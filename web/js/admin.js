import { panggil } from './api.js';
import { adaSalah, kosongkanPesan, tampilkanPesan, tombolSibuk } from './form.js';
import { aturSaatSesiHabis, panggilAdmin, simpanToken, token } from './sesi.js';
import { formGantiPassword } from './admin-password.js';
import { siapkanCatat } from './admin-catat.js';
import { muatPengurus, siapkanAkun } from './admin-akun.js';
import { muatLog } from './admin-log.js';
import { muatBuku, siapkanBuku } from './admin-buku.js';

const tampilan = {
  memeriksa: document.getElementById('memeriksa'),
  masuk: document.getElementById('tampilan-masuk'),
  gantiWajib: document.getElementById('tampilan-ganti-wajib'),
  admin: document.getElementById('tampilan-admin'),
};
const menu = [...document.querySelectorAll('[data-menu]')];
const bagian = [...document.querySelectorAll('[data-bagian]')];
const pemuat = { buku: muatBuku, akun: muatPengurus, log: muatLog };
const formMasuk = document.getElementById('form-masuk');
const pesanMasuk = document.getElementById('pesan-masuk');

let sesiSaya = null;

function tampilkan(nama) {
  Object.entries(tampilan).forEach(([k, node]) => { node.hidden = k !== nama; });
}

function bukaBagian() {
  if (!sesiSaya || sesiSaya.wajib_ganti) return;
  const id = bagian.some((b) => '#' + b.id === location.hash) ? location.hash.slice(1) : 'catat';
  bagian.forEach((b) => { b.hidden = b.id !== id; });
  menu.forEach((a) => {
    if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `${document.getElementById('judul-' + id).textContent} · Pengurus Kas RT 05 RW 02`;
  if (pemuat[id]) pemuat[id]();
}

// defaultValue, bukan value, supaya form.reset() setelah ganti password tidak mengosongkannya.
function isiUsernameSesi(username) {
  document.querySelectorAll('.username-sesi').forEach((i) => { i.defaultValue = username; });
}

function masukKeAdmin(s) {
  sesiSaya = s;
  if (s.wajib_ganti) {
    tampilkan('gantiWajib');
    formGantiPassword(document.getElementById('wadah-ganti-wajib'), () => masukKeAdmin({ ...s, wajib_ganti: false }));
    isiUsernameSesi(s.username);
    document.getElementById('judul-ganti-wajib').focus();
    return;
  }
  isiUsernameSesi(s.username);
  document.getElementById('nama-sesi').textContent = `${s.nama} (${s.jabatan})`;
  tampilkan('admin');
  bukaBagian();
}

function keHalamanMasuk(pesan) {
  sesiSaya = null;
  tampilkan('masuk');
  if (pesan) tampilkanPesan(pesanMasuk, 'galat', pesan);
  document.getElementById('masuk-username').focus();
}

formMasuk.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('masuk-username');
  const password = document.getElementById('masuk-password');
  const tombol = formMasuk.querySelector('button[type=submit]');
  kosongkanPesan(pesanMasuk);
  if (adaSalah(formMasuk, [
    [username, username.value.trim() ? '' : 'Isi username.'],
    [password, password.value ? '' : 'Isi password.'],
  ])) return;
  tombolSibuk(tombol, true, 'Memeriksa…');
  try {
    const r = await panggil('login', { username: username.value, password: password.value });
    simpanToken(r.token);
    formMasuk.reset();
    masukKeAdmin(r);
  } catch (err) {
    tampilkanPesan(pesanMasuk, 'galat', err.message);
    password.value = '';
    password.focus();
  } finally {
    tombolSibuk(tombol, false);
  }
});

aturSaatSesiHabis((err) => {
  if (err.kode === 'WAJIB_GANTI' && sesiSaya) masukKeAdmin({ ...sesiSaya, wajib_ganti: true });
  else keHalamanMasuk(err.message);
});

window.addEventListener('hashchange', bukaBagian);

siapkanCatat();
siapkanBuku();
siapkanAkun(() => sesiSaya);

async function mulai() {
  if (!token()) {
    keHalamanMasuk();
    return;
  }
  try {
    masukKeAdmin(await panggilAdmin('sesiSaya'));
  } catch (err) {
    if (err.kode !== 'SESI_HABIS') keHalamanMasuk('Sesi belum bisa diperiksa. ' + err.message);
  }
}

mulai();
