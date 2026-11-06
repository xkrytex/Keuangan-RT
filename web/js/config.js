// Isi API_URL dengan URL Web App Apps Script (berakhiran /exec) setelah deploy.
export const API_URL = '';

export function urlFoto(fileId) {
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1600';
}

export function urlFotoPenuh(fileId) {
  return 'https://drive.google.com/file/d/' + encodeURIComponent(fileId) + '/view';
}
