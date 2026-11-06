import { bukaKonfirmasi } from './dialog.js';
import { keteranganKas, nominalBertanda, tanggalPanjang } from './format.js';
import { panggilAdmin } from './sesi.js';
import { el } from './ui.js';

// Tombol Batalkan di daftar transaksi, hanya dipasang kalau pengurus sedang masuk di tab ini.
export function tombolBatalkan(t, saatDibatalkan) {
  if (t.status !== 'AKTIF') return null;
  const tombol = el('button', { type: 'button', class: 'tombol tombol-sekunder tombol-kecil', text: 'Batalkan',
    'aria-label': `Batalkan transaksi ${t.uraian}` });
  tombol.addEventListener('click', async () => {
    const dibatalkan = await bukaKonfirmasi({
      judul: 'Batalkan transaksi ini?',
      isi: [
        el('dl', { class: 'ringkas-dialog' },
          el('dt', { text: 'Keterangan' }), el('dd', { text: t.uraian }),
          el('dt', { text: 'Nominal' }), el('dd', { class: 'angka', text: nominalBertanda(t) }),
          el('dt', { text: 'Tanggal' }), el('dd', { text: tanggalPanjang(t.tanggal) }),
          el('dt', { text: 'Kas' }), el('dd', { text: keteranganKas(t) })),
        el('p', { class: 'bantuan', text: 'Transaksi tetap terlihat warga dalam keadaan dicoret, bersama alasan yang Anda tulis. Pembatalan tidak bisa diurungkan.' }),
      ],
      alasan: { label: 'Alasan pembatalan', pesanKurang: 'Tulis alasan minimal 5 karakter.' },
      teksYa: 'Batalkan transaksi',
      bahaya: true,
      aksi: (alasan) => panggilAdmin('batalkanTransaksi', { id: t.id, alasan }),
    });
    if (dibatalkan) saatDibatalkan();
    else tombol.focus();
  });
  return tombol;
}
