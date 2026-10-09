import { mutate } from 'swr';

export const MAX_AGE = 5 * 60 * 1000;
const referenceActions = new Set(['bootstrap', 'getKaryawan', 'getPengaturan', 'getJabatan']);
const dependencies = {
  bootstrap: ['Karyawan', 'Pengaturan', 'Jabatan'], getKaryawan: ['Karyawan'], getPengaturan: ['Pengaturan'], getJabatan: ['Jabatan'],
  getEmployeeDashboard: ['Absensi', 'Todo', 'TodoStatus', 'FotoBriefing', 'Reservasi', 'Pengumuman', 'Pengaturan', 'Karyawan'],
  getAdminDashboard: ['Absensi', 'Karyawan', 'Pengaturan'], getAbsensi: ['Absensi'], getReport: ['Absensi'],
  getReservasiAdmin: ['Reservasi'], getTodosAdmin: ['Todo'], getPengumumanAdmin: ['Pengumuman'],
  getAdminNotes: ['AdminNotes'], getShiftKhusus: ['ShiftKhusus'], getAllEmployees: ['Karyawan'], getJabatanAdmin: ['Jabatan'],
};
const changes = {
  clockIn: ['Absensi'], clockOut: ['Absensi'], setTodoStatus: ['TodoStatus'], uploadFotoBriefing: ['FotoBriefing'],
  tambahKaryawan: ['Karyawan'], editKaryawan: ['Karyawan'], simpanJabatan: ['Jabatan'], editPengaturan: ['Pengaturan'],
  tambahReservasi: ['Reservasi'], editReservasi: ['Reservasi'], hapusReservasi: ['Reservasi'],
  tambahTodo: ['Todo'], editTodo: ['Todo'], hapusTodo: ['Todo'],
  tambahPengumuman: ['Pengumuman'], editPengumuman: ['Pengumuman'], hapusPengumuman: ['Pengumuman'], updatePengumumanStatus: ['Pengumuman'],
  tambahAdminNote: ['AdminNotes'], hapusAdminNote: ['AdminNotes'], tambahShiftKhusus: ['ShiftKhusus'], hapusShiftKhusus: ['ShiftKhusus'],
};
const revisions = new Map();
const known = new Map();
const listeners = new Set();
let epoch = 0;
let version = 0;
let day = today();

function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); }
export const subscribeReads = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const readVersion = () => version;
export const readSession = () => epoch;
const notify = () => { version++; listeners.forEach(listener => listener()); };
export const isReference = action => referenceActions.has(action);

export function readKey(action, params = {}, scope = 'public') {
  const safe = Object.fromEntries(Object.entries(params).filter(([key]) => !/password|pin|secret|token/i.test(key)).sort(([a], [b]) => a.localeCompare(b)));
  const key = JSON.stringify(['ketjeh-read', referenceActions.has(action) ? 'public' : scope, referenceActions.has(action) ? 0 : epoch, day, action, safe, revisions.get(action) || 0]);
  known.set(key, { action, scope: referenceActions.has(action) ? 'public' : scope });
  return key;
}

export function keyIsCurrent(key) {
  const [, scope, savedEpoch, savedDay, action, , revision] = JSON.parse(key);
  return savedDay === day && (scope === 'public' || savedEpoch === epoch) && revision === (revisions.get(action) || 0);
}

function discard(predicate) {
  for (const [key, entry] of known) {
    if (predicate(entry)) {
      // SWR mutation also discards any response from a read already in flight.
      void mutate(key, undefined, { revalidate: false });
      known.delete(key);
    }
  }
}

export function resetReadSession() {
  epoch++;
  discard(entry => entry.scope !== 'public');
  notify();
}

export function invalidateReads(action) {
  const changed = changes[action] || [];
  const affected = new Set(Object.keys(dependencies).filter(name => dependencies[name].some(table => changed.includes(table))));
  for (const name of affected) revisions.set(name, (revisions.get(name) || 0) + 1);
  discard(entry => affected.has(entry.action));
  notify();
}

export function refreshReadDay() {
  const current = today();
  if (current === day) return;
  day = current;
  discard(() => true);
  notify();
}

export function seedRead(action, params, result, scope) {
  if (result?.success) void mutate(readKey(action, params, scope), { result, at: Date.now() }, { revalidate: false });
}
