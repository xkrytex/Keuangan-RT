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

// ---- Spreadsheet LAPORAN ----
// Tata letaknya dibuat untuk dicetak di A4 (bulanan potret, rekap lanskap) sebagai bahan rapat.
// Warna diambil dari palet web dan tetap terbaca kalau dicetak hitam-putih.
const WARNA_LAPORAN = {
  tua: '#17472A', utama: '#1F5C36', muda: '#E3EFE3', lembut: '#F4F8F3',
  garis: '#B7C7BA', sekunder: '#556158', demo: '#FCE8E6', teksDemo: '#A6392E',
};
// Nol ditulis "-" agar kolom kosong tidak terbaca sebagai angka yang terlewat.
const FORMAT_RUPIAH = '"Rp "#,##0;"-Rp "#,##0;"-"';
const TINGGI_BARIS = 24;
const TEKS_DEMO = 'DATA CONTOH UNTUK DEMO. Angka di laporan ini bukan keuangan RT yang sebenarnya.';

function bukaLaporan() {
  return SpreadsheetApp.openById(prop('ID_LAPORAN'));
}

// Urutan tab: Petunjuk, lalu per tahun terbaru: rekap tahunnya, kemudian bulan dari yang terbaru.
function kunciUrutTab(nama) {
  if (nama === 'Petunjuk') return '0';
  const m = /^(Rekap|Laporan)-(\d{4})(?:-(\d{2}))?$/.exec(nama);
  if (!m) return '9' + nama;
  return '1' + (9999 - Number(m[2])) + (m[1] === 'Rekap' ? '00' : String(99 - Number(m[3])).padStart(2, '0'));
}

// Tab lama dikosongkan di tempat, bukan dihapus, agar tautan ke tab itu (gid) tetap berlaku.
function siapkanTab(ss, nama, lebar) {
  let sheet = ss.getSheetByName(nama);
  if (sheet) {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
    sheet.clear();
    sheet.setRowHeights(1, sheet.getMaxRows(), TINGGI_BARIS);
  } else {
    const kunci = kunciUrutTab(nama);
    const posisi = ss.getSheets().filter(function (s) { return kunciUrutTab(s.getName()) < kunci; }).length;
    sheet = ss.insertSheet(nama, posisi);
  }
  if (sheet.getMaxColumns() > lebar) sheet.deleteColumns(lebar + 1, sheet.getMaxColumns() - lebar);
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(0);
  return sheet;
}

function formatWaktu(iso) {
  return formatTanggal(iso.slice(0, 10)) + ' pukul ' + iso.slice(11, 16).replace(':', '.');
}

// Menyusun isi tab baris demi baris sambil mencatat gaya tiap baris, lalu menulis semuanya sekaligus.
// Satu panggilan setValues jauh lebih cepat daripada menulis per sel di Apps Script.
function susunanLembar(lebar) {
  const baris = [];
  const gaya = [];
  return {
    lebar: lebar,
    baris: baris,
    tambah: function (isi, jenis, opsi) {
      const lengkap = isi.slice();
      while (lengkap.length < lebar) lengkap.push('');
      baris.push(lengkap);
      gaya.push({ n: baris.length, jenis: jenis || '', opsi: opsi || {} });
      return baris.length;
    },
    gaya: gaya,
  };
}

function tulisKop(s, judul, keterangan) {
  s.tambah([judul], 'judul');
  s.tambah(['RT 05 RW 02 Donglo Santren, Kedung Sugo'], 'subjudul');
  s.tambah([keterangan], 'keterangan');
  if (prop('MODE_DEMO') === '1') s.tambah([TEKS_DEMO], 'demo');
  s.tambah([''], 'jarak');
}

// Kolom ttd: [kolom awal, jumlah kolom] untuk Ketua RT dan Bendahara.
function tulisTandaTangan(s, kiri, kanan) {
  s.tambah([''], 'jarak');
  const tempat = [];
  tempat[kanan[0] - 1] = 'Donglo Santren, ' + formatTanggal(hariIni());
  s.tambah(tempat, 'ttd', { kiri: kiri, kanan: kanan });
  const jabatan = [];
  jabatan[kiri[0] - 1] = 'Ketua RT';
  jabatan[kanan[0] - 1] = 'Bendahara';
  s.tambah(jabatan, 'ttd', { kiri: kiri, kanan: kanan });
  s.tambah([''], 'ruang-ttd');
  const nama = [];
  nama[kiri[0] - 1] = '(................................)';
  nama[kanan[0] - 1] = '(................................)';
  s.tambah(nama, 'ttd', { kiri: kiri, kanan: kanan });
  s.tambah([''], 'jarak');
  s.tambah(['Dibuat otomatis oleh web kas RT pada ' + formatWaktu(waktuIso()) + '.'], 'catatan-kaki');
}

function terapkanGaya(sheet, s) {
  const L = s.lebar;
  const W = WARNA_LAPORAN;
  sheet.getRange(1, 1, s.baris.length, L).setValues(s.baris)
    .setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle').setFontColor('#17201A');
  sheet.setRowHeights(1, s.baris.length, TINGGI_BARIS);
  const baris = function (n, dari, jumlah) { return sheet.getRange(n, dari || 1, 1, jumlah || L - (dari || 1) + 1); };
  const garisTipis = SpreadsheetApp.BorderStyle.SOLID;

  s.gaya.forEach(function (g) {
    const o = g.opsi;
    switch (g.jenis) {
      case 'judul':
        baris(g.n).merge().setFontSize(15).setFontWeight('bold').setFontColor(W.tua).setHorizontalAlignment('center');
        sheet.setRowHeight(g.n, 32);
        break;
      case 'subjudul':
        baris(g.n).merge().setFontSize(11).setFontWeight('bold').setHorizontalAlignment('center');
        break;
      case 'keterangan':
        baris(g.n).merge().setFontColor(W.sekunder).setHorizontalAlignment('center')
          .setBorder(null, null, true, null, null, null, W.tua, SpreadsheetApp.BorderStyle.SOLID_THICK);
        sheet.setRowHeight(g.n, 28);
        break;
      case 'demo':
        baris(g.n).merge().setBackground(W.demo).setFontColor(W.teksDemo).setFontWeight('bold')
          .setHorizontalAlignment('center').setWrap(true);
        sheet.setRowHeight(g.n, 30);
        break;
      case 'bagian':
        baris(g.n).merge().setBackground(W.utama).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(11);
        sheet.setRowHeight(g.n, 28);
        break;
      case 'kepala-tabel':
        baris(g.n).setBackground(W.muda).setFontWeight('bold').setFontColor(W.tua)
          .setBorder(true, true, true, true, true, true, W.garis, garisTipis);
        if (o.kanan) sheet.getRange(g.n, o.kanan, 1, L - o.kanan + 1).setHorizontalAlignment('right');
        break;
      case 'kepala-grup':
        baris(g.n).setBackground(W.muda).setFontWeight('bold').setFontColor(W.tua).setHorizontalAlignment('center')
          .setBorder(true, true, true, true, true, true, W.garis, garisTipis);
        o.gabung.forEach(function (r) { sheet.getRange(g.n, r[0], 1, r[1]).merge(); });
        break;
      case 'isi':
        baris(g.n).setBorder(true, true, true, true, true, true, W.garis, garisTipis);
        if (o.gabung) sheet.getRange(g.n, o.gabung[0], 1, o.gabung[1]).merge();
        if (o.lembut) baris(g.n).setBackground(W.lembut);
        if (o.miring) baris(g.n, 2).setFontStyle('italic').setFontColor(W.sekunder);
        if (o.tebal) baris(g.n).setFontWeight('bold');
        break;
      case 'jumlah':
        baris(g.n).setFontWeight('bold').setBackground(W.lembut)
          .setBorder(true, true, true, true, true, true, W.garis, garisTipis)
          .setBorder(true, null, null, null, null, null, W.tua, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
        if (o.gabung) sheet.getRange(g.n, o.gabung[0], 1, o.gabung[1]).merge();
        break;
      case 'akhir':
        baris(g.n).setFontWeight('bold').setBackground(W.muda).setFontColor(W.tua)
          .setBorder(true, true, true, true, true, true, W.garis, garisTipis);
        if (o.gabung) sheet.getRange(g.n, o.gabung[0], 1, o.gabung[1]).merge();
        break;
      case 'ttd':
        sheet.getRange(g.n, o.kiri[0], 1, o.kiri[1]).merge().setHorizontalAlignment('center');
        sheet.getRange(g.n, o.kanan[0], 1, o.kanan[1]).merge().setHorizontalAlignment('center');
        break;
      case 'ruang-ttd':
        sheet.setRowHeight(g.n, 64);
        break;
      case 'catatan-kaki':
        baris(g.n).merge().setFontSize(8).setFontColor(W.sekunder).setFontStyle('italic');
        break;
      case 'jarak':
        sheet.setRowHeight(g.n, 12);
        break;
    }
  });
}

// Tinggi baris yang diatur manual tidak ikut membesar saat teks terbungkus, jadi teks panjang diberi tinggi
// sesuai perkiraan jumlah barisnya (lebar kolom dibagi lebar rata-rata huruf Arial 10).
function sesuaikanTinggi(sheet, s, kolom, hurufPerBaris) {
  s.gaya.forEach(function (g) {
    if (g.jenis !== 'isi' || g.opsi.gabung) return;
    const jumlahBaris = Math.ceil(String(s.baris[g.n - 1][kolom - 1]).length / hurufPerBaris);
    if (jumlahBaris > 1) sheet.setRowHeight(g.n, 8 + jumlahBaris * 16);
  });
}

function tulisLaporanBulanan(periode) {
  const ss = bukaLaporan();
  const semua = bacaTab(TAB.TRANSAKSI);
  const ringkas = ringkasBulan(semua, periode);
  const status = statusPeriode(periode);
  const teksStatus = { TUTUP: 'Buku sudah ditutup', DIBUKA: 'Buku dibuka kembali untuk koreksi', TERBUKA: 'Buku belum ditutup' };
  const akhirBulan = geserTanggal(geserPeriode(periode, 1) + '-01', -1);

  // Kolom: A Tanggal, B Keterangan, C Kategori, D Masuk, E Keluar.
  const s = susunanLembar(5);
  tulisKop(s, 'LAPORAN KEUANGAN BULANAN', 'Periode ' + namaPeriode(periode) + '  ·  ' + teksStatus[status]);

  s.tambah(['Ringkasan'], 'bagian');
  s.tambah(['Kas', 'Saldo awal', 'Pemasukan', 'Pengeluaran', 'Saldo akhir'], 'kepala-tabel', { kanan: 2 });
  const total = { saldo_awal: 0, total_masuk: 0, total_keluar: 0, saldo_akhir: 0 };
  KAS.forEach(function (kas) {
    const r = ringkas[kas];
    s.tambah([NAMA_KAS[kas], r.saldo_awal, r.total_masuk, r.total_keluar, r.saldo_akhir], 'isi');
    Object.keys(total).forEach(function (k) { total[k] += r[k]; });
  });
  s.tambah(['Jumlah ketiga kas', total.saldo_awal, total.total_masuk, total.total_keluar, total.saldo_akhir], 'jumlah');
  s.tambah([''], 'jarak');

  KAS.forEach(function (kas) {
    const r = ringkas[kas];
    s.tambah([NAMA_KAS[kas]], 'bagian');
    s.tambah(['Tanggal', 'Keterangan', 'Kategori', 'Masuk', 'Keluar'], 'kepala-tabel', { kanan: 4 });
    s.tambah(['', 'Saldo awal ' + formatTanggal(periode + '-01'), '', r.saldo_awal], 'isi', { tebal: true, lembut: true, gabung: [4, 2] });
    // Nominalnya sudah ada di baris Saldo awal, jadi di sini hanya keterangan agar tidak terhitung dua kali.
    r.saldo_awal_dicatat.forEach(function (t) {
      s.tambah([formatTanggal(t.tanggal), selAman('Sudah termasuk saldo awal: ' + t.uraian + ' (' + formatRupiah(t.nominal) + ')')],
        'isi', { miring: true, gabung: [2, 4] });
    });
    r.transaksi.forEach(function (t) {
      const uraian = t.kas_lawan ? t.uraian + ' (' + (t.masuk ? 'dari ' : 'ke ') + NAMA_KAS[t.kas_lawan] + ')' : t.uraian;
      s.tambah([formatTanggal(t.tanggal), selAman(uraian), selAman(t.kategori), t.masuk || '', t.keluar || ''], 'isi');
    });
    if (!r.transaksi.length) s.tambah(['', 'Tidak ada pemasukan atau pengeluaran bulan ini.'], 'isi', { miring: true, gabung: [2, 4] });
    s.tambah(['', 'Jumlah', '', r.total_masuk, r.total_keluar], 'jumlah');
    s.tambah(['', 'Saldo akhir ' + formatTanggal(akhirBulan), '', r.saldo_akhir], 'akhir', { gabung: [4, 2] });
    s.tambah([''], 'jarak');
  });
  tulisTandaTangan(s, [2, 1], [4, 2]);

  const sheet = siapkanTab(ss, 'Laporan-' + periode, 5);
  terapkanGaya(sheet, s);
  sheet.getRange(1, 2, s.baris.length, 4).setNumberFormat(FORMAT_RUPIAH);
  sheet.getRange(1, 2, s.baris.length, 1).setWrap(true);
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 300);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidths(4, 2, 110);
  sesuaikanTinggi(sheet, s, 2, 46);
  sheet.setTabColor(WARNA_LAPORAN.muda);

  tulisRekapTahun(ss, semua, periode.slice(0, 4));
  tulisPetunjuk(ss);
}

function tulisRekapTahun(ss, semua, tahun) {
  const rekap = rekapTahun(semua, tahun);
  const sekarang = periodeDari(hariIni());
  const awalTahun = hitungSaldo(semua, (Number(tahun) - 1) + '-12-31');
  // Saldo awal kas yang dicatat di tahun ini (awal pembukuan) ikut dihitung sebagai saldo awal, sama seperti laporan bulanan.
  hanyaAktif(semua).forEach(function (t) {
    if (adalahSaldoAwal(t) && t.tanggal.slice(0, 4) === tahun) awalTahun[t.kas] += t.nominal;
  });

  // Kolom: A Bulan, lalu per kas: Masuk, Keluar, Saldo akhir.
  const L = 1 + KAS.length * 3;
  const s = susunanLembar(L);
  tulisKop(s, 'REKAP KEUANGAN TAHUN ' + tahun, 'Januari sampai Desember ' + tahun + '  ·  Pemasukan, pengeluaran, dan saldo akhir per bulan');

  const grup = ['Bulan'];
  const sub = [''];
  KAS.forEach(function (kas) {
    grup.push(NAMA_KAS[kas], '', '');
    sub.push('Masuk', 'Keluar', 'Saldo akhir');
  });
  const n1 = s.tambah(grup, 'kepala-grup', { gabung: KAS.map(function (k, i) { return [2 + i * 3, 3]; }) });
  s.tambah(sub, 'kepala-grup', { gabung: [] });

  const awal = ['Saldo awal'];
  KAS.forEach(function (kas) { awal.push('', '', awalTahun[kas]); });
  s.tambah(awal, 'isi', { tebal: true, lembut: true });

  const jumlah = ['Jumlah'];
  const masuk = {};
  const keluar = {};
  let terakhir = null;
  KAS.forEach(function (kas) { masuk[kas] = 0; keluar[kas] = 0; });
  rekap.bulan.forEach(function (b) {
    // Bulan yang belum datang dikosongkan agar saldonya tidak terbaca sebagai angka pasti.
    if (b.periode > sekarang) {
      s.tambah([BULAN[Number(b.periode.slice(5, 7)) - 1]], 'isi', { miring: true });
      return;
    }
    const isi = [BULAN[Number(b.periode.slice(5, 7)) - 1]];
    KAS.forEach(function (kas) {
      isi.push(b.kas[kas].masuk, b.kas[kas].keluar, b.kas[kas].saldo_akhir);
      masuk[kas] += b.kas[kas].masuk;
      keluar[kas] += b.kas[kas].keluar;
    });
    terakhir = b;
    s.tambah(isi, 'isi');
  });
  KAS.forEach(function (kas) { jumlah.push(masuk[kas], keluar[kas], terakhir ? terakhir.kas[kas].saldo_akhir : awalTahun[kas]); });
  s.tambah(jumlah, 'jumlah');
  tulisTandaTangan(s, [2, 3], [L - 2, 3]);

  const sheet = siapkanTab(ss, 'Rekap-' + tahun, L);
  terapkanGaya(sheet, s);
  // Kolom Bulan pada dua baris judul digabung ke bawah.
  sheet.getRange(n1, 1, 2, 1).merge().setVerticalAlignment('middle');
  // Saldo awal, 12 bulan, dan Jumlah.
  sheet.getRange(n1 + 2, 2, 14, L - 1).setNumberFormat(FORMAT_RUPIAH).setHorizontalAlignment('right');
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidths(2, L - 1, 96);
  sheet.setTabColor(WARNA_LAPORAN.utama);
}

// Daftar isi spreadsheet: setiap laporan punya tautan ke tabnya dan tautan PDF A4 yang siap dicetak.
function tulisPetunjuk(ss) {
  const ditutup = {};
  barisTutupBuku().forEach(function (b) { ditutup[b.periode] = b.status; });
  const daftar = ss.getSheets().filter(function (sh) { return sh.getName() !== 'Petunjuk' && kunciUrutTab(sh.getName()).charAt(0) === '1'; })
    .sort(function (a, b) { return kunciUrutTab(a.getName()) < kunciUrutTab(b.getName()) ? -1 : 1; });

  const s = susunanLembar(4);
  s.tambah(['LAPORAN KEUANGAN RT 05 RW 02'], 'judul');
  s.tambah(['Donglo Santren, Kedung Sugo'], 'subjudul');
  s.tambah(['Diisi otomatis oleh web kas RT. Spreadsheet ini hanya bisa dilihat.'], 'keterangan');
  if (prop('MODE_DEMO') === '1') s.tambah([TEKS_DEMO], 'demo');
  s.tambah([''], 'jarak');
  const nPanduan = s.tambah(['Untuk dicetak sebagai bahan rapat, klik "Unduh PDF". PDF sudah diatur ke kertas A4: laporan bulanan tegak, rekap tahunan mendatar.'],
    'isi', { gabung: [1, 4], miring: true });
  s.tambah([''], 'jarak');
  s.tambah(['Laporan', 'Status', 'Tab', 'PDF'], 'kepala-tabel');
  const mulai = s.baris.length + 1;
  daftar.forEach(function (sh) {
    const nama = sh.getName();
    const rekap = nama.indexOf('Rekap-') === 0;
    const periode = nama.replace(/^(Rekap|Laporan)-/, '');
    const status = rekap ? 'Rekap tahunan' : ({ TUTUP: 'Buku ditutup', DIBUKA: 'Dibuka kembali' })[ditutup[periode]] || 'Bulan berjalan';
    s.tambah([rekap ? 'Rekap tahun ' + periode : 'Laporan ' + namaPeriode(periode), status, 'Buka tab', 'Unduh PDF'], 'isi', { tebal: rekap });
  });
  if (!daftar.length) s.tambah(['Belum ada laporan. Laporan pertama ditulis setelah ada transaksi.'], 'isi', { gabung: [1, 4], miring: true });

  const sheet = siapkanTab(ss, 'Petunjuk', 4);
  terapkanGaya(sheet, s);
  daftar.forEach(function (sh, i) {
    const rekap = sh.getName().indexOf('Rekap-') === 0;
    sheet.getRange(mulai + i, 3).setRichTextValue(tautanSel('Buka tab', '#gid=' + sh.getSheetId()));
    sheet.getRange(mulai + i, 4).setRichTextValue(tautanSel('Unduh PDF', urlPdf(ss, sh, !rekap)));
  });
  sheet.getRange(1, 1, s.baris.length, 4).setWrap(true);
  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidths(3, 2, 110);
  sheet.setRowHeight(nPanduan, 42);
}

function tautanSel(teks, url) {
  return SpreadsheetApp.newRichTextValue().setText(teks).setLinkUrl(url).build();
}

function urlPdf(ss, sheet, tegak) {
  return 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&gid=' + sheet.getSheetId() +
    '&size=A4&portrait=' + tegak + '&fitw=true&gridlines=false&printtitle=false&sheetnames=false' +
    '&pagenum=CENTER&horizontal_alignment=CENTER&top_margin=0.6&bottom_margin=0.6&left_margin=0.6&right_margin=0.6';
}

// Pemicu harian: tab bulan berjalan diperbarui setiap pagi, begitu juga bulan lalu selama bukunya belum ditutup
// (petugas ronda masih boleh mencatat jimpitan kemarin, jadi tanggal 1 pun bulan lalu bisa bertambah).
function laporanOtomatisHarian() {
  const sekarang = periodeDari(hariIni());
  const lalu = geserPeriode(sekarang, -1);
  const adaTransaksi = {};
  hanyaAktif(bacaTab(TAB.TRANSAKSI)).forEach(function (t) { adaTransaksi[periodeDari(t.tanggal)] = true; });
  if (adaTransaksi[lalu] && statusPeriode(lalu) !== 'TUTUP') tulisLaporanAman(lalu);
  if (adaTransaksi[sekarang]) tulisLaporanAman(sekarang);
}

// Nama lama pemicu bulanan. Dipertahankan agar pemicu yang sudah terpasang sebelum pembaruan tidak galat.
function laporanOtomatisBulanan() {
  laporanOtomatisHarian();
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
