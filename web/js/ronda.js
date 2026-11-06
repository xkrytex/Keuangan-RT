import { panggil } from './api.js';
import { rupiah, tanggalPanjang } from './format.js';
import { adaSalah, bacaNominal, hariIniWIB, kosongkanPesan, pasangInputNominal, tampilkanPesan, tombolSibuk } from './form.js';
import { el } from './ui.js';

// Sesi ronda terpisah dari sesi pengurus dan hanya berlaku 1 jam di server.
const KUNCI_SESI = 'sesi-ronda';
const KUNCI_NAMA = 'nama-petugas';
const NOMINAL_MAKS = 1000000;

const tampilanPin = document.getElementById('tampilan-pin');
const tampilanCatat = document.getElementById('tampilan-catat');
const tombolKeluar = document.getElementById('keluar-ronda');
const formPin = document.getElementById('form-pin');
const pesanPin = document.getElementById('pesan-pin');
const inputPin = document.getElementById('pin');
const formCatat = document.getElementById('form-catat');
const pesanCatat = document.getElementById('pesan-catat');
const petugas = document.getElementById('catat-petugas');
const nominal = document.getElementById('catat-nominal');

function simpan(penyimpanan, kunci, nilai) {
  try {
    if (nilai) penyimpanan.setItem(kunci, nilai);
    else penyimpanan.removeItem(kunci);
  } catch (err) {
    // Penyimpanan diblokir (mode privat): sesi tetap jalan selama halaman tidak dimuat ulang.
  }
}

function baca(penyimpanan, kunci) {
  try {
    return penyimpanan.getItem(kunci) || '';
  } catch (err) {
    return '';
  }
}

let token = baca(sessionStorage, KUNCI_SESI);

function aturToken(baru) {
  token = baru;
  simpan(sessionStorage, KUNCI_SESI, baru);
}

function geserTanggal(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function jamWIB() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
}

// Label tanggal dihitung ulang setiap form ditampilkan, karena petugas sering membuka halaman ini lewat tengah malam.
function siapkanPilihanMalam() {
  const hariIni = hariIniWIB();
  document.getElementById('label-malam-0').textContent = `Hari ini, ${tanggalPanjang(hariIni)}`;
  document.getElementById('label-malam-1').textContent = `Kemarin, ${tanggalPanjang(geserTanggal(hariIni, -1))}`;
  if (!formCatat.querySelector('input[name=malam]:checked')) {
    // Sebelum tengah hari, uang yang dihitung hampir pasti hasil ronda tadi malam.
    formCatat.querySelector(`input[name=malam][value="${jamWIB() < 12 ? -1 : 0}"]`).checked = true;
  }
}

function keFormPin(pesan) {
  aturToken('');
  tampilanCatat.hidden = true;
  tampilanPin.hidden = false;
  if (pesan) tampilkanPesan(pesanPin, 'galat', pesan);
  inputPin.focus();
}

function keFormCatat() {
  tampilanPin.hidden = true;
  tampilanCatat.hidden = false;
  siapkanPilihanMalam();
  if (!petugas.value) petugas.value = baca(localStorage, KUNCI_NAMA);
}

formPin.addEventListener('submit', async (e) => {
  e.preventDefault();
  kosongkanPesan(pesanPin);
  if (adaSalah(formPin, [[inputPin, /^\d{6}$/.test(inputPin.value) ? '' : 'PIN harus 6 angka.']])) return;
  const tombol = formPin.querySelector('button[type=submit]');
  tombolSibuk(tombol, true, 'Memeriksa…');
  try {
    const r = await panggil('loginRonda', { pin: inputPin.value });
    aturToken(r.token);
    formPin.reset();
    keFormCatat();
    document.getElementById('judul-catat').focus();
  } catch (err) {
    tampilkanPesan(pesanPin, 'galat', err.message);
    inputPin.value = '';
    inputPin.focus();
  } finally {
    tombolSibuk(tombol, false);
  }
});

formCatat.addEventListener('submit', async (e) => {
  e.preventDefault();
  kosongkanPesan(pesanCatat);
  siapkanPilihanMalam();
  const n = bacaNominal(nominal);
  const nama = petugas.value.trim();
  if (adaSalah(formCatat, [
    [petugas, nama.length < 2 ? 'Isi nama petugas, minimal 2 huruf.' : ''],
    [nominal, n < 1 ? 'Isi jumlah uang.' : n > NOMINAL_MAKS ? `Jumlah maksimal ${rupiah(NOMINAL_MAKS)} per malam.` : ''],
  ])) return;

  const geser = Number(formCatat.querySelector('input[name=malam]:checked').value);
  const tombol = formCatat.querySelector('button[type=submit]');
  tombolSibuk(tombol, true, 'Menyimpan…');
  try {
    const t = await panggil('catatJimpitan', { tanggal: geserTanggal(hariIniWIB(), geser), nama_petugas: nama, nominal: n }, token);
    simpan(localStorage, KUNCI_NAMA, nama);
    nominal.value = '';
    tampilkanPesan(pesanCatat, 'berhasil', `Tersimpan: ${t.uraian}, ${rupiah(t.nominal)}. Terima kasih.`,
      el('a', { href: `detail.html?id=${encodeURIComponent(t.id)}`, text: 'Lihat catatan ini' }));
    pesanCatat.scrollIntoView({ block: 'nearest' });
  } catch (err) {
    // Isian form dibiarkan, jadi setelah memasukkan PIN lagi petugas tinggal menekan Simpan.
    if (err.kode === 'SESI_HABIS') keFormPin('Sesi petugas sudah habis atau PIN baru saja diganti. Masukkan PIN lagi, lalu simpan ulang.');
    else {
      tampilkanPesan(pesanCatat, 'galat', err.message);
      pesanCatat.scrollIntoView({ block: 'nearest' });
    }
  } finally {
    tombolSibuk(tombol, false);
  }
});

tombolKeluar.addEventListener('click', async () => {
  try {
    await panggil('logoutRonda', {}, token);
  } catch (err) {
    // Sesi di server mungkin sudah habis; token di HP tetap dihapus.
  }
  kosongkanPesan(pesanCatat);
  keFormPin();
});

pasangInputNominal(nominal);
if (token) keFormCatat();
else keFormPin();
