import assert from 'node:assert/strict';
import test from 'node:test';
import { getEarlyLeaveMinutes, getLateMinutes } from '../src/utils/attendanceStatus.js';

const settings = { shift_mulai: '08:30', shift_selesai: '17:30', toleransi_terlambat_menit: '15' };
const record = (jam_masuk, jam_keluar = '') => ({ tanggal: '2026-10-09', jam_masuk, jam_keluar });

test('late minutes count past the tolerance limit only', () => {
  assert.equal(getLateMinutes(record('2026-10-09 08:20:00'), settings), 0);
  assert.equal(getLateMinutes(record('2026-10-09 08:45:00'), settings), 0);
  assert.equal(getLateMinutes(record('2026-10-09 08:50:00'), settings), 5);
  assert.equal(getLateMinutes(record('2026-10-09 9:05'), settings), 20);
  assert.equal(getLateMinutes(record(''), settings), 0);
});

test('early leave counts minutes before the end of shift on the same day', () => {
  assert.equal(getEarlyLeaveMinutes(record('08:30', '2026-10-09 17:00:00'), settings), 30);
  assert.equal(getEarlyLeaveMinutes(record('08:30', '2026-10-09 17:30:00'), settings), 0);
  assert.equal(getEarlyLeaveMinutes(record('08:30', '2026-10-09 19:10:00'), settings), 0);
  assert.equal(getEarlyLeaveMinutes(record('08:30', '2026-10-10 01:00:00'), settings), 0);
  assert.equal(getEarlyLeaveMinutes(record('08:30', ''), settings), 0);
});
