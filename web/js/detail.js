import { GalatApi, panggil } from './api.js';
import { urlFoto, urlFotoPenuh } from './config.js';
import { NAMA_JENIS, NAMA_KAS, arahUang, keteranganKas, nominalBertanda, tanggalPanjang, waktu } from './format.js';
import { el, ikonKas, selesaiMemuat, tampilkanGalat, tampilkanKosong, tampilkanMemuat } from './ui.js';

const wadah = document.getElementById('detail');
const tombolKembali = document.getElementById('tombol-kembali');
const id = new URLSearchParams(location.search).get('id') || '';

// Datang dari halaman lain di web ini: tombol kembali memakai riwayat browser, supaya filter,
// nomor halaman, dan sesi pengurus atau petugas di tab ini tetap seperti sebelum detail dibuka.
try {
  const asal = new URL(document.referrer);
  if (asal.origin === location.origin) {
    let label = 'Kembali ke halaman sebelumnya';
    if (asal.pathname.endsWith('/admin.html')) {
      tombolKembali.href = 'admin.html#riwayat';
      label = 'Kembali ke halaman pengurus';
    } else if (asal.pathname.endsWith('/transaksi.html')) {
      tombolKembali.href = asal.href;
      label = 'Kembali ke daftar transaksi';
    }
    tombolKembali.setAttribute('aria-label', label);
    tombolKembali.title = label;
    if (history.length > 1) {
      tombolKembali.addEventListener('click', (e) => {
        e.preventDefault();
        history.back();
      });
    }
  }
} catch (err) {
  // Tanpa referrer yang sah, tombol tetap menuju transaksi.html.
}

function baris(label, ...isi) {
  return el('div', {}, el('dt', { text: label }), el('dd', {}, ...isi));
}

function bagianFoto(t) {
  if (!t.bukti_id) {
    return el('p', { class: 'keadaan', text: 'Tidak ada bukti pembayaran untuk transaksi ini.' });
  }
  const gambar = el('img', { src: urlFoto(t.bukti_id), width: '600', height: '800', loading: 'lazy',
    alt: 'Bukti pembayaran: ' + t.uraian });
  const bingkai = el('div', { class: 'foto-nota-bingkai' }, gambar);
  gambar.addEventListener('error', () => {
    bingkai.replaceChildren(el('p', { class: 'keadaan', text: 'Bukti pembayaran tidak bisa ditampilkan di sini.' }));
  });
  return el('figure', { class: 'foto-nota' }, bingkai,
    el('figcaption', {}, el('a', { href: urlFotoPenuh(t.bukti_id), target: '_blank', rel: 'noopener',
      text: 'Buka foto ukuran penuh di Google Drive' })));
}

function tampilkan(t) {
  document.title = `${t.uraian} · Transaksi RT 05 RW 02`;
  const batal = t.status === 'BATAL';
  const kasRincian = t.jenis === 'PINDAH'
    ? [baris('Dari', ikonKas(t.kas), NAMA_KAS[t.kas]), baris('Ke', ikonKas(t.kas_tujuan), NAMA_KAS[t.kas_tujuan])]
    : [baris('Kas', ikonKas(t.kas), NAMA_KAS[t.kas])];

  selesaiMemuat(wadah,
    el('section', { class: 'detail-utama' + (batal ? ' detail-batal' : ''), 'aria-label': 'Ringkasan transaksi' },
      el('p', { class: 'detail-label' },
        el('span', { class: 'label-jenis', text: NAMA_JENIS[t.jenis] }),
        batal ? el('span', { class: 'label-status', text: 'Dibatalkan' }) : null),
      el('p', { class: `detail-nominal angka arah-${arahUang(t)}` },
        batal ? el('span', { class: 'sr-only', text: 'Dibatalkan, ' }) : null,
        nominalBertanda(t)),
      el('h2', { class: 'detail-uraian', text: t.uraian }),
      el('p', { class: 'detail-sub' }, ikonKas(t.jenis === 'PINDAH' ? t.kas_tujuan : t.kas),
        `${tanggalPanjang(t.tanggal)} · ${keteranganKas(t)}`)),
    batal ? el('div', { class: 'kotak-batal', role: 'note' },
      el('p', { class: 'kotak-batal-judul', text: 'Alasan pembatalan' }),
      el('p', { text: t.alasan_batal }),
      el('p', { class: 'kotak-batal-oleh', text: `Dibatalkan oleh ${t.dibatalkan_oleh}, ${waktu(t.dibatalkan_pada)}` })) : null,
    el('div', { class: 'detail-kolom' },
      el('section', { 'aria-labelledby': 'judul-rincian' },
        el('h2', { id: 'judul-rincian', class: 'judul-bagian', text: 'Rincian' }),
        el('dl', { class: 'rincian' },
          baris('Kategori', t.kategori),
          ...kasRincian,
          baris('Dicatat oleh', t.dicatat_oleh),
          baris('Dicatat pada', waktu(t.dicatat_pada)),
          baris('Nomor', el('span', { class: 'angka', text: t.id })))),
      el('section', { 'aria-labelledby': 'judul-foto' },
        el('h2', { id: 'judul-foto', class: 'judul-bagian', text: 'Bukti pembayaran' }),
        bagianFoto(t))));
}

async function muat() {
  const tautanDaftar = () => el('a', { href: 'transaksi.html', text: 'Buka daftar transaksi' });
  if (!/^[A-Za-z0-9-]{1,40}$/.test(id)) {
    tampilkanKosong(wadah, 'Alamat transaksi tidak lengkap.', tautanDaftar());
    return;
  }
  tampilkanMemuat(wadah, 'Memuat detail transaksi…');
  try {
    tampilkan(await panggil('detailTransaksi', { id }));
  } catch (err) {
    // Transaksi yang memang tidak ada tidak perlu tombol Coba lagi.
    if (err instanceof GalatApi && err.kode === 'TIDAK_DITEMUKAN') {
      tampilkanKosong(wadah, 'Transaksi ini tidak ditemukan. Mungkin alamatnya terpotong saat disalin.', tautanDaftar());
      return;
    }
    tampilkanGalat(wadah, 'Detail transaksi belum bisa dimuat. ' + err.message, muat);
  }
}

muat();
