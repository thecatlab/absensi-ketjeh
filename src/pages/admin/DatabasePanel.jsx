import { useCallback, useEffect, useState } from 'react';
import { getJabatanAdmin, saveJabatan, getSyncStatus, syncSheets, updateSettings } from '../../api/client';

export default function DatabasePanel({ password, onLogout, onCatalogChanged }) {
  const [roles, setRoles] = useState([]);
  const [newRole, setNewRole] = useState('');
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState({ admin_password: '', manager_password: '' });
  const load = useCallback(async () => {
    const [catalog, sync] = await Promise.all([getJabatanAdmin(), getSyncStatus()]);
    if (catalog.success) setRoles(catalog.data);
    if (sync.success) setStatus(sync.data);
    if (catalog.error || sync.error) setMessage(catalog.error || sync.error);
  }, []);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);

  async function changeRole(jabatan, aktif) {
    setBusy(true);
    const result = await saveJabatan(jabatan, aktif, password);
    setBusy(false);
    setMessage(result.error || result.message);
    if (result.success) { setNewRole(''); load(); onCatalogChanged(); }
  }

  async function saveCredentials(event) {
    event.preventDefault();
    const changes = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value));
    if (!Object.keys(changes).length) return;
    setBusy(true);
    const result = await updateSettings(changes, password);
    setBusy(false);
    setMessage(result.error || 'Password berhasil diperbarui.');
    if (result.success) {
      setCredentials({ admin_password: '', manager_password: '' });
      if (changes.admin_password) onLogout();
    }
  }

  async function syncNow() {
    setBusy(true);
    const result = await syncSheets(password);
    setBusy(false);
    setMessage(result.error || 'Google Sheets berhasil disinkronkan dan diverifikasi.');
    if (result.success) load();
  }

  return (
    <div className="space-y-4 mt-6">
      {message && <p role="status" className="text-sm bg-gray-50 rounded-xl p-3">{message}</p>}
      <section className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold">Jabatan</h3>
        <p className="text-xs text-gray-500">Perubahan di sini berlaku di semua halaman. Jabatan yang masih dipakai karyawan aktif tidak dapat dinonaktifkan.</p>
        {roles.map(role => {
          const active = String(role.aktif).toUpperCase() === 'TRUE';
          return <div key={role.jabatan} className="flex justify-between gap-3 text-sm">
            <span>{role.jabatan}{!active && ' (nonaktif)'}</span>
            <button disabled={busy} onClick={() => changeRole(role.jabatan, !active)} className="text-navy font-medium">{active ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </div>;
        })}
        <form onSubmit={event => { event.preventDefault(); if (newRole.trim()) changeRole(newRole.trim(), true); }} className="flex gap-2">
          <input aria-label="Jabatan baru" value={newRole} onChange={event => setNewRole(event.target.value)} className="min-w-0 flex-1 border rounded-lg p-2 text-sm" placeholder="Jabatan baru" />
          <button disabled={busy || !newRole.trim()} className="bg-navy text-white rounded-lg px-3 text-sm disabled:opacity-40">Tambah</button>
        </form>
      </section>
      <section className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold">Password admin dan manager</h3>
        <p className="text-xs text-gray-500">Kosongkan jika tidak diubah. Mengubah password admin akan meminta Anda masuk kembali.</p>
        <form onSubmit={saveCredentials} className="space-y-3">
          {['admin', 'manager'].map(role => <label key={role} className="block text-xs text-gray-600">
            Password {role} baru
            <input type="password" autoComplete="new-password" value={credentials[role + '_password']} onChange={event => setCredentials(previous => ({ ...previous, [role + '_password']: event.target.value }))} className="block w-full border rounded-lg p-2 mt-1" />
          </label>)}
          <button disabled={busy} className="bg-navy text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40">Simpan password</button>
        </form>
      </section>
      <section className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold">Google Sheets</h3>
        <p className="text-xs text-gray-500">Data aplikasi disimpan di Supabase. Sheets diperbarui sekitar setiap 5 menit. Gunakan tab Aktif_ untuk perhitungan; buat rumus manual di tab terpisah.</p>
        <p className="text-sm">Terakhir berhasil: {status?.last_success ? new Date(status.last_success).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'Belum tersinkron'}</p>
        {status?.stale && <p className="text-sm text-danger">Salinan Sheets tertinggal lebih dari 15 menit.</p>}
        {status?.error && <p className="text-sm text-danger">{status.error}</p>}
        {status?.datasets && <p className="text-xs text-gray-500">{Object.keys(status.datasets).length} tab diverifikasi · {Object.values(status.datasets).reduce((sum, item) => sum + item.count, 0)} baris</p>}
        <p className="text-xs text-gray-500">Backup terakhir: {status?.backup?.last_success ? new Date(status.backup.last_success).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'Belum tersedia'}</p>
        {status?.backup?.error && <p className="text-sm text-danger">Backup: {status.backup.error}</p>}
        <button disabled={busy} onClick={syncNow} className="bg-navy text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40">{busy ? 'Memproses...' : 'Sinkronkan sekarang'}</button>
      </section>
    </div>
  );
}
