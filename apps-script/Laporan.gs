const CADANGAN_DISIMPAN = 12;

function barisTutupBuku() {
  return bacaTab(TAB.TUTUP);
}

function periodeTerakhirDitutup() {
  let terakhir = '';
  barisTutupBuku().forEach(function (b) {
    if (b.status === 'TUTUP' && b.periode > terakhir) terakhir = b.periode;
  });
  return terakhir;
}

// Transaksi hanya boleh masuk setelah bulan terakhir yang ditutup, agar saldo awal bulan tertutup tidak berubah.
function pastikanBulanTerbuka(tanggal) {
  const terakhir = periodeTerakhirDitutup();
  if (terakhir && periodeDari(tanggal) <= terakhir) {
    throw new GalatPengguna('Buku sampai ' + namaPeriode(terakhir) + ' sudah ditutup. ' +
      'Buka kembali bukunya dulu kalau perlu koreksi.');
  }
}

function ringkasBulan(semua, periode) {
  const awal = hitungSaldo(semua, geserTanggal(periode + '-01', -1));
  const hasil = {};
  KAS.forEach(function (kas) {
    hasil[kas] = { saldo_awal: awal[kas], total_masuk: 0, total_keluar: 0, saldo_akhir: awal[kas], transaksi: [], saldo_awal_dicatat: [] };
  });
  hanyaAktif(semua).filter(function (t) { return periodeDari(t.tanggal) === periode; })
    .sort(function (a, b) { return urutTerbaru(b, a); })
    .forEach(function (t) {
      // Saldo awal adalah uang yang sudah ada sebelum pembukuan di web dimulai, bukan pemasukan bulan itu.
      // Ia ditambahkan ke saldo awal bulan dan dicantumkan terpisah agar tetap bisa ditelusuri.
      if (adalahSaldoAwal(t)) {
        const r = hasil[t.kas];
        r.saldo_awal += t.nominal;
        r.saldo_akhir += t.nominal;
        r.saldo_awal_dicatat.push({ id: t.id, tanggal: t.tanggal, uraian: t.uraian, nominal: t.nominal });
        return;
      }
      const efek = efekTransaksi(t);
      Object.keys(efek).forEach(function (kas) {
        const r = hasil[kas];
        if (efek[kas] > 0) r.total_masuk += efek[kas];
        else r.total_keluar -= efek[kas];
        r.saldo_akhir += efek[kas];
        r.transaksi.push({
          id: t.id, tanggal: t.tanggal, jenis: t.jenis, kategori: t.kategori, uraian: t.uraian,
          kas_lawan: t.jenis === 'PINDAH' ? (kas === t.kas ? t.kas_tujuan : t.kas) : '',
          masuk: efek[kas] > 0 ? efek[kas] : 0,
          keluar: efek[kas] < 0 ? -efek[kas] : 0,
          bukti_id: t.bukti_file_id,
        });
      });
    });
  return hasil;
}

function statusPeriode(periode) {
  const baris = barisTutupBuku().filter(function (b) { return b.periode === periode; })[0];
  return baris ? baris.status : 'TERBUKA';
}

// Alamat spreadsheet LAPORAN disimpan sekali agar halaman laporan tidak membuka spreadsheet di setiap permintaan.
function urlLaporan() {
  let url = prop('URL_LAPORAN');
  if (!url && prop('ID_LAPORAN')) {
    url = SpreadsheetApp.openById(prop('ID_LAPORAN')).getUrl();
    setProp('URL_LAPORAN', url);
  }
  return url || '';
}

function aksiLaporan(data) {
  let hasil;
  if (data.periode) {
    const periode = wajibPeriode(data.periode);
    hasil = denganCache('laporan:' + periode, function () {
      return { periode: periode, status: statusPeriode(periode), kas: ringkasBulan(bacaTab(TAB.TRANSAKSI), periode) };
    });
  } else {
    const tahun = String(data.tahun || '');
    if (!/^\d{4}$/.test(tahun)) throw new GalatPengguna('Tahun tidak valid.');
    hasil = denganCache('rekap:' + tahun, function () { return rekapTahun(bacaTab(TAB.TRANSAKSI), tahun); });
  }
  hasil.url_laporan = urlLaporan();
  hasil.periode_terakhir_ditutup = periodeTerakhirDitutup();
  return hasil;
}

// Bulan yang bisa ditutup berikutnya: sesudah bulan terakhir yang ditutup, atau bulan transaksi paling awal.
function aksiStatusBuku() {
  const terakhir = periodeTerakhirDitutup();
  let berikut = '';
  if (terakhir) {
    berikut = geserPeriode(terakhir, 1);
  } else {
    hanyaAktif(bacaTab(TAB.TRANSAKSI)).forEach(function (t) {
      const p = periodeDari(t.tanggal);
      if (!berikut || p < berikut) berikut = p;
    });
  }
  const petaNama = petaNamaAdmin();
  const riwayat = {};
  barisTutupBuku().forEach(function (b) {
    if (riwayat[b.periode]) return;
    riwayat[b.periode] = {
      periode: b.periode, status: b.status,
      ditutup_oleh: petaNama[b.ditutup_oleh] || b.ditutup_oleh, ditutup_pada: b.ditutup_pada,
      alasan_buka: b.alasan_buka, dibuka_oleh: petaNama[b.dibuka_oleh] || b.dibuka_oleh, dibuka_pada: b.dibuka_pada,
    };
  });
  return {
    terakhir: terakhir,
    berikut: berikut,
    bisa_ditutup: Boolean(berikut) && berikut < periodeDari(hariIni()),
    riwayat: Object.keys(riwayat).sort().reverse().map(function (p) { return riwayat[p]; }),
    url_laporan: urlLaporan(),
  };
}

function rekapTahun(semua, tahun) {
  const bulan = [];
  for (let m = 1; m <= 12; m++) {
    const periode = tahun + '-' + String(m).padStart(2, '0');
    const r = ringkasBulan(semua, periode);
    const isi = { periode: periode, kas: {} };
    KAS.forEach(function (kas) {
      isi.kas[kas] = { masuk: r[kas].total_masuk, keluar: r[kas].total_keluar, saldo_akhir: r[kas].saldo_akhir };
    });
    bulan.push(isi);
  }
  return { tahun: tahun, bulan: bulan };
}

function aksiTutupBuku(data, sesi) {
  const periode = wajibPeriode(data.periode);
  const hasil = denganKunci(function () {
    if (periode >= periodeDari(hariIni())) {
      throw new GalatPengguna('Buku hanya bisa ditutup setelah bulannya berakhir.');
    }
    const terakhir = periodeTerakhirDitutup();
    const semua = bacaTab(TAB.TRANSAKSI);
    if (terakhir) {
      if (periode <= terakhir) throw new GalatPengguna('Buku ' + namaPeriode(periode) + ' sudah ditutup.');
      if (periode !== geserPeriode(terakhir, 1)) {
        throw new GalatPengguna('Tutup buku ' + namaPeriode(geserPeriode(terakhir, 1)) + ' dulu.');
      }
    } else {
      const lebihAwal = hanyaAktif(semua).filter(function (t) { return periodeDari(t.tanggal) < periode; });
      if (lebihAwal.length) {
        const pertama = lebihAwal.map(function (t) { return periodeDari(t.tanggal); }).sort()[0];
        throw new GalatPengguna('Masih ada transaksi di ' + namaPeriode(pertama) + '. Tutup buku bulan itu dulu.');
      }
    }

    const ringkas = ringkasBulan(semua, periode);
    const lama = barisTutupBuku();
    KAS.forEach(function (kas) {
      const r = ringkas[kas];
      const baris = {
        periode: periode, kas: kas, saldo_awal: r.saldo_awal, total_masuk: r.total_masuk,
        total_keluar: r.total_keluar, saldo_akhir: r.saldo_akhir, status: 'TUTUP',
        ditutup_oleh: sesi.username, ditutup_pada: waktuIso(), alasan_buka: '', dibuka_oleh: '', dibuka_pada: '',
      };
      const ada = lama.filter(function (b) { return b.periode === periode && b.kas === kas; })[0];
      if (ada) ubahBaris(TAB.TUTUP, ada._baris, baris);
      else tambahBaris(TAB.TUTUP, baris);
    });
    naikkanVersiData();
    catatLog(sesi.username, 'TUTUP_BUKU', periode, KAS.map(function (kas) {
      return NAMA_KAS[kas] + ' ' + formatRupiah(ringkas[kas].saldo_akhir);
    }).join(', '));
    return { periode: periode, status: 'TUTUP', kas: ringkas };
  });
  tulisLaporanAman(periode);
  return hasil;
}

function aksiBukaBuku(data, sesi) {
  const periode = wajibPeriode(data.periode);
  const alasan = wajibTeks(data.alasan, 'Alasan membuka buku', 5, 200);
  return denganKunci(function () {
    const terakhir = periodeTerakhirDitutup();
    if (periode !== terakhir) {
      throw new GalatPengguna(terakhir
        ? 'Hanya buku bulan terakhir yang ditutup (' + namaPeriode(terakhir) + ') yang bisa dibuka kembali.'
        : 'Belum ada buku yang ditutup.');
    }
    barisTutupBuku().forEach(function (b) {
      if (b.periode !== periode) return;
      b.status = 'DIBUKA';
      b.alasan_buka = alasan;
      b.dibuka_oleh = sesi.username;
      b.dibuka_pada = waktuIso();
      ubahBaris(TAB.TUTUP, b._baris, b);
    });
    naikkanVersiData();
    catatLog(sesi.username, 'BUKA_BUKU', periode, alasan);
    return { periode: periode, status: 'DIBUKA' };
  });
}

function aksiTulisLaporan(data, sesi) {
  const periode = wajibPeriode(data.periode);
  tulisLaporanBulanan(periode);
  catatLog(sesi.username, 'TULIS_LAPORAN', periode, '');
  return { periode: periode, url: urlLaporan() };
}

function tulisLaporanAman(periode) {
  try {
    tulisLaporanBulanan(periode);
  } catch (err) {
    console.error('Gagal menulis laporan ' + periode, err);
  }
}

function tabBersih(ss, nama) {
  const ada = ss.getSheetByName(nama);
  if (ada) {
    ada.clear();
    return ada;
  }
  return ss.insertSheet(nama);
}

function tulisLaporanBulanan(periode) {
  const ss = SpreadsheetApp.openById(prop('ID_LAPORAN'));
  const semua = bacaTab(TAB.TRANSAKSI);
  const ringkas = ringkasBulan(semua, periode);
  const status = statusPeriode(periode);
  const sheet = tabBersih(ss, 'Laporan-' + periode);

  const baris = [
    ['LAPORAN KEUANGAN RT 05 RW 02', '', '', '', ''],
    ['Donglo Santren, Kedung Sugo', '', '', '', ''],
    ['Periode: ' + namaPeriode(periode) + (status === 'TUTUP' ? ' (buku sudah ditutup)' : ' (buku belum ditutup)'), '', '', '', ''],
    ['', '', '', '', ''],
  ];
  const barisJudul = [];
  KAS.forEach(function (kas) {
    const r = ringkas[kas];
    barisJudul.push(baris.length + 1);
    baris.push([NAMA_KAS[kas], '', '', '', '']);
    baris.push(['Tanggal', 'Keterangan', 'Kategori', 'Masuk', 'Keluar']);
    baris.push(['', 'Saldo awal', '', r.saldo_awal, '']);
    // Nominalnya sudah ada di baris Saldo awal, jadi di sini hanya keterangan agar tidak terhitung dua kali.
    r.saldo_awal_dicatat.forEach(function (t) {
      baris.push([formatTanggal(t.tanggal), selAman('Termasuk saldo awal: ' + t.uraian + ' (' + formatRupiah(t.nominal) + ')'),
        KATEGORI_SALDO_AWAL, '', '']);
    });
    r.transaksi.forEach(function (t) {
      const uraian = t.kas_lawan ? t.uraian + ' (' + (t.masuk ? 'dari ' : 'ke ') + NAMA_KAS[t.kas_lawan] + ')' : t.uraian;
      baris.push([formatTanggal(t.tanggal), selAman(uraian), selAman(t.kategori), t.masuk || '', t.keluar || '']);
    });
    baris.push(['', 'Jumlah', '', r.total_masuk, r.total_keluar]);
    baris.push(['', 'Saldo akhir', '', r.saldo_akhir, '']);
    baris.push(['', '', '', '', '']);
  });
  baris.push(['Dibuat otomatis: ' + formatTanggal(hariIni()), '', '', '', '']);

  sheet.getRange(1, 1, baris.length, 5).setValues(baris);
  sheet.getRange(1, 1, 3, 1).setFontWeight('bold');
  barisJudul.forEach(function (n) {
    sheet.getRange(n, 1, 1, 5).setFontWeight('bold');
    sheet.getRange(n + 1, 1, 1, 5).setFontWeight('bold').setBackground('#E3EFE3');
  });
  sheet.getRange(1, 4, baris.length, 2).setNumberFormat('#,##0');
  sheet.setColumnWidths(1, 1, 110);
  sheet.setColumnWidth(2, 320);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidths(4, 2, 120);

  tulisRekapTahun(ss, semua, periode.slice(0, 4));
}

function tulisRekapTahun(ss, semua, tahun) {
  const rekap = rekapTahun(semua, tahun);
  const sheet = tabBersih(ss, 'Rekap-' + tahun);
  const judul = ['Bulan'];
  KAS.forEach(function (kas) {
    judul.push(NAMA_KAS[kas] + ' masuk', NAMA_KAS[kas] + ' keluar', NAMA_KAS[kas] + ' saldo akhir');
  });
  const baris = [['REKAP KEUANGAN RT 05 RW 02 TAHUN ' + tahun].concat(judul.slice(1).map(function () { return ''; })), judul];
  rekap.bulan.forEach(function (b) {
    const isi = [namaPeriode(b.periode)];
    KAS.forEach(function (kas) { isi.push(b.kas[kas].masuk, b.kas[kas].keluar, b.kas[kas].saldo_akhir); });
    baris.push(isi);
  });
  sheet.getRange(1, 1, baris.length, judul.length).setValues(baris);
  sheet.getRange(1, 1, 2, judul.length).setFontWeight('bold');
  sheet.getRange(3, 2, 12, judul.length - 1).setNumberFormat('#,##0');
  sheet.setFrozenRows(2);
}

function laporanOtomatisBulanan() {
  tulisLaporanAman(geserPeriode(periodeDari(hariIni()), -1));
}

function cadanganMingguan() {
  const folder = DriveApp.getFolderById(prop('ID_FOLDER_CADANGAN'));
  DriveApp.getFileById(prop('ID_DATA')).makeCopy('Cadangan DATA ' + hariIni(), folder);
  const file = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) file.push(iter.next());
  file.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  file.slice(CADANGAN_DISIMPAN).forEach(function (f) { f.setTrashed(true); });
}
