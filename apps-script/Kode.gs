const ZONA = 'Asia/Jakarta';
const KAS = ['LAMPU', 'RT', 'JIMPITAN'];
const NAMA_KAS = { LAMPU: 'Kas Lampu', RT: 'Kas RT', JIMPITAN: 'Kas Jimpitan' };
const JENIS = ['MASUK', 'KELUAR', 'PINDAH'];
const NOMINAL_MAKS = 100000000;
const NOMINAL_MAKS_RONDA = 1000000;
const PER_HALAMAN = 30;

const TAB = {
  TRANSAKSI: 'Transaksi',
  KATEGORI: 'Kategori',
  ADMIN: 'Admin',
  TUTUP: 'TutupBuku',
  LOG: 'Log',
};

const KOLOM = {
  Transaksi: ['id', 'tanggal', 'jenis', 'kas', 'kas_tujuan', 'kategori', 'uraian', 'nominal', 'bukti_file_id',
    'dicatat_oleh', 'dicatat_pada', 'status', 'alasan_batal', 'dibatalkan_oleh', 'dibatalkan_pada'],
  Kategori: ['jenis', 'nama', 'aktif'],
  Admin: ['username', 'nama', 'jabatan', 'salt', 'hash', 'aktif', 'wajib_ganti', 'dibuat_pada'],
  TutupBuku: ['periode', 'kas', 'saldo_awal', 'total_masuk', 'total_keluar', 'saldo_akhir', 'status',
    'ditutup_oleh', 'ditutup_pada', 'alasan_buka', 'dibuka_oleh', 'dibuka_pada'],
  Log: ['waktu', 'pelaku', 'aksi', 'id_terkait', 'detail'],
};

const KOLOM_ANGKA = ['nominal', 'saldo_awal', 'total_masuk', 'total_keluar', 'saldo_akhir'];

// kode dipakai frontend untuk membedakan galat tanpa mencocokkan teks pesan.
class GalatPengguna extends Error {
  constructor(pesan, kode) {
    super(pesan);
    this.kode = kode || '';
  }
}

// Dibangun per permintaan: Apps Script memuat file berurutan, jadi fungsi dari file lain belum ada saat file ini dimuat.
function petaAksi() {
  return {
    ringkasan: { akses: 'publik', fn: aksiRingkasan },
    daftarTransaksi: { akses: 'publik', fn: aksiDaftarTransaksi },
    detailTransaksi: { akses: 'publik', fn: aksiDetailTransaksi },
    daftarKategori: { akses: 'publik', fn: aksiDaftarKategori },
    laporan: { akses: 'publik', fn: aksiLaporan },
    login: { akses: 'publik', fn: aksiLogin },
    loginRonda: { akses: 'publik', fn: aksiLoginRonda },

    sesiSaya: { akses: 'admin-awal', fn: aksiSesiSaya },
    logout: { akses: 'admin-awal', fn: aksiLogout },
    gantiPassword: { akses: 'admin-awal', fn: aksiGantiPassword },

    catatTransaksi: { akses: 'admin', fn: aksiCatatTransaksi },
    batalkanTransaksi: { akses: 'admin', fn: aksiBatalkanTransaksi },
    tutupBuku: { akses: 'admin', fn: aksiTutupBuku },
    bukaBuku: { akses: 'admin', fn: aksiBukaBuku },
    tulisLaporan: { akses: 'admin', fn: aksiTulisLaporan },
    daftarAdmin: { akses: 'admin', fn: aksiDaftarAdmin },
    tambahAdmin: { akses: 'admin', fn: aksiTambahAdmin },
    resetPasswordAdmin: { akses: 'admin', fn: aksiResetPasswordAdmin },
    nonaktifkanAdmin: { akses: 'admin', fn: aksiNonaktifkanAdmin },
    aktifkanAdmin: { akses: 'admin', fn: aksiAktifkanAdmin },
    gantiPinRonda: { akses: 'admin', fn: aksiGantiPinRonda },
    log: { akses: 'admin', fn: aksiLog },
    statusBuku: { akses: 'admin', fn: aksiStatusBuku },

    logoutRonda: { akses: 'ronda', fn: aksiLogout },
    catatJimpitan: { akses: 'ronda', fn: aksiCatatJimpitan },
  };
}

// Frontend mengirim text/plain agar browser tidak melakukan preflight CORS, yang tidak bisa dijawab Apps Script.
function doPost(e) {
  return balasJson(prosesPermintaan(e && e.postData ? e.postData.contents : ''));
}

function doGet() {
  return balasJson({ ok: true, data: 'API Keuangan RT 05 RW 02' });
}

function prosesPermintaan(isi) {
  try {
    let req;
    try {
      req = JSON.parse(isi || '{}');
    } catch (err) {
      throw new GalatPengguna('Permintaan tidak valid.');
    }
    const hasil = { ok: true, data: jalankan(req) };
    // Web memasang tanda "data contoh" di setiap halaman selama data demo terpasang (lihat Demo.gs).
    if (prop('MODE_DEMO') === '1') hasil.demo = true;
    return hasil;
  } catch (err) {
    if (err instanceof GalatPengguna) return { ok: false, pesan: err.message, kode: err.kode };
    console.error(err && err.stack ? err.stack : err);
    return { ok: false, pesan: 'Terjadi kesalahan di server. Coba lagi beberapa saat lagi.' };
  } finally {
    _data = null;
  }
}

function jalankan(req) {
  const peta = petaAksi();
  const aksi = Object.prototype.hasOwnProperty.call(peta, req.aksi) ? peta[req.aksi] : null;
  if (!aksi) {
    // Biasanya terjadi kalau web sudah memakai fitur baru tetapi Apps Script belum di-deploy ulang.
    const nama = String(req.aksi || '').replace(/[^A-Za-z]/g, '').slice(0, 40);
    throw new GalatPengguna('Aksi tidak dikenal' + (nama ? ' (' + nama + ')' : '') + '. Hubungi pengelola web.');
  }
  const data = req.data && typeof req.data === 'object' ? req.data : {};
  if (aksi.akses === 'publik') return aksi.fn(data);
  return aksi.fn(data, ambilSesi(req.token, aksi.akses));
}

function balasJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function prop(nama) {
  return PropertiesService.getScriptProperties().getProperty(nama);
}

function setProp(nama, nilai) {
  PropertiesService.getScriptProperties().setProperty(nama, String(nilai));
}

let _data = null;

function tab(nama) {
  if (!_data) _data = SpreadsheetApp.openById(prop('ID_DATA'));
  const sheet = _data.getSheetByName(nama);
  if (!sheet) throw new Error('Tab tidak ditemukan: ' + nama);
  return sheet;
}

function bacaTab(nama) {
  const kolom = KOLOM[nama];
  return tab(nama).getDataRange().getValues().slice(1).map(function (baris, i) {
    const obj = { _baris: i + 2 };
    kolom.forEach(function (k, j) { obj[k] = normalisasiSel(k, baris[j]); });
    return obj;
  });
}

// Kolom diformat teks polos saat setup, tapi edit manual di Sheets masih bisa mengubah nilai menjadi Date.
function normalisasiSel(kolom, nilai) {
  if (nilai instanceof Date) {
    return Utilities.formatDate(nilai, ZONA, kolom === 'periode' ? 'yyyy-MM' : 'yyyy-MM-dd');
  }
  if (KOLOM_ANGKA.indexOf(kolom) !== -1) return Number(nilai) || 0;
  return nilai === null || nilai === undefined ? '' : String(nilai);
}

function barisDari(nama, obj) {
  return KOLOM[nama].map(function (k) {
    const v = obj[k];
    return v === undefined || v === null ? '' : selAman(v);
  });
}

// Apostrof di depan mencegah Sheets menjalankan teks dari pengguna sebagai rumus.
function selAman(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function tambahBaris(nama, obj) {
  tab(nama).appendRow(barisDari(nama, obj));
}

function ubahBaris(nama, nomorBaris, obj) {
  const kolom = KOLOM[nama];
  tab(nama).getRange(nomorBaris, 1, 1, kolom.length).setValues([barisDari(nama, obj)]);
}

function denganKunci(fn) {
  const kunci = LockService.getScriptLock();
  if (!kunci.tryLock(20000)) throw new GalatPengguna('Server sedang sibuk. Coba simpan lagi sebentar.');
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    kunci.releaseLock();
  }
}

function cache() {
  return CacheService.getScriptCache();
}

function naikkanVersiData() {
  setProp('VERSI_DATA', Number(prop('VERSI_DATA') || 0) + 1);
}

// Cache publik memakai nomor versi data, jadi setiap penulisan otomatis membuat cache lama tidak terpakai.
function denganCache(kunci, fn) {
  const k = 'publik:' + (prop('VERSI_DATA') || '0') + ':' + kunci;
  const ada = cache().get(k);
  if (ada) return JSON.parse(ada);
  const hasil = fn();
  const teks = JSON.stringify(hasil);
  if (teks.length < 90000) cache().put(k, teks, 300);
  return hasil;
}

function catatLog(pelaku, aksi, idTerkait, detail) {
  try {
    tambahBaris(TAB.LOG, {
      waktu: waktuIso(),
      pelaku: String(pelaku).slice(0, 60),
      aksi: aksi,
      id_terkait: idTerkait || '',
      detail: String(detail || '').slice(0, 300),
    });
  } catch (err) {
    console.error('Gagal menulis log: ' + aksi + ' ' + idTerkait, err);
  }
}

function sekarang() {
  return new Date();
}

function hariIni() {
  return Utilities.formatDate(sekarang(), ZONA, 'yyyy-MM-dd');
}

function waktuIso() {
  return Utilities.formatDate(sekarang(), ZONA, "yyyy-MM-dd'T'HH:mm:ss");
}

function periodeDari(tanggal) {
  return tanggal.slice(0, 7);
}

function geserPeriode(periode, n) {
  const bagian = periode.split('-').map(Number);
  const total = bagian[0] * 12 + (bagian[1] - 1) + n;
  return Math.floor(total / 12) + '-' + String((total % 12) + 1).padStart(2, '0');
}

function geserTanggal(tanggal, hari) {
  const b = tanggal.split('-').map(Number);
  const d = new Date(Date.UTC(b[0], b[1] - 1, b[2] + hari));
  return d.toISOString().slice(0, 10);
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September',
  'Oktober', 'November', 'Desember'];

function namaPeriode(periode) {
  return BULAN[Number(periode.slice(5, 7)) - 1] + ' ' + periode.slice(0, 4);
}

function formatTanggal(tanggal) {
  return Number(tanggal.slice(8, 10)) + ' ' + BULAN[Number(tanggal.slice(5, 7)) - 1] + ' ' + tanggal.slice(0, 4);
}

function formatRupiah(n) {
  const tanda = n < 0 ? '-' : '';
  return tanda + 'Rp ' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function wajibTeks(nilai, label, min, maks) {
  const teks = typeof nilai === 'string' ? nilai.trim().replace(/\s+/g, ' ') : '';
  if (teks.length < min || teks.length > maks) {
    throw new GalatPengguna(label + ' harus diisi ' + min + ' sampai ' + maks + ' karakter.');
  }
  return teks;
}

function wajibPilihan(nilai, pilihan, label) {
  if (pilihan.indexOf(nilai) === -1) throw new GalatPengguna(label + ' tidak valid.');
  return nilai;
}

function wajibNominal(nilai, maks) {
  if (!Number.isInteger(nilai) || nilai < 1 || nilai > maks) {
    throw new GalatPengguna('Nominal harus bilangan bulat antara Rp 1 dan ' + formatRupiah(maks) + '.');
  }
  return nilai;
}

function tanggalValid(nilai) {
  if (typeof nilai !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return false;
  const b = nilai.split('-').map(Number);
  const d = new Date(Date.UTC(b[0], b[1] - 1, b[2]));
  return d.getUTCFullYear() === b[0] && d.getUTCMonth() === b[1] - 1 && d.getUTCDate() === b[2];
}

function wajibTanggal(nilai) {
  if (!tanggalValid(nilai)) throw new GalatPengguna('Tanggal tidak valid.');
  if (nilai > hariIni()) throw new GalatPengguna('Tanggal tidak boleh melewati hari ini.');
  return nilai;
}

function wajibPeriode(nilai) {
  if (typeof nilai !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(nilai)) {
    throw new GalatPengguna('Bulan tidak valid.');
  }
  return nilai;
}
