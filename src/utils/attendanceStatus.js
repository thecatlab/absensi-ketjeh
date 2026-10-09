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
