import { GalatApi, panggil } from './api.js';

// sessionStorage: sesi hilang saat tab ditutup, cocok untuk HP yang mungkin dipinjam orang lain.
// Modul ini dimuat di semua halaman, jadi tombol Keluar di menu tampil di halaman mana pun selama sesi pengurus ada.
const KUNCI = 'sesi-admin';
const tombolKeluar = document.getElementById('tombol-keluar');
let saatHabis = () => {};

function perbaruiTombolKeluar() {
  if (tombolKeluar) tombolKeluar.hidden = !tokenMemori;
}

export function ambilToken() {
  try {
    return sessionStorage.getItem(KUNCI) || '';
  } catch (err) {
    return '';
  }
}

export function simpanToken(token) {
  try {
    sessionStorage.setItem(KUNCI, token);
  } catch (err) {
    // Tanpa sessionStorage sesi tetap jalan selama halaman tidak dimuat ulang.
  }
  tokenMemori = token;
  perbaruiTombolKeluar();
}

export function hapusToken() {
  tokenMemori = '';
  perbaruiTombolKeluar();
  try {
    sessionStorage.removeItem(KUNCI);
  } catch (err) {
    // Tidak ada yang perlu dihapus.
  }
}

let tokenMemori = ambilToken();

export function aturSaatSesiHabis(fn) {
  saatHabis = fn;
}

export async function panggilAdmin(aksi, data = {}) {
  try {
    return await panggil(aksi, data, tokenMemori);
  } catch (err) {
    if (err instanceof GalatApi && (err.kode === 'SESI_HABIS' || err.kode === 'WAJIB_GANTI')) {
      if (err.kode === 'SESI_HABIS') hapusToken();
      saatHabis(err);
    }
    throw err;
  }
}

export function token() {
  return tokenMemori;
}

tombolKeluar?.addEventListener('click', async () => {
  tombolKeluar.disabled = true;
  try {
    await panggil('logout', {}, tokenMemori);
  } catch (err) {
    // Sesi di server mungkin sudah habis; token di tab ini tetap dihapus.
  }
  hapusToken();
  location.href = 'admin.html';
});

perbaruiTombolKeluar();
