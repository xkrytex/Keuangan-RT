// Apps Script tidak punya bcrypt, jadi password di-hash SHA-256 bersalt yang diulang agar tebakan massal mahal.
const ITERASI_HASH = 2000;
const SESI_ADMIN_DETIK = 6 * 60 * 60;
const SESI_RONDA_DETIK = 60 * 60;
const BATAS_GAGAL = 5;
const KUNCI_GAGAL_DETIK = 15 * 60;
const PESAN_SESI_HABIS = 'Sesi Anda sudah berakhir. Silakan masuk lagi.';
const HURUF_SANDI = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function hashRahasia(rahasia, salt) {
  const sha = Utilities.DigestAlgorithm.SHA_256;
  const garam = Utilities.newBlob(salt).getBytes();
  let hasil = Utilities.computeDigest(sha, salt + ':' + rahasia, Utilities.Charset.UTF_8);
  for (let i = 0; i < ITERASI_HASH; i++) hasil = Utilities.computeDigest(sha, hasil.concat(garam));
  return hasil.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function samaAman(a, b) {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

function saltBaru() {
  return Utilities.getUuid().replace(/-/g, '');
}

function sandiSementara() {
  const acak = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  return acak.slice(0, 12).map(function (b) { return HURUF_SANDI[(b & 0xff) % HURUF_SANDI.length]; }).join('');
}

function cariAdmin(username) {
  return bacaTab(TAB.ADMIN).filter(function (a) { return a.username === username; })[0] || null;
}

function sidikHash(hash) {
  return hash.slice(0, 16);
}

function buatSesi(isi, detik) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  cache().put('sesi:' + token, JSON.stringify(isi), detik);
  return token;
}

function ambilSesi(token, akses) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new GalatPengguna(PESAN_SESI_HABIS, 'SESI_HABIS');
  const isi = cache().get('sesi:' + token);
  if (!isi) throw new GalatPengguna(PESAN_SESI_HABIS, 'SESI_HABIS');
  const sesi = JSON.parse(isi);
  sesi.token = token;

  if (akses === 'ronda') {
    if (sesi.peran !== 'ronda') throw new GalatPengguna(PESAN_SESI_HABIS, 'SESI_HABIS');
    if (sesi.versiPin !== prop('PIN_RONDA_VERSI')) {
      cache().remove('sesi:' + token);
      throw new GalatPengguna(PESAN_SESI_HABIS, 'SESI_HABIS');
    }
    return sesi;
  }

  if (sesi.peran !== 'admin') throw new GalatPengguna('Halaman ini khusus pengurus.', 'SESI_HABIS');
  // Dicek ulang tiap permintaan supaya admin yang dinonaktifkan atau di-reset langsung kehilangan sesinya.
  const admin = cariAdmin(sesi.username);
  if (!admin || admin.aktif !== 'YA' || sidikHash(admin.hash) !== sesi.sidik) {
    cache().remove('sesi:' + token);
    throw new GalatPengguna(PESAN_SESI_HABIS, 'SESI_HABIS');
  }
  if (akses === 'admin' && admin.wajib_ganti === 'YA') {
    throw new GalatPengguna('Ganti password sementara Anda dulu sebelum melanjutkan.', 'WAJIB_GANTI');
  }
  sesi.nama = admin.nama;
  return sesi;
}

function periksaBatasGagal(kunci) {
  if (Number(cache().get('gagal:' + kunci) || 0) >= BATAS_GAGAL) {
    throw new GalatPengguna('Terlalu banyak percobaan yang salah. Coba lagi 15 menit lagi.');
  }
}

function catatGagal(kunci) {
  const n = Number(cache().get('gagal:' + kunci) || 0) + 1;
  cache().put('gagal:' + kunci, String(n), KUNCI_GAGAL_DETIK);
}

function aksiLogin(data) {
  const username = String(data.username || '').trim().toLowerCase().slice(0, 40);
  const password = String(data.password || '');
  if (!username || !password) throw new GalatPengguna('Isi username dan password.');
  periksaBatasGagal('admin:' + username);

  const admin = cariAdmin(username);
  // Hash tetap dihitung untuk username yang tidak ada agar waktu respons tidak membocorkan daftar akun.
  const hash = hashRahasia(password, admin ? admin.salt : 'tidak-ada');
  if (!admin || admin.aktif !== 'YA' || !samaAman(hash, admin.hash)) {
    catatGagal('admin:' + username);
    catatLog(username, 'LOGIN_GAGAL', '', '');
    throw new GalatPengguna('Username atau password salah.');
  }
  cache().remove('gagal:admin:' + username);
  catatLog(username, 'LOGIN', '', '');
  return {
    token: buatSesi({ peran: 'admin', username: username, sidik: sidikHash(admin.hash) }, SESI_ADMIN_DETIK),
    username: username,
    nama: admin.nama,
    jabatan: admin.jabatan,
    wajib_ganti: admin.wajib_ganti === 'YA',
  };
}

function aksiSesiSaya(data, sesi) {
  const admin = cariAdmin(sesi.username);
  return { username: admin.username, nama: admin.nama, jabatan: admin.jabatan, wajib_ganti: admin.wajib_ganti === 'YA' };
}

function aksiLogout(data, sesi) {
  cache().remove('sesi:' + sesi.token);
  return { keluar: true };
}

function wajibPasswordBaru(password, username) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new GalatPengguna('Password baru harus 8 sampai 72 karakter.');
  }
  if (password.toLowerCase().indexOf(username) !== -1) {
    throw new GalatPengguna('Password baru tidak boleh memuat username.');
  }
  return password;
}

function aksiGantiPassword(data, sesi) {
  return denganKunci(function () {
    const admin = cariAdmin(sesi.username);
    if (!samaAman(hashRahasia(String(data.lama || ''), admin.salt), admin.hash)) {
      throw new GalatPengguna('Password lama salah.');
    }
    const baru = wajibPasswordBaru(data.baru, admin.username);
    if (baru === data.lama) throw new GalatPengguna('Password baru harus berbeda dari password lama.');
    admin.salt = saltBaru();
    admin.hash = hashRahasia(baru, admin.salt);
    admin.wajib_ganti = 'TIDAK';
    ubahBaris(TAB.ADMIN, admin._baris, admin);
    cache().remove('sesi:' + sesi.token);
    catatLog(admin.username, 'GANTI_PASSWORD', '', '');
    return {
      token: buatSesi({ peran: 'admin', username: admin.username, sidik: sidikHash(admin.hash) }, SESI_ADMIN_DETIK),
    };
  });
}

function adminUntukDaftar(a) {
  return { username: a.username, nama: a.nama, jabatan: a.jabatan, aktif: a.aktif === 'YA', dibuat_pada: a.dibuat_pada };
}

function aksiDaftarAdmin() {
  return bacaTab(TAB.ADMIN).map(adminUntukDaftar);
}

function buatAkunAdmin(username, nama, jabatan, pelaku) {
  if (typeof username !== 'string' || !/^[a-z0-9_.]{3,30}$/.test(username)) {
    throw new GalatPengguna('Username harus 3 sampai 30 karakter: huruf kecil, angka, titik, atau garis bawah.');
  }
  const namaBersih = wajibTeks(nama, 'Nama', 2, 60);
  const jabatanBersih = wajibTeks(jabatan, 'Jabatan', 2, 40);
  if (cariAdmin(username)) throw new GalatPengguna('Username sudah dipakai.');
  const sandi = sandiSementara();
  const salt = saltBaru();
  tambahBaris(TAB.ADMIN, {
    username: username,
    nama: namaBersih,
    jabatan: jabatanBersih,
    salt: salt,
    hash: hashRahasia(sandi, salt),
    aktif: 'YA',
    wajib_ganti: 'YA',
    dibuat_pada: waktuIso(),
  });
  catatLog(pelaku, 'TAMBAH_ADMIN', username, namaBersih + ' (' + jabatanBersih + ')');
  return { username: username, password_sementara: sandi };
}

function aksiTambahAdmin(data, sesi) {
  return denganKunci(function () {
    return buatAkunAdmin(data.username, data.nama, data.jabatan, sesi.username);
  });
}

function wajibAdminLain(username, sesi) {
  if (username === sesi.username) throw new GalatPengguna('Aksi ini tidak bisa dilakukan pada akun Anda sendiri.');
  const admin = cariAdmin(username);
  if (!admin) throw new GalatPengguna('Admin tidak ditemukan.');
  return admin;
}

// Hash baru juga mengganti sidik sesi, jadi semua sesi lama akun ini langsung tidak berlaku.
function resetSandiAdmin(admin, pelaku) {
  const sandi = sandiSementara();
  admin.salt = saltBaru();
  admin.hash = hashRahasia(sandi, admin.salt);
  admin.wajib_ganti = 'YA';
  ubahBaris(TAB.ADMIN, admin._baris, admin);
  catatLog(pelaku, 'RESET_PASSWORD', admin.username, '');
  return { username: admin.username, password_sementara: sandi };
}

function aksiResetPasswordAdmin(data, sesi) {
  return denganKunci(function () {
    return resetSandiAdmin(wajibAdminLain(data.username, sesi), sesi.username);
  });
}

function aksiNonaktifkanAdmin(data, sesi) {
  return denganKunci(function () {
    const admin = wajibAdminLain(data.username, sesi);
    if (admin.aktif !== 'YA') throw new GalatPengguna('Admin ini sudah nonaktif.');
    admin.aktif = 'TIDAK';
    ubahBaris(TAB.ADMIN, admin._baris, admin);
    catatLog(sesi.username, 'NONAKTIFKAN_ADMIN', admin.username, '');
    return adminUntukDaftar(admin);
  });
}

function aksiAktifkanAdmin(data, sesi) {
  return denganKunci(function () {
    const admin = wajibAdminLain(data.username, sesi);
    if (admin.aktif === 'YA') throw new GalatPengguna('Admin ini sudah aktif.');
    admin.aktif = 'YA';
    ubahBaris(TAB.ADMIN, admin._baris, admin);
    catatLog(sesi.username, 'AKTIFKAN_ADMIN', admin.username, '');
    return adminUntukDaftar(admin);
  });
}

// PIN dipakai bersama, jadi batas gagalnya juga bersama. Risikonya: orang iseng bisa mengunci form ronda 15 menit.
function aksiLoginRonda(data) {
  const pin = String(data.pin || '');
  periksaBatasGagal('ronda');
  const salt = prop('PIN_RONDA_SALT');
  if (!salt || !/^\d{6}$/.test(pin) || !samaAman(hashRahasia(pin, salt), prop('PIN_RONDA_HASH'))) {
    catatGagal('ronda');
    throw new GalatPengguna('PIN salah.');
  }
  cache().remove('gagal:ronda');
  catatLog('ronda', 'LOGIN_RONDA', '', '');
  return { token: buatSesi({ peran: 'ronda', versiPin: prop('PIN_RONDA_VERSI') }, SESI_RONDA_DETIK) };
}

function simpanPinRonda(pin) {
  const salt = saltBaru();
  setProp('PIN_RONDA_SALT', salt);
  setProp('PIN_RONDA_HASH', hashRahasia(pin, salt));
  setProp('PIN_RONDA_VERSI', Utilities.getUuid());
}

function aksiGantiPinRonda(data, sesi) {
  const pin = String(data.pin_baru || '');
  if (!/^\d{6}$/.test(pin)) throw new GalatPengguna('PIN harus 6 angka.');
  if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') {
    throw new GalatPengguna('PIN terlalu mudah ditebak. Pilih kombinasi lain.');
  }
  return denganKunci(function () {
    simpanPinRonda(pin);
    catatLog(sesi.username, 'GANTI_PIN_RONDA', '', '');
    return { diganti: true };
  });
}

function aksiLog(data) {
  const halaman = Number.isInteger(data.halaman) && data.halaman > 0 ? data.halaman : 1;
  const semua = bacaTab(TAB.LOG).reverse();
  const mulai = (halaman - 1) * 50;
  return {
    item: semua.slice(mulai, mulai + 50).map(function (l) {
      return { waktu: l.waktu, pelaku: l.pelaku, aksi: l.aksi, id_terkait: l.id_terkait, detail: l.detail };
    }),
    halaman: halaman,
    jumlah_halaman: Math.max(1, Math.ceil(semua.length / 50)),
  };
}
