const todayDate = new Date();
const today = todayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const yesterdayDate = new Date(todayDate);
yesterdayDate.setDate(todayDate.getDate() - 1);
const yesterday = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const nextWeekDate = new Date(todayDate);
nextWeekDate.setDate(todayDate.getDate() + 7);
const nextWeek = nextWeekDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

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
  { id: 'K011', nama: 'Maya Lestari', jabatan: 'Manager', kategori: 'on-site', aktif: true },
  { id: 'K012', nama: 'Raka Firmansyah', jabatan: 'Captain Floor', kategori: 'on-site', aktif: true },
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
  briefing_photo_roles: 'Manager,Captain Floor',
  reservation_manage_roles: 'Manager,Kasir',
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

export const MOCK_PENGUMUMAN = [
  {
    id: 'P001',
    judul: 'Briefing Service Jam 10.00',
    isi: 'Semua tim floor kumpul di area kasir untuk update promo dan reservasi rombongan.',
    tanggal_mulai: today,
    tanggal_selesai: today,
    target_type: 'all',
    target_value: '',
    aktif: true,
    dibuat_oleh: 'admin',
  },
  {
    id: 'P002',
    judul: 'Cek Kebersihan Area Outdoor',
    isi: 'Pastikan area outdoor kering dan meja siap sebelum lunch rush.',
    tanggal_mulai: today,
    tanggal_selesai: today,
    target_type: 'roles',
    target_value: 'Waitress,Captain Floor',
    aktif: true,
    dibuat_oleh: 'manager',
  },
];

export const MOCK_RESERVASI = [
  {
    id: 'R001',
    tanggal: today,
    jam: '11:30',
    nama_pelanggan: 'Ibu Ratna',
    area: 'Saung 2',
    pesanan: 'Paket seafood 8 pax',
    keterangan: 'Minta kursi tambahan untuk anak.',
    status: 'confirmed',
  },
  {
    id: 'R002',
    tanggal: today,
    jam: '18:45',
    nama_pelanggan: 'PT Sinar Laut',
    area: 'Meja indoor',
    pesanan: 'Paket corporate 14 pax',
    keterangan: 'Siapkan invoice perusahaan.',
    status: 'confirmed',
  },
  {
    id: 'R003',
    tanggal: today,
    jam: '19:30',
    nama_pelanggan: 'Mas Dimas',
    area: 'Saung 4',
    pesanan: 'Nila Bakar 3 porsi\nUdang Saus Padang 2 porsi\nCumi Goreng Tepung 2 porsi\nNasi Goreng Jawa 2 porsi\nEs Teh 8 Gelas',
    keterangan: 'Minta sambal dipisah dan nasi disajikan belakangan.',
    status: 'confirmed',
  },
  {
    id: 'R004',
    tanggal: yesterday,
    jam: '12:00',
    nama_pelanggan: 'Bu Sari',
    area: 'Saung 1',
    pesanan: 'Paket gurame 6 pax',
    keterangan: 'Arsip contoh untuk reservasi kemarin.',
    status: 'confirmed',
  },
  {
    id: 'R005',
    tanggal: nextWeek,
    jam: '13:00',
    nama_pelanggan: 'Keluarga Pak Anton',
    area: 'Saung 3',
    pesanan: 'Paket keluarga 10 pax\nEs kelapa muda 10 gelas',
    keterangan: 'Minta area dekat kolam.',
    status: 'confirmed',
  },
];

export const MOCK_TODOS = [
  {
    id: 'T001',
    judul: 'Cek kebersihan meja dan condiment',
    deskripsi: 'Pastikan setiap meja punya tisu, saus, dan sendok garpu lengkap.',
    target_type: 'role',
    target_value: 'Waitress',
    aktif: true,
  },
  {
    id: 'T002',
    judul: 'Update stok bahan utama',
    deskripsi: 'Catat stok ikan, udang, cumi, dan bumbu utama sebelum jam 10.00.',
    target_type: 'role',
    target_value: 'Chef',
    aktif: true,
  },
  {
    id: 'T003',
    judul: 'Briefing dan foto tim',
    deskripsi: 'Lakukan briefing singkat sebelum operasional dan upload foto briefing.',
    target_type: 'role',
    target_value: 'Manager',
    aktif: true,
  },
  {
    id: 'T005',
    judul: 'Cek kesiapan floor team',
    deskripsi: 'Pastikan floor team memahami pembagian area dan reservasi prioritas.',
    target_type: 'role',
    target_value: 'Captain Floor',
    aktif: true,
  },
  {
    id: 'T004',
    judul: 'Follow up reservasi malam',
    deskripsi: 'Konfirmasi ulang reservasi jam 18.45 dan request invoice.',
    target_type: 'employee',
    target_value: 'K001',
    aktif: true,
  },
];

export const MOCK_BRIEFING_PHOTOS = [];

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
  {
    id: `A${today.replace(/-/g, '')}-K011-IN`,
    karyawan_id: 'K011',
    nama: 'Maya Lestari',
    jabatan: 'Manager',
    tanggal: today,
    jam_masuk: `${today} 07:45:00`,
    jam_keluar: '',
    durasi_jam: '',
    status_lokasi_masuk: 'On-site',
    status_lokasi_keluar: '',
    foto_masuk_url: 'https://ui-avatars.com/api/?name=Maya+Lestari&size=128&background=1e3a5f&color=fff',
    foto_keluar_url: '',
  },
  {
    id: `A${today.replace(/-/g, '')}-K012-IN`,
    karyawan_id: 'K012',
    nama: 'Raka Firmansyah',
    jabatan: 'Captain Floor',
    tanggal: today,
    jam_masuk: `${today} 07:58:00`,
    jam_keluar: '',
    durasi_jam: '',
    status_lokasi_masuk: 'On-site',
    status_lokasi_keluar: '',
    foto_masuk_url: 'https://ui-avatars.com/api/?name=Raka+Firmansyah&size=128&background=1e3a5f&color=fff',
    foto_keluar_url: '',
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
