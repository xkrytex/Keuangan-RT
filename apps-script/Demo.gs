// Data contoh untuk demo ke warga sebelum pembukuan sungguhan dimulai.
// Jalankan isiDataDemo dari editor. Selama data demo terpasang, web dan laporan menampilkan tanda "data contoh".
// Sebelum mulai mencatat keuangan yang sebenarnya, jalankan hapusDataDemo: hanya data demo yang dihapus.
//
// Penanda data demo: id transaksi berawalan DEMO- dan baris tutup buku yang ditutup oleh PENCATAT_DEMO.
const AWALAN_ID_DEMO = 'DEMO-';
const PENCATAT_DEMO = 'Bendahara (data contoh)';
const BULAN_DEMO = 4;
const PETUGAS_DEMO = ['Pak Slamet', 'Mas Joko', 'Pak Budi', 'Mas Rian', 'Pak Darto', 'Mas Eko', 'Pak Wahyu'];

function isiDataDemo() {
  const hasil = denganKunci(function () {
    const semua = bacaTab(TAB.TRANSAKSI);
    const sekarang = periodeDari(hariIni());
    const mulai = geserPeriode(sekarang, -BULAN_DEMO);
    if (semua.some(function (t) { return t.id.indexOf(AWALAN_ID_DEMO) === 0; })) {
      throw new Error('Data demo sudah terpasang. Jalankan hapusDataDemo dulu kalau ingin mengisi ulang.');
    }
    if (barisTutupBuku().length) {
      throw new Error('Sudah ada riwayat tutup buku. Data demo hanya bisa diisi sebelum pembukuan sungguhan dimulai.');
    }
    const asli = hanyaAktif(semua);
    if (asli.some(function (t) { return adalahSaldoAwal(t) || periodeDari(t.tanggal) < sekarang; })) {
      throw new Error('Sudah ada saldo awal atau transaksi sebelum bulan ini. Data demo hanya bisa diisi sebelum pembukuan sungguhan dimulai.');
    }

    const jimpitanAsli = {};
    asli.forEach(function (t) { if (t.kategori === 'Jimpitan') jimpitanAsli[t.tanggal] = true; });
    const demo = buatTransaksiDemo(mulai, hariIni(), jimpitanAsli);
    periksaTidakMinus(semua.concat(demo), KAS);

    const sheet = tab(TAB.TRANSAKSI);
    sheet.getRange(sheet.getLastRow() + 1, 1, demo.length, KOLOM.Transaksi.length)
      .setValues(demo.map(function (t) { return barisDari(TAB.TRANSAKSI, t); }));

    const bulanDitutup = [];
    for (let p = mulai; p < sekarang; p = geserPeriode(p, 1)) bulanDitutup.push(p);
    const semuaBaru = semua.concat(demo);
    bulanDitutup.forEach(function (p) {
      const ringkas = ringkasBulan(semuaBaru, p);
      KAS.forEach(function (kas) {
        const r = ringkas[kas];
        tambahBaris(TAB.TUTUP, {
          periode: p, kas: kas, saldo_awal: r.saldo_awal, total_masuk: r.total_masuk, total_keluar: r.total_keluar,
          saldo_akhir: r.saldo_akhir, status: 'TUTUP', ditutup_oleh: PENCATAT_DEMO,
          ditutup_pada: geserPeriode(p, 1) + '-03T19:30:00', alasan_buka: '', dibuka_oleh: '', dibuka_pada: '',
        });
      });
    });

    setProp('MODE_DEMO', '1');
    naikkanVersiData();
    catatLog('editor', 'ISI_DEMO', '', demo.length + ' transaksi contoh, ' + namaPeriode(mulai) + ' sampai ' + namaPeriode(sekarang));
    return { jumlah: demo.length, bulan: bulanDitutup.concat([sekarang]) };
  });

  hasil.bulan.forEach(tulisLaporanAman);
  console.log('Data demo terpasang: ' + hasil.jumlah + ' transaksi, ' + hasil.bulan.map(namaPeriode).join(', ') + '.');
  console.log('Buka web untuk melihat hasilnya. Jalankan hapusDataDemo sebelum mulai mencatat keuangan yang sebenarnya.');
}

function hapusDataDemo() {
  const jumlah = denganKunci(function () {
    const sheet = tab(TAB.TRANSAKSI);
    const semua = sheet.getDataRange().getValues();
    const kolomId = KOLOM.Transaksi.indexOf('id');
    const sisa = semua.slice(1).filter(function (b) { return String(b[kolomId]).indexOf(AWALAN_ID_DEMO) !== 0; });
    const terhapus = semua.length - 1 - sisa.length;
    tulisUlangIsiTab(sheet, semua.length - 1, sisa);

    const tutup = tab(TAB.TUTUP);
    const barisTutup = tutup.getDataRange().getValues();
    const kolomOleh = KOLOM.TutupBuku.indexOf('ditutup_oleh');
    tulisUlangIsiTab(tutup, barisTutup.length - 1,
      barisTutup.slice(1).filter(function (b) { return b[kolomOleh] !== PENCATAT_DEMO; }));

    PropertiesService.getScriptProperties().deleteProperty('MODE_DEMO');
    naikkanVersiData();
    catatLog('editor', 'HAPUS_DEMO', '', terhapus + ' transaksi contoh dihapus');
    return terhapus;
  });

  tulisUlangSemuaLaporan();
  console.log('Data demo dihapus: ' + jumlah + ' transaksi. Transaksi lain dan akun pengurus tidak berubah.');
}

// Mengganti isi tab (tanpa baris judul) dengan baris yang tersisa. Format teks kolom tetap, karena hanya isinya yang dihapus.
function tulisUlangIsiTab(sheet, jumlahLama, sisa) {
  const lebar = sheet.getLastColumn();
  if (jumlahLama > 0) sheet.getRange(2, 1, jumlahLama, lebar).clearContent();
  if (sisa.length) sheet.getRange(2, 1, sisa.length, lebar).setValues(sisa);
}

// Angka acak yang selalu sama setiap kali dijalankan, agar demo bisa diulang dengan hasil yang sama.
function pengacak(benih) {
  let x = benih;
  return function (min, maks, kelipatan) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const langkah = kelipatan || 1;
    return min + Math.floor((x / 2147483648) * ((maks - min) / langkah + 1)) * langkah;
  };
}

function buatTransaksiDemo(mulai, sampai, jimpitanAsli) {
  const acak = pengacak(52026);
  const hasil = [];
  const nomor = {};
  const catat = function (tanggal, jenis, kas, kategori, uraian, nominal, pencatat, kasTujuan) {
    // Hari ini dilewati agar jam pencatatan contoh tidak pernah lebih lambat dari jam sekarang.
    if (tanggal >= sampai) return;
    const kunci = tanggal.replace(/-/g, '');
    nomor[kunci] = (nomor[kunci] || 0) + 1;
    hasil.push({
      id: AWALAN_ID_DEMO + kunci + '-' + String(nomor[kunci]).padStart(4, '0'),
      tanggal: tanggal, jenis: jenis, kas: kas, kas_tujuan: kasTujuan || '',
      kategori: jenis === 'PINDAH' ? 'Pindah kas' : kategori, uraian: uraian, nominal: nominal, bukti_file_id: '',
      dicatat_oleh: pencatat || PENCATAT_DEMO, dicatat_pada: tanggal + 'T' + (pencatat ? '21:' : '19:') + String(10 + nomor[kunci]).padStart(2, '0') + ':00',
      status: 'AKTIF', alasan_batal: '', dibatalkan_oleh: '', dibatalkan_pada: '',
    });
  };

  const awal = mulai + '-01';
  catat(awal, 'MASUK', 'LAMPU', KATEGORI_SALDO_AWAL, 'Saldo awal dari buku kas lama', 412000);
  catat(awal, 'MASUK', 'RT', KATEGORI_SALDO_AWAL, 'Saldo awal dari buku kas lama', 2150000);
  catat(awal, 'MASUK', 'JIMPITAN', KATEGORI_SALDO_AWAL, 'Saldo awal dari buku kas lama', 385000);

  for (let p = mulai; p <= periodeDari(sampai); p = geserPeriode(p, 1)) {
    const bulan = namaPeriode(p);
    const tgl = function (hari) { return p + '-' + String(hari).padStart(2, '0'); };
    const bulanKe = Number(p.slice(5, 7));

    const rumahLampu = acak(64, 70);
    catat(tgl(3), 'MASUK', 'LAMPU', 'Iuran bulanan', 'Iuran Kas Lampu ' + bulan + ', ' + rumahLampu + ' rumah', rumahLampu * 5000);
    catat(tgl(11), 'KELUAR', 'LAMPU', 'Listrik/lampu jalan', 'Token listrik lampu jalan gang 1 sampai 3', acak(100000, 150000, 5000));
    if (bulanKe % 2 === 0) catat(tgl(18), 'KELUAR', 'LAMPU', 'Perbaikan', 'Ganti ' + acak(2, 4) + ' bohlam LED 18 W lampu jalan', acak(60000, 110000, 1000));

    const rumahRt = acak(63, 70);
    catat(tgl(5), 'MASUK', 'RT', 'Iuran bulanan', 'Iuran Kas RT ' + bulan + ', ' + rumahRt + ' rumah', rumahRt * 10000);
    catat(tgl(7), 'KELUAR', 'RT', 'Kebersihan', 'Upah petugas angkut sampah ' + bulan, 280000);
    catat(tgl(20), 'KELUAR', 'RT', 'ATK', 'Fotokopi undangan rapat warga dan buku tulis kas', acak(18000, 35000, 1000));
    if (bulanKe === 8) {
      catat(tgl(10), 'MASUK', 'RT', 'Sumbangan', 'Sumbangan warga untuk peringatan 17 Agustus', 650000);
      catat(tgl(14), 'PINDAH', 'JIMPITAN', '', 'Tambahan dana lomba 17 Agustus', 300000, '', 'RT');
      catat(tgl(17), 'KELUAR', 'RT', 'Kegiatan warga', 'Hadiah lomba dan tasyakuran 17 Agustus', 1250000);
    }
    if (bulanKe === 9) catat(tgl(23), 'KELUAR', 'RT', 'Sosial/duka', 'Santunan duka warga gang 2', 300000);
    if (bulanKe === 10) catat(tgl(12), 'KELUAR', 'RT', 'Perbaikan', 'Cat ulang dan ganti engsel pintu pos ronda', 185000);
    if (bulanKe === 11) catat(tgl(2), 'MASUK', 'RT', 'Lain-lain', 'Sewa tenda RT untuk hajatan warga', 150000);

    catat(tgl(15), 'KELUAR', 'JIMPITAN', 'Kegiatan warga', 'Kopi, gula, dan teh untuk pos ronda', acak(60000, 85000, 5000));
    if (bulanKe === 9) catat(tgl(26), 'KELUAR', 'JIMPITAN', 'Perbaikan', 'Beli 2 senter dan baterai untuk pos ronda', 95000);

    const jumlahHari = Number(geserTanggal(geserPeriode(p, 1) + '-01', -1).slice(8, 10));
    for (let hari = 1; hari <= jumlahHari; hari++) {
      const t = tgl(hari);
      // Jimpitan dicatat malam hari, jadi hari ini belum ada. Sesekali ronda libur.
      if (jimpitanAsli[t] || acak(1, 10) === 1) continue;
      const petugas = PETUGAS_DEMO[(hari + bulanKe) % PETUGAS_DEMO.length];
      catat(t, 'MASUK', 'JIMPITAN', 'Jimpitan', 'Jimpitan ronda malam ' + formatTanggal(t), acak(18000, 42000, 500), 'ronda:' + petugas);
    }
  }
  return hasil;
}
