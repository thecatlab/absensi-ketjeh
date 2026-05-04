import { useCallback, useEffect, useMemo, useState } from 'react';
import { addTodo, deleteTodo, getAllEmployees, getTodosAdmin, updateTodo } from '../../api/client';

const COMMON_ROLES = ['Manager', 'Captain Floor', 'Kasir', 'Chef', 'Waitress', 'Purchasing', 'Security', 'Admin', 'Delivery', 'Maintenance'];
const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Senin' },
  { value: '2', label: 'Selasa' },
  { value: '3', label: 'Rabu' },
  { value: '4', label: 'Kamis' },
  { value: '5', label: 'Jumat' },
  { value: '6', label: 'Sabtu' },
  { value: '0', label: 'Minggu' },
];

export default function TodosPage({ adminPassword }) {
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
    deskripsi: '',
    target_type: 'roles',
    target_value: '',
    schedule_type: 'daily',
    tanggal_mulai: '',
    tanggal_selesai: '',
    schedule_value: '',
    schedule_interval_months: '',
    aktif: true,
  });

  const loadItems = useCallback(() => {
    setLoading(true);
    getTodosAdmin()
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
  const filteredItems = useMemo(() => (
    roleFilter === 'all'
      ? items
      : items.filter(item => todoMatchesRole(item, roleFilter, employees))
  ), [items, roleFilter, employees]);

  function showMessage(text, isError = false) {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 3000);
  }

  function update(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'target_type') {
        next.target_value = '';
      }
      if (field === 'schedule_type') {
        next.tanggal_mulai = '';
        next.tanggal_selesai = '';
        next.schedule_value = '';
        next.schedule_interval_months = '';
      }
      return next;
    });
  }

  function toggleListValue(field, value) {
    setForm(prev => {
      const values = splitTargets(prev[field]);
      const exists = values.includes(value);
      const nextValues = exists ? values.filter(item => item !== value) : [...values, value];
      return { ...prev, [field]: nextValues.join(',') };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.judul.trim() || !form.target_value) return;
    setSaving(true);
    const res = editingId
      ? await updateTodo(editingId, form, adminPassword)
      : await addTodo(form, adminPassword);
    setSaving(false);
    if (res.error) {
      showMessage(res.error, true);
    } else {
      showMessage(editingId ? 'To-do diperbarui' : 'To-do ditambahkan');
      resetForm();
      setShowForm(false);
      loadItems();
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      judul: '',
      deskripsi: '',
      target_type: 'roles',
      target_value: '',
      schedule_type: 'daily',
      tanggal_mulai: '',
      tanggal_selesai: '',
      schedule_value: '',
      schedule_interval_months: '',
      aktif: true,
    });
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      judul: item.judul || '',
      deskripsi: item.deskripsi || '',
      target_type: normalizeTodoTargetType(item.target_type),
      target_value: item.target_value || '',
      schedule_type: item.schedule_type || 'daily',
      tanggal_mulai: item.tanggal_mulai || '',
      tanggal_selesai: item.tanggal_selesai || '',
      schedule_value: item.schedule_value || '',
      schedule_interval_months: item.schedule_interval_months || '',
      aktif: item.aktif !== false,
    });
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm('Hapus to-do ini?')) return;
    const res = await deleteTodo(id, adminPassword);
    if (res.error) showMessage(res.error, true);
    else { showMessage('To-do dihapus'); loadItems(); }
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
          + Tambahkan Pekerjaan
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-5">
          <input type="text" value={form.judul} onChange={e => update('judul', e.target.value)} placeholder="Judul to-do" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy" />
          <textarea value={form.deskripsi} onChange={e => update('deskripsi', e.target.value)} placeholder="Deskripsi singkat" rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy resize-none" />
          <div className="space-y-2">
            <select value={form.target_type} onChange={e => update('target_type', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy">
              <option value="roles">Pilih jabatan</option>
              <option value="employees">Pilih karyawan</option>
            </select>

            {form.target_type === 'roles' && (
              <CheckboxGrid
                items={roleOptions.map(roleName => ({ value: roleName, label: roleName }))}
                selected={splitTargets(form.target_value)}
                onToggle={value => toggleListValue('target_value', value)}
              />
            )}

            {form.target_type === 'employees' && (
              <CheckboxGrid
                items={employees.map(emp => ({ value: emp.id, label: emp.nama, sublabel: emp.jabatan }))}
                selected={splitTargets(form.target_value)}
                onToggle={value => toggleListValue('target_value', value)}
              />
            )}
          </div>
          <div className="space-y-2">
            <select value={form.schedule_type} onChange={e => update('schedule_type', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy">
              <option value="daily">Setiap hari</option>
              <option value="once">Tanggal tertentu</option>
              <option value="period">Periode tanggal</option>
              <option value="weekdays">Hari tertentu setiap minggu</option>
              <option value="month_dates">Tanggal tertentu setiap bulan</option>
              <option value="every_x_month">Berulang setiap beberapa bulan</option>
              <option value="last_day_of_month">Hari terakhir setiap bulan</option>
            </select>

            {['once', 'period', 'every_x_month'].includes(form.schedule_type) && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={form.tanggal_mulai}
                  onChange={e => update('tanggal_mulai', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
                />
                {form.schedule_type === 'period' ? (
                  <input
                    type="date"
                    value={form.tanggal_selesai}
                    onChange={e => update('tanggal_selesai', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
                  />
                ) : form.schedule_type === 'every_x_month' ? (
                  <div className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 flex items-center justify-center gap-2">
                    <span>Setiap</span>
                    <input
                      type="number"
                      min="1"
                      value={form.schedule_interval_months}
                      onChange={e => update('schedule_interval_months', e.target.value)}
                      aria-label="Jumlah bulan"
                      className="w-12 px-1 py-0.5 border-b border-gray-300 text-center text-gray-800 focus:outline-none focus:border-navy bg-transparent"
                    />
                    <span>bulan</span>
                  </div>
                ) : (
                  <div className="hidden" />
                )}
              </div>
            )}

            {form.schedule_type === 'weekdays' && (
              <CheckboxGrid
                items={WEEKDAY_OPTIONS}
                selected={splitTargets(form.schedule_value)}
                onToggle={value => toggleListValue('schedule_value', value)}
                columns={3}
              />
            )}

            {form.schedule_type === 'month_dates' && (
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 31 }, (_, index) => String(index + 1)).map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleListValue('schedule_value', day)}
                    className={`aspect-square rounded-lg text-xs font-medium ${
                      splitTargets(form.schedule_value).includes(day)
                        ? 'bg-navy text-white'
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" disabled={saving || !form.judul.trim() || !form.target_value} className={`w-full py-3 rounded-xl text-sm font-semibold ${
            saving || !form.judul.trim() || !form.target_value
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-navy text-white'
          }`}>
            {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : '+ Tambah To-do'}
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
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy bg-white"
        >
          <option value="all">Semua data</option>
          {roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
      ) : filteredItems.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">Belum ada to-do.</div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <div key={item.id} className="border border-gray-100 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{item.judul}</p>
                  <p className="text-xs text-gray-400">{formatTarget(item, employees)}</p>
                  <p className="text-xs text-gray-400">{formatSchedule(item)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button onClick={() => handleEdit(item)} className="text-xs text-navy font-medium">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="text-xs text-danger font-medium">Hapus</button>
                </div>
              </div>
              {item.deskripsi && <p className="text-sm text-gray-600 mt-2">{item.deskripsi}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function splitTargets(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeTodoTargetType(value) {
  const type = String(value || 'roles').toLowerCase();
  if (type === 'employee' || type === 'employees') return 'employees';
  return 'roles';
}

function CheckboxGrid({ items, selected, onToggle, columns = 2 }) {
  return (
    <div className={`grid ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
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

function formatTarget(item, employees) {
  if (item.target_type === 'role') return `Jabatan: ${item.target_value}`;
  if (item.target_type === 'roles') return `Jabatan: ${splitTargets(item.target_value).join(', ') || '-'}`;
  const names = splitTargets(item.target_value).map(id => employees.find(emp => String(emp.id) === String(id))?.nama || id);
  return `Karyawan: ${names.join(', ') || '-'}`;
}

function formatSchedule(item) {
  const type = String(item.schedule_type || 'daily');
  if (type === 'daily') return 'Jadwal: Setiap hari';
  if (type === 'once') return `Jadwal: ${item.tanggal_mulai || '-'}`;
  if (type === 'period') return `Jadwal: ${item.tanggal_mulai || '-'} - ${item.tanggal_selesai || '-'}`;
  if (type === 'weekdays') {
    const labels = splitTargets(item.schedule_value).map(value => WEEKDAY_OPTIONS.find(day => day.value === value)?.label || value);
    return `Jadwal: ${labels.join(', ') || '-'}`;
  }
  if (type === 'month_dates') return `Jadwal: Tanggal ${splitTargets(item.schedule_value).join(', ') || '-'}`;
  if (type === 'every_x_month') return `Jadwal: Setiap ${item.schedule_interval_months || 1} bulan dari ${item.tanggal_mulai || '-'}`;
  if (type === 'last_day_of_month') return 'Jadwal: Hari terakhir setiap bulan';
  return 'Jadwal: -';
}

function todoMatchesRole(item, role, employees) {
  const type = String(item.target_type || '').toLowerCase();
  const targets = splitTargets(item.target_value);
  if (type === 'role' || type === 'roles') {
    return targets.some(target => String(target).toLowerCase() === String(role).toLowerCase());
  }
  if (type === 'employee' || type === 'employees') {
    return targets.some(target => {
      const employee = employees.find(emp => String(emp.id) === String(target));
      return String(employee?.jabatan || '').toLowerCase() === String(role).toLowerCase();
    });
  }
  return false;
}
