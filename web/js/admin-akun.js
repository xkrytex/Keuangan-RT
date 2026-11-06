import { bukaKonfirmasi } from './dialog.js';
import { adaSalah, kosongkanPesan, tampilkanPesan, tombolSibuk } from './form.js';
import { formGantiPassword } from './admin-password.js';
import { panggilAdmin } from './sesi.js';
import { el, selesaiMemuat, tampilkanGalat, tampilkanMemuat } from './ui.js';

const wadahPengurus = document.getElementById('daftar-pengurus');
const formTambah = document.getElementById('form-tambah');
const pesanTambah = document.getElementById('pesan-tambah');
const formPin = document.getElementById('form-pin');
const pesanPin = document.getElementById('pesan-pin');
let sesiSekarang = () => null;

// Password sementara hanya dikirim server sekali, jadi ditampilkan jelas dengan tombol salin.
function kotakPasswordSementara(judul, username, sandi) {
  const salin = el('button', { type: 'button', class: 'tombol tombol-sekunder tombol-kecil', text: 'Salin password' });
  salin.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(sandi);
      salin.textContent = 'Tersalin';
    } catch (err) {
      salin.textContent = 'Salin manual';
    }
  });
  return el('div', { class: 'kotak-pesan kotak-berhasil', role: 'status' },
    el('p', { class: 'kotak-judul', text: judul }),
    el('p', {}, 'Username: ', el('strong', { text: username })),
    el('p', {}, 'Password sementara: ', el('strong', { class: 'sandi', text: sandi })),
    salin,
    el('p', { class: 'bantuan', text: 'Berikan langsung ke orangnya, jangan lewat grup. Password ini hanya tampil sekali dan wajib diganti saat ia pertama kali masuk.' }));
}

function tombolAksi(teks, fn, bahaya = false) {
  const b = el('button', { type: 'button', class: 'tombol tombol-sekunder tombol-kecil' + (bahaya ? ' tombol-bahaya-garis' : ''), text: teks });
  b.addEventListener('click', fn);
  return b;
}

function barisPengurus(a, saya) {
  const diriSendiri = saya && a.username === saya.username;
  const aksi = [];
  if (!diriSendiri) {
    aksi.push(tombolAksi('Reset password', async () => {
      let hasil = null;
      await bukaKonfirmasi({
        judul: `Reset password ${a.nama}?`,
        isi: [el('p', { text: 'Password lama langsung tidak berlaku dan ia akan keluar dari semua perangkat. Anda akan menerima password sementara untuk diberikan kepadanya.' })],
        teksYa: 'Reset password',
        aksi: async () => { hasil = await panggilAdmin('resetPasswordAdmin', { username: a.username }); return true; },
      });
      if (hasil) {
        await muatPengurus();
        wadahPengurus.prepend(kotakPasswordSementara(`Password ${a.nama} sudah direset.`, hasil.username, hasil.password_sementara));
      }
    }));
    if (a.aktif) {
      aksi.push(tombolAksi('Nonaktifkan', async () => {
        const ok = await bukaKonfirmasi({
          judul: `Nonaktifkan ${a.nama}?`,
          isi: [el('p', { text: 'Ia tidak bisa masuk lagi sampai diaktifkan kembali. Transaksi yang pernah ia catat tetap ada.' })],
          teksYa: 'Nonaktifkan',
          bahaya: true,
          aksi: () => panggilAdmin('nonaktifkanAdmin', { username: a.username }),
        });
        if (ok) muatPengurus();
      }, true));
    } else {
      aksi.push(tombolAksi('Aktifkan lagi', async () => {
        const ok = await bukaKonfirmasi({
          judul: `Aktifkan lagi ${a.nama}?`,
          isi: [el('p', { text: 'Ia bisa masuk lagi dengan password terakhirnya.' })],
          teksYa: 'Aktifkan',
          aksi: () => panggilAdmin('aktifkanAdmin', { username: a.username }),
        });
        if (ok) muatPengurus();
      }));
    }
  }
  return el('li', { class: 'pengurus' + (a.aktif ? '' : ' pengurus-nonaktif') },
    el('div', { class: 'pengurus-isi' },
      el('p', { class: 'pengurus-nama' }, a.nama, diriSendiri ? el('span', { class: 'label-jenis', text: 'Anda' }) : null,
        a.aktif ? null : el('span', { class: 'label-status', text: 'Nonaktif' })),
      el('p', { class: 'pengurus-meta', text: `${a.jabatan} · username ${a.username}` })),
    aksi.length ? el('div', { class: 'pengurus-aksi' }, ...aksi) : null);
}

export async function muatPengurus() {
  tampilkanMemuat(wadahPengurus, 'Memuat daftar pengurus…');
  try {
    const daftar = await panggilAdmin('daftarAdmin');
    selesaiMemuat(wadahPengurus, el('ul', { class: 'daftar-pengurus', role: 'list' },
      daftar.map((a) => barisPengurus(a, sesiSekarang()))));
  } catch (err) {
    tampilkanGalat(wadahPengurus, 'Daftar pengurus belum bisa dimuat. ' + err.message, muatPengurus);
  }
}

formTambah.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nama = document.getElementById('tambah-nama');
  const jabatan = document.getElementById('tambah-jabatan');
  const username = document.getElementById('tambah-username');
  username.value = username.value.trim().toLowerCase();
  kosongkanPesan(pesanTambah);
  if (adaSalah(formTambah, [
    [nama, nama.value.trim().length < 2 ? 'Isi nama lengkap.' : ''],
    [jabatan, jabatan.value.trim().length < 2 ? 'Isi jabatan.' : ''],
    [username, /^[a-z0-9_.]{3,30}$/.test(username.value) ? '' : 'Username 3 sampai 30 karakter: huruf kecil, angka, titik, atau garis bawah.'],
  ])) return;
  const tombol = formTambah.querySelector('button[type=submit]');
  tombolSibuk(tombol, true);
  try {
    const namaBaru = nama.value.trim();
    const r = await panggilAdmin('tambahAdmin', { username: username.value, nama: namaBaru, jabatan: jabatan.value.trim() });
    formTambah.reset();
    pesanTambah.replaceChildren(kotakPasswordSementara(`${namaBaru} sudah ditambahkan.`, r.username, r.password_sementara));
    muatPengurus();
  } catch (err) {
    tampilkanPesan(pesanTambah, 'galat', err.message);
  } finally {
    tombolSibuk(tombol, false);
  }
});

formPin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = document.getElementById('pin-baru');
  const ulang = document.getElementById('pin-ulang');
  kosongkanPesan(pesanPin);
  if (adaSalah(formPin, [
    [pin, /^\d{6}$/.test(pin.value) ? '' : 'PIN harus 6 angka.'],
    [ulang, ulang.value !== pin.value ? 'Ulangan PIN tidak sama.' : ''],
  ])) return;
  const tombol = formPin.querySelector('button[type=submit]');
  tombolSibuk(tombol, true);
  try {
    await panggilAdmin('gantiPinRonda', { pin_baru: pin.value });
    formPin.reset();
    tampilkanPesan(pesanPin, 'berhasil', 'PIN ronda sudah diganti. Beritahu petugas ronda PIN yang baru.');
  } catch (err) {
    tampilkanPesan(pesanPin, 'galat', err.message);
  } finally {
    tombolSibuk(tombol, false);
  }
});

export function siapkanAkun(ambilSesi) {
  sesiSekarang = ambilSesi;
  formGantiPassword(document.getElementById('wadah-ganti-password'), () => {});
}
