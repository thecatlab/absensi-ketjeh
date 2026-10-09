import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'vite';
import { MOCK_ADMIN_PASSWORD, MOCK_MANAGER_PASSWORD, MOCK_EMPLOYEES } from '../src/api/mockData.js';

test('production bundles exclude demo credentials and fixtures even if the mock flag is set', async () => {
  const result = await build({
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_USE_MOCKS': '"true"' },
    build: { write: false },
  });
  const code = result.output.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
  for (const value of [MOCK_ADMIN_PASSWORD, MOCK_MANAGER_PASSWORD, MOCK_EMPLOYEES[0].nama]) {
    assert.equal(code.includes(value), false, 'Demo values must not be shipped to production');
  }
});
