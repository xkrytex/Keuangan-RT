import { el } from './ui.js';

export { hariIniWIB } from './format.js';

export function pasangInputNominal(input) {
  input.addEventListener('input', () => {
    const angka = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    input.value = angka ? Number(angka).toLocaleString('id-ID') : '';
  });
}

export function bacaNominal(input) {
  return Number(input.value.replace(/\D/g, '')) || 0;
}

export function tandaiSalah(input, pesan) {
  const galat = document.getElementById(input.id + '-galat');
  input.setAttribute('aria-invalid', 'true');
  galat.textContent = pesan;
  galat.hidden = false;
}

export function bersihkanSalah(form) {
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
  form.querySelectorAll('.pesan-salah').forEach((p) => {
    p.hidden = true;
    p.textContent = '';
  });
}

// Mengembalikan true kalau ada kolom salah, dan memindahkan fokus ke kolom salah pertama.
export function adaSalah(form, aturan) {
  bersihkanSalah(form);
  let pertama = null;
  for (const [input, pesan] of aturan) {
    if (!pesan) continue;
    tandaiSalah(input, pesan);
    pertama = pertama || input;
  }
  if (pertama) pertama.focus();
  return Boolean(pertama);
}

export function tampilkanPesan(wadah, jenis, teks, ...tambahan) {
  wadah.replaceChildren(el('div', { class: `kotak-pesan kotak-${jenis}`, role: jenis === 'galat' ? 'alert' : 'status' },
    el('p', { text: teks }), ...tambahan.filter(Boolean)));
}

export function kosongkanPesan(wadah) {
  wadah.replaceChildren();
}

export function tombolSibuk(tombol, sibuk, teksSibuk = 'Menyimpan…') {
  if (sibuk) {
    tombol.dataset.teksAsli = tombol.textContent;
    tombol.textContent = teksSibuk;
    tombol.disabled = true;
  } else {
    tombol.textContent = tombol.dataset.teksAsli || tombol.textContent;
    tombol.disabled = false;
  }
}
