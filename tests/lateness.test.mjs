import assert from 'node:assert/strict';
import test from 'node:test';
import { getEarlyLeaveMinutes, getLateMinutes, shiftSettingsForDate, summarizeLateness } from '../src/utils/attendanceStatus.js';

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

const specialShifts = [
  { tanggal: '2026-10-10', nama_hari: 'Event', shift_mulai: '06:00', shift_selesai: '15:00' },
  { tanggal: '2026-10-11', nama_hari: 'Libur', shift_mulai: 'LIBUR', shift_selesai: '' },
];

test('special shifts replace start and end times on their date only', () => {
  const event = shiftSettingsForDate(settings, specialShifts, '2026-10-10');
  assert.equal(event.shift_mulai, '06:00');
  assert.equal(event.shift_selesai, '15:00');
  assert.equal(event.toleransi_terlambat_menit, '15');
  assert.equal(getLateMinutes({ tanggal: '2026-10-10', jam_masuk: '2026-10-10 06:30:00' }, event), 15);
  assert.equal(shiftSettingsForDate(settings, specialShifts, '2026-10-11'), settings);
  assert.equal(shiftSettingsForDate(settings, specialShifts, '2026-10-12'), settings);
});

test('lateness summary totals each employee over the period, worst first', () => {
  const rows = [
    { karyawan_id: 'K1', nama: 'Ani', tanggal: '2026-10-08', jam_masuk: '08:50' },
    { karyawan_id: 'K1', nama: 'Ani', tanggal: '2026-10-09', jam_masuk: '09:45' },
    { karyawan_id: 'K2', nama: 'Budi', tanggal: '2026-10-09', jam_masuk: '08:30' },
    { karyawan_id: 'K3', nama: 'Cici', tanggal: '2026-10-10', jam_masuk: '06:30' },
  ];
  const summary = summarizeLateness(rows, record => shiftSettingsForDate(settings, specialShifts, record.tanggal));
  assert.deepEqual(summary.map(row => [row.nama, row.hadir, row.hariTerlambat, row.lateMinutes]),
    [['Ani', 2, 2, 65], ['Cici', 1, 1, 15], ['Budi', 1, 0, 0]]);
});
