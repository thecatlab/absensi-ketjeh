import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { handleRead } from '../api/read.mjs';
import { readResult, requestSnapshot, scheduleMatchesDate, todayWib } from '../server/read-model.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const today = '2026-10-02';
function fixture(role = 'admin') {
  const context = vm.createContext({ Date, Set });
  for (const name of ['Code', 'Helpers', 'Admin', 'Absensi', 'Dashboard', 'Supabase']) {
    vm.runInContext(readFileSync(new URL('../gas/' + name + '.gs', import.meta.url), 'utf8'), context);
  }
  const headers = plain(vm.runInContext('DATABASE_HEADERS', context));
  const employee = { id: 'K001', nama: 'Synthetic employee', jabatan: 'Bartender', aktif: 'TRUE' };
  const snapshot = { auth: { role, employee }, datasets: {} };
  for (const [name, columns] of Object.entries(headers)) snapshot.datasets[name] = { headers: columns, revision: 1, rows: [] };
  const add = (name, data) => snapshot.datasets[name].rows.push({ id: data[headers[name][0]], ordinal: snapshot.datasets[name].rows.length + 1, data });
  add('Karyawan', { ...employee, pin: 'synthetic-secret' });
  add('Karyawan', { id: 'K002', nama: 'Inactive', jabatan: 'Cook', aktif: 'FALSE' });
  add('Jabatan', { jabatan: 'Bartender', aktif: true });
  add('Jabatan', { jabatan: 'Bartender', aktif: 'TRUE' });
  add('Jabatan', { jabatan: 'Retired', aktif: 'FALSE' });
  add('Pengaturan', { key: 'shift_mulai', value: '08:00' });
  add('Pengaturan', { key: 'admin_password', value: 'synthetic-secret' });
  add('Absensi', { id: 'A1', tanggal: today, karyawan_id: 'K001', jam_masuk: today + ' 08:00:00', durasi_jam: '8.125' });
  add('Absensi', { id: 'A2', tanggal: '2026-09-30', karyawan_id: 'K002', jam_masuk: '2026-09-30 08:01:00', jam_keluar: '2026-09-30 17:00:00', durasi_jam: '8.98' });
  for (const [id, target_type, target_value] of [['T1','roles','Bartender'], ['T2','employees','K002'], ['T3','all','']]) {
    add('Todo', { id, judul: id, target_type, target_value, aktif: true, schedule_type: 'daily' });
    add('Pengumuman', { id, judul: id, target_type, target_value, aktif: true });
  }
  add('TodoStatus', { id: 'S1', tanggal: today, karyawan_id: 'K001', todo_id: 'T1', selesai: true });
  add('TodoStatus', { id: 'S2', tanggal: today, karyawan_id: 'K001', todo_id: 'T1', selesai: false });
  add('FotoBriefing', { id: 'B1', tanggal: today, karyawan_id: 'K001', foto_url: 'https://example.test/photo' });
  add('Reservasi', { id: 'R1', tanggal: today, jam: '19:00' });
  add('Reservasi', { id: 'R2', tanggal: today, jam: '10:00' });
  add('AdminNotes', { id: 'N1', tanggal: today, jam: '10:00', pesan: 'Later' });
  add('AdminNotes', { id: 'N2', tanggal: today, jam: '09:00', pesan: 'Earlier' });
  context.supabaseRpc = () => structuredClone(snapshot);
  context.getTodayString = () => today;
  return { snapshot, legacy: body => plain(context.databaseDispatch(body, 'POST')) };
}

for (const role of ['admin', 'manager', 'employee', 'anonymous']) {
  test(`read responses match existing backend for ${role}`, () => {
    const { snapshot, legacy } = fixture(role);
    for (const action of ['getKaryawan','getPengaturan','getJabatan','adminLogin','verifyPin','getAllEmployees','getAbsensiHariIni','getAbsensi','downloadAbsensi','getReport','cekStatusHariIni','getEmployeeDashboard','getShiftKhusus','getAdminNotes','getPengumumanAdmin','getReservasiAdmin','getTodosAdmin','getJabatanAdmin']) {
      const body = { action, password: role === 'admin' || role === 'manager' ? 'synthetic' : '', karyawan_id: 'K001', pin: '0012', dari: '2026-09-01', sampai: today };
      // The job-title catalog is owner-only now; covered by its own test below.
      if (role === 'manager' && action === 'getJabatanAdmin') continue;
      let expected;
      try { expected = legacy(body); } catch (error) { expected = { error: error.message }; }
      const actual = readResult(body, snapshot, today);
      delete actual.code; // Explicit HTTP auth failure is new; Indonesian message is preserved.
      delete actual.settings; // Bundled public settings eliminate the second request.
      assert.deepEqual(actual, expected, action);
    }
  });
}

test('bundled login, bootstrap and dashboard preserve individual read values', () => {
  const { snapshot } = fixture('employee');
  const result = body => readResult(body, snapshot, today);
  const bootstrap = result({ action: 'bootstrap' }).data;
  assert.deepEqual(bootstrap.employees, result({ action: 'getKaryawan' }).data);
  assert.deepEqual(bootstrap.settings, result({ action: 'getPengaturan' }).data);
  assert.deepEqual(bootstrap.jabatan, result({ action: 'getJabatan' }).data);
  const body = { action: 'verifyPin', karyawan_id: 'K001', pin: '0012', include_dashboard: true };
  assert.deepEqual(result(body).dashboard, result({ ...body, action: 'getEmployeeDashboard' }));
  assert.doesNotMatch(JSON.stringify(result(body)), /synthetic-secret/);
  snapshot.auth = { role: 'admin' };
  assert.deepEqual(result({ action: 'adminLogin', include_dashboard: true }).dashboard, result({ action: 'getAdminDashboard' }));
});

test('dates and recurring schedules use Jakarta calendar boundaries on any host', () => {
  assert.equal(todayWib(new Date('2026-10-02T17:00:00Z')), '2026-10-03');
  assert.equal(todayWib(new Date('2026-10-02T16:59:59Z')), '2026-10-02');
  for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Jakarta']) {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
      assert.ok(scheduleMatchesDate({ schedule_type: 'weekdays', schedule_value: '5' }, today));
      assert.ok(scheduleMatchesDate({ schedule_type: 'month_dates', schedule_value: '2,17' }, today));
      assert.ok(scheduleMatchesDate({ schedule_type: 'last_day_of_month' }, '2028-02-29'));
      assert.equal(scheduleMatchesDate({ schedule_type: 'last_day_of_month' }, '2026-02-27'), false);
      assert.ok(scheduleMatchesDate({ schedule_type: 'every_x_month', tanggal_mulai: '2026-08-02', schedule_interval_months: '2' }, today));
      assert.equal(scheduleMatchesDate({ schedule_type: 'once', tanggal_mulai: '2026-10-01' }, today), false);
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  }
});

test('only required datasets and filters are requested, and untrusted queries or writes are rejected', async () => {
  assert.deepEqual(requestSnapshot({ action: 'verifyPin' }, today).p_tables, []);
  assert.deepEqual(requestSnapshot({ action: 'getReport', dari: '2026-09-01', sampai: today }, today).p_tables, ['Absensi']);
  assert.equal(requestSnapshot({ action: 'getEmployeeDashboard' }, today).p_filter.from, today);
  for (const action of ['clockIn', 'syncSheets', 'select', 'constructor', '__proto__']) {
    const response = await handleRead({ action }, { fetcher: () => assert.fail('No network call allowed') });
    assert.equal(response.status, 400);
  }
});

test('read endpoint verifies credentials on every request and never exposes provider errors', async () => {
  const { snapshot } = fixture('anonymous');
  let calls = 0;
  const options = { url: 'https://synthetic.supabase.co', secret: 'synthetic-server-secret', fetcher: async (_, request) => {
    calls++;
    assert.equal(request.method, 'POST');
    assert.equal(JSON.parse(request.body).p_auth.password, 'test');
    return { ok: true, json: async () => snapshot };
  } };
  for (let i = 0; i < 2; i++) assert.equal((await handleRead({ action: 'getAdminNotes', password: 'test' }, options)).status, 401);
  assert.equal(calls, 2);
  assert.equal((await handleRead({ action: 'getAdminNotes' }, { ...options, fetcher: async () => ({ ok: false }) })).status, 503);
});

test('admin dashboard summary counts late arrivals and clock-outs in WIB today', () => {
  const dataset = (headers, rows) => ({ headers, revision: 1, rows: rows.map((data, index) => ({ id: String(index), ordinal: index + 1, data })) });
  const snapshot = { auth: { role: 'admin' }, datasets: {
    Karyawan: dataset(['id', 'nama', 'jabatan', 'aktif'], [{ id: 'K1', aktif: 'TRUE' }, { id: 'K2', aktif: 'TRUE' }, { id: 'K3', aktif: 'TRUE' }]),
    Pengaturan: dataset(['key', 'value'], [{ key: 'shift_mulai', value: '08:00' }, { key: 'toleransi_terlambat_menit', value: '15' }]),
    Absensi: dataset(['id', 'karyawan_id', 'tanggal', 'jam_masuk', 'jam_keluar'], [
      { id: 'A1', karyawan_id: 'K1', tanggal: today, jam_masuk: today + ' 08:10:00', jam_keluar: today + ' 17:00:00' },
      { id: 'A2', karyawan_id: 'K2', tanggal: today, jam_masuk: today + ' 08:16:00', jam_keluar: '' },
      { id: 'A3', karyawan_id: 'K3', tanggal: '2026-10-01', jam_masuk: '2026-10-01 09:00:00', jam_keluar: '' },
    ]),
  } };
  assert.deepEqual(readResult({ action: 'getAdminDashboard' }, snapshot, today).summary,
    { totalKaryawan: 3, hadir: 2, belumHadir: 1, terlambat: 1, sudahKeluar: 1 });
});

test('the job-title catalog is readable by the owner only', () => {
  const read = role => readResult({ action: 'getJabatanAdmin', password: 'synthetic', karyawan_id: 'K001' }, fixture(role).snapshot, today);
  assert.equal(read('admin').success, true);
  // Managers stay logged in; they are refused without an auth-expiry code.
  assert.deepEqual(read('manager'), { error: 'Akses ditolak. Hanya admin.' });
  for (const role of ['employee', 'anonymous']) assert.equal(read(role).code, 'AUTH_REQUIRED', role);
});
