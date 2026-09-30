import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function createBackend() {
  const tables = {
    Karyawan: [
      ['id', 'nama', 'jabatan', 'kategori', 'aktif', 'tanggal_masuk', 'pin'],
      ['K012', 'Existing bartender', 'Bartender', 'on-site', true, '2026-04-06', '2468'],
      ['K013', 'Inactive employee', 'Retired position', 'on-site', false, '2026-04-06', '1357'],
    ],
    Jabatan: [['jabatan', 'aktif'], ['Bartender', true], ['Kasir', true], ['Retired position', false]],
    Pengaturan: [['key', 'value'], ['admin_password', 'test-admin'], ['manager_password', 'test-manager']],
    Absensi: [['id', 'karyawan_id', 'tanggal', 'durasi_jam'], ['A001', 'K012', '2026-09-29', '8']],
    AdminNotes: [['id', 'tanggal', 'jam', 'pesan'], ['N001', '2026-09-29', '09:00', 'Keep this note']],
    Todo: [['id', 'judul'], ['T001', 'Keep this task']],
    Reservasi: [['id', 'nama_pelanggan'], ['R001', 'Keep this reservation']],
  };
  const writes = [];
  const spreadsheet = {
    getSheetByName(name) {
      if (!tables[name]) return null;
      return {
        getDataRange: () => ({
          getValues: () => structuredClone(tables[name]),
          getDisplayValues: () => tables[name].map(row => row.map(value => (
            typeof value === 'boolean' ? String(value).toUpperCase() : String(value)
          ))),
        }),
        appendRow(row) { tables[name].push([...row]); writes.push({ name, row }); },
        getRange(row, col) {
          return { setValue(value) { tables[name][row - 1][col - 1] = value; writes.push({ name, row, col, value }); } };
        },
      };
    },
  };
  const context = vm.createContext({
    SpreadsheetApp: { openById: () => spreadsheet },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: text => ({ text, setMimeType() { return this; } }),
    },
  });
  for (const name of ['Code.gs', 'Helpers.gs', 'Admin.gs']) {
    vm.runInContext(readFileSync(new URL('../gas/' + name, import.meta.url), 'utf8'), context, { filename: name });
  }
  context.getTodayString = () => '2026-09-30';
  return { context, tables, writes };
}

const asPlain = value => JSON.parse(JSON.stringify(value));
const unrelated = tables => structuredClone(Object.fromEntries(
  Object.entries(tables).filter(([name]) => name !== 'Karyawan' && name !== 'Jabatan'),
));

test('catalog includes Bartender, excludes retired titles, and is independent of employee status', () => {
  const { context, tables, writes } = createBackend();
  tables.Karyawan[1][4] = false;
  tables.Jabatan.push([' Barista ', true], ['Bartender', true], ['', true]);
  assert.deepEqual(asPlain(context.handleGetJabatan().data), ['Barista', 'Bartender', 'Kasir']);
  tables.Jabatan.push(['New position', true]);
  assert.ok(context.handleGetJabatan().data.includes('New position'));
  assert.equal(writes.length, 0);
});

test('admin list includes inactive employees without exposing PINs and requires authentication', () => {
  const { context, writes } = createBackend();
  assert.ok(context.handleGetAllEmployees({ password: 'wrong' }).error);
  const result = context.handleGetAllEmployees({ password: 'test-admin' });
  assert.equal(result.data.length, 2);
  assert.equal(result.data[1].aktif, 'FALSE');
  assert.ok(result.data.every(employee => !('pin' in employee)));
  assert.equal(writes.length, 0);
});

test('adding a Bartender preserves every existing row and all unrelated tabs', () => {
  const { context, tables, writes } = createBackend();
  const employeesBefore = structuredClone(tables.Karyawan);
  const otherBefore = unrelated(tables);
  const result = context.handleTambahKaryawan({ password: 'test-admin', nama: 'New employee', jabatan: 'Bartender', pin: '6789' });
  assert.equal(result.id, 'K014');
  assert.deepEqual(tables.Karyawan.slice(0, -1), employeesBefore);
  assert.equal(tables.Karyawan.at(-1)[2], 'Bartender');
  assert.deepEqual(unrelated(tables), otherBefore);
  assert.ok(writes.every(write => write.name === 'Karyawan'));
});

for (const jabatan of ['Unknown position', 'Retired position']) {
  test(`rejects ${jabatan} on add and edit before writing any data`, () => {
    const { context, tables, writes } = createBackend();
    const before = structuredClone(tables);
    assert.ok(context.handleTambahKaryawan({ password: 'test-admin', nama: 'New', jabatan }).error);
    assert.ok(context.handleEditKaryawan({ password: 'test-admin', id: 'K012', nama: 'Changed', jabatan }).error);
    assert.deepEqual(tables, before);
    assert.equal(writes.length, 0);
  });
}

test('editing an inactive employee preserves their retired title and blank PIN', () => {
  const { context, tables, writes } = createBackend();
  const before = structuredClone(tables);
  assert.ok(context.handleEditKaryawan({ password: 'test-admin', id: 'K013', jabatan: 'Retired position', pin: '', nama: 'Renamed' }).success);
  before.Karyawan[2][1] = 'Renamed';
  assert.deepEqual(tables, before);
  assert.ok(writes.every(write => write.col !== 7));
});

test('changing a title validates against the current master list', () => {
  const { context, tables } = createBackend();
  tables.Jabatan[1][1] = false;
  assert.ok(context.handleTambahKaryawan({ password: 'test-admin', nama: 'New', jabatan: 'Bartender' }).error);
  assert.ok(context.handleEditKaryawan({ password: 'test-admin', id: 'K012', jabatan: 'Bartender', nama: 'Renamed' }).success);
  assert.ok(context.handleEditKaryawan({ password: 'test-admin', id: 'K013', jabatan: 'Kasir' }).success);
  assert.equal(tables.Karyawan[2][2], 'Kasir');
});

test('missing catalog fails safely for additions but permits unrelated edits', () => {
  const { context, tables, writes } = createBackend();
  delete tables.Jabatan;
  const response = JSON.parse(context.doGet({ parameter: { action: 'getJabatan' } }).text);
  assert.match(response.error, /belum disetel/);
  assert.throws(() => context.handleTambahKaryawan({ password: 'test-admin', nama: 'New', jabatan: 'Bartender' }));
  assert.equal(writes.length, 0);
  assert.ok(context.handleEditKaryawan({ password: 'test-admin', id: 'K012', nama: 'Renamed' }).success);
});

test('new routes and existing report/notes reads leave all tables unchanged', () => {
  const { context, tables, writes } = createBackend();
  const before = structuredClone(tables);
  assert.ok(JSON.parse(context.doGet({ parameter: { action: 'getJabatan' } }).text).data.includes('Bartender'));
  const employees = JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ action: 'getAllEmployees', password: 'test-admin' }) } }).text);
  assert.equal(employees.data.length, 2);
  assert.equal(context.handleGetReport({ password: 'test-admin', dari: '2026-09-01', sampai: '2026-09-30' }).summary.total_hadir, 1);
  assert.equal(context.handleGetAdminNotes().data[0].pesan, 'Keep this note');
  assert.deepEqual(tables, before);
  assert.equal(writes.length, 0);
});
