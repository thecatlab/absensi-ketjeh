import assert from 'node:assert/strict';
import test from 'node:test';
import { cache } from 'swr/_internal';
import { readKey, keyIsCurrent, invalidateReads, resetReadSession, seedRead, refreshReadDay } from '../src/api/readCache.mjs';

test('private cache keys separate sessions and query filters without retaining credentials', () => {
  const first = readKey('getAbsensi', { karyawan_id: 'K1', dari: '2026-10-01', pin: 'secret' }, 'employee:K1');
  const second = readKey('getAbsensi', { karyawan_id: 'K2', dari: '2026-10-01' }, 'employee:K2');
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /secret|pin/);
  assert.notEqual(first, readKey('getAbsensi', { karyawan_id: 'K1', dari: '2026-10-02' }, 'employee:K1'));
  resetReadSession();
  assert.equal(keyIsCurrent(first), false);
});

test('confirmed saves obsolete earlier reads and remove their cached responses', async () => {
  const result = { success: true, records: [{ id: 'synthetic' }] };
  seedRead('getAdminDashboard', {}, result, 'admin');
  const before = readKey('getAdminDashboard', {}, 'admin');
  const unrelated = readKey('getAdminNotes', {}, 'admin');
  assert.deepEqual(cache.get(before).data.result, result);
  invalidateReads('clockIn');
  assert.equal(keyIsCurrent(before), false);
  assert.equal(cache.get(before).data, undefined);
  assert.ok(keyIsCurrent(unrelated));
  assert.notEqual(readKey('getAdminDashboard', {}, 'admin'), before);
});

test('reference edits invalidate bootstrap and dependent private views', () => {
  const bootstrap = readKey('bootstrap');
  const dashboard = readKey('getEmployeeDashboard', { karyawan_id: 'K1' }, 'employee:K1');
  invalidateReads('editKaryawan');
  assert.equal(keyIsCurrent(bootstrap), false);
  assert.equal(keyIsCurrent(dashboard), false);
});

test('logout clears private content and rejects old responses while retaining public references', () => {
  seedRead('getAdminNotes', {}, { success: true, data: ['private'] }, 'admin');
  seedRead('bootstrap', {}, { success: true, data: ['reference'] }, 'public');
  const privateKey = readKey('getAdminNotes', {}, 'admin');
  const publicKey = readKey('bootstrap');
  resetReadSession();
  assert.equal(cache.get(privateKey).data, undefined);
  assert.equal(keyIsCurrent(privateKey), false);
  assert.ok(cache.get(publicKey).data);
  assert.ok(keyIsCurrent(publicKey));
});

test('midnight in Jakarta invalidates the previous daily data', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-02T16:59:59Z') });
  refreshReadDay();
  const key = readKey('getEmployeeDashboard', { karyawan_id: 'K1' }, 'employee:K1');
  t.mock.timers.tick(1001);
  refreshReadDay();
  assert.equal(keyIsCurrent(key), false);
  assert.equal(JSON.parse(readKey('bootstrap'))[3], '2026-10-03');
});
