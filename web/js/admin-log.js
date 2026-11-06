import { panggilAdmin } from './sesi.js';
import { waktu } from './format.js';
import { el, navigasiHalaman, selesaiMemuat, tampilkanGalat, tampilkanKosong, tampilkanMemuat } from './ui.js';

const wadah = document.getElementById('log-hasil');
const NAMA_AKSI = {
  LOGIN: 'Masuk',
  LOGIN_GAGAL: 'Gagal masuk',
  LOGIN_RONDA: 'Petugas ronda masuk',
  CATAT: 'Mencatat transaksi',
  BATAL: 'Membatalkan transaksi',
  GANTI_PASSWORD: 'Mengganti password',
  TAMBAH_ADMIN: 'Menambah pengurus',
  RESET_PASSWORD: 'Mereset password pengurus',
  NONAKTIFKAN_ADMIN: 'Menonaktifkan pengurus',
  AKTIFKAN_ADMIN: 'Mengaktifkan pengurus',
  GANTI_PIN_RONDA: 'Mengganti PIN ronda',
  TUTUP_BUKU: 'Menutup buku',
  BUKA_BUKU: 'Membuka kembali buku',
  TULIS_LAPORAN: 'Menulis laporan ke spreadsheet',
};
let halaman = 1;

function barisLog(l) {
  const terkait = l.id_terkait && l.id_terkait.startsWith('TRX-')
    ? el('a', { href: `detail.html?id=${encodeURIComponent(l.id_terkait)}`, text: l.id_terkait })
    : l.id_terkait;
  return el('li', { class: 'log' + (l.aksi === 'LOGIN_GAGAL' ? ' log-peringatan' : '') },
    el('p', { class: 'log-atas' },
      el('strong', { text: NAMA_AKSI[l.aksi] || l.aksi }),
      el('span', { class: 'log-waktu', text: waktu(l.waktu) })),
    el('p', { class: 'log-meta' }, 'Oleh ', el('span', { text: l.pelaku }), terkait ? ' · ' : null, terkait || null),
    l.detail ? el('p', { class: 'log-detail', text: l.detail }) : null);
}

export async function muatLog() {
  tampilkanMemuat(wadah, 'Memuat log aktivitas…');
  let r;
  try {
    r = await panggilAdmin('log', { halaman });
  } catch (err) {
    tampilkanGalat(wadah, 'Log belum bisa dimuat. ' + err.message, muatLog);
    return;
  }
  if (!r.item.length) {
    tampilkanKosong(wadah, 'Belum ada aktivitas yang tercatat.');
    return;
  }
  selesaiMemuat(wadah, el('ul', { class: 'daftar-log', role: 'list' }, r.item.map(barisLog)),
    navigasiHalaman(r.halaman, r.jumlah_halaman, (h) => {
      halaman = h;
      muatLog();
      document.getElementById('judul-log').focus();
    }));
}
