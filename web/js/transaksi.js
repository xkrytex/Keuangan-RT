import { panggil } from './api.js';
import { tombolBatalkan } from './batal.js';
import { panggilAdmin, token } from './sesi.js';
import { KAS, NAMA_JENIS, NAMA_KAS, geserPeriode, namaBulan, periodeIni } from './format.js';
import { daftarTransaksi, el, navigasiHalaman, selesaiMemuat, tampilkanGalat, tampilkanKosong, tampilkanMemuat } from './ui.js';

const form = document.getElementById('filter');
const pilihKas = document.getElementById('filter-kas');
const pilihBulan = document.getElementById('filter-bulan');
const pilihJenis = document.getElementById('filter-jenis');
const wadah = document.getElementById('hasil');
const ringkasHasil = document.getElementById('ringkas-hasil');

const JUMLAH_BULAN_PILIHAN = 36;

function isiPilihan() {
  KAS.forEach((kas) => pilihKas.append(el('option', { value: kas, text: NAMA_KAS[kas] })));
  const sekarang = periodeIni();
  for (let i = 0; i < JUMLAH_BULAN_PILIHAN; i++) {
    const p = geserPeriode(sekarang, -i);
    pilihBulan.append(el('option', { value: p, text: namaBulan(p) }));
  }
  Object.entries(NAMA_JENIS).forEach(([k, v]) => pilihJenis.append(el('option', { value: k, text: v })));
}

function bacaFilter() {
  const q = new URLSearchParams(location.search);
  const sah = (pilih, nilai) => [...pilih.options].some((o) => o.value === nilai) ? nilai : '';
  const halaman = Number(q.get('halaman'));
  return {
    kas: sah(pilihKas, q.get('kas') || ''),
    periode: sah(pilihBulan, q.get('bulan') || ''),
    jenis: sah(pilihJenis, q.get('jenis') || ''),
    halaman: Number.isInteger(halaman) && halaman > 0 ? halaman : 1,
  };
}

function tulisUrl(f) {
  const q = new URLSearchParams();
  if (f.kas) q.set('kas', f.kas);
  if (f.periode) q.set('bulan', f.periode);
  if (f.jenis) q.set('jenis', f.jenis);
  if (f.halaman > 1) q.set('halaman', String(f.halaman));
  const s = q.toString();
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

function uraianFilter(f) {
  const bagian = [];
  if (f.jenis) bagian.push(NAMA_JENIS[f.jenis].toLowerCase());
  else bagian.push('transaksi');
  if (f.kas) bagian.push(NAMA_KAS[f.kas]);
  if (f.periode) bagian.push('di ' + namaBulan(f.periode));
  return bagian.join(' ');
}

let urutanMuat = 0;

// Pengurus yang masuk di tab ini melihat tombol Batalkan. Sesi diperiksa sekali ke server,
// supaya token yang sudah kedaluwarsa tidak memunculkan tombol yang pasti gagal.
const sesiPengurus = token()
  ? panggilAdmin('sesiSaya').then((s) => !s.wajib_ganti, () => false)
  : Promise.resolve(false);

async function muat(f) {
  const nomor = ++urutanMuat;
  tulisUrl(f);
  ringkasHasil.textContent = '';
  tampilkanMemuat(wadah, 'Memuat daftar transaksi…');
  let r;
  let pengurus;
  try {
    [r, pengurus] = await Promise.all([panggil('daftarTransaksi', f), sesiPengurus]);
  } catch (err) {
    if (nomor !== urutanMuat) return;
    tampilkanGalat(wadah, 'Daftar transaksi belum bisa dimuat. ' + err.message, () => muat(f));
    return;
  }
  // Abaikan jawaban lama kalau filter sudah diganti sebelum jawaban ini tiba.
  if (nomor !== urutanMuat) return;

  const adaFilter = f.kas || f.periode || f.jenis;
  if (!r.total) {
    ringkasHasil.textContent = '';
    if (adaFilter) {
      tampilkanKosong(wadah, `Tidak ada ${uraianFilter(f)}.`, el('a', { href: 'transaksi.html', text: 'Tampilkan semua transaksi' }));
    } else {
      tampilkanKosong(wadah, 'Belum ada transaksi yang dicatat.');
    }
    return;
  }
  const awal = (r.halaman - 1) * 30 + 1;
  const akhir = awal + r.item.length - 1;
  ringkasHasil.textContent = r.total <= 30
    ? `${r.total} ${uraianFilter(f)}`
    : `Menampilkan ${awal} sampai ${akhir} dari ${r.total} ${uraianFilter(f)}`;
  const aksi = pengurus ? (t) => tombolBatalkan(t, () => muat(f)) : undefined;
  selesaiMemuat(wadah, daftarTransaksi(r.item, f.kas, aksi), navigasiHalaman(f.halaman, r.jumlah_halaman, (halaman) => {
    muat({ ...f, halaman });
    document.getElementById('judul-hasil').focus();
  }));
}

isiPilihan();
const awal = bacaFilter();
pilihKas.value = awal.kas;
pilihBulan.value = awal.periode;
pilihJenis.value = awal.jenis;

form.addEventListener('change', () => {
  muat({ kas: pilihKas.value, periode: pilihBulan.value, jenis: pilihJenis.value, halaman: 1 });
});
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('reset', () => {
  setTimeout(() => muat({ kas: '', periode: '', jenis: '', halaman: 1 }));
});

muat(awal);
