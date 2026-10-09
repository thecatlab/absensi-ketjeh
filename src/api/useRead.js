import { useEffect, useReducer, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { readQuery, readScope } from './client';
import { readKey, keyIsCurrent, isReference, MAX_AGE, subscribeReads, readVersion, refreshReadDay } from './readCache.mjs';

async function fetchRead(key) {
  const [, , , , action, params] = JSON.parse(key);
  const result = await readQuery(action, params);
  if (!keyIsCurrent(key)) throw Object.assign(new Error('Permintaan digantikan.'), { obsolete: true });
  if (!result.success) throw Object.assign(new Error(result.error || 'Data belum dapat dimuat.'), { code: result.code });
  return { result, at: Date.now() };
}

export function useRead(action, params = {}, enabled = true) {
  useSyncExternalStore(subscribeReads, readVersion, readVersion);
  const key = enabled ? readKey(action, params, readScope(action)) : null;
  const query = useSWR(key, fetchRead, {
    dedupingInterval: 2000,
    refreshInterval: isReference(action) ? MAX_AGE : 30000,
    refreshWhenHidden: false, refreshWhenOffline: false,
    revalidateOnFocus: true, revalidateOnReconnect: true,
    shouldRetryOnError: false,
  });
  // Re-render exactly when this cached response expires, even after a failed refresh.
  const [checkedAt, expire] = useReducer(() => Date.now(), null, Date.now);
  useEffect(() => {
    if (!query.data?.at) return;
    const timer = setTimeout(expire, Math.max(0, query.data.at + MAX_AGE - Date.now()) + 1);
    return () => clearTimeout(timer);
  }, [query.data?.at]);
  const usable = query.data && checkedAt - query.data.at < MAX_AGE;
  const data = usable ? query.data.result : undefined;
  const error = query.error?.obsolete ? null : query.error;
  return {
    data,
    loading: enabled && !data && !error,
    error,
    stale: Boolean(error && data),
    refresh: () => query.mutate(),
    update: updater => query.mutate(previous => previous ? { result: updater(previous.result), at: previous.at } : previous, { revalidate: false }),
  };
}

export function useReadClock() {
  useEffect(() => {
    const timer = setInterval(refreshReadDay, 1000);
    window.addEventListener('focus', refreshReadDay);
    document.addEventListener('visibilitychange', refreshReadDay);
    return () => { clearInterval(timer); window.removeEventListener('focus', refreshReadDay); document.removeEventListener('visibilitychange', refreshReadDay); };
  }, []);
}

export const useBootstrap = () => useRead('bootstrap');
