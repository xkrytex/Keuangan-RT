import { panggil } from './api.js';
import { KAS, NAMA_KAS, namaBulan, rupiah, tanggalSedang, waktu } from './format.js';
import { daftarTransaksi, el, ikonKas, selesaiMemuat, tampilkanGalat, tampilkanKosong, tampilkanMemuat } from './ui.js';

const wadahSaldo = document.getElementById('saldo');
const wadahTerbaru = document.getElementById('terbaru');
const diperbarui = document.getElementById('diperbarui');
const statusBuku = document.getElementById('status-buku');

function kartuKas(kas, r) {
  const bulan = r.bulan_ini[kas];
  return el('li', { class: 'kartu-kas' },
    el('h2', { class: 'kartu-kas-nama' }, ikonKas(kas), NAMA_KAS[kas]),
    el('p', { class: 'kartu-kas-saldo angka', text: rupiah(r.saldo[kas]) }),
    el('p', { class: 'kartu-kas-bulan' },
      el('span', { class: 'kartu-kas-bulan-judul', text: namaBulan(r.periode) }),
      el('span', { class: 'angka arah-masuk', text: 'Masuk + ' + rupiah(bulan.masuk) }),
      el('span', { class: 'angka arah-keluar', text: 'Keluar − ' + rupiah(bulan.keluar) })));
}

async function muat() {
  tampilkanMemuat(wadahSaldo, 'Memuat saldo kas…');
  tampilkanMemuat(wadahTerbaru, 'Memuat transaksi terbaru…');
  let r;
  try {
    r = await panggil('ringkasan');
  } catch (err) {
    const pesan = 'Saldo belum bisa dimuat. ' + err.message;
    tampilkanGalat(wadahSaldo, pesan, muat);
    tampilkanKosong(wadahTerbaru, 'Transaksi terbaru akan tampil setelah saldo berhasil dimuat.');
    return;
  }

  diperbarui.textContent = 'Diperbarui ' + waktu(r.diperbarui);
  statusBuku.textContent = r.periode_terakhir_ditutup
    ? `Buku sudah ditutup sampai ${namaBulan(r.periode_terakhir_ditutup)}.`
    : 'Belum ada bulan yang ditutup bukunya.';

  selesaiMemuat(wadahSaldo,
    el('div', { class: 'pita-total' },
      el('p', { class: 'pita-total-judul', text: `Saldo total ketiga kas per hari ini, ${tanggalSedang(r.diperbarui)}` }),
      el('p', { class: 'pita-total-angka angka', text: rupiah(r.saldo_total) })),
    el('ul', { class: 'daftar-kas', role: 'list' }, KAS.map((kas) => kartuKas(kas, r))));

  if (!r.terbaru.length) {
    tampilkanKosong(wadahTerbaru, 'Belum ada transaksi yang dicatat. Pengurus akan mulai dari saldo awal setiap kas.');
    return;
  }
  selesaiMemuat(wadahTerbaru, daftarTransaksi(r.terbaru),
    el('p', { class: 'tautan-lanjut' }, el('a', { href: 'transaksi.html', text: 'Lihat semua transaksi' })));
}

muat();
