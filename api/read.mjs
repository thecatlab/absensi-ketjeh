import { READ_TABLES, requestSnapshot, readResult, todayWib } from '../server/read-model.mjs';

export async function handleRead(body, { url, secret, fetcher = fetch, now = new Date() }) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.action !== 'string' || !Object.hasOwn(READ_TABLES, body.action)) {
    return { status: 400, result: { error: 'Permintaan baca tidak valid.' } };
  }
  for (const key of ['password', 'pin', 'karyawan_id', 'dari', 'sampai']) {
    if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > 128)) {
      return { status: 400, result: { error: 'Parameter tidak valid.' } };
    }
  }
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || '') || !secret) {
    return { status: 503, result: { error: 'Konfigurasi server belum disetel. Hubungi admin.' } };
  }
  const today = todayWib(now);
  const started = performance.now();
  const response = await fetcher(url + '/rest/v1/rpc/ketjeh_snapshot', {
    method: 'POST', headers: { apikey: secret, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestSnapshot(body, today)), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return { status: 503, result: { error: 'Database belum dapat diakses. Silakan coba lagi.' } };
  const snapshot = await response.json();
  const databaseMs = performance.now() - started;
  const result = readResult(body, snapshot, today);
  return { status: result.code === 'AUTH_REQUIRED' ? 401 : 200, result, databaseMs };
}

export default async function handler(request, response) {
  const started = performance.now();
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Gunakan POST untuk membaca data.' });
  }
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const outcome = await handleRead(body, { url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SECRET_KEY });
    response.setHeader('Server-Timing', `database;dur=${(outcome.databaseMs || 0).toFixed(1)}, total;dur=${(performance.now() - started).toFixed(1)}`);
    return response.status(outcome.status).json(outcome.result);
  } catch {
    return response.status(503).json({ error: 'Server belum dapat diakses. Silakan coba lagi.' });
  }
}
