import { CONFIG } from '../config';
import {
  MOCK_EMPLOYEES,
  MOCK_PIN,
  MOCK_SETTINGS,
  MOCK_ABSENSI_TODAY,
  MOCK_ADMIN_PASSWORD,
  MOCK_MANAGER_PASSWORD,
  MOCK_SHIFT_KHUSUS,
  generateMockHistory,
} from './mockData';

const GAS_URL = CONFIG.APPS_SCRIPT_URL;

function useMock() {
  return !GAS_URL;
}

async function gasGet(action, params = {}) {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function gasPost(action, body = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}

// ============================================================
// API Functions
// ============================================================

export async function getKaryawan() {
  if (useMock()) {
    await delay(300);
    return { success: true, data: MOCK_EMPLOYEES };
  }
  return gasGet('getKaryawan');
}

export async function cekStatusHariIni(karyawanId) {
  if (useMock()) {
    await delay(200);
    const record = MOCK_ABSENSI_TODAY.find(a => a.karyawan_id === karyawanId);
    if (!record) {
      return { success: true, status: 'belum_masuk' };
    }
    if (!record.jam_keluar) {
      return { success: true, status: 'sudah_masuk', jam_masuk: record.jam_masuk };
    }
    return { success: true, status: 'sudah_keluar', jam_masuk: record.jam_masuk, jam_keluar: record.jam_keluar };
  }
  return gasGet('cekStatusHariIni', { karyawan_id: karyawanId });
}

export async function clockIn(data) {
  if (useMock()) {
    await delay(1000);
    if (data.pin !== MOCK_PIN) {
      return { error: 'PIN salah' };
    }
    const now = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', hour12: false }).replace(',', '');
    return { success: true, message: 'Clock in berhasil', jam_masuk: now, status_lokasi: 'On-site (mock)' };
  }
  return gasPost('clockIn', data);
}

export async function clockOut(data) {
  if (useMock()) {
    await delay(1000);
    if (data.pin !== MOCK_PIN) {
      return { error: 'PIN salah' };
    }
    const now = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', hour12: false }).replace(',', '');
    return { success: true, message: 'Clock out berhasil', jam_keluar: now, durasi_jam: 8.5, status_lokasi: 'On-site (mock)' };
  }
  return gasPost('clockOut', data);
}

export async function getAbsensiHariIni() {
  if (useMock()) {
    await delay(200);
    return { success: true, data: MOCK_ABSENSI_TODAY };
  }
  return gasGet('getAbsensiHariIni');
}

export async function getAbsensi(dari, sampai, karyawanId) {
  if (useMock()) {
    await delay(400);
    let data = karyawanId ? generateMockHistory(karyawanId) : [];
    return { success: true, data };
  }
  return gasGet('getAbsensi', { dari, sampai });
}

export async function getPengaturan() {
  if (useMock()) {
    await delay(100);
    return { success: true, data: MOCK_SETTINGS };
  }
  return gasGet('getPengaturan');
}

// ============================================================
// Admin API Functions
// ============================================================

export async function adminLogin(password) {
  if (useMock()) {
    await delay(300);
    if (password === MOCK_ADMIN_PASSWORD) {
      return { success: true, role: 'admin' };
    }
    if (password === MOCK_MANAGER_PASSWORD) {
      return { success: true, role: 'manager' };
    }
    return { error: 'Password salah' };
  }
  return gasPost('adminLogin', { password });
}

export async function getDashboardData() {
  if (useMock()) {
    await delay(300);
    const todayRecords = MOCK_ABSENSI_TODAY;
    const totalKaryawan = MOCK_EMPLOYEES.length;
    const hadir = todayRecords.length;
    const belumHadir = totalKaryawan - hadir;
    const sudahKeluar = todayRecords.filter(r => r.jam_keluar).length;

    // Count late: jam_masuk > shift_mulai + toleransi
    const shiftMulai = MOCK_SETTINGS.shift_mulai;
    const toleransi = parseInt(MOCK_SETTINGS.toleransi_terlambat_menit) || 15;
    const batasMasuk = addMinutesToTime(shiftMulai, toleransi);
    const terlambat = todayRecords.filter(r => {
      const masuk = extractTimeFromDatetime(r.jam_masuk);
      return masuk > batasMasuk;
    }).length;

    return {
      success: true,
      summary: { totalKaryawan, hadir, belumHadir, terlambat, sudahKeluar },
      records: todayRecords,
    };
  }
  // Real API: combine getAbsensiHariIni + getKaryawan
  const [absensi, karyawan] = await Promise.all([
    gasGet('getAbsensiHariIni'),
    gasGet('getKaryawan'),
  ]);
  const records = absensi.data || [];
  const totalKaryawan = (karyawan.data || []).length;
  const hadir = records.length;
  return {
    success: true,
    summary: { totalKaryawan, hadir, belumHadir: totalKaryawan - hadir, terlambat: 0, sudahKeluar: 0 },
    records,
  };
}

// ============================================================
// Employee CRUD
// ============================================================

let _mockEmployees = null;
function getMockEmployees() {
  if (!_mockEmployees) _mockEmployees = [...MOCK_EMPLOYEES];
  return _mockEmployees;
}

export async function getAllEmployees() {
  if (useMock()) {
    await delay(300);
    return { success: true, data: getMockEmployees() };
  }
  // Real API returns only active; for admin we need all
  return gasGet('getKaryawan');
}

export async function addEmployee(data, password) {
  if (useMock()) {
    await delay(500);
    const emps = getMockEmployees();
    const maxNum = emps.reduce((max, e) => {
      const n = parseInt(e.id.substring(1));
      return n > max ? n : max;
    }, 0);
    const newId = 'K' + String(maxNum + 1).padStart(3, '0');
    const newEmp = {
      id: newId,
      nama: data.nama,
      jabatan: data.jabatan,
      kategori: data.kategori || 'on-site',
      aktif: true,
      pin: data.pin || '1234',
    };
    emps.push(newEmp);
    return { success: true, message: 'Karyawan berhasil ditambahkan', id: newId };
  }
  return gasPost('tambahKaryawan', { ...data, password });
}

export async function updateEmployee(id, data, password) {
  if (useMock()) {
    await delay(500);
    const emps = getMockEmployees();
    const idx = emps.findIndex(e => e.id === id);
    if (idx === -1) return { error: 'Karyawan tidak ditemukan' };
    // Update fields
    if (data.nama) emps[idx].nama = data.nama;
    if (data.jabatan) emps[idx].jabatan = data.jabatan;
    if (data.kategori) emps[idx].kategori = data.kategori;
    if (data.pin) emps[idx].pin = data.pin;
    if (data.aktif !== undefined) emps[idx].aktif = data.aktif;
    return { success: true, message: 'Karyawan berhasil diperbarui' };
  }
  return gasPost('editKaryawan', { id, ...data, password });
}

export async function deactivateEmployee(id, password) {
  if (useMock()) {
    await delay(300);
    const emps = getMockEmployees();
    const idx = emps.findIndex(e => e.id === id);
    if (idx === -1) return { error: 'Karyawan tidak ditemukan' };
    emps[idx].aktif = false;
    return { success: true, message: 'Karyawan berhasil dinonaktifkan' };
  }
  return gasPost('editKaryawan', { id, aktif: 'FALSE', password });
}

// ============================================================
// Settings & Special Shifts
// ============================================================

let _mockSettings = null;
function getMockSettings() {
  if (!_mockSettings) _mockSettings = { ...MOCK_SETTINGS };
  return _mockSettings;
}

let _mockShiftKhusus = null;
function getMockShiftKhusus() {
  if (!_mockShiftKhusus) _mockShiftKhusus = [...MOCK_SHIFT_KHUSUS];
  return _mockShiftKhusus;
}

export async function updateSettings(newSettings, password) {
  if (useMock()) {
    await delay(400);
    const s = getMockSettings();
    Object.assign(s, newSettings);
    return { success: true, message: 'Pengaturan berhasil diperbarui' };
  }
  return gasPost('editPengaturan', { settings: newSettings, password });
}

export async function getShiftKhusus() {
  if (useMock()) {
    await delay(300);
    return { success: true, data: getMockShiftKhusus() };
  }
  return gasGet('getShiftKhusus');
}

export async function addShiftKhusus(data, password) {
  if (useMock()) {
    await delay(400);
    const shifts = getMockShiftKhusus();
    // Prevent duplicate date
    if (shifts.find(s => s.tanggal === data.tanggal)) {
      return { error: 'Sudah ada shift khusus untuk tanggal tersebut' };
    }
    shifts.push({
      tanggal: data.tanggal,
      nama_hari: data.nama_hari,
      shift_mulai: data.shift_mulai || 'LIBUR',
      shift_selesai: data.shift_selesai || '',
      catatan: data.catatan || '',
    });
    shifts.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    return { success: true, message: 'Shift khusus berhasil ditambahkan' };
  }
  return gasPost('tambahShiftKhusus', { ...data, password });
}

export async function deleteShiftKhusus(tanggal, password) {
  if (useMock()) {
    await delay(300);
    const shifts = getMockShiftKhusus();
    const idx = shifts.findIndex(s => s.tanggal === tanggal);
    if (idx === -1) return { error: 'Shift khusus tidak ditemukan' };
    shifts.splice(idx, 1);
    return { success: true, message: 'Shift khusus berhasil dihapus' };
  }
  return gasPost('hapusShiftKhusus', { tanggal, password });
}

// ============================================================
// Admin Notes
// ============================================================

let _mockNotes = null;
function getMockNotes() {
  if (!_mockNotes) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    _mockNotes = [
      { id: 'N001', tanggal: yesterdayStr, jam: '09:15', pengirim: 'admin', pesan: 'Cici Wulandari izin datang terlambat karena antar anak sekolah.' },
      { id: 'N002', tanggal: yesterdayStr, jam: '14:30', pengirim: 'manager', pesan: 'Stok bahan baku menipis, Dewi sudah diinstruksikan untuk purchasing besok pagi.' },
      { id: 'N003', tanggal: today, jam: '08:05', pengirim: 'admin', pesan: 'Joko Widodo datang terlambat karena kondisi orang tua sakit. Sudah konfirmasi via WA.' },
      { id: 'N004', tanggal: today, jam: '10:20', pengirim: 'manager', pesan: 'Event waterpark tanggal 25 April, perlu tambahan 2 orang waitress dari shift siang.' },
    ];
  }
  return _mockNotes;
}

export async function getAdminNotes() {
  if (useMock()) {
    await delay(300);
    return { success: true, data: getMockNotes() };
  }
  return gasGet('getAdminNotes');
}

export async function addAdminNote(data, password) {
  if (useMock()) {
    await delay(400);
    const notes = getMockNotes();
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    const newNote = {
      id: 'N' + String(Date.now()).slice(-6),
      tanggal: today,
      jam,
      pengirim: data.pengirim,
      pesan: data.pesan,
    };
    notes.push(newNote);
    return { success: true, message: 'Catatan berhasil ditambahkan' };
  }
  return gasPost('tambahAdminNote', { ...data, password });
}

export async function deleteAdminNote(noteId, password) {
  if (useMock()) {
    await delay(300);
    const notes = getMockNotes();
    const idx = notes.findIndex(n => n.id === noteId);
    if (idx === -1) return { error: 'Catatan tidak ditemukan' };
    notes.splice(idx, 1);
    return { success: true, message: 'Catatan berhasil dihapus' };
  }
  return gasPost('hapusAdminNote', { id: noteId, password });
}

// ============================================================
// Reports
// ============================================================

export async function getReport(dari, sampai, karyawanId) {
  if (useMock()) {
    await delay(400);
    // Generate mock report data across the date range
    const emps = getMockEmployees();
    const records = [];
    const start = new Date(dari + 'T00:00:00+07:00');
    const end = new Date(sampai + 'T00:00:00+07:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) continue; // skip Sunday
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      const targetEmps = karyawanId ? emps.filter(e => e.id === karyawanId) : emps;
      for (const emp of targetEmps) {
        if (!emp.aktif) continue;
        // 80% chance of attendance
        if (Math.random() < 0.2) continue;
        const hour = 7 + Math.floor(Math.random() * 2);
        const min = Math.floor(Math.random() * 60);
        const outHour = hour + 8 + Math.floor(Math.random() * 2);
        const outMin = Math.floor(Math.random() * 60);
        const masuk = `${dateStr} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
        const keluar = `${dateStr} ${String(outHour).padStart(2, '0')}:${String(outMin).padStart(2, '0')}:00`;
        const durasi = Math.round((outHour + outMin / 60 - hour - min / 60) * 100) / 100;

        const lokasi = Math.random() > 0.15 ? 'On-site' : `Off-site (${(Math.random() * 3 + 0.3).toFixed(1)}km)`;
        records.push({
          karyawan_id: emp.id,
          nama: emp.nama,
          jabatan: emp.jabatan,
          kategori: emp.kategori,
          tanggal: dateStr,
          jam_masuk: masuk,
          jam_keluar: keluar,
          durasi_jam: durasi,
          status_lokasi_masuk: lokasi,
          foto_masuk_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nama)}&size=128&background=1e3a5f&color=fff`,
          foto_keluar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nama)}&size=128&background=22c55e&color=fff`,
        });
      }
    }

    // Summary
    const uniqueDates = [...new Set(records.map(r => r.tanggal))];
    const totalDurasi = records.reduce((s, r) => s + (r.durasi_jam || 0), 0);
    const settings = getMockSettings();
    const batas = addMinutesToTime(settings.shift_mulai, parseInt(settings.toleransi_terlambat_menit) || 15);
    const terlambat = records.filter(r => extractTimeFromDatetime(r.jam_masuk) > batas).length;

    return {
      success: true,
      data: records,
      summary: {
        total_hari: uniqueDates.length,
        total_hadir: records.length,
        total_durasi_jam: Math.round(totalDurasi * 100) / 100,
        rata_rata_durasi: records.length > 0 ? Math.round((totalDurasi / records.length) * 100) / 100 : 0,
        total_terlambat: terlambat,
      },
    };
  }
  return gasPost('getReport', { dari, sampai, karyawan_id: karyawanId });
}

function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function extractTimeFromDatetime(dtStr) {
  if (!dtStr) return '99:99';
  const parts = String(dtStr).split(' ');
  return parts.length >= 2 ? parts[1].substring(0, 5) : dtStr;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
