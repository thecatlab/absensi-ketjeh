import { CONFIG } from '../config';
import {
  MOCK_EMPLOYEES,
  MOCK_PIN,
  MOCK_SETTINGS,
  MOCK_ABSENSI_TODAY,
  MOCK_ADMIN_PASSWORD,
  MOCK_MANAGER_PASSWORD,
  MOCK_SHIFT_KHUSUS,
  MOCK_PENGUMUMAN,
  MOCK_RESERVASI,
  MOCK_TODOS,
  MOCK_BRIEFING_PHOTOS,
  generateMockHistory,
} from './mockData';

const GAS_URL = CONFIG.APPS_SCRIPT_URL;
const CONFIGURATION_ERROR = 'Konfigurasi server belum disetel. Hubungi admin.';

function shouldUseMock() {
  return import.meta.env.DEV && !GAS_URL;
}

function configurationError() {
  return { success: false, error: CONFIGURATION_ERROR };
}

async function gasGet(action, params = {}) {
  if (!GAS_URL) return configurationError();
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function gasPost(action, body = {}) {
  if (!GAS_URL) return configurationError();
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}

function normalizeClockData(data) {
  if (!data || typeof data !== 'object') {
    return { error: 'Data absensi tidak lengkap. Verifikasi karyawan dan PIN terlebih dahulu.' };
  }

  const normalized = {
    ...data,
    karyawan_id: data.karyawan_id ?? data.employeeId ?? data.id,
    nama: data.nama ?? data.name,
    pin: data.pin == null ? '' : String(data.pin).trim(),
  };

  if (!normalized.karyawan_id || !normalized.nama || !normalized.pin) {
    return { error: 'Data absensi tidak lengkap. Verifikasi karyawan dan PIN terlebih dahulu.' };
  }

  return { data: normalized };
}

// ============================================================
// API Functions
// ============================================================

export async function getKaryawan() {
  if (shouldUseMock()) {
    await delay(300);
    return { success: true, data: MOCK_EMPLOYEES };
  }
  return gasGet('getKaryawan');
}

export async function cekStatusHariIni(karyawanId) {
  if (shouldUseMock()) {
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
  const normalized = normalizeClockData(data);
  if (normalized.error) return { success: false, error: normalized.error };

  if (shouldUseMock()) {
    await delay(1000);
    if (String(normalized.data.pin) !== String(MOCK_PIN)) {
      return { error: 'PIN salah' };
    }
    const now = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', hour12: false }).replace(',', '');
    return { success: true, message: 'Clock in berhasil', jam_masuk: now, status_lokasi: 'On-site (mock)' };
  }
  return gasPost('clockIn', normalized.data);
}

export async function clockOut(data) {
  const normalized = normalizeClockData(data);
  if (normalized.error) return { success: false, error: normalized.error };

  if (shouldUseMock()) {
    await delay(1000);
    if (String(normalized.data.pin) !== String(MOCK_PIN)) {
      return { error: 'PIN salah' };
    }
    const now = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', hour12: false }).replace(',', '');
    return { success: true, message: 'Clock out berhasil', jam_keluar: now, durasi_jam: 8.5, status_lokasi: 'On-site (mock)' };
  }
  return gasPost('clockOut', normalized.data);
}

export async function getAbsensiHariIni() {
  if (shouldUseMock()) {
    await delay(200);
    return { success: true, data: MOCK_ABSENSI_TODAY };
  }
  return gasGet('getAbsensiHariIni');
}

export async function getAbsensi(dari, sampai, karyawanId) {
  if (shouldUseMock()) {
    await delay(400);
    let data = karyawanId ? generateMockHistory(karyawanId) : [];
    return { success: true, data };
  }
  const params = { dari, sampai };
  if (karyawanId) params.karyawan_id = karyawanId;
  return gasGet('getAbsensi', params);
}

export async function getPengaturan() {
  if (shouldUseMock()) {
    await delay(100);
    return { success: true, data: MOCK_SETTINGS };
  }
  return gasGet('getPengaturan');
}

// ============================================================
// PIN Verification (Employee)
// ============================================================

export async function verifyEmployeePin(karyawanId, pin) {
  if (shouldUseMock()) {
    await delay(300);
    const emp = MOCK_EMPLOYEES.find(e => e.id === karyawanId);
    const expectedPin = emp?.pin || MOCK_PIN;
    if (emp && String(expectedPin) === String(pin)) {
      return { success: true, verified: true };
    }
    return { success: true, verified: false };
  }
  return gasPost('verifyPin', { karyawan_id: karyawanId, pin });
}

// ============================================================
// Admin API Functions
// ============================================================

export async function adminLogin(password) {
  if (shouldUseMock()) {
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
  if (shouldUseMock()) {
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
  if (shouldUseMock()) {
    await delay(300);
    return { success: true, data: getMockEmployees() };
  }
  // Real API returns only active; for admin we need all
  return gasGet('getKaryawan');
}

export async function addEmployee(data, password) {
  if (shouldUseMock()) {
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
  if (shouldUseMock()) {
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
  if (shouldUseMock()) {
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
  if (shouldUseMock()) {
    await delay(400);
    const s = getMockSettings();
    Object.assign(s, newSettings);
    return { success: true, message: 'Pengaturan berhasil diperbarui' };
  }
  return gasPost('editPengaturan', { settings: newSettings, password });
}

export async function getShiftKhusus() {
  if (shouldUseMock()) {
    await delay(300);
    return { success: true, data: getMockShiftKhusus() };
  }
  return gasGet('getShiftKhusus');
}

export async function addShiftKhusus(data, password) {
  if (shouldUseMock()) {
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
  if (shouldUseMock()) {
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
  if (shouldUseMock()) {
    await delay(300);
    return { success: true, data: getMockNotes() };
  }
  return gasGet('getAdminNotes');
}

export async function addAdminNote(data, password) {
  if (shouldUseMock()) {
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
  if (shouldUseMock()) {
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
// Employee Dashboard
// ============================================================

let _mockPengumuman = null;
function getMockPengumuman() {
  if (!_mockPengumuman) _mockPengumuman = [...MOCK_PENGUMUMAN];
  return _mockPengumuman;
}

let _mockReservasi = null;
function getMockReservasi() {
  if (!_mockReservasi) _mockReservasi = [...MOCK_RESERVASI];
  return _mockReservasi;
}

let _mockTodos = null;
function getMockTodos() {
  if (!_mockTodos) _mockTodos = [...MOCK_TODOS];
  return _mockTodos;
}

function getTodayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function readTodoCompletions() {
  try {
    return JSON.parse(localStorage.getItem('todo_completions') || '{}');
  } catch {
    return {};
  }
}

function writeTodoCompletions(data) {
  localStorage.setItem('todo_completions', JSON.stringify(data));
}

function isActiveFlag(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

function isInDateRange(item, dateKey) {
  const start = item.tanggal_mulai || item.tanggal || dateKey;
  const end = item.tanggal_selesai || item.tanggal || dateKey;
  return start <= dateKey && dateKey <= end;
}

function splitTargets(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function targetMatchesEmployee(item, employee) {
  const type = String(item.target_type || 'all').toLowerCase();
  if (type === 'all') return true;

  const targets = splitTargets(item.target_value);
  if (type === 'employee' || type === 'employees') {
    return targets.some(target => String(target) === String(employee.id));
  }
  if (type === 'role' || type === 'roles') {
    const jabatan = String(employee.jabatan || '').toLowerCase();
    return targets.some(target => String(target).toLowerCase() === jabatan);
  }
  return false;
}

function todoMatchesEmployee(todo, employee) {
  if (!isActiveFlag(todo.aktif)) return false;
  return targetMatchesEmployee(todo, employee) && scheduleMatchesDate(todo, getTodayKey());
}

function scheduleMatchesDate(todo, dateKey) {
  const type = String(todo.schedule_type || 'daily').toLowerCase();
  const start = todo.tanggal_mulai || '';
  const end = todo.tanggal_selesai || '';
  if (start && dateKey < start) return false;
  if (end && dateKey > end) return false;

  if (type === 'once') return String(start || todo.tanggal || dateKey) === String(dateKey);
  if (type === 'period') return true;

  const date = new Date(`${dateKey}T00:00:00+07:00`);
  if (type === 'weekdays') {
    const day = String(date.getDay());
    return splitTargets(todo.schedule_value).includes(day);
  }

  if (type === 'month_dates') {
    return splitTargets(todo.schedule_value).includes(String(date.getDate()));
  }

  if (type === 'last_day_of_month') {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === lastDay;
  }

  if (type === 'every_x_month') {
    const interval = Math.max(parseInt(todo.schedule_interval_months) || 1, 1);
    const anchor = start || dateKey;
    const anchorDate = new Date(`${anchor}T00:00:00+07:00`);
    const monthDiff = (date.getFullYear() - anchorDate.getFullYear()) * 12 + date.getMonth() - anchorDate.getMonth();
    return monthDiff >= 0 && monthDiff % interval === 0 && date.getDate() === anchorDate.getDate();
  }

  return true;
}

function getMockClockStatus(employee) {
  const record = MOCK_ABSENSI_TODAY.find(a => a.karyawan_id === employee.id);
  if (!record) {
    return { status: 'belum_masuk' };
  }
  if (!record.jam_keluar) {
    return { status: 'sudah_masuk', jam_masuk: record.jam_masuk };
  }
  return {
    status: 'sudah_keluar',
    jam_masuk: record.jam_masuk,
    jam_keluar: record.jam_keluar,
    durasi_jam: record.durasi_jam,
  };
}

export async function getEmployeeDashboard(employee) {
  if (shouldUseMock()) {
    await delay(300);
    const todayKey = getTodayKey();
    const completions = readTodoCompletions();
    const completionKey = `${todayKey}:${employee.id}`;
    const completedTodos = completions[completionKey] || {};
    const briefing = MOCK_BRIEFING_PHOTOS.find(p => p.tanggal === todayKey && String(p.karyawan_id) === String(employee.id));

    return {
      success: true,
      pengumuman: getMockPengumuman()
        .filter(p => isActiveFlag(p.aktif) && isInDateRange(p, todayKey) && targetMatchesEmployee(p, employee))
        .sort((a, b) => String(a.tanggal_mulai).localeCompare(String(b.tanggal_mulai))),
      reservasi: getMockReservasi()
        .filter(r => r.tanggal === todayKey)
        .sort((a, b) => String(a.jam).localeCompare(String(b.jam))),
      status_hari_ini: getMockClockStatus(employee),
      todos: getMockTodos()
        .filter(todo => todoMatchesEmployee(todo, employee))
        .map(todo => ({ ...todo, selesai: Boolean(completedTodos[todo.id]) })),
      briefing: briefing || null,
    };
  }
  return gasGet('getEmployeeDashboard', {
    karyawan_id: employee.id,
    jabatan: employee.jabatan,
    nama: employee.nama,
  });
}

export async function setTodoStatus(todoId, employee, selesai) {
  if (shouldUseMock()) {
    await delay(200);
    const todayKey = getTodayKey();
    const completions = readTodoCompletions();
    const completionKey = `${todayKey}:${employee.id}`;
    completions[completionKey] = completions[completionKey] || {};
    completions[completionKey][todoId] = Boolean(selesai);
    writeTodoCompletions(completions);
    return { success: true };
  }
  return gasPost('setTodoStatus', {
    todo_id: todoId,
    karyawan_id: employee.id,
    nama: employee.nama,
    selesai,
  });
}

export async function uploadBriefingPhoto(employee, fotoBase64) {
  if (shouldUseMock()) {
    await delay(500);
    const todayKey = getTodayKey();
    const idx = MOCK_BRIEFING_PHOTOS.findIndex(p => p.tanggal === todayKey && String(p.karyawan_id) === String(employee.id));
    if (idx >= 0) {
      return { error: 'Foto briefing untuk hari ini sudah diupload' };
    }
    const record = {
      id: 'B' + Date.now(),
      tanggal: todayKey,
      karyawan_id: employee.id,
      nama: employee.nama,
      foto_url: `data:image/jpeg;base64,${fotoBase64}`,
      jam_upload: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }),
    };
    MOCK_BRIEFING_PHOTOS.push(record);
    return { success: true, data: record, message: 'Foto briefing berhasil diupload' };
  }
  return gasPost('uploadFotoBriefing', {
    karyawan_id: employee.id,
    nama: employee.nama,
    foto_base64: fotoBase64,
  });
}

// ============================================================
// Dashboard Admin Data
// ============================================================

export async function getPengumumanAdmin() {
  if (shouldUseMock()) {
    await delay(250);
    return { success: true, data: getMockPengumuman() };
  }
  return gasGet('getPengumumanAdmin');
}

export async function addPengumuman(data, password) {
  if (shouldUseMock()) {
    await delay(350);
    getMockPengumuman().push({
      id: 'P' + String(Date.now()).slice(-6),
      ...data,
      aktif: true,
    });
    return { success: true, message: 'Pengumuman berhasil ditambahkan' };
  }
  return gasPost('tambahPengumuman', { ...data, aktif: true, password });
}

export async function deletePengumuman(id, password) {
  if (shouldUseMock()) {
    await delay(250);
    const data = getMockPengumuman();
    const idx = data.findIndex(item => item.id === id);
    if (idx >= 0) data.splice(idx, 1);
    return { success: true, message: 'Pengumuman dihapus' };
  }
  return gasPost('hapusPengumuman', { id, password });
}

export async function updatePengumumanStatus(id, aktif, password) {
  if (shouldUseMock()) {
    await delay(250);
    const data = getMockPengumuman();
    const item = data.find(row => row.id === id);
    if (!item) return { error: 'Pengumuman tidak ditemukan' };
    item.aktif = Boolean(aktif);
    return { success: true, message: 'Status pengumuman diperbarui' };
  }
  return gasPost('updatePengumumanStatus', { id, aktif, password });
}

export async function updatePengumuman(id, data, password) {
  if (shouldUseMock()) {
    await delay(350);
    const rows = getMockPengumuman();
    const idx = rows.findIndex(item => item.id === id);
    if (idx === -1) return { error: 'Pengumuman tidak ditemukan' };
    rows[idx] = { ...rows[idx], ...data, id };
    return { success: true, message: 'Pengumuman berhasil diperbarui' };
  }
  return gasPost('editPengumuman', { ...data, id, password });
}

export async function getReservasiAdmin() {
  if (shouldUseMock()) {
    await delay(250);
    return { success: true, data: getMockReservasi() };
  }
  return gasGet('getReservasiAdmin');
}

export async function addReservasi(data, password) {
  if (shouldUseMock()) {
    await delay(350);
    getMockReservasi().push({
      id: 'R' + String(Date.now()).slice(-6),
      status: 'confirmed',
      ...data,
    });
    return { success: true, message: 'Reservasi berhasil ditambahkan' };
  }
  return gasPost('tambahReservasi', { ...data, password });
}

export async function updateReservasi(id, data, password) {
  if (shouldUseMock()) {
    await delay(350);
    const rows = getMockReservasi();
    const idx = rows.findIndex(item => item.id === id);
    if (idx === -1) return { error: 'Reservasi tidak ditemukan' };
    rows[idx] = { ...rows[idx], ...data, id };
    return { success: true, message: 'Reservasi berhasil diperbarui' };
  }
  return gasPost('editReservasi', { ...data, id, password });
}

export async function deleteReservasi(id, password) {
  if (shouldUseMock()) {
    await delay(250);
    const data = getMockReservasi();
    const idx = data.findIndex(item => item.id === id);
    if (idx >= 0) data.splice(idx, 1);
    return { success: true, message: 'Reservasi dihapus' };
  }
  return gasPost('hapusReservasi', { id, password });
}

export async function getTodosAdmin() {
  if (shouldUseMock()) {
    await delay(250);
    return { success: true, data: getMockTodos() };
  }
  return gasGet('getTodosAdmin');
}

export async function addTodo(data, password) {
  if (shouldUseMock()) {
    await delay(350);
    getMockTodos().push({
      id: 'T' + String(Date.now()).slice(-6),
      aktif: true,
      ...data,
    });
    return { success: true, message: 'To-do berhasil ditambahkan' };
  }
  return gasPost('tambahTodo', { ...data, password });
}

export async function updateTodo(id, data, password) {
  if (shouldUseMock()) {
    await delay(350);
    const rows = getMockTodos();
    const idx = rows.findIndex(item => item.id === id);
    if (idx === -1) return { error: 'To-do tidak ditemukan' };
    rows[idx] = { ...rows[idx], ...data, id };
    return { success: true, message: 'To-do berhasil diperbarui' };
  }
  return gasPost('editTodo', { ...data, id, password });
}

export async function deleteTodo(id, password) {
  if (shouldUseMock()) {
    await delay(250);
    const data = getMockTodos();
    const idx = data.findIndex(item => item.id === id);
    if (idx >= 0) data.splice(idx, 1);
    return { success: true, message: 'To-do dihapus' };
  }
  return gasPost('hapusTodo', { id, password });
}

// ============================================================
// Reports
// ============================================================

export async function getReport(dari, sampai, karyawanId, password) {
  if (shouldUseMock()) {
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
  return gasPost('getReport', { dari, sampai, karyawan_id: karyawanId, password });
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
