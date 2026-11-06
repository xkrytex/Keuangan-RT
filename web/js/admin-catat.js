import { panggil } from './api.js';
import { kecilkanFoto } from './foto.js';
import { pasangKalender } from './kalender.js';
import { KAS, NAMA_KAS, rupiah } from './format.js';
import { adaSalah, bacaNominal, hariIniWIB, kosongkanPesan, pasangInputNominal, tampilkanPesan, tombolSibuk } from './form.js';
import { panggilAdmin } from './sesi.js';
import { el } from './ui.js';

const form = document.getElementById('form-catat');
const pesan = document.getElementById('pesan-catat');
const kas = document.getElementById('catat-kas');
const labelKas = document.getElementById('label-kas');
const tujuan = document.getElementById('catat-tujuan');
const kolomTujuan = document.getElementById('kolom-tujuan');
const kategori = document.getElementById('catat-kategori');
const kolomKategori = document.getElementById('kolom-kategori');
const infoSaldoAwal = document.getElementById('info-saldo-awal');
const nominal = document.getElementById('catat-nominal');
const uraian = document.getElementById('catat-uraian');
const wadahFoto = document.getElementById('unggah-foto');
const tombol = document.getElementById('tombol-catat');

const TEKS_TOMBOL = { MASUK: 'Catat pemasukan', KELUAR: 'Catat pengeluaran', PINDAH: 'Pindahkan dana' };
const NOMINAL_MAKS = 100000000;

let daftarKategori = null;
let foto = null;
let tanggal = null;

function jenis() {
  return form.querySelector('input[name=jenis]:checked').value;
}

function isiKategori() {
  const j = jenis();
  if (j === 'PINDAH' || !daftarKategori) return;
  const pilihanLama = kategori.value;
  kategori.replaceChildren(el('option', { value: '', text: 'Pilih kategori' }),
    ...daftarKategori[j].map((k) => el('option', { value: k, text: k })));
  if (daftarKategori[j].includes(pilihanLama)) kategori.value = pilihanLama;
  perbaruiInfo();
}

function perbaruiInfo() {
  infoSaldoAwal.hidden = !(jenis() === 'MASUK' && kategori.value === 'Saldo awal');
}

function sesuaikanJenis() {
  kosongkanPesan(pesan);
  const j = jenis();
  const pindah = j === 'PINDAH';
  kolomTujuan.hidden = !pindah;
  kolomKategori.hidden = pindah;
  labelKas.textContent = pindah ? 'Dari kas' : 'Kas';
  tombol.textContent = TEKS_TOMBOL[j];
  if (pindah && tujuan.value === kas.value) tujuan.value = KAS.find((k) => k !== kas.value);
  isiKategori();
  perbaruiInfo();
}

function tampilkanFotoKosong() {
  const input = el('input', { type: 'file', id: 'catat-foto', accept: 'image/jpeg,image/png', class: 'input-file' });
  input.setAttribute('aria-labelledby', 'label-foto');
  const label = el('label', { for: 'catat-foto', class: 'tombol tombol-sekunder' }, 'Pilih atau ambil foto');
  input.addEventListener('change', () => input.files[0] && prosesFoto(input.files[0]));
  wadahFoto.replaceChildren(input, label);
}

async function prosesFoto(file) {
  wadahFoto.replaceChildren(el('p', { class: 'bantuan', text: 'Memperkecil foto…' }));
  try {
    foto = await kecilkanFoto(file);
  } catch (err) {
    foto = null;
    tampilkanFotoKosong();
    wadahFoto.prepend(el('p', { class: 'pesan-salah', role: 'alert', text: err.message }));
    return;
  }
  const url = URL.createObjectURL(foto.blob);
  const hapus = el('button', { type: 'button', class: 'tombol tombol-sekunder', text: 'Hapus foto' });
  hapus.addEventListener('click', () => {
    URL.revokeObjectURL(url);
    foto = null;
    tampilkanFotoKosong();
    document.getElementById('catat-foto').focus();
  });
  wadahFoto.replaceChildren(
    el('img', { src: url, alt: 'Pratinjau bukti pembayaran', width: '160', height: '213', class: 'pratinjau-foto' }),
    el('div', { class: 'pratinjau-aksi' },
      el('p', { class: 'bantuan', text: `Foto siap diunggah (${Math.round(foto.blob.size / 1024)} KB).` }),
      hapus));
}

function aturanValidasi() {
  const j = jenis();
  const n = bacaNominal(nominal);
  return [
    [tujuan, j === 'PINDAH' && tujuan.value === kas.value ? 'Kas tujuan harus berbeda dari kas asal.' : ''],
    [kategori, j !== 'PINDAH' && !kategori.value ? 'Pilih kategori.' : ''],
    [tanggal.tombol, tanggal.nilai > hariIniWIB() ? 'Tanggal tidak boleh melewati hari ini.' : ''],
    [nominal, n < 1 ? 'Isi nominal.' : n > NOMINAL_MAKS ? `Nominal maksimal ${rupiah(NOMINAL_MAKS)}.` : ''],
    [uraian, uraian.value.trim().length < 3 ? 'Keterangan minimal 3 karakter.' : ''],
  ];
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  kosongkanPesan(pesan);
  if (adaSalah(form, aturanValidasi())) return;
  const j = jenis();
  const data = {
    jenis: j,
    kas: kas.value,
    tanggal: tanggal.nilai,
    uraian: uraian.value.trim(),
    nominal: bacaNominal(nominal),
  };
  if (j === 'PINDAH') data.kas_tujuan = tujuan.value;
  else data.kategori = kategori.value;
  if (foto) data.foto = { mime: foto.mime, base64: foto.base64 };

  tombolSibuk(tombol, true, foto ? 'Mengunggah dan menyimpan…' : 'Menyimpan…');
  try {
    const t = await panggilAdmin('catatTransaksi', data);
    tampilkanPesan(pesan, 'berhasil', `Tersimpan: ${t.uraian}, ${rupiah(t.nominal)}.`,
      el('a', { href: `detail.html?id=${encodeURIComponent(t.id)}`, text: 'Lihat seperti yang dilihat warga' }));
    // Jenis, kas, kategori, dan tanggal dibiarkan agar mudah mencatat beberapa transaksi lama berturut-turut.
    uraian.value = '';
    nominal.value = '';
    foto = null;
    tampilkanFotoKosong();
    pesan.scrollIntoView({ block: 'nearest' });
    uraian.focus();
  } catch (err) {
    tampilkanPesan(pesan, 'galat', err.message);
    pesan.scrollIntoView({ block: 'nearest' });
  } finally {
    tombolSibuk(tombol, false);
  }
});

export async function siapkanCatat() {
  KAS.forEach((k) => {
    kas.append(el('option', { value: k, text: NAMA_KAS[k] }));
    tujuan.append(el('option', { value: k, text: NAMA_KAS[k] }));
  });
  tujuan.value = 'RT';
  tanggal = pasangKalender(document.getElementById('pilih-tanggal'), {
    id: 'catat-tanggal', labelId: 'label-tanggal', deskripsi: 'catat-tanggal-bantuan catat-tanggal-galat', maks: hariIniWIB,
  });
  pasangInputNominal(nominal);
  tampilkanFotoKosong();
  form.querySelectorAll('input[name=jenis]').forEach((r) => r.addEventListener('change', sesuaikanJenis));
  kas.addEventListener('change', sesuaikanJenis);
  kategori.addEventListener('change', perbaruiInfo);
  sesuaikanJenis();

  kategori.replaceChildren(el('option', { value: '', text: 'Memuat kategori…' }));
  try {
    daftarKategori = await panggil('daftarKategori');
    isiKategori();
  } catch (err) {
    kategori.replaceChildren(el('option', { value: '', text: 'Kategori gagal dimuat' }));
    tampilkanPesan(pesan, 'galat', 'Daftar kategori belum bisa dimuat. Muat ulang halaman ini. ' + err.message);
  }
}
