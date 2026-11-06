// Jalankan dari editor Apps Script, berurutan: setupAwal, ukurWaktuHash, lalu buatAdminPertama setelah
// ADMIN_PERTAMA diisi. Langkah lengkapnya ada di PANDUAN-SETUP.md bagian 2.
const ADMIN_PERTAMA = { username: '', nama: '', jabatan: '' };

const KATEGORI_AWAL = [
  ['MASUK', 'Saldo awal'], ['MASUK', 'Iuran bulanan'], ['MASUK', 'Jimpitan'], ['MASUK', 'Sumbangan'], ['MASUK', 'Lain-lain'],
  ['KELUAR', 'Listrik/lampu jalan'], ['KELUAR', 'Perbaikan'], ['KELUAR', 'Kebersihan'],
  ['KELUAR', 'Kegiatan warga'], ['KELUAR', 'Sosial/duka'], ['KELUAR', 'ATK'], ['KELUAR', 'Lain-lain'],
];

function setupAwal() {
  if (prop('ID_DATA')) {
    console.log('Setup sudah pernah dijalankan. Spreadsheet DATA: ' + SpreadsheetApp.openById(prop('ID_DATA')).getUrl());
    return;
  }
  const induk = DriveApp.createFolder('Keuangan RT 05 RW 02');
  const nota = induk.createFolder('Nota');
  const cadangan = induk.createFolder('Cadangan');

  const data = SpreadsheetApp.create('Keuangan RT 05 RW 02 - DATA (privat)');
  aturZonaDanLokal(data);
  Object.keys(KOLOM).forEach(function (nama) {
    const sheet = data.insertSheet(nama);
    const kolom = KOLOM[nama];
    // Format teks polos mencegah Sheets mengubah "2026-11" atau "2026-11-06" menjadi tanggal.
    sheet.getRange(1, 1, sheet.getMaxRows(), kolom.length).setNumberFormat('@');
    kolom.forEach(function (k, i) {
      if (KOLOM_ANGKA.indexOf(k) !== -1) sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).setNumberFormat('#,##0');
    });
    sheet.getRange(1, 1, 1, kolom.length).setValues([kolom]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
  data.deleteSheet(data.getSheets()[0]);
  const kategori = data.getSheetByName(TAB.KATEGORI);
  kategori.getRange(2, 1, KATEGORI_AWAL.length, 3)
    .setValues(KATEGORI_AWAL.map(function (k) { return [k[0], k[1], 'YA']; }));

  const laporan = SpreadsheetApp.create('Laporan Keuangan RT 05 RW 02 (publik)');
  aturZonaDanLokal(laporan);
  laporan.getSheets()[0].setName('Petunjuk').getRange(1, 1, 2, 1).setValues([
    ['Laporan keuangan RT 05 RW 02 Donglo Santren, Kedung Sugo.'],
    ['Tab Laporan-YYYY-MM dan Rekap-YYYY dibuat otomatis oleh sistem. Jangan diedit manual.'],
  ]);

  DriveApp.getFileById(data.getId()).moveTo(induk);
  const fileLaporan = DriveApp.getFileById(laporan.getId());
  fileLaporan.moveTo(induk);
  fileLaporan.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  setProp('ID_DATA', data.getId());
  setProp('ID_LAPORAN', laporan.getId());
  setProp('URL_LAPORAN', laporan.getUrl());
  setProp('ID_FOLDER_NOTA', nota.getId());
  setProp('ID_FOLDER_CADANGAN', cadangan.getId());
  setProp('VERSI_DATA', 1);

  const pin = String(100000 + Math.floor(Math.random() * 900000));
  simpanPinRonda(pin);
  pasangTrigger();

  console.log('Setup selesai.');
  console.log('Spreadsheet DATA (jangan dibagikan): ' + data.getUrl());
  console.log('Spreadsheet LAPORAN (boleh dibagikan): ' + laporan.getUrl());
  console.log('PIN ronda awal: ' + pin + '. Ganti lewat halaman admin setelah login.');
}

// Lokal Indonesia membuat angka tampil 1.250.000. Kalau kode lokal ditolak, angka tetap benar, hanya pemisahnya berbeda.
function aturZonaDanLokal(ss) {
  ss.setSpreadsheetTimeZone(ZONA);
  try {
    ss.setSpreadsheetLocale('in_ID');
  } catch (err) {
    console.warn('Lokal in_ID ditolak, memakai lokal bawaan.', err);
  }
}

function buatAdminPertama() {
  if (bacaTab(TAB.ADMIN).length) throw new Error('Admin sudah ada. Tambah admin berikutnya lewat halaman admin.');
  if (!ADMIN_PERTAMA.username || !ADMIN_PERTAMA.nama || !ADMIN_PERTAMA.jabatan) {
    throw new Error('Isi ADMIN_PERTAMA di bagian atas Setup.gs dulu.');
  }
  const hasil = buatAkunAdmin(ADMIN_PERTAMA.username, ADMIN_PERTAMA.nama, ADMIN_PERTAMA.jabatan, 'setup');
  console.log('Admin dibuat. Username: ' + hasil.username + ', password sementara: ' + hasil.password_sementara);
  console.log('Password ini wajib diganti saat pertama kali masuk.');
}

// Pemulihan kalau tidak ada pengurus yang bisa masuk (semua lupa password atau nonaktif).
// Hanya bisa dijalankan dari editor Apps Script oleh pemilik akun Google RT; tidak terhubung ke web.
// Isi username, jalankan pulihkanAksesAdmin, lalu kosongkan lagi.
const PEMULIHAN_USERNAME = '';

function pulihkanAksesAdmin(username) {
  // Dari editor fungsi ini dijalankan tanpa argumen (Apps Script mengirim objek event), jadi pakai konstanta.
  const nama = typeof username === 'string' ? username : PEMULIHAN_USERNAME;
  if (!nama) throw new Error('Isi PEMULIHAN_USERNAME di Setup.gs dulu.');
  const hasil = denganKunci(function () {
    const admin = cariAdmin(nama);
    if (!admin) throw new Error('Username ' + nama + ' tidak ditemukan di tab Admin.');
    admin.aktif = 'YA';
    // Berbeda dengan reset dari halaman Akun, kunci 15 menit ikut dibuka: yang menjalankan ini pasti pemilik akun Google.
    cache().remove('gagal:admin:' + admin.username);
    return resetSandiAdmin(admin, 'editor');
  });
  console.log('Akses dipulihkan. Username: ' + hasil.username + ', password sementara: ' + hasil.password_sementara);
  console.log('Password ini wajib diganti saat masuk. Kosongkan lagi PEMULIHAN_USERNAME.');
}

function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['laporanOtomatisBulanan', 'cadanganMingguan'].indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('laporanOtomatisBulanan').timeBased().onMonthDay(1).atHour(1).inTimezone(ZONA).create();
  ScriptApp.newTrigger('cadanganMingguan').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2)
    .inTimezone(ZONA).create();
}

// Ukur lama hash sebelum rilis: targetnya di bawah 1 detik per login.
function ukurWaktuHash() {
  const mulai = Date.now();
  hashRahasia('contoh-password', saltBaru());
  console.log('Hash ' + ITERASI_HASH + ' iterasi: ' + (Date.now() - mulai) + ' ms');
}
