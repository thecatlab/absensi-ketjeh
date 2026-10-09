// Read-only equivalents of the Apps Script handlers. Writes remain in Apps Script.
import { getArrivalStatus } from '../src/utils/attendanceStatus.js';
const dashboardTables = ['Absensi', 'Todo', 'TodoStatus', 'FotoBriefing', 'Reservasi', 'Pengumuman', 'Pengaturan'];
export const READ_TABLES = {
  bootstrap: ['Karyawan', 'Pengaturan', 'Jabatan'],
  getKaryawan: ['Karyawan'], getJabatan: ['Jabatan'], getPengaturan: ['Pengaturan'],
  verifyPin: [], adminLogin: [], getAllEmployees: ['Karyawan'],
  getAbsensiHariIni: ['Absensi'], getAbsensi: ['Absensi'], downloadAbsensi: ['Absensi'],
  cekStatusHariIni: ['Absensi'], getReport: ['Absensi'],
  getEmployeeDashboard: dashboardTables,
  getAdminDashboard: ['Absensi', 'Karyawan', 'Pengaturan'],
  getShiftKhusus: ['ShiftKhusus'], getAdminNotes: ['AdminNotes'],
  getPengumumanAdmin: ['Pengumuman'], getReservasiAdmin: ['Reservasi'],
  getTodosAdmin: ['Todo'], getJabatanAdmin: ['Jabatan'],
};
const publicActions = new Set(['bootstrap', 'getKaryawan', 'getJabatan', 'getPengaturan', 'verifyPin', 'adminLogin']);
const employeeActions = new Set(['getAbsensi', 'cekStatusHariIni', 'getEmployeeDashboard', 'getReservasiAdmin']);
const employeeOnly = new Set(['cekStatusHariIni', 'getEmployeeDashboard']);
export const todayWib = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const clean = value => Object.fromEntries(Object.entries(value).filter(([key]) => !/pin|password|credential|secret|token/i.test(key)));
const active = value => String(value).toUpperCase() === 'TRUE';
const targets = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);

export function requestSnapshot(body, today) {
  let tables = READ_TABLES[body.action];
  if (!tables) throw new Error('Unknown action: ' + body.action);
  if (body.include_dashboard === true && body.action === 'verifyPin') tables = dashboardTables;
  if (body.include_dashboard === true && body.action === 'adminLogin') tables = READ_TABLES.getAdminDashboard;
  const daily = ['getAbsensiHariIni', 'cekStatusHariIni', 'getEmployeeDashboard', 'getAdminDashboard'].includes(body.action)
    || (body.include_dashboard === true && ['verifyPin', 'adminLogin'].includes(body.action));
  return {
    p_tables: tables,
    p_filter: { from: daily ? today : body.dari || '', to: daily ? today : body.sampai || '', employee: body.karyawan_id || '' },
    p_auth: { password: body.password || '', pin: body.pin || '', karyawan_id: body.karyawan_id || '' },
  };
}

export function authorized(body, auth) {
  if (publicActions.has(body.action)) return true;
  if (['admin', 'manager'].includes(auth.role) && !employeeOnly.has(body.action)) return true;
  return auth.role === 'employee' && auth.employee?.id === String(body.karyawan_id) && employeeActions.has(body.action);
}

export function scheduleMatchesDate(todo, dateKey) {
  const type = String(todo.schedule_type || 'daily').toLowerCase();
  const start = todo.tanggal_mulai || '';
  const end = todo.tanggal_selesai || '';
  if ((start && dateKey < start) || (end && dateKey > end)) return false;
  if (type === 'once') return String(start || todo.tanggal || dateKey) === dateKey;
  if (type === 'period') return true;
  // Calendar-only dates use UTC getters so the hosting region cannot shift WIB days.
  const date = new Date(dateKey + 'T00:00:00Z');
  if (type === 'weekdays') return targets(todo.schedule_value).includes(String(date.getUTCDay()));
  if (type === 'month_dates') return targets(todo.schedule_value).includes(String(date.getUTCDate()));
  if (type === 'last_day_of_month') return date.getUTCDate() === new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  if (type === 'every_x_month') {
    const anchor = new Date((start || dateKey) + 'T00:00:00Z');
    const interval = Math.max(parseInt(todo.schedule_interval_months, 10) || 1, 1);
    const months = (date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + date.getUTCMonth() - anchor.getUTCMonth();
    return months >= 0 && months % interval === 0 && date.getUTCDate() === anchor.getUTCDate();
  }
  return true;
}

function targetMatches(item, employee) {
  const type = String(item.target_type || 'all').toLowerCase();
  if (type === 'all') return true;
  if (['employee', 'employees'].includes(type)) return targets(item.target_value).includes(String(employee.id));
  if (['role', 'roles'].includes(type)) return targets(item.target_value).some(value => value.toLowerCase() === String(employee.jabatan || '').toLowerCase());
  return false;
}

export function readResult(body, snapshot, today) {
  const auth = snapshot.auth || {};
  if (!authorized(body, auth)) return { error: 'Akses ditolak. Verifikasi PIN atau login kembali.', code: 'AUTH_REQUIRED' };
  const rows = name => {
    const dataset = snapshot.datasets[name];
    if (!dataset || !Array.isArray(dataset.rows)) throw new Error('Skema database tidak cocok: ' + name);
    // Match the sheet adapter's empty cells, string values, and credential redaction.
    return dataset.rows.map(row => clean(Object.fromEntries(dataset.headers.map(key => [key, row.data[key] == null ? '' : typeof row.data[key] === 'boolean' ? String(row.data[key]).toUpperCase() : String(row.data[key])]))));
  };
  const settings = () => clean(Object.fromEntries(rows('Pengaturan').map(row => [String(row.key).trim(), String(row.value || '').trim()]).filter(([key]) => key)));
  const employees = () => rows('Karyawan').filter(employee => active(employee.aktif));
  const jabatan = () => [...new Set(rows('Jabatan').filter(row => active(row.aktif)).map(row => row.jabatan.trim()).filter(Boolean))].sort();
  const attendance = () => rows('Absensi').filter(row => (!body.dari || row.tanggal >= body.dari) && (!body.sampai || row.tanggal <= body.sampai) && (!body.karyawan_id || row.karyawan_id === String(body.karyawan_id)));
  const todayAttendance = () => rows('Absensi').filter(row => row.tanggal === today);
  const status = id => {
    if (!id) return { error: 'karyawan_id diperlukan' };
    const record = todayAttendance().find(row => row.karyawan_id === String(id));
    if (!record) return { success: true, status: 'belum_masuk' };
    if (!record.jam_keluar.trim()) return { success: true, status: 'sudah_masuk', jam_masuk: record.jam_masuk, foto_masuk_url: record.foto_masuk_url };
    return { success: true, status: 'sudah_keluar', jam_masuk: record.jam_masuk, jam_keluar: record.jam_keluar, durasi_jam: record.durasi_jam };
  };
  const employeeDashboard = () => {
    const employee = auth.employee;
    if (!employee?.id || !employee.jabatan) return { error: 'karyawan_id dan jabatan diperlukan' };
    const statuses = rows('TodoStatus');
    return {
      success: true,
      pengumuman: rows('Pengumuman').filter(item => active(item.aktif) && (item.tanggal_mulai || today) <= today && today <= (item.tanggal_selesai || today) && targetMatches(item, employee)),
      reservasi: rows('Reservasi').filter(item => item.tanggal === today).sort((a, b) => a.jam.localeCompare(b.jam)),
      status_hari_ini: status(employee.id),
      todos: rows('Todo').filter(todo => active(todo.aktif) && targetMatches(todo, employee) && scheduleMatchesDate(todo, today)).map(todo => {
        const found = statuses.find(row => row.tanggal === today && row.karyawan_id === employee.id && row.todo_id === todo.id);
        return { ...todo, selesai: found ? active(found.selesai) : false, nama: employee.nama || '' };
      }),
      briefing: rows('FotoBriefing').find(row => row.tanggal === today && row.karyawan_id === employee.id) || null,
      settings: settings(),
    };
  };
  const adminDashboard = () => {
    const records = todayAttendance();
    const totalKaryawan = employees().length;
    const current = settings();
    const terlambat = records.filter(row => getArrivalStatus(row, current) === 'late').length;
    const sudahKeluar = records.filter(row => row.jam_keluar.trim()).length;
    return { success: true, summary: { totalKaryawan, hadir: records.length, belumHadir: totalKaryawan - records.length, terlambat, sudahKeluar }, records, settings: current };
  };
  switch (body.action) {
    case 'bootstrap': return { success: true, data: { employees: employees(), settings: settings(), jabatan: jabatan() } };
    case 'getKaryawan': return { success: true, data: employees() };
    case 'getJabatan': return { success: true, data: jabatan() };
    case 'getPengaturan': return { success: true, data: settings() };
    case 'verifyPin': {
      if (!body.karyawan_id || !body.pin) return { error: 'karyawan_id dan pin diperlukan' };
      const verified = auth.role === 'employee' && auth.employee?.id === String(body.karyawan_id);
      return { success: true, verified, ...(verified && body.include_dashboard === true ? { dashboard: employeeDashboard() } : {}) };
    }
    case 'adminLogin': return ['admin', 'manager'].includes(auth.role)
      ? { success: true, role: auth.role, ...(body.include_dashboard === true ? { dashboard: adminDashboard() } : {}) }
      : { error: 'Password salah' };
    case 'getEmployeeDashboard': return employeeDashboard();
    case 'getAdminDashboard': return adminDashboard();
    case 'cekStatusHariIni': return status(body.karyawan_id);
    case 'getAbsensiHariIni': return { success: true, data: todayAttendance() };
    case 'getAbsensi': case 'downloadAbsensi': return body.dari && body.sampai ? { success: true, data: attendance() } : { error: 'Parameter dari dan sampai diperlukan' };
    case 'getReport': {
      const data = attendance();
      const duration = data.reduce((sum, row) => sum + (parseFloat(row.durasi_jam) || 0), 0);
      return { success: true, data, summary: { total_hari: new Set(data.map(row => row.tanggal)).size, total_hadir: data.length, total_durasi_jam: Math.round(duration * 100) / 100, rata_rata_durasi: data.length ? Math.round(duration / data.length * 100) / 100 : 0 } };
    }
    case 'getAdminNotes': return { success: true, data: rows('AdminNotes').sort((a, b) => (a.tanggal + ' ' + a.jam).localeCompare(b.tanggal + ' ' + b.jam)) };
    default: return { success: true, data: rows(READ_TABLES[body.action][0]) };
  }
}
