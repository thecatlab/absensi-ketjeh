import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { setTimeout as settle } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

let server, dom, root, hooks, client, cache, current, calls;
let answer = async () => ({ success: true, data: [{ id: 'initial' }] });
before(async () => {
  dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test', pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async (_, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    const result = await answer(body);
    return { ok: true, json: async () => result };
  };
  server = await createServer({ define: { 'import.meta.env.VITE_USE_MOCKS': '"false"', 'import.meta.env.VITE_APPS_SCRIPT_URL': '"https://example.test/writes"' }, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  hooks = await server.ssrLoadModule('/src/api/useRead.js');
  client = await server.ssrLoadModule('/src/api/client.js');
  cache = await server.ssrLoadModule('/src/api/readCache.mjs');
  root = createRoot(document.getElementById('root'));
});
after(async () => { await act(() => root.unmount()); await server.close(); dom.window.close(); });
function View({ action = 'getAbsensi', id = 'K1', duplicate = false }) {
  const query = hooks.useRead(action, { karyawan_id: id, dari: '2026-10-01', sampai: '2026-10-02' });
  current = query;
  return createElement('div', {}, query.data?.data?.[0]?.id || (query.loading ? 'loading' : 'error'), duplicate && createElement(View, { action, id }));
}
const render = props => act(async () => { root.render(createElement(View, props)); });
const clear = () => act(async () => { root.render(null); });

test('shared reads deduplicate, cached returns render immediately, failures retain young data', async () => {
  calls = [];
  client.setEmployeeCredential('K1', 'synthetic');
  await render({ duplicate: true });
  assert.equal(calls.length, 1);
  assert.equal(document.getElementById('root').textContent, 'initialinitial');
  await clear();
  await render({});
  assert.ok(current.data);
  assert.equal(current.loading, false);
  answer = async () => { throw new Error('Offline'); };
  await act(async () => { await current.refresh().catch(() => {}); });
  assert.equal(current.data.data[0].id, 'initial');
  assert.ok(current.stale);
  assert.ok(current.error);
});

test('a response from the previous employee cannot refill the current cache', async () => {
  await clear();
  let resolveOld;
  answer = body => body.karyawan_id === 'K1'
    ? new Promise(resolve => { resolveOld = resolve; })
    : Promise.resolve({ success: true, data: [{ id: 'employee-two' }] });
  await act(async () => client.setEmployeeCredential('K1', 'synthetic'));
  await render({ id: 'K1' });
  await act(async () => client.setEmployeeCredential('K2', 'different'));
  await render({ id: 'K2' });
  await act(async () => resolveOld({ success: true, data: [{ id: 'employee-one-private' }] }));
  assert.equal(current.data.data[0].id, 'employee-two');
  assert.doesNotMatch(document.getElementById('root').textContent, /employee-one/);
});

test('reads started before a successful save cannot restore old data', async () => {
  await clear();
  let resolveOld;
  answer = () => new Promise(resolve => { resolveOld = resolve; });
  await act(async () => client.setEmployeeCredential('K3', 'synthetic'));
  await render({ id: 'K3' });
  answer = async () => ({ success: true, data: [{ id: 'after-save' }] });
  await act(async () => cache.invalidateReads('clockIn'));
  await act(async () => resolveOld({ success: true, data: [{ id: 'before-save' }] }));
  assert.equal(current.data.data[0].id, 'after-save');
});

test('polling refreshes visible views, stops hidden views, and expired data is hidden', async t => {
  await clear();
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.now() });
  let hidden = false;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
  calls = [];
  answer = async () => ({ success: true, data: [{ id: 'fresh' }] });
  await act(async () => client.setEmployeeCredential('K4', 'synthetic'));
  await render({ id: 'K4' });
  assert.equal(calls.length, 1);
  await act(async () => t.mock.timers.tick(30001));
  assert.equal(calls.length, 2);
  hidden = true;
  await act(async () => t.mock.timers.tick(30001));
  assert.equal(calls.length, 2);
  answer = async () => { throw new Error('Offline'); };
  await act(async () => { await current.refresh().catch(() => {}); });
  assert.ok(current.stale);
  await act(async () => t.mock.timers.tick(300001));
  assert.equal(current.data, undefined);
  assert.ok(current.error);
  hidden = false;
  answer = async () => ({ success: true, data: [{ id: 'updated-on-another-device' }] });
  await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); await settle(20); });
  assert.equal(current.data.data[0].id, 'updated-on-another-device');
  answer = async () => ({ success: true, data: [{ id: 'after-reconnect' }] });
  await act(async () => { t.mock.timers.tick(2001); window.dispatchEvent(new dom.window.Event('offline')); window.dispatchEvent(new dom.window.Event('online')); await settle(20); });
  assert.equal(current.data.data[0].id, 'after-reconnect');
  await clear();
});

test('changing the selected employee clears the PIN gate and private session safely', async () => {
  await clear();
  const { default: App } = await server.ssrLoadModule('/src/App.jsx');
  const { BrowserRouter } = await import('react-router-dom');
  const employee = { id: 'K6', nama: 'Synthetic employee', jabatan: 'Bartender', kategori: 'on-site' };
  localStorage.setItem('employee_dashboard_session', JSON.stringify({ employeeId: employee.id, date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) }));
  answer = async () => ({ success: true, data: { employees: [employee], settings: {}, jabatan: ['Bartender'] } });
  await act(async () => { root.render(createElement(BrowserRouter, {}, createElement(App))); });
  assert.ok(document.querySelector('[aria-label="Ganti karyawan"]'));
  await act(async () => document.querySelector('[aria-label="Ganti karyawan"]').click());
  assert.ok(document.querySelector('[placeholder="Cari nama karyawan..."]'));
  assert.equal(document.querySelector('[placeholder="PIN 4-6 digit"]'), null);
  assert.equal(localStorage.getItem('employee_dashboard_session'), null);
  await clear();
});
