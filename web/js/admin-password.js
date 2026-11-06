import { adaSalah, kosongkanPesan, tampilkanPesan, tombolSibuk } from './form.js';
import { panggilAdmin, simpanToken } from './sesi.js';
import { el } from './ui.js';

export function formGantiPassword(wadah, saatSelesai) {
  const kolom = (id, label, auto) => el('div', { class: 'kolom' },
    el('label', { for: id, text: label }),
    el('input', { id, type: 'password', autocomplete: auto, 'aria-describedby': id + '-galat' }),
    el('p', { class: 'pesan-salah', id: id + '-galat', hidden: true }));
  const pesan = el('div');
  const tombol = el('button', { type: 'submit', class: 'tombol', text: 'Simpan password baru' });
  const awalan = wadah.id;
  // Kolom username tersembunyi agar pengelola password tahu password baru ini milik akun yang mana.
  // Nilainya diisi admin.js saat pengurus masuk (kelas username-sesi).
  const form = el('form', { class: 'kartu-form', novalidate: true }, pesan,
    el('input', { type: 'text', name: 'username', autocomplete: 'username', class: 'username-sesi', hidden: true }),
    kolom(awalan + '-lama', 'Password saat ini', 'current-password'),
    kolom(awalan + '-baru', 'Password baru (minimal 8 karakter)', 'new-password'),
    kolom(awalan + '-ulang', 'Ulangi password baru', 'new-password'),
    tombol);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [lama, baru, ulang] = ['lama', 'baru', 'ulang'].map((k) => form.querySelector(`#${awalan}-${k}`));
    kosongkanPesan(pesan);
    if (adaSalah(form, [
      [lama, lama.value ? '' : 'Isi password saat ini.'],
      [baru, baru.value.length < 8 ? 'Password baru minimal 8 karakter.' : ''],
      [ulang, ulang.value !== baru.value ? 'Ulangan password tidak sama.' : ''],
    ])) return;
    tombolSibuk(tombol, true);
    try {
      const r = await panggilAdmin('gantiPassword', { lama: lama.value, baru: baru.value });
      simpanToken(r.token);
      form.reset();
      tampilkanPesan(pesan, 'berhasil', 'Password sudah diganti. Pakai password baru ini saat masuk berikutnya.');
      saatSelesai();
    } catch (err) {
      tampilkanPesan(pesan, 'galat', err.message);
    } finally {
      tombolSibuk(tombol, false);
    }
  });
  wadah.replaceChildren(form);
}
