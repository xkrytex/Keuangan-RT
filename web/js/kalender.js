import { namaBulan, tanggalPanjang } from './format.js';
import { el, ikon } from './ui.js';

// Kalender sendiri, bukan <input type="date">: tampilan pemilih bawaan browser mengikuti bahasa HP
// dan tidak bisa diberi gaya. Semua tanggal berupa teks YYYY-MM-DD agar tidak tergeser zona waktu.
const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function tambahHari(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function tambahBulan(iso, n) {
  const [t, b, h] = iso.split('-').map(Number);
  const akhirBulan = new Date(Date.UTC(t, b - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t, b - 1 + n, Math.min(h, akhirBulan))).toISOString().slice(0, 10);
}

// 0 = Senin, karena kalender Indonesia umumnya dimulai hari Senin.
function hariKe(iso) {
  return (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

/**
 * Memasang tombol pemilih tanggal di `wadah`. Tombol diberi `id` agar tandaiSalah() di form.js
 * menemukan pesan galatnya lewat `${id}-galat`. `maks` dipanggil tiap kalender dibuka,
 * jadi batas "hari ini" ikut berganti kalau halaman dibiarkan terbuka melewati tengah malam.
 */
export function pasangKalender(wadah, { id, labelId, deskripsi, maks }) {
  let nilai = maks();
  let fokus = nilai;

  const teks = el('span', { id: id + '-teks' });
  const tombol = el('button', {
    type: 'button', id, class: 'input-tanggal',
    'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    'aria-labelledby': `${labelId} ${id}-teks`, 'aria-describedby': deskripsi,
  }, ikon('kalender'), teks);

  const judul = el('p', { class: 'kalender-judul', id: id + '-bulan', 'aria-live': 'polite' });
  const sebelum = el('button', { type: 'button', class: 'tombol-ikon', 'aria-label': 'Bulan sebelumnya', title: 'Bulan sebelumnya' }, ikon('kiri'));
  const sesudah = el('button', { type: 'button', class: 'tombol-ikon', 'aria-label': 'Bulan berikutnya', title: 'Bulan berikutnya' }, ikon('kanan'));
  const badan = el('tbody');
  const tabel = el('table', { class: 'kalender-tabel', role: 'grid', 'aria-labelledby': id + '-bulan' },
    el('thead', {}, el('tr', {}, ...HARI_PENDEK.map((h) => el('th', { scope: 'col', text: h })))),
    badan);
  const pintasan = (label, geser) => {
    const b = el('button', { type: 'button', class: 'tombol tombol-sekunder tombol-kecil', text: label });
    b.addEventListener('click', () => pilih(tambahHari(maks(), geser)));
    return b;
  };
  const panel = el('div', { class: 'kalender', role: 'dialog', 'aria-label': 'Pilih tanggal transaksi', hidden: true },
    el('div', { class: 'kalender-kepala' }, sebelum, judul, sesudah),
    tabel,
    el('div', { class: 'kalender-kaki' }, pintasan('Hari ini', 0), pintasan('Kemarin', -1)),
    el('p', { class: 'kalender-petunjuk', text: 'Tanggal setelah hari ini tidak bisa dipilih.' }));

  wadah.replaceChildren(tombol, panel);

  function tampilkanNilai() {
    const hariIni = maks();
    const keterangan = nilai === hariIni ? ' (hari ini)' : nilai === tambahHari(hariIni, -1) ? ' (kemarin)' : '';
    teks.textContent = tanggalPanjang(nilai) + keterangan;
  }

  function gambar(pindahkanFokus) {
    const batas = maks();
    const awalBulan = fokus.slice(0, 8) + '01';
    judul.textContent = namaBulan(fokus.slice(0, 7));
    sesudah.disabled = tambahBulan(awalBulan, 1) > batas;
    let hari = tambahHari(awalBulan, -hariKe(awalBulan));
    const baris = [];
    do {
      const sel = [];
      for (let i = 0; i < 7; i += 1) {
        if (hari.slice(0, 7) !== fokus.slice(0, 7)) {
          sel.push(el('td'));
        } else {
          const b = el('button', {
            type: 'button', class: 'kalender-hari', text: String(Number(hari.slice(8))),
            'aria-label': tanggalPanjang(hari), 'data-tanggal': hari,
            tabindex: hari === fokus ? '0' : '-1',
            'aria-pressed': String(hari === nilai),
            'aria-current': hari === batas ? 'date' : null,
            disabled: hari > batas,
          });
          sel.push(el('td', {}, b));
        }
        hari = tambahHari(hari, 1);
      }
      baris.push(el('tr', {}, ...sel));
    } while (hari.slice(0, 7) === fokus.slice(0, 7));
    badan.replaceChildren(...baris);
    if (pindahkanFokus) badan.querySelector('[tabindex="0"]').focus();
  }

  function geserFokus(tujuan) {
    const batas = maks();
    fokus = tujuan > batas ? batas : tujuan;
    gambar(true);
  }

  function buka() {
    fokus = nilai;
    panel.hidden = false;
    tombol.setAttribute('aria-expanded', 'true');
    gambar(true);
    document.addEventListener('pointerdown', klikLuar);
  }

  function tutup(kembalikanFokus) {
    if (panel.hidden) return;
    panel.hidden = true;
    tombol.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', klikLuar);
    if (kembalikanFokus) tombol.focus();
  }

  function klikLuar(e) {
    if (!wadah.contains(e.target)) tutup(false);
  }

  function pilih(iso) {
    nilai = iso;
    tampilkanNilai();
    tutup(true);
  }

  tombol.addEventListener('click', () => (panel.hidden ? buka() : tutup(true)));
  sebelum.addEventListener('click', () => { fokus = tambahBulan(fokus, -1); gambar(false); });
  sesudah.addEventListener('click', () => {
    const tujuan = tambahBulan(fokus, 1);
    fokus = tujuan > maks() ? maks() : tujuan;
    gambar(false);
    if (sesudah.disabled) sebelum.focus();
  });
  badan.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tanggal]');
    if (b && !b.disabled) pilih(b.dataset.tanggal);
  });

  const LANGKAH = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  badan.addEventListener('keydown', (e) => {
    if (!e.target.dataset.tanggal) return;
    let tujuan = null;
    if (e.key in LANGKAH) tujuan = tambahHari(fokus, LANGKAH[e.key]);
    else if (e.key === 'PageUp') tujuan = tambahBulan(fokus, -1);
    else if (e.key === 'PageDown') tujuan = tambahBulan(fokus, 1);
    else if (e.key === 'Home') tujuan = tambahHari(fokus, -hariKe(fokus));
    else if (e.key === 'End') tujuan = tambahHari(fokus, 6 - hariKe(fokus));
    if (!tujuan) return;
    e.preventDefault();
    geserFokus(tujuan);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      tutup(true);
    }
  });
  // Kalender tertutup sendiri saat fokus Tab keluar darinya.
  wadah.addEventListener('focusout', (e) => {
    if (!panel.hidden && e.relatedTarget && !wadah.contains(e.relatedTarget)) tutup(false);
  });

  tampilkanNilai();
  return {
    get nilai() { return nilai; },
    tombol,
  };
}
