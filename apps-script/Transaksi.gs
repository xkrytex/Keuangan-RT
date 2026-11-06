const MIME_FOTO = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const UKURAN_FOTO_MAKS = 2 * 1024 * 1024;
const KATEGORI_SALDO_AWAL = 'Saldo awal';

function adalahSaldoAwal(t) {
  return t.jenis === 'MASUK' && t.kategori === KATEGORI_SALDO_AWAL;
}

function saldoNol() {
  return { LAMPU: 0, RT: 0, JIMPITAN: 0 };
}

function efekTransaksi(t) {
  const efek = {};
  if (t.jenis === 'MASUK') efek[t.kas] = t.nominal;
  else if (t.jenis === 'KELUAR') efek[t.kas] = -t.nominal;
  else {
    efek[t.kas] = -t.nominal;
    efek[t.kas_tujuan] = t.nominal;
  }
  return efek;
}

function hanyaAktif(semua) {
  return semua.filter(function (t) { return t.status === 'AKTIF'; });
}

function terapkan(saldo, t) {
  const efek = efekTransaksi(t);
  Object.keys(efek).forEach(function (kas) { saldo[kas] += efek[kas]; });
}

function hitungSaldo(semua, sampaiTanggal) {
  const saldo = saldoNol();
  hanyaAktif(semua).forEach(function (t) {
    if (!sampaiTanggal || t.tanggal <= sampaiTanggal) terapkan(saldo, t);
  });
  return saldo;
}

// Dicek per akhir hari, bukan per baris: urutan pencatatan dalam satu hari tidak mencerminkan urutan kejadian.
function periksaTidakMinus(semua, kasTerdampak) {
  const perTanggal = {};
  hanyaAktif(semua).forEach(function (t) {
    (perTanggal[t.tanggal] = perTanggal[t.tanggal] || []).push(t);
  });
  const saldo = saldoNol();
  Object.keys(perTanggal).sort().forEach(function (tanggal) {
    perTanggal[tanggal].forEach(function (t) { terapkan(saldo, t); });
    kasTerdampak.forEach(function (kas) {
      if (saldo[kas] < 0) {
        throw new GalatPengguna('Saldo ' + NAMA_KAS[kas] + ' akan minus pada ' + formatTanggal(tanggal) +
          '. Periksa nominal atau tanggalnya. Untuk transaksi lama, catat dulu saldo awal kas dengan tanggal yang lebih awal.');
      }
    });
  });
}

function urutTerbaru(a, b) {
  if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
  if (a.dicatat_pada !== b.dicatat_pada) return a.dicatat_pada < b.dicatat_pada ? 1 : -1;
  return 0;
}

function petaNamaAdmin() {
  const peta = {};
  bacaTab(TAB.ADMIN).forEach(function (a) { peta[a.username] = a.nama; });
  return peta;
}

function namaPencatat(pencatat, petaNama) {
  if (!pencatat) return '';
  if (pencatat.indexOf('ronda:') === 0) return 'Petugas ronda: ' + pencatat.slice(6);
  return petaNama[pencatat] || pencatat;
}

function untukPublik(t, petaNama) {
  return {
    id: t.id,
    tanggal: t.tanggal,
    jenis: t.jenis,
    kas: t.kas,
    kas_tujuan: t.kas_tujuan,
    kategori: t.kategori,
    uraian: t.uraian,
    nominal: t.nominal,
    bukti_id: t.bukti_file_id,
    status: t.status,
    alasan_batal: t.alasan_batal,
    dicatat_oleh: namaPencatat(t.dicatat_oleh, petaNama),
    dicatat_pada: t.dicatat_pada,
    dibatalkan_oleh: namaPencatat(t.dibatalkan_oleh, petaNama),
    dibatalkan_pada: t.dibatalkan_pada,
  };
}

function aksiRingkasan() {
  return denganCache('ringkasan', function () {
    const semua = bacaTab(TAB.TRANSAKSI);
    const petaNama = petaNamaAdmin();
    const periode = periodeDari(hariIni());
    const bulanIni = {};
    KAS.forEach(function (kas) { bulanIni[kas] = { masuk: 0, keluar: 0 }; });
    hanyaAktif(semua).forEach(function (t) {
      // Sama dengan laporan: saldo awal tidak dihitung sebagai pemasukan bulan berjalan.
      if (periodeDari(t.tanggal) !== periode || adalahSaldoAwal(t)) return;
      const efek = efekTransaksi(t);
      Object.keys(efek).forEach(function (kas) {
        if (efek[kas] > 0) bulanIni[kas].masuk += efek[kas];
        else bulanIni[kas].keluar -= efek[kas];
      });
    });
    const saldo = hitungSaldo(semua);
    return {
      saldo: saldo,
      saldo_total: saldo.LAMPU + saldo.RT + saldo.JIMPITAN,
      periode: periode,
      bulan_ini: bulanIni,
      terbaru: semua.slice().sort(urutTerbaru).slice(0, 10).map(function (t) { return untukPublik(t, petaNama); }),
      periode_terakhir_ditutup: periodeTerakhirDitutup(),
      diperbarui: waktuIso(),
    };
  });
}

function aksiDaftarTransaksi(data) {
  const filter = {
    kas: data.kas ? wajibPilihan(data.kas, KAS, 'Kas') : '',
    periode: data.periode ? wajibPeriode(data.periode) : '',
    jenis: data.jenis ? wajibPilihan(data.jenis, JENIS, 'Jenis transaksi') : '',
  };
  const halaman = Number.isInteger(data.halaman) && data.halaman > 0 ? data.halaman : 1;
  const kunci = 'daftar:' + filter.kas + ':' + filter.periode + ':' + filter.jenis + ':' + halaman;
  return denganCache(kunci, function () {
    const petaNama = petaNamaAdmin();
    const cocok = bacaTab(TAB.TRANSAKSI).filter(function (t) {
      if (filter.kas && t.kas !== filter.kas && t.kas_tujuan !== filter.kas) return false;
      if (filter.periode && periodeDari(t.tanggal) !== filter.periode) return false;
      if (filter.jenis && t.jenis !== filter.jenis) return false;
      return true;
    }).sort(urutTerbaru);
    const mulai = (halaman - 1) * PER_HALAMAN;
    return {
      item: cocok.slice(mulai, mulai + PER_HALAMAN).map(function (t) { return untukPublik(t, petaNama); }),
      total: cocok.length,
      halaman: halaman,
      jumlah_halaman: Math.max(1, Math.ceil(cocok.length / PER_HALAMAN)),
    };
  });
}

function aksiDetailTransaksi(data) {
  const t = bacaTab(TAB.TRANSAKSI).filter(function (x) { return x.id === data.id; })[0];
  if (!t) throw new GalatPengguna('Transaksi tidak ditemukan.', 'TIDAK_DITEMUKAN');
  return untukPublik(t, petaNamaAdmin());
}

function aksiDaftarKategori() {
  return denganCache('kategori', function () {
    const hasil = { MASUK: [], KELUAR: [] };
    bacaTab(TAB.KATEGORI).forEach(function (k) {
      if (k.aktif === 'YA' && hasil[k.jenis]) hasil[k.jenis].push(k.nama);
    });
    return hasil;
  });
}

function wajibKategori(jenis, nama) {
  const ada = bacaTab(TAB.KATEGORI).some(function (k) {
    return k.jenis === jenis && k.nama === nama && k.aktif === 'YA';
  });
  if (!ada) throw new GalatPengguna('Kategori tidak valid.');
  return nama;
}

function aksiCatatTransaksi(data, sesi) {
  const jenis = wajibPilihan(data.jenis, JENIS, 'Jenis transaksi');
  const kas = wajibPilihan(data.kas, KAS, 'Kas');
  let kasTujuan = '';
  if (jenis === 'PINDAH') {
    kasTujuan = wajibPilihan(data.kas_tujuan, KAS, 'Kas tujuan');
    if (kasTujuan === kas) throw new GalatPengguna('Kas asal dan kas tujuan harus berbeda.');
  }
  const t = {
    tanggal: wajibTanggal(data.tanggal),
    jenis: jenis,
    kas: kas,
    kas_tujuan: kasTujuan,
    kategori: jenis === 'PINDAH' ? 'Pindah kas' : wajibKategori(jenis, data.kategori),
    uraian: wajibTeks(data.uraian, 'Keterangan', 3, 200),
    nominal: wajibNominal(data.nominal, NOMINAL_MAKS),
  };
  return simpanTransaksi(t, data.foto ? periksaFoto(data.foto) : null, sesi.username);
}

function aksiCatatJimpitan(data, sesi) {
  const tanggal = wajibTanggal(data.tanggal);
  if (tanggal < geserTanggal(hariIni(), -1)) {
    throw new GalatPengguna('Petugas ronda hanya bisa mencatat jimpitan hari ini atau kemarin.');
  }
  const petugas = wajibTeks(data.nama_petugas, 'Nama petugas', 2, 40);
  const t = {
    tanggal: tanggal,
    jenis: 'MASUK',
    kas: 'JIMPITAN',
    kas_tujuan: '',
    kategori: 'Jimpitan',
    uraian: 'Jimpitan ronda malam ' + formatTanggal(tanggal),
    nominal: wajibNominal(data.nominal, NOMINAL_MAKS_RONDA),
  };
  return simpanTransaksi(t, data.foto ? periksaFoto(data.foto) : null, 'ronda:' + petugas);
}

function simpanTransaksi(t, foto, pencatat) {
  return denganKunci(function () {
    pastikanBulanTerbuka(t.tanggal);
    const semua = bacaTab(TAB.TRANSAKSI);
    if (t.kategori === KATEGORI_SALDO_AWAL) pastikanSaldoAwalBelumAda(semua, t.kas);
    t.id = idTransaksiBaru(semua);
    t.dicatat_oleh = pencatat;
    t.dicatat_pada = waktuIso();
    t.status = 'AKTIF';
    if (t.jenis !== 'MASUK') periksaTidakMinus(semua.concat([t]), Object.keys(efekTransaksi(t)));

    t.bukti_file_id = foto ? simpanFoto(foto, t) : '';
    try {
      tambahBaris(TAB.TRANSAKSI, t);
    } catch (err) {
      if (t.bukti_file_id) buangFoto(t.bukti_file_id);
      throw err;
    }
    naikkanVersiData();
    catatLog(pencatat, 'CATAT', t.id, t.jenis + ' ' + NAMA_KAS[t.kas] +
      (t.kas_tujuan ? ' ke ' + NAMA_KAS[t.kas_tujuan] : '') + ' ' + formatRupiah(t.nominal));
    return untukPublik(t, petaNamaAdmin());
  });
}

function aksiBatalkanTransaksi(data, sesi) {
  const alasan = wajibTeks(data.alasan, 'Alasan pembatalan', 5, 200);
  return denganKunci(function () {
    const semua = bacaTab(TAB.TRANSAKSI);
    const t = semua.filter(function (x) { return x.id === data.id; })[0];
    if (!t) throw new GalatPengguna('Transaksi tidak ditemukan.', 'TIDAK_DITEMUKAN');
    if (t.status !== 'AKTIF') throw new GalatPengguna('Transaksi ini sudah dibatalkan.');
    pastikanBulanTerbuka(t.tanggal);
    if (t.jenis !== 'KELUAR') {
      const sisa = semua.filter(function (x) { return x.id !== t.id; });
      periksaTidakMinus(sisa, Object.keys(efekTransaksi(t)));
    }
    t.status = 'BATAL';
    t.alasan_batal = alasan;
    t.dibatalkan_oleh = sesi.username;
    t.dibatalkan_pada = waktuIso();
    ubahBaris(TAB.TRANSAKSI, t._baris, t);
    naikkanVersiData();
    catatLog(sesi.username, 'BATAL', t.id, alasan);
    return untukPublik(t, petaNamaAdmin());
  });
}

// Saldo awal adalah uang kas yang sudah ada sebelum web dipakai. Satu kas cukup satu; kalau salah, batalkan lalu catat ulang.
function pastikanSaldoAwalBelumAda(semua, kas) {
  const ada = hanyaAktif(semua).some(function (t) { return t.kas === kas && t.kategori === KATEGORI_SALDO_AWAL; });
  if (ada) throw new GalatPengguna('Saldo awal ' + NAMA_KAS[kas] + ' sudah dicatat. Batalkan yang lama dulu kalau perlu diganti.');
}

function idTransaksiBaru(semua) {
  const awalan = 'TRX-' + Utilities.formatDate(sekarang(), ZONA, 'yyyyMMdd') + '-';
  let terbesar = 0;
  semua.forEach(function (t) {
    if (t.id.indexOf(awalan) === 0) terbesar = Math.max(terbesar, Number(t.id.slice(awalan.length)) || 0);
  });
  return awalan + String(terbesar + 1).padStart(4, '0');
}

function periksaFoto(foto) {
  if (!foto || typeof foto.base64 !== 'string' || !MIME_FOTO[foto.mime]) {
    throw new GalatPengguna('Foto harus berformat JPG, PNG, atau WEBP.');
  }
  let bytes;
  try {
    bytes = Utilities.base64Decode(foto.base64);
  } catch (err) {
    throw new GalatPengguna('Foto tidak terbaca. Coba pilih ulang fotonya.');
  }
  if (bytes.length > UKURAN_FOTO_MAKS) throw new GalatPengguna('Ukuran foto lebih dari 2 MB.');
  if (!tandaFileCocok(bytes, foto.mime)) throw new GalatPengguna('Isi file bukan foto JPG, PNG, atau WEBP.');
  return { bytes: bytes, mime: foto.mime };
}

// Byte dari Apps Script bertanda (-128..127), jadi dinormalkan dengan & 0xff.
function tandaFileCocok(bytes, mime) {
  const b = function (i) { return bytes[i] & 0xff; };
  if (mime === 'image/jpeg') return b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff;
  if (mime === 'image/png') return b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47;
  return b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50;
}

function folderAnak(induk, nama) {
  const ada = induk.getFoldersByName(nama);
  return ada.hasNext() ? ada.next() : induk.createFolder(nama);
}

function simpanFoto(foto, t) {
  const nota = DriveApp.getFolderById(prop('ID_FOLDER_NOTA'));
  const folder = folderAnak(folderAnak(nota, t.tanggal.slice(0, 4)), t.tanggal.slice(5, 7));
  const file = folder.createFile(Utilities.newBlob(foto.bytes, foto.mime, t.id + MIME_FOTO[foto.mime]));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

function buangFoto(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (err) {
    console.error('Gagal membuang foto ' + fileId, err);
  }
}
