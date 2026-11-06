export const KAS = ['LAMPU', 'RT', 'JIMPITAN'];
export const NAMA_KAS = { LAMPU: 'Kas Lampu', RT: 'Kas RT', JIMPITAN: 'Kas Jimpitan' };
export const NAMA_JENIS = { MASUK: 'Pemasukan', KELUAR: 'Pengeluaran', PINDAH: 'Pindah kas' };

const angka = new Intl.NumberFormat('id-ID');
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September',
  'Oktober', 'November', 'Desember'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function rupiah(n) {
  return 'Rp ' + angka.format(n);
}

function bagianTanggal(tanggal) {
  const [t, b, h] = tanggal.slice(0, 10).split('-').map(Number);
  return { t, b, h };
}

export function tanggalPendek(tanggal) {
  const { t, b, h } = bagianTanggal(tanggal);
  return `${h} ${BULAN_PENDEK[b - 1]} ${t}`;
}

export function tanggalSedang(tanggal) {
  const { t, b, h } = bagianTanggal(tanggal);
  return `${h} ${BULAN[b - 1]} ${t}`;
}

// Tanggal terakhir bulan itu, YYYY-MM-DD.
export function akhirBulan(periode) {
  const [t, b] = periode.split('-').map(Number);
  return `${periode}-${String(new Date(Date.UTC(t, b, 0)).getUTCDate()).padStart(2, '0')}`;
}

export function tanggalPanjang(tanggal) {
  const { t, b, h } = bagianTanggal(tanggal);
  const hari = new Date(Date.UTC(t, b - 1, h)).getUTCDay();
  return `${HARI[hari]}, ${h} ${BULAN[b - 1]} ${t}`;
}

export function waktu(iso) {
  return `${tanggalPendek(iso)} pukul ${iso.slice(11, 13)}.${iso.slice(14, 16)}`;
}

export function namaBulan(periode) {
  return `${BULAN[Number(periode.slice(5, 7)) - 1]} ${periode.slice(0, 4)}`;
}

// Arah uang dilihat dari satu kas: pindah kas menjadi masuk bagi kas tujuan dan keluar bagi kas asal.
export function arahUang(t, kasKonteks) {
  if (t.jenis !== 'PINDAH') return t.jenis === 'MASUK' ? 'masuk' : 'keluar';
  if (kasKonteks === t.kas_tujuan) return 'masuk';
  if (kasKonteks === t.kas) return 'keluar';
  return 'pindah';
}

export function nominalBertanda(t, kasKonteks) {
  const arah = arahUang(t, kasKonteks);
  if (arah === 'masuk') return '+ ' + rupiah(t.nominal);
  if (arah === 'keluar') return '− ' + rupiah(t.nominal);
  return rupiah(t.nominal);
}

export function keteranganKas(t) {
  return t.jenis === 'PINDAH' ? `${NAMA_KAS[t.kas]} ke ${NAMA_KAS[t.kas_tujuan]}` : NAMA_KAS[t.kas];
}

// Server memvalidasi tanggal dengan zona Asia/Jakarta, jadi "hari ini" di web juga dihitung dalam WIB, bukan jam HP.
export function hariIniWIB() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
}

export function periodeIni() {
  return hariIniWIB().slice(0, 7);
}

export function geserPeriode(periode, n) {
  const total = Number(periode.slice(0, 4)) * 12 + Number(periode.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
