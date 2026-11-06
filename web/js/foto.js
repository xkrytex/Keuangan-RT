const SISI_MAKS = 1600;
const UKURAN_MAKS = 1.9 * 1024 * 1024;

function keBlob(kanvas, kualitas) {
  return new Promise((selesai) => kanvas.toBlob(selesai, 'image/jpeg', kualitas));
}

function keBase64(blob) {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload = () => selesai(String(pembaca.result).split(',')[1]);
    pembaca.onerror = () => gagal(new Error('Foto tidak terbaca.'));
    pembaca.readAsDataURL(blob);
  });
}

// Foto dari kamera HP biasanya 3-8 MB; diperkecil ke sisi 1600 px JPEG agar unggahan cepat dan hemat kuota Drive.
export async function kecilkanFoto(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Pilih file .jpg atau .png.');
  let gambar;
  try {
    gambar = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (err) {
    throw new Error('Format foto ini tidak bisa dibaca browser. Coba ambil ulang fotonya dengan kamera.');
  }
  const skala = Math.min(1, SISI_MAKS / Math.max(gambar.width, gambar.height));
  const kanvas = document.createElement('canvas');
  kanvas.width = Math.round(gambar.width * skala);
  kanvas.height = Math.round(gambar.height * skala);
  kanvas.getContext('2d').drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
  gambar.close();

  let blob = await keBlob(kanvas, 0.75);
  if (blob && blob.size > UKURAN_MAKS) blob = await keBlob(kanvas, 0.55);
  if (!blob || blob.size > UKURAN_MAKS) throw new Error('Foto terlalu besar meski sudah diperkecil. Coba foto ulang lebih dekat.');
  return { blob, mime: 'image/jpeg', base64: await keBase64(blob) };
}
