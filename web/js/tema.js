// Tema terang adalah bawaan. Pilihan gelap disimpan di perangkat; skrip kecil di <head> menerapkannya sebelum halaman tampil.
const tombol = document.getElementById('tombol-tema');
const ikon = tombol.querySelector('use');
const warnaBilah = document.querySelector('meta[name="theme-color"]');

function terapkan(tema) {
  const gelap = tema === 'gelap';
  if (gelap) document.documentElement.dataset.tema = 'gelap';
  else delete document.documentElement.dataset.tema;
  tombol.setAttribute('aria-pressed', String(gelap));
  ikon.setAttribute('href', gelap ? 'img/ikon.svg#matahari' : 'img/ikon.svg#bulan');
  warnaBilah.setAttribute('content', gelap ? '#171A1C' : '#1F5C36');
}

tombol.addEventListener('click', () => {
  const tema = document.documentElement.dataset.tema === 'gelap' ? 'terang' : 'gelap';
  terapkan(tema);
  try {
    localStorage.setItem('tema', tema);
  } catch (err) {
    // Penyimpanan bisa diblokir (mode privat); tema tetap berlaku sampai halaman ditutup.
  }
});

terapkan(document.documentElement.dataset.tema);
