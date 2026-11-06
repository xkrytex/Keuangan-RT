import { NAMA_KAS, arahUang, keteranganKas, nominalBertanda, tanggalPendek } from './format.js';

const SVG = 'http://www.w3.org/2000/svg';

// Semua teks dari server masuk lewat textContent, tidak pernah lewat innerHTML.
export function el(tag, atribut = {}, ...anak) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(atribut)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const a of anak.flat()) if (a !== null && a !== undefined && a !== false) node.append(a);
  return node;
}

export function ikon(nama, kelas = 'ikon') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', kelas);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const pakai = document.createElementNS(SVG, 'use');
  pakai.setAttribute('href', `img/ikon.svg#${nama}`);
  svg.append(pakai);
  return svg;
}

export function ikonKas(kas) {
  return ikon('kas-' + kas.toLowerCase());
}

export function tampilkanMemuat(wadah, pesan) {
  wadah.setAttribute('aria-busy', 'true');
  wadah.replaceChildren(el('p', { class: 'keadaan keadaan-memuat', text: pesan }));
}

export function tampilkanGalat(wadah, pesan, cobaLagi) {
  wadah.removeAttribute('aria-busy');
  const tombol = el('button', { type: 'button', class: 'tombol tombol-sekunder', text: 'Coba lagi' });
  tombol.addEventListener('click', cobaLagi);
  wadah.replaceChildren(el('div', { class: 'keadaan keadaan-galat', role: 'alert' },
    el('p', { text: pesan }), tombol));
}

export function tampilkanKosong(wadah, pesan, ...tambahan) {
  wadah.removeAttribute('aria-busy');
  wadah.replaceChildren(el('div', { class: 'keadaan' }, el('p', { text: pesan }), ...tambahan.filter(Boolean)));
}

export function selesaiMemuat(wadah, ...isi) {
  wadah.removeAttribute('aria-busy');
  wadah.replaceChildren(...isi.filter(Boolean));
}

// aksi: tombol tambahan (misalnya Batalkan) yang diletakkan di luar tautan, karena tombol tidak boleh berada di dalam <a>.
export function barisTransaksi(t, kasKonteks, aksi = null) {
  const batal = t.status === 'BATAL';
  const arah = arahUang(t, kasKonteks);
  const kasIkon = t.jenis === 'PINDAH' && kasKonteks === t.kas_tujuan ? t.kas_tujuan : t.kas;
  const meta = [tanggalPendek(t.tanggal), keteranganKas(t), t.kategori].join(' · ');
  return el('li', { class: 'trx' + (batal ? ' trx-batal' : '') + (aksi ? ' trx-dengan-aksi' : '') },
    el('a', { class: 'trx-tautan', href: `detail.html?id=${encodeURIComponent(t.id)}` },
      el('span', { class: 'trx-ikon', title: NAMA_KAS[kasIkon] }, ikonKas(kasIkon)),
      el('span', { class: 'trx-isi' },
        el('span', { class: 'trx-uraian', text: t.uraian }),
        el('span', { class: 'trx-meta' },
          meta,
          t.bukti_id ? el('span', { class: 'trx-nota' }, ikon('nota', 'ikon ikon-kecil'), 'ada bukti') : null),
        batal ? el('span', { class: 'label-status', text: 'Dibatalkan' }) : null),
      el('span', { class: `trx-nominal angka arah-${arah}` },
        batal ? el('span', { class: 'sr-only', text: 'Dibatalkan, ' }) : null,
        nominalBertanda(t, kasKonteks))),
    aksi);
}

export function daftarTransaksi(item, kasKonteks, buatAksi = () => null) {
  return el('ul', { class: 'daftar-trx', role: 'list' }, item.map((t) => barisTransaksi(t, kasKonteks, buatAksi(t))));
}

export function navigasiHalaman(halaman, jumlahHalaman, pindah) {
  if (jumlahHalaman <= 1) return null;
  const tombol = (teks, tujuan, nonaktif) => {
    const b = el('button', { type: 'button', class: 'tombol tombol-sekunder', text: teks, disabled: nonaktif });
    b.addEventListener('click', () => pindah(tujuan));
    return b;
  };
  return el('nav', { class: 'halaman', 'aria-label': 'Pindah halaman' },
    tombol('Sebelumnya', halaman - 1, halaman <= 1),
    el('span', { class: 'halaman-posisi', text: `Halaman ${halaman} dari ${jumlahHalaman}` }),
    tombol('Berikutnya', halaman + 1, halaman >= jumlahHalaman));
}
