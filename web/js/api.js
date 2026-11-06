import { API_URL } from './config.js';

export class GalatApi extends Error {
  constructor(pesan, kode = '') {
    super(pesan);
    this.kode = kode;
  }
}

// text/plain membuat permintaan "sederhana", jadi browser tidak mengirim preflight CORS ke Apps Script.
export async function panggil(aksi, data = {}, token) {
  if (!API_URL) throw new GalatApi('Alamat server belum diatur. Hubungi pengelola web.');
  const kendali = new AbortController();
  const batas = setTimeout(() => kendali.abort(), 30000);
  let jawaban;
  try {
    jawaban = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ aksi, data, token }),
      signal: kendali.signal,
    });
  } catch (err) {
    throw new GalatApi(err.name === 'AbortError'
      ? 'Server terlalu lama menjawab. Periksa koneksi lalu coba lagi.'
      : 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda.');
  } finally {
    clearTimeout(batas);
  }
  if (!jawaban.ok) throw new GalatApi('Server sedang bermasalah. Coba lagi beberapa saat lagi.');
  let isi;
  try {
    isi = await jawaban.json();
  } catch (err) {
    throw new GalatApi('Jawaban server tidak terbaca. Coba lagi.');
  }
  if (!isi.ok) throw new GalatApi(isi.pesan || 'Permintaan ditolak server.', isi.kode);
  return isi.data;
}
