import { useCallback, useEffect, useMemo, useState } from 'react';
import { addPengumuman, deletePengumuman, getAllEmployees, getPengumumanAdmin, updatePengumuman, updatePengumumanStatus } from '../../api/client';

const COMMON_ROLES = ['Manager', 'Captain Floor', 'Kasir', 'Chef', 'Waitress', 'Purchasing', 'Security', 'Admin', 'Delivery', 'Maintenance'];

export default function PengumumanPage({ adminPassword, role }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    judul: '',
    isi: '',
    tanggal_mulai: today,
    tanggal_selesai: today,
    target_type: 'all',
    target_value: '',
  });

  const loadItems = useCallback(() => {
    setLoading(true);
    getPengumumanAdmin()
      .then(res => { if (res.success) setItems(res.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadItems, 0);
    getAllEmployees().then(res => { if (res.success) setEmployees(res.data); });
    return () => clearTimeout(timer);
  }, [loadItems]);

  const roleOptions = useMemo(() => {
    const roles = employees.map(emp => emp.jabatan).filter(Boolean);
    return [...new Set([...COMMON_ROLES, ...roles])];
  }, [employees]);

  function showMessage(text, isError = false) {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 3000);
  }

  function update(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'target_type') next.target_value = '';
      return next;
    });
  }

  function toggleTarget(value) {
    setForm(prev => {
      const targets = splitTargets(prev.target_value);
      const exists = targets.includes(value);
      const nextTargets = exists ? targets.filter(item => item !== value) : [...targets, value];
      return { ...prev, target_value: nextTargets.join(',') };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.judul.trim() || !form.isi.trim() || needsTargetValue(form)) return;
    setSaving(true);
    const payload = { ...form, dibuat_oleh: role };
    const res = editingId
      ? await updatePengumuman(editingId, payload, adminPassword)
      : await addPengumuman(payload, adminPassword);
    setSaving(false);
    if (res.error) {
      showMessage(res.error, true);
    } else {
      showMessage(editingId ? 'Pengumuman diperbarui' : 'Pengumuman ditambahkan');
      resetForm();
      setShowForm(false);
      loadItems();
    }
  }

  const canSubmit = form.judul.trim() && form.isi.trim() && !needsTargetValue(form);

  function resetForm() {
    setEditingId(null);
    setForm({ judul: '', isi: '', tanggal_mulai: today, tanggal_selesai: today, target_type: 'all', target_value: '' });
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      judul: item.judul || '',
      isi: item.isi || '',
      tanggal_mulai: item.tanggal_mulai || today,
      tanggal_selesai: item.tanggal_selesai || today,
      target_type: normalizeTargetType(item.target_type),
      target_value: item.target_value || '',
    });
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm('Hapus pengumuman ini?')) return;
    const res = await deletePengumuman(id, adminPassword);
    if (res.error) showMessage(res.error, true);
    else { showMessage('Pengumuman dihapus'); loadItems(); }
  }

  async function handleToggleActive(item) {
    const nextActive = !isActive(item.aktif);
    const res = await updatePengumumanStatus(item.id, nextActive, adminPassword);
    if (res.error) {
      showMessage(res.error, true);
    } else {
      showMessage(nextActive ? 'Pengumuman ditampilkan' : 'Pengumuman disembunyikan');
      setItems(prev => prev.map(row => row.id === item.id ? { ...row, aktif: nextActive } : row));
    }
  }

  return (
    <div>
      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
          message.isError ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
        }`}>
          {message.text}
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full mb-5 py-3 rounded-xl text-sm font-semibold bg-navy text-white"
        >
          + Tambahkan Pengumuman
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-5">
          <input
            type="text"
            value={form.judul}
            onChange={e => update('judul', e.target.value)}
            placeholder="Judul pengumuman"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
          />
          <textarea
            value={form.isi}
            onChange={e => update('isi', e.target.value)}
            placeholder="Isi pengumuman"
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={form.tanggal_mulai}
              onChange={e => update('tanggal_mulai', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
            />
            <input
              type="date"
              value={form.tanggal_selesai}
              onChange={e => update('tanggal_selesai', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
            />
          </div>
          <div className="space-y-2">
            <select
              value={form.target_type}
              onChange={e => update('target_type', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
            >
              <option value="all">Semua staff</option>
              <option value="roles">Pilih jabatan</option>
              <option value="employees">Pilih karyawan</option>
            </select>

            {form.target_type === 'roles' && (
              <CheckboxGrid
                items={roleOptions.map(roleName => ({ value: roleName, label: roleName }))}
                selected={splitTargets(form.target_value)}
                onToggle={toggleTarget}
              />
            )}

            {form.target_type === 'employees' && (
              <CheckboxGrid
                items={employees.map(emp => ({ value: emp.id, label: emp.nama, sublabel: emp.jabatan }))}
                selected={splitTargets(form.target_value)}
                onToggle={toggleTarget}
              />
            )}
          </div>
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className={`w-full py-3 rounded-xl text-sm font-semibold ${
              saving || !canSubmit
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-navy text-white'
            }`}
          >
            {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : '+ Tambah Pengumuman'}
          </button>
          <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-500">
            {editingId ? 'Batal Edit' : 'Tutup Form'}
          </button>
        </form>
      )}

      <div className="mb-3">
        <p className="mb-1.5 text-xs font-semibold text-gray-500">Filter by Position</p>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
        >
          <option value="all">Semua pengumuman</option>
          {roleOptions.map(roleName => <option key={roleName} value={roleName}>{roleName}</option>)}
        </select>
      </div>

      <DataList
        loading={loading}
        items={items}
        employees={employees}
        roleFilter={roleFilter}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />
    </div>
  );
}

function splitTargets(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function needsTargetValue(form) {
  return ['roles', 'employees'].includes(form.target_type) && splitTargets(form.target_value).length === 0;
}

function normalizeTargetType(value) {
  const type = String(value || 'all').toLowerCase();
  if (type === 'role' || type === 'roles') return 'roles';
  if (type === 'employee' || type === 'employees') return 'employees';
  return 'all';
}

function CheckboxGrid({ items, selected, onToggle }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(item => (
        <label key={item.value} className="flex items-start gap-2 border border-gray-100 rounded-xl px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(item.value)}
            onChange={() => onToggle(item.value)}
            className="mt-0.5 accent-navy shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-gray-700 leading-tight">{item.label}</span>
            {item.sublabel && <span className="block text-xs text-gray-400 leading-tight">{item.sublabel}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function DataList({ loading, items, employees, roleFilter, onEdit, onDelete, onToggleActive }) {
  if (loading) {
    return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;
  }
  const filtered = sortPengumuman(items.filter(item => roleFilter === 'all' || isViewableByRole(item, roleFilter, employees)));

  if (filtered.length === 0) {
    return <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">Belum ada pengumuman.</div>;
  }
  return (
    <div className="space-y-2">
      {filtered.map(item => (
        <div key={item.id} className="border border-gray-100 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800 text-sm">{item.judul}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isActive(item.aktif) ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-400'}`}>
                  {isActive(item.aktif) ? 'Tampil' : 'Sembunyi'}
                </span>
              </div>
              <p className="text-xs text-gray-400">{item.tanggal_mulai} - {item.tanggal_selesai}</p>
              <p className="text-xs text-gray-400">{formatTarget(item, employees)}</p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <button onClick={() => onEdit(item)} className="text-xs text-navy font-medium">Edit</button>
              <button onClick={() => onToggleActive(item)} className="text-xs text-navy font-medium">
                {isActive(item.aktif) ? 'Sembunyikan' : 'Tampilkan'}
              </button>
              <button onClick={() => onDelete(item.id)} className="text-xs text-danger font-medium">Hapus</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">{item.isi}</p>
        </div>
      ))}
    </div>
  );
}

function isActive(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

function sortPengumuman(items) {
  return [...items].sort((a, b) => {
    const activeDiff = Number(isActive(b.aktif)) - Number(isActive(a.aktif));
    if (activeDiff !== 0) return activeDiff;
    return String(b.tanggal_mulai || '').localeCompare(String(a.tanggal_mulai || ''));
  });
}

function isViewableByRole(item, role, employees) {
  const type = String(item.target_type || 'all').toLowerCase();
  if (type === 'all') return true;

  const values = splitTargets(item.target_value);
  if (type === 'role' || type === 'roles') {
    return values.some(value => String(value).toLowerCase() === String(role).toLowerCase());
  }

  if (type === 'employee' || type === 'employees') {
    return values.some(id => {
      const employee = employees.find(emp => String(emp.id) === String(id));
      return employee && String(employee.jabatan).toLowerCase() === String(role).toLowerCase();
    });
  }

  return false;
}

function formatTarget(item, employees) {
  const type = String(item.target_type || 'all').toLowerCase();
  const values = splitTargets(item.target_value);
  if (type === 'all') return 'Untuk: Semua staff';
  if (type === 'roles') return `Jabatan: ${values.join(', ') || '-'}`;
  if (type === 'role') return `Jabatan: ${item.target_value || '-'}`;
  if (type === 'employees' || type === 'employee') {
    const names = values.map(id => employees.find(emp => String(emp.id) === String(id))?.nama || id);
    return `Karyawan: ${names.join(', ') || '-'}`;
  }
  return 'Untuk: -';
}
