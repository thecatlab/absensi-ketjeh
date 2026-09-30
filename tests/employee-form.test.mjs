import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let EmployeeForm;
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  ({ default: EmployeeForm } = await server.ssrLoadModule('/src/components/EmployeeForm.jsx'));
});
after(async () => { await server?.close(); });

const render = props => renderToStaticMarkup(createElement(EmployeeForm, { onSubmit() {}, loading: false, ...props }));

test('add form renders the supplied master titles including Bartender', () => {
  const html = render({ jabatanOptions: ['Bartender', 'Kasir'] });
  assert.match(html, /<option value="Bartender">Bartender<\/option>/);
  assert.doesNotMatch(html, /<option value="Chef">/);
});

test('edit form preserves an existing title absent from the active master', () => {
  const html = render({ employee: { nama: 'Existing', jabatan: 'Retired position', aktif: false }, jabatanOptions: ['Bartender'] });
  assert.match(html, /<option value="Retired position" selected="">Retired position<\/option>/);
  assert.match(html, /Simpan Perubahan/);
  assert.doesNotMatch(html, /type="submit" disabled/);
});

test('empty catalog prevents adding an employee instead of falling back to a hardcoded list', () => {
  const html = render({ jabatanOptions: [] });
  assert.match(html, /type="submit" disabled=""/);
  assert.doesNotMatch(html, /<option value="Bartender">/);
});
