const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export const MOCK_EMPLOYEES = [
  { id: 'K001', nama: 'Andi Pratama', jabatan: 'Kasir', kategori: 'on-site', aktif: true },
  { id: 'K002', nama: 'Budi Santoso', jabatan: 'Chef', kategori: 'on-site', aktif: true },
  { id: 'K003', nama: 'Cici Wulandari', jabatan: 'Waitress', kategori: 'on-site', aktif: true },
  { id: 'K004', nama: 'Dewi Anggraini', jabatan: 'Purchasing', kategori: 'mobile', aktif: true },
  { id: 'K005', nama: 'Eko Prasetyo', jabatan: 'Security', kategori: 'on-site', aktif: true },
  { id: 'K006', nama: 'Fitri Handayani', jabatan: 'Admin', kategori: 'on-site', aktif: true },
  { id: 'K007', nama: 'Gunawan Hidayat', jabatan: 'Chef', kategori: 'on-site', aktif: true },
  { id: 'K008', nama: 'Hani Rahmawati', jabatan: 'Waitress', kategori: 'on-site', aktif: true },
  { id: 'K009', nama: 'Irfan Maulana', jabatan: 'Delivery', kategori: 'mobile', aktif: true },
  { id: 'K010', nama: 'Joko Widodo', jabatan: 'Maintenance', kategori: 'on-site', aktif: true },
];

// PIN for all mock employees is "1234"
export const MOCK_PIN = '1234';

export const MOCK_SETTINGS = {
  shift_mulai: '08:00',
  shift_selesai: '17:00',
  toleransi_terlambat_menit: '15',
  geofence_lat: '-7.6',
  geofence_lng: '110.6',
  geofence_radius_meter: '200',
  nama_perusahaan: 'Ketjeh Seafood & Leisure',
};

// Mock admin password
export const MOCK_ADMIN_PASSWORD = 'admin123';
export const MOCK_MANAGER_PASSWORD = 'manager123';

// Mock special shifts
export const MOCK_SHIFT_KHUSUS = [
  { tanggal: '2026-04-10', nama_hari: 'Hari Raya Idul Fitri', shift_mulai: 'LIBUR', shift_selesai: '', catatan: 'Libur nasional' },
  { tanggal: '2026-04-11', nama_hari: 'Cuti Bersama Idul Fitri', shift_mulai: 'LIBUR', shift_selesai: '', catatan: '' },
  { tanggal: '2026-04-25', nama_hari: 'Event Khusus', shift_mulai: '06:00', shift_selesai: '15:00', catatan: 'Shift pagi untuk event waterpark' },
];

// Simulated attendance — some employees already clocked in today
export const MOCK_ABSENSI_TODAY = [
  {
    id: `A${today.replace(/-/g, '')}-K001-IN`,
    karyawan_id: 'K001',
    nama: 'Andi Pratama',
    jabatan: 'Kasir',
    tanggal: today,
    jam_masuk: `${today} 07:55:00`,
    jam_keluar: '',
    durasi_jam: '',
    status_lokasi_masuk: 'On-site',
    status_lokasi_keluar: '',
    foto_masuk_url: 'https://ui-avatars.com/api/?name=Andi+Pratama&size=128&background=1e3a5f&color=fff',
    foto_keluar_url: '',
  },
  {
    id: `A${today.replace(/-/g, '')}-K002-IN`,
    karyawan_id: 'K002',
    nama: 'Budi Santoso',
    jabatan: 'Chef',
    tanggal: today,
    jam_masuk: `${today} 08:12:00`,
    jam_keluar: '',
    durasi_jam: '',
    status_lokasi_masuk: 'On-site',
    status_lokasi_keluar: '',
    foto_masuk_url: 'https://ui-avatars.com/api/?name=Budi+Santoso&size=128&background=1e3a5f&color=fff',
    foto_keluar_url: '',
  },
  {
    id: `A${today.replace(/-/g, '')}-K003-IN`,
    karyawan_id: 'K003',
    nama: 'Cici Wulandari',
    jabatan: 'Waitress',
    tanggal: today,
    jam_masuk: `${today} 08:45:00`,
    jam_keluar: '',
    durasi_jam: '',
    status_lokasi_masuk: 'Off-site (1.2km)',
    status_lokasi_keluar: '',
    foto_masuk_url: 'https://ui-avatars.com/api/?name=Cici+Wulandari&size=128&background=1e3a5f&color=fff',
    foto_keluar_url: '',
  },
  {
    id: `A${today.replace(/-/g, '')}-K006-IN`,
    karyawan_id: 'K006',
    nama: 'Fitri Handayani',
    jabatan: 'Admin',
    tanggal: today,
    jam_masuk: `${today} 07:50:00`,
    jam_keluar: `${today} 16:05:00`,
    durasi_jam: 8.25,
    status_lokasi_masuk: 'On-site',
    status_lokasi_keluar: 'On-site',
    foto_masuk_url: 'https://ui-avatars.com/api/?name=Fitri+Handayani&size=128&background=1e3a5f&color=fff',
    foto_keluar_url: 'https://ui-avatars.com/api/?name=Fitri+Handayani&size=128&background=22c55e&color=fff',
  },
];

// History for past days
export function generateMockHistory(karyawanId) {
  const history = [];
  for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const emp = MOCK_EMPLOYEES.find(e => e.id === karyawanId);
    if (!emp) continue;

    // Skip Sundays
    if (date.getDay() === 0) continue;

    const hour = 7 + Math.floor(Math.random() * 2);
    const minute = Math.floor(Math.random() * 60);
    const masuk = `${dateStr} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    const keluar = `${dateStr} ${String(hour + 8 + Math.floor(Math.random() * 2)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`;

    history.push({
      id: `A${dateStr.replace(/-/g, '')}-${karyawanId}-IN`,
      karyawan_id: karyawanId,
      nama: emp.nama,
      tanggal: dateStr,
      jam_masuk: masuk,
      jam_keluar: keluar,
      durasi_jam: 8 + Math.round(Math.random() * 2 * 100) / 100,
      status_lokasi_masuk: Math.random() > 0.2 ? 'On-site' : `Off-site (${(Math.random() * 3 + 0.3).toFixed(1)}km)`,
      status_lokasi_keluar: 'On-site',
      foto_masuk_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nama)}&size=128&background=1e3a5f&color=fff`,
      foto_keluar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nama)}&size=128&background=22c55e&color=fff`,
    });
  }
  return history;
}
