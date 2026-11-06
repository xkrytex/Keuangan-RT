import { panggil } from './api.js';
import { KAS, NAMA_KAS, akhirBulan, geserPeriode, hariIniWIB, namaBulan, periodeIni, rupiah, tanggalPendek, tanggalSedang } from './format.js';
import { el, ikonKas, selesaiMemuat, tampilkanGalat, tampilkanMemuat } from './ui.js';

const form = document.getElementById('pilih-laporan');
const pilihBulan = document.getElementById('laporan-bulan');
const pilihTahun = document.getElementById('laporan-tahun');
const kolomBulan = document.getElementById('kolom-bulan');
const kolomTahun = document.getElementById('kolom-tahun');
const tombolCetak = document.getElementById('tombol-cetak');
const tautanSheet = document.getElementById('tautan-sheet');
const wadah = document.getElementById('laporan');

const JUMLAH_BULAN_PILIHAN = 36;
const JUMLAH_TAHUN_PILIHAN = 5;
// Angka di tabel ditulis tanpa "Rp" (cukup disebut sekali di atas laporan) agar empat kolom muat di HP.
const angka = new Intl.NumberFormat('id-ID');
const sel = (n) => (n ? angka.format(n) : '–');

function jenis() {
  return form.querySelector('input[name=jenis]:checked').value;
}

function isiPilihan() {
  const sekarang = periodeIni();
  for (let i = 0; i < JUMLAH_BULAN_PILIHAN; i++) {
    const p = geserPeriode(sekarang, -i);
    pilihBulan.append(el('option', { value: p, text: namaBulan(p) + (i === 0 ? ' (berjalan)' : '') }));
  }
  const tahun = Number(sekarang.slice(0, 4));
  for (let i = 0; i < JUMLAH_TAHUN_PILIHAN; i++) {
    pilihTahun.append(el('option', { value: String(tahun - i), text: String(tahun - i) }));
  }
}

function kop() {
  return el('header', { class: 'kop hanya-cetak' },
    el('img', { src: 'img/logo.svg', width: '56', height: '56', alt: '' }),
    el('div', {},
      el('p', { class: 'kop-judul', text: 'RUKUN TETANGGA 05 RUKUN WARGA 02' }),
      el('p', { text: 'Donglo Santren, Kedung Sugo' })));
}

function tandaTangan() {
  const kolom = (jabatan) => el('div', { class: 'ttd-kolom' },
    el('p', { text: jabatan }), el('p', { class: 'ttd-nama', text: '(................................)' }));
  return el('footer', { class: 'ttd hanya-cetak' },
    el('p', { class: 'ttd-tempat', text: `Donglo Santren, ${tanggalSedang(hariIniWIB())}` }),
    el('div', { class: 'ttd-baris' }, kolom('Ketua RT'), kolom('Bendahara')));
}

function angkaKas(r) {
  const item = (label, nilai, kelas = '') => el('div', { class: kelas }, el('dt', { text: label }), el('dd', { class: 'angka', text: rupiah(nilai) }));
  return el('dl', { class: 'laporan-angka' },
    item('Saldo awal', r.saldo_awal),
    item('Pemasukan', r.total_masuk, 'arah-masuk'),
    item('Pengeluaran', r.total_keluar, 'arah-keluar'),
    item('Saldo akhir', r.saldo_akhir, 'laporan-akhir'));
}

// Saldo awal yang dicatat di bulan ini sudah masuk ke angka "Saldo awal" di atas, bukan ke Pemasukan.
// Tetap disebut beserta tautannya agar warga bisa menelusuri asal angkanya.
function catatanSaldoAwal(r) {
  if (!r.saldo_awal_dicatat || !r.saldo_awal_dicatat.length) return null;
  return el('p', { class: 'laporan-catatan' }, 'Saldo awal sudah termasuk ',
    ...r.saldo_awal_dicatat.flatMap((t, i) => [
      i ? ' dan ' : '',
      el('a', { href: `detail.html?id=${encodeURIComponent(t.id)}`, text: t.uraian }),
      ` (${tanggalSedang(t.tanggal)}, ${rupiah(t.nominal)})`,
    ]),
    '.');
}

function keterangan(t) {
  const lawan = t.kas_lawan ? `${t.masuk ? 'Dari' : 'Ke'} ${NAMA_KAS[t.kas_lawan]}` : t.kategori;
  // Tautan membungkus keterangan dan kategori agar area sentuhnya setinggi isi sel, bukan hanya satu baris teks.
  return el('a', { class: 'laporan-tautan', href: `detail.html?id=${encodeURIComponent(t.id)}` },
    el('span', { class: 'laporan-uraian', text: t.uraian }),
    el('span', { class: 'laporan-kategori', text: lawan }));
}

// Tabel angka tidak bisa menyempit tanpa rusak (WCAG 1.4.10 mengecualikan tabel data), jadi saat huruf
// diperbesar tabelnya yang digeser ke samping, bukan halamannya. tabindex agar bisa digeser dengan papan ketik.
function gulir(label, tabel) {
  return el('div', { class: 'tabel-gulir', tabindex: '0', role: 'region', 'aria-label': label }, tabel);
}

function tabelBulan(kas, r, periode) {
  if (!r.transaksi.length) {
    return el('p', { class: 'keadaan', text: `Tidak ada transaksi ${NAMA_KAS[kas]} di ${namaBulan(periode)}.` });
  }
  const judul = `Transaksi ${NAMA_KAS[kas]} ${namaBulan(periode)}, dalam rupiah`;
  return gulir(judul, el('table', { class: 'tabel-laporan' },
    el('caption', { class: 'sr-only', text: judul }),
    el('thead', {}, el('tr', {},
      el('th', { scope: 'col', text: 'Tanggal' }), el('th', { scope: 'col', text: 'Keterangan' }),
      el('th', { scope: 'col', class: 'angka', text: 'Masuk' }), el('th', { scope: 'col', class: 'angka', text: 'Keluar' }))),
    el('tbody', {}, r.transaksi.map((t) => el('tr', {},
      el('td', { class: 'laporan-tanggal', text: tanggalPendek(t.tanggal).replace(/ \d{4}$/, '') }),
      el('td', {}, keterangan(t)),
      el('td', { class: 'angka', text: sel(t.masuk) }),
      el('td', { class: 'angka', text: sel(t.keluar) })))),
    el('tfoot', {}, el('tr', {},
      el('th', { scope: 'row', colspan: '2', text: 'Jumlah' }),
      el('td', { class: 'angka', text: sel(r.total_masuk) }),
      el('td', { class: 'angka', text: sel(r.total_keluar) })))));
}

function statusBulan(d) {
  if (d.status === 'TUTUP') return 'Buku bulan ini sudah ditutup. Angkanya tidak akan berubah lagi.';
  if (d.periode === periodeIni()) return 'Bulan ini masih berjalan. Angka akan bertambah selama ada transaksi baru.';
  return 'Buku bulan ini belum ditutup pengurus. Angka masih bisa berubah kalau ada koreksi.';
}

function tampilkanBulanan(d) {
  const total = KAS.reduce((n, k) => n + d.kas[k].saldo_akhir, 0);
  // Tanggalnya disebut, karena saldo akhir bulan lalu wajar berbeda dengan saldo hari ini di beranda.
  const per = d.periode === periodeIni()
    ? `per hari ini, ${tanggalSedang(hariIniWIB())}`
    : `per ${tanggalSedang(akhirBulan(d.periode))}`;
  selesaiMemuat(wadah,
    kop(),
    el('h2', { class: 'laporan-judul', text: `Laporan Keuangan ${namaBulan(d.periode)}` }),
    el('p', { class: 'laporan-status', text: statusBulan(d) }),
    el('p', { class: 'laporan-status', text: 'Angka di tabel dalam rupiah.' }),
    el('p', { class: 'laporan-total' }, `Saldo ketiga kas ${per}: `, el('strong', { class: 'angka', text: rupiah(total) })),
    ...KAS.map((kas) => el('section', { class: 'laporan-kas', 'aria-labelledby': `judul-${kas}` },
      el('h3', { id: `judul-${kas}`, class: 'laporan-kas-judul' }, ikonKas(kas), NAMA_KAS[kas]),
      angkaKas(d.kas[kas]),
      catatanSaldoAwal(d.kas[kas]),
      tabelBulan(kas, d.kas[kas], d.periode))),
    tandaTangan());
}

function tampilkanTahunan(d) {
  const sekarang = periodeIni();
  // Bulan yang belum datang tidak ditampilkan agar saldo akhirnya tidak terbaca sebagai angka pasti.
  const bulan = d.bulan.filter((b) => b.periode <= sekarang);
  // Tahun sebelum pembukuan dimulai berisi nol semua; tabel nol tidak memberi informasi.
  const adaIsi = bulan.some((b) => KAS.some((k) => b.kas[k].masuk || b.kas[k].keluar || b.kas[k].saldo_akhir));
  const ditutup = d.periode_terakhir_ditutup;
  selesaiMemuat(wadah,
    kop(),
    el('h2', { class: 'laporan-judul', text: `Rekap Keuangan Tahun ${d.tahun}` }),
    el('p', { class: 'laporan-status', text: ditutup
      ? `Buku sudah ditutup sampai ${namaBulan(ditutup)}. Bulan sesudahnya masih bisa berubah.`
      : 'Belum ada bulan yang ditutup bukunya. Angka masih bisa berubah kalau ada koreksi.' }),
    adaIsi ? el('p', { class: 'laporan-status', text: 'Angka di tabel dalam rupiah.' }) : null,
    !bulan.length ? el('p', { class: 'keadaan', text: `Tahun ${d.tahun} belum dimulai.` }) : null,
    bulan.length && !adaIsi ? el('p', { class: 'keadaan', text: `Belum ada transaksi di tahun ${d.tahun}.` }) : null,
    ...(adaIsi ? KAS.map((kas) => {
      const masuk = bulan.reduce((n, b) => n + b.kas[kas].masuk, 0);
      const keluar = bulan.reduce((n, b) => n + b.kas[kas].keluar, 0);
      const judul = `Rekap ${NAMA_KAS[kas]} tahun ${d.tahun}, dalam rupiah`;
      return el('section', { class: 'laporan-kas', 'aria-labelledby': `judul-${kas}` },
        el('h3', { id: `judul-${kas}`, class: 'laporan-kas-judul' }, ikonKas(kas), NAMA_KAS[kas]),
        gulir(judul, el('table', { class: 'tabel-laporan' },
          el('caption', { class: 'sr-only', text: judul }),
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col', text: 'Bulan' }), el('th', { scope: 'col', class: 'angka', text: 'Masuk' }),
            el('th', { scope: 'col', class: 'angka', text: 'Keluar' }), el('th', { scope: 'col', class: 'angka', text: 'Saldo akhir' }))),
          el('tbody', {}, bulan.map((b) => el('tr', {},
            el('th', { scope: 'row', text: namaBulan(b.periode).split(' ')[0] }),
            el('td', { class: 'angka', text: sel(b.kas[kas].masuk) }),
            el('td', { class: 'angka', text: sel(b.kas[kas].keluar) }),
            el('td', { class: 'angka', text: angka.format(b.kas[kas].saldo_akhir) })))),
          el('tfoot', {}, el('tr', {},
            el('th', { scope: 'row', text: 'Jumlah' }),
            el('td', { class: 'angka', text: sel(masuk) }),
            el('td', { class: 'angka', text: sel(keluar) }),
            el('td', { class: 'angka', text: angka.format(bulan[bulan.length - 1].kas[kas].saldo_akhir) }))))));
    }) : []),
    adaIsi ? tandaTangan() : null);
}

let urutan = 0;

async function muat() {
  const nomor = ++urutan;
  const bulanan = jenis() === 'bulanan';
  kolomBulan.hidden = !bulanan;
  kolomTahun.hidden = bulanan;
  history.replaceState(null, '', bulanan ? `?bulan=${pilihBulan.value}` : `?tahun=${pilihTahun.value}`);
  tombolCetak.disabled = true;
  tampilkanMemuat(wadah, 'Memuat laporan…');
  let d;
  try {
    d = await panggil('laporan', bulanan ? { periode: pilihBulan.value } : { tahun: pilihTahun.value });
  } catch (err) {
    if (nomor !== urutan) return;
    tampilkanGalat(wadah, 'Laporan belum bisa dimuat. ' + err.message, muat);
    return;
  }
  if (nomor !== urutan) return;
  document.title = `${bulanan ? 'Laporan ' + namaBulan(d.periode) : 'Rekap ' + d.tahun} · Kas RT 05 RW 02`;
  tautanSheet.hidden = !d.url_laporan;
  if (d.url_laporan) tautanSheet.href = d.url_laporan;
  if (bulanan) tampilkanBulanan(d);
  else tampilkanTahunan(d);
  tombolCetak.disabled = false;
}

isiPilihan();
// Bawaan: bulan lalu, karena laporan biasanya dibaca setelah bulannya selesai.
const q = new URLSearchParams(location.search);
const ada = (pilih, nilai) => [...pilih.options].some((o) => o.value === nilai);
pilihBulan.value = ada(pilihBulan, q.get('bulan')) ? q.get('bulan') : geserPeriode(periodeIni(), -1);
if (ada(pilihTahun, q.get('tahun'))) {
  pilihTahun.value = q.get('tahun');
  form.querySelector('input[value=tahunan]').checked = true;
}
form.addEventListener('change', muat);
form.addEventListener('submit', (e) => e.preventDefault());
tombolCetak.addEventListener('click', () => window.print());
muat();
