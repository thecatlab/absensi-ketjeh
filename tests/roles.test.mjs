import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { MOCK_JABATAN, MOCK_EMPLOYEES, MOCK_SETTINGS, MOCK_TODOS, MOCK_PENGUMUMAN } from '../src/api/mockData.js';
import { DEFAULT_RESERVATION_ROLES, isRoleAllowed } from '../src/utils/permissions.js';

const canonical = [
  'Admin', 'Barista', 'Bartender', 'Captain Floor', 'Cashier', 'Cook',
  'Head Chef', 'Kitchen', 'Manager', 'Purchasing', 'Security', 'Waiter/Waitress',
];

test('development data uses the canonical catalog, including role-based task and announcement targets', () => {
  assert.deepEqual(MOCK_JABATAN.filter(row => row.aktif).map(row => row.jabatan), canonical);
  assert.ok(MOCK_EMPLOYEES.every(employee => canonical.includes(employee.jabatan)));
  for (const item of [...MOCK_TODOS, ...MOCK_PENGUMUMAN]) {
    if (item.target_type === 'roles') {
      assert.ok(item.target_value.split(',').every(role => canonical.includes(role)));
    }
  }
});

test('Cashier keeps reservation permission in configured and default frontend/backend rules', () => {
  const backend = vm.createContext({ getSettings: () => ({}) });
  vm.runInContext(readFileSync(new URL('../gas/Dashboard.gs', import.meta.url), 'utf8'), backend);
  for (const settings of [{}, { reservation_manage_roles: MOCK_SETTINGS.reservation_manage_roles }]) {
    backend.getSettings = () => settings;
    for (const role of ['Manager', 'Cashier', 'Bartender']) {
      const expected = role !== 'Bartender';
      assert.equal(isRoleAllowed(role, settings, 'reservation_manage_roles', DEFAULT_RESERVATION_ROLES), expected);
      assert.equal(backend.isReservationRoleAllowed(role), expected);
    }
  }
});

test('renamed roles match task and announcement targets without changing Head Chef or employee-ID targeting', () => {
  const backend = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../gas/Dashboard.gs', import.meta.url), 'utf8'), backend);
  const roles = { target_type: 'roles', target_value: 'Cook,Waiter/Waitress,Head Chef' };
  for (const role of ['Cook', 'Waiter/Waitress', 'Head Chef']) {
    assert.equal(backend.targetMatchesEmployee(roles, 'K041', role), true);
  }
  assert.equal(backend.targetMatchesEmployee(roles, 'K041', 'Bartender'), false);
  assert.equal(backend.targetMatchesEmployee({ target_type: 'employees', target_value: 'K041' }, 'K041', 'Bartender'), true);
});
