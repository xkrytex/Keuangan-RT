import { el } from './ui.js';

const dialog = document.getElementById('dialog');

// <dialog> bawaan browser sudah mengunci fokus di dalamnya dan menutup dengan Escape.
// aksi dipanggil saat tombol konfirmasi ditekan; kalau melempar galat, pesannya tampil di dialog dan dialog tetap terbuka.
export function bukaKonfirmasi({ judul, isi = [], teksYa, bahaya = false, alasan = null, aksi }) {
  return new Promise((selesai) => {
    const pesan = el('div', { 'aria-live': 'polite' });
    const isian = alasan ? el('textarea', { id: 'dialog-alasan', rows: '3', maxlength: '200', required: true }) : null;
    const galatAlasan = alasan ? el('p', { class: 'pesan-salah', id: 'dialog-alasan-galat', hidden: true }) : null;
    if (isian) isian.setAttribute('aria-describedby', 'dialog-alasan-galat');
    const tombolYa = el('button', { type: 'submit', class: 'tombol' + (bahaya ? ' tombol-bahaya' : ''), text: teksYa });
    const tombolBatal = el('button', { type: 'button', class: 'tombol tombol-sekunder', text: 'Tutup' });
    const form = el('form', { method: 'dialog', class: 'dialog-isi', novalidate: true },
      el('h2', { id: 'dialog-judul', text: judul }),
      ...isi,
      alasan ? el('div', { class: 'kolom' }, el('label', { for: 'dialog-alasan', text: alasan.label }), isian, galatAlasan) : null,
      pesan,
      el('div', { class: 'dialog-tombol' }, tombolBatal, tombolYa));

    let hasil = false;
    tombolBatal.addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isian) {
        const teks = isian.value.trim();
        if (teks.length < 5) {
          isian.setAttribute('aria-invalid', 'true');
          galatAlasan.textContent = alasan.pesanKurang;
          galatAlasan.hidden = false;
          isian.focus();
          return;
        }
      }
      tombolYa.disabled = true;
      tombolYa.textContent = 'Memproses…';
      try {
        hasil = await aksi(isian ? isian.value.trim() : undefined);
        dialog.close();
      } catch (err) {
        pesan.replaceChildren(el('div', { class: 'kotak-pesan kotak-galat', role: 'alert' }, el('p', { text: err.message })));
        tombolYa.disabled = false;
        tombolYa.textContent = teksYa;
      }
    });
    dialog.addEventListener('close', () => selesai(hasil), { once: true });
    dialog.setAttribute('aria-labelledby', 'dialog-judul');
    dialog.replaceChildren(form);
    dialog.showModal();
    (isian || tombolBatal).focus();
  });
}
