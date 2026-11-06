import { panggil } from './api.js';
import { bukaKonfirmasi } from './dialog.js';
import { KAS, NAMA_KAS, geserPeriode, namaBulan, periodeIni, rupiah, waktu } from './format.js';
import { kosongkanPesan, tampilkanPesan, tombolSibuk } from './form.js';
import { panggilAdmin } from './sesi.js';
import { el, selesaiMemuat, tampilkanGalat, tampilkanKosong, tampilkanMemuat } from './ui.js';

const wadahStatus = document.getElementById('buku-status');
const wadahRiwayat = document.getElementById('buku-riwayat');
const formSheet = document.getElementById('form-sheet');
const pesanSheet = document.getElementById('pesan-sheet');
const pilihBulan = document.getElementById('sheet-bulan');

function ringkasSaldo(kas) {
  return el('dl', { class: 'ringkas-dialog' }, KAS.flatMap((k) => [
    el('dt', { text: NAMA_KAS[k] }),
    el('dd', { class: 'angka', text: `saldo akhir ${rupiah(kas[k].saldo_akhir)}` }),
  ]));
}

async function tutupBuku(periode, tombol) {
  tombolSibuk(tombol, true, 'Menyiapkan…');
  let lap;
  try {
    lap = await panggil('laporan', { periode });
  } catch (err) {
    tampilkanPesan(wadahStatus.querySelector('.pesan-buku'), 'galat', 'Ringkasan bulan belum bisa dimuat. ' + err.message);
    return;
  } finally {
    tombolSibuk(tombol, false);
  }
  const ditutup = await bukaKonfirmasi({
    judul: `Tutup buku ${namaBulan(periode)}?`,
    isi: [
      ringkasSaldo(lap.kas),
      el('p', { class: 'bantuan', text: `Setelah ditutup, transaksi bertanggal ${namaBulan(periode)} tidak bisa dicatat atau dibatalkan lagi. Kalau ternyata ada yang salah, buku bisa dibuka kembali dengan alasan.` }),
    ],
    teksYa: 'Tutup buku',
    aksi: () => panggilAdmin('tutupBuku', { periode }),
  });
  if (ditutup) {
    await muatBuku();
    tampilkanPesan(wadahStatus.querySelector('.pesan-buku'), 'berhasil',
      `Buku ${namaBulan(periode)} sudah ditutup dan laporannya ditulis ke Google Sheets.`,
      el('a', { href: `laporan.html?bulan=${periode}`, text: `Lihat laporan ${namaBulan(periode)}` }));
  } else {
    tombol.focus();
  }
}

async function bukaBuku(periode, tombol) {
  const dibuka = await bukaKonfirmasi({
    judul: `Buka kembali buku ${namaBulan(periode)}?`,
    isi: [el('p', { class: 'bantuan', text: 'Transaksi bulan itu bisa dicatat dan dibatalkan lagi. Alasan Anda tercatat di riwayat tutup buku dan log aktivitas. Setelah koreksi selesai, tutup lagi bukunya.' })],
    alasan: { label: 'Alasan membuka kembali', pesanKurang: 'Tulis alasan minimal 5 karakter.' },
    teksYa: 'Buka kembali',
    bahaya: true,
    aksi: (alasan) => panggilAdmin('bukaBuku', { periode, alasan }),
  });
  if (dibuka) {
    await muatBuku();
    tampilkanPesan(wadahStatus.querySelector('.pesan-buku'), 'berhasil', `Buku ${namaBulan(periode)} dibuka kembali.`);
  } else {
    tombol.focus();
  }
}

function kartuStatus(s) {
  const isi = [el('div', { class: 'pesan-buku' })];
  isi.push(el('p', {}, s.terakhir
    ? ['Buku terakhir yang ditutup: ', el('strong', { text: namaBulan(s.terakhir) })]
    : 'Belum ada buku yang ditutup.'));

  if (!s.berikut) {
    isi.push(el('p', { class: 'bantuan', text: 'Belum ada transaksi, jadi belum ada buku yang bisa ditutup.' }));
  } else if (s.bisa_ditutup) {
    const tombol = el('button', { type: 'button', class: 'tombol', text: `Tutup buku ${namaBulan(s.berikut)}` });
    tombol.addEventListener('click', () => tutupBuku(s.berikut, tombol));
    isi.push(
      el('p', { class: 'bantuan' }, 'Periksa dulu ',
        el('a', { href: `laporan.html?bulan=${s.berikut}`, text: `laporan ${namaBulan(s.berikut)}` }),
        ' sebelum menutup bukunya.'),
      tombol);
  } else {
    isi.push(el('p', { class: 'bantuan', text: `${namaBulan(s.berikut)} masih berjalan. Bukunya bisa ditutup mulai 1 ${namaBulan(geserPeriode(s.berikut, 1))}.` }));
  }

  if (s.terakhir) {
    const tombolBuka = el('button', { type: 'button', class: 'tombol tombol-sekunder tombol-bahaya-garis', text: `Buka kembali buku ${namaBulan(s.terakhir)}` });
    tombolBuka.addEventListener('click', () => bukaBuku(s.terakhir, tombolBuka));
    isi.push(el('div', { class: 'buku-buka' },
      el('p', { class: 'bantuan', text: 'Hanya buku bulan terakhir yang ditutup yang bisa dibuka kembali, dan wajib dengan alasan.' }),
      tombolBuka));
  }
  return el('div', { class: 'kartu-form' }, ...isi);
}

function daftarRiwayat(riwayat) {
  if (!riwayat.length) return null;
  return el('ul', { class: 'daftar-log', role: 'list' }, riwayat.map((r) => el('li', { class: 'log' },
    el('p', { class: 'log-atas' },
      el('strong', { text: namaBulan(r.periode) }),
      el('span', { class: 'label-status' + (r.status === 'TUTUP' ? ' label-tutup' : ''), text: r.status === 'TUTUP' ? 'Ditutup' : 'Dibuka kembali' })),
    el('p', { class: 'log-meta', text: `Ditutup oleh ${r.ditutup_oleh}, ${waktu(r.ditutup_pada)}` }),
    r.status !== 'TUTUP' ? el('p', { class: 'log-detail', text: `Dibuka kembali oleh ${r.dibuka_oleh}, ${waktu(r.dibuka_pada)}. Alasan: ${r.alasan_buka}` }) : null)));
}

export async function muatBuku() {
  tampilkanMemuat(wadahStatus, 'Memeriksa status buku…');
  tampilkanMemuat(wadahRiwayat, 'Memuat riwayat tutup buku…');
  let s;
  try {
    s = await panggilAdmin('statusBuku');
  } catch (err) {
    tampilkanGalat(wadahStatus, 'Status buku belum bisa dimuat. ' + err.message, muatBuku);
    // Tombol Coba lagi di atas memuat ulang keduanya, jadi di sini cukup keterangan.
    selesaiMemuat(wadahRiwayat, el('p', { class: 'keadaan', text: 'Riwayat ikut tampil setelah status buku berhasil dimuat.' }));
    return;
  }
  selesaiMemuat(wadahStatus, kartuStatus(s));
  const riwayat = daftarRiwayat(s.riwayat);
  if (riwayat) selesaiMemuat(wadahRiwayat, riwayat);
  else tampilkanKosong(wadahRiwayat, 'Belum ada riwayat tutup buku.');
}

formSheet.addEventListener('submit', async (e) => {
  e.preventDefault();
  kosongkanPesan(pesanSheet);
  const tombol = formSheet.querySelector('button[type=submit]');
  tombolSibuk(tombol, true, 'Menulis laporan…');
  try {
    const r = await panggilAdmin('tulisLaporan', { periode: pilihBulan.value });
    tampilkanPesan(pesanSheet, 'berhasil', `Laporan ${namaBulan(r.periode)} sudah ditulis ulang.`,
      r.url ? el('a', { href: r.url, target: '_blank', rel: 'noopener', text: 'Buka Google Sheets' }) : null);
  } catch (err) {
    tampilkanPesan(pesanSheet, 'galat', err.message);
  } finally {
    tombolSibuk(tombol, false);
  }
});

export function siapkanBuku() {
  const sekarang = periodeIni();
  for (let i = 1; i <= 24; i++) {
    const p = geserPeriode(sekarang, -i);
    pilihBulan.append(el('option', { value: p, text: namaBulan(p) }));
  }
}
