export function extractTime(value) {
  return normalizeTime(value) || '-';
}

export function normalizeTime(value) {
  const match = String(value || '').match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return '';
  const hours = Math.min(parseInt(match[1], 10), 23);
  const minutes = Math.min(parseInt(match[2], 10), 59);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getArrivalStatus(record, settings) {
  const masukMinutes = timeToMinutes(record?.jam_masuk);
  if (masukMinutes === null) return 'none';

  const shiftMulaiMinutes = timeToMinutes(settings?.shift_mulai || '08:00');
  if (shiftMulaiMinutes === null) return 'none';

  const toleransi = parseInt(settings?.toleransi_terlambat_menit, 10) || 15;
  const batasToleransiMinutes = shiftMulaiMinutes + toleransi;

  if (masukMinutes <= shiftMulaiMinutes) return 'on_time';
  if (masukMinutes <= batasToleransiMinutes) return 'tolerance';
  return 'late';
}

export function compareRecordsByLatestInput(a, b, recordOrder) {
  const aMinutes = timeToMinutes(a.jam_masuk);
  const bMinutes = timeToMinutes(b.jam_masuk);
  if (aMinutes !== null && bMinutes !== null && aMinutes !== bMinutes) {
    return bMinutes - aMinutes;
  }
  if (aMinutes === null && bMinutes !== null) return 1;
  if (aMinutes !== null && bMinutes === null) return -1;
  return (recordOrder.get(b) ?? 0) - (recordOrder.get(a) ?? 0);
}

export function addMinutes(timeStr, minutes) {
  const start = timeToMinutes(timeStr);
  if (start === null) return '';
  const total = start + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function diffMinutes(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null) return 0;
  return end - start;
}

// Minutes past the tolerance limit (shift_mulai + toleransi); 0 when within it.
export function getLateMinutes(record, settings) {
  const masuk = timeToMinutes(record?.jam_masuk);
  const shiftMulai = timeToMinutes(settings?.shift_mulai || '08:00');
  if (masuk === null || shiftMulai === null) return 0;
  const toleransi = parseInt(settings?.toleransi_terlambat_menit, 10) || 15;
  return Math.max(masuk - (shiftMulai + toleransi), 0);
}

// Minutes clocked out before shift_selesai on the attendance date; 0 otherwise.
export function getEarlyLeaveMinutes(record, settings) {
  const keluar = timeToMinutes(record?.jam_keluar);
  const shiftSelesai = timeToMinutes(settings?.shift_selesai || '17:00');
  if (keluar === null || shiftSelesai === null) return 0;
  const keluarDate = String(record.jam_keluar).match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (keluarDate && record.tanggal && keluarDate > record.tanggal) return 0;
  return Math.max(shiftSelesai - keluar, 0);
}

// Settings for one attendance date: a special shift (Shift tab) replaces the
// general start/end times on its date. LIBUR days have no working hours to apply.
export function shiftSettingsForDate(settings, specialShifts, date) {
  const special = (specialShifts || []).find(shift => String(shift.tanggal || '').slice(0, 10) === date);
  if (!special || String(special.shift_mulai).toUpperCase() === 'LIBUR') return settings;
  return {
    ...settings,
    shift_mulai: normalizeTime(special.shift_mulai) || settings?.shift_mulai,
    shift_selesai: normalizeTime(special.shift_selesai) || settings?.shift_selesai,
  };
}

// One row per employee for the chosen period, most late minutes first.
// Days without attendance are not counted; absences are tracked separately.
export function summarizeLateness(records, settingsFor) {
  const byEmployee = new Map();
  for (const record of records) {
    const key = String(record.karyawan_id || record.nama);
    const row = byEmployee.get(key) || { karyawan_id: record.karyawan_id, nama: record.nama, jabatan: record.jabatan, days: new Set(), lateDays: new Set(), lateMinutes: 0 };
    const late = getLateMinutes(record, settingsFor(record));
    row.days.add(record.tanggal);
    if (late > 0) row.lateDays.add(record.tanggal);
    row.lateMinutes += late;
    byEmployee.set(key, row);
  }
  return [...byEmployee.values()]
    .map(({ days, lateDays, ...row }) => ({ ...row, hadir: days.size, hariTerlambat: lateDays.size }))
    .sort((a, b) => b.lateMinutes - a.lateMinutes || String(a.nama).localeCompare(String(b.nama)));
}
