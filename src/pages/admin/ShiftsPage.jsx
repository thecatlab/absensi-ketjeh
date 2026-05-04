import { useCallback, useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { getPengaturan, updateSettings, getShiftKhusus, addShiftKhusus, deleteShiftKhusus } from '../../api/client';

export default function ShiftsPage({ adminPassword }) {
  const [settings, setSettings] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [settingsRes, shiftsRes] = await Promise.all([
      getPengaturan(),
      getShiftKhusus(),
    ]);
    if (settingsRes.success) setSettings(settingsRes.data);
    if (shiftsRes.success) setShifts(shiftsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadAll, 0);
    return () => clearTimeout(timer);
  }, [loadAll]);

  function showMsg(text, isError = false) {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleDeleteShift(tanggal) {
    if (!confirm('Hapus shift khusus ini?')) return;
    const res = await deleteShiftKhusus(tanggal, adminPassword);
    if (res.error) showMsg(res.error, true);
    else { showMsg('Shift khusus dihapus'); loadAll(); }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
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

      {/* Default Settings */}
      <SettingsForm settings={settings} adminPassword={adminPassword} onSaved={(msg) => { showMsg(msg); loadAll(); }} />

      {/* Special Shifts */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Hari Khusus / Libur</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-navy text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-navy-dark"
          >
            + Tambah
          </button>
        </div>

        {shifts.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
            Belum ada hari khusus
          </div>
        ) : (
          <div className="space-y-2">
            {shifts.map(s => (
              <ShiftRow key={s.tanggal} shift={s} onDelete={() => handleDeleteShift(s.tanggal)} />
            ))}
          </div>
        )}
      </div>

      {/* Add Shift Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Hari Khusus">
        <AddShiftForm
          adminPassword={adminPassword}
          onSuccess={(msg) => { showMsg(msg); setShowAddModal(false); loadAll(); }}
          onError={(msg) => showMsg(msg, true)}
        />
      </Modal>
    </div>
  );
}

// ============================================================
// Default Settings Form
// ============================================================

function SettingsForm({ settings, adminPassword, onSaved }) {
  const [form, setForm] = useState({
    shift_mulai: settings?.shift_mulai || '08:00',
    shift_selesai: settings?.shift_selesai || '17:00',
    toleransi_terlambat_menit: settings?.toleransi_terlambat_menit || '15',
    geofence_lat: settings?.geofence_lat || '',
    geofence_lng: settings?.geofence_lng || '',
    geofence_radius_meter: settings?.geofence_radius_meter || '200',
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await updateSettings(form, adminPassword);
    setSaving(false);
    if (res.success) {
      setEditing(false);
      onSaved('Pengaturan berhasil disimpan');
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Pengaturan Default</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-navy font-medium">Edit</button>
        )}
      </div>

      {!editing ? (
        // Read-only view
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoItem label="Jam Masuk" value={form.shift_mulai} />
          <InfoItem label="Jam Keluar" value={form.shift_selesai} />
          <InfoItem label="Toleransi" value={`${form.toleransi_terlambat_menit} menit`} />
          <InfoItem label="Radius GPS" value={`${form.geofence_radius_meter} meter`} />
          <InfoItem label="Latitude" value={form.geofence_lat || '-'} />
          <InfoItem label="Longitude" value={form.geofence_lng || '-'} />
        </div>
      ) : (
        // Edit form
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="Jam Masuk" type="time" value={form.shift_mulai} onChange={v => update('shift_mulai', v)} />
            <FieldInput label="Jam Keluar" type="time" value={form.shift_selesai} onChange={v => update('shift_selesai', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="Toleransi (menit)" type="number" value={form.toleransi_terlambat_menit} onChange={v => update('toleransi_terlambat_menit', v)} />
            <FieldInput label="Radius GPS (m)" type="number" value={form.geofence_radius_meter} onChange={v => update('geofence_radius_meter', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="Latitude" type="text" value={form.geofence_lat} onChange={v => update('geofence_lat', v)} placeholder="-7.6xxx" />
            <FieldInput label="Longitude" type="text" value={form.geofence_lng} onChange={v => update('geofence_lng', v)} placeholder="110.6xxx" />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-600"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-navy text-white active:bg-navy-dark"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-700">{value}</p>
    </div>
  );
}

function FieldInput({ label, type, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy"
      />
    </div>
  );
}

// ============================================================
// Shift Row
// ============================================================

function ShiftRow({ shift, onDelete }) {
  const date = new Date(shift.tanggal + 'T00:00:00+07:00');
  const dateStr = date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
  const isLibur = shift.shift_mulai === 'LIBUR';

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-8 rounded-full ${isLibur ? 'bg-danger' : 'bg-accent'}`} />
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-800 text-sm">{shift.nama_hari}</p>
            {isLibur && (
              <span className="text-[10px] bg-danger/10 text-danger px-1.5 py-0.5 rounded font-medium">LIBUR</span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {dateStr}
            {!isLibur && ` • ${shift.shift_mulai} - ${shift.shift_selesai}`}
          </p>
          {shift.catatan && <p className="text-xs text-gray-400 mt-0.5">{shift.catatan}</p>}
        </div>
      </div>
      <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-danger rounded-lg hover:bg-red-50" title="Hapus">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

// ============================================================
// Add Shift Form
// ============================================================

function AddShiftForm({ adminPassword, onSuccess, onError }) {
  const [form, setForm] = useState({
    tanggal: '',
    nama_hari: '',
    isLibur: true,
    shift_mulai: '08:00',
    shift_selesai: '17:00',
    catatan: '',
  });
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.tanggal || !form.nama_hari) return;

    setSaving(true);
    const res = await addShiftKhusus({
      tanggal: form.tanggal,
      nama_hari: form.nama_hari,
      shift_mulai: form.isLibur ? 'LIBUR' : form.shift_mulai,
      shift_selesai: form.isLibur ? '' : form.shift_selesai,
      catatan: form.catatan,
    }, adminPassword);
    setSaving(false);

    if (res.error) onError(res.error);
    else onSuccess(res.message);
  }

  const canSubmit = form.tanggal && form.nama_hari && !saving;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Tanggal *</label>
        <input
          type="date"
          value={form.tanggal}
          onChange={e => update('tanggal', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Nama Hari *</label>
        <input
          type="text"
          value={form.nama_hari}
          onChange={e => update('nama_hari', e.target.value)}
          placeholder="Contoh: Hari Raya Idul Fitri"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Tipe</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update('isLibur', true)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              form.isLibur ? 'bg-danger text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Libur
          </button>
          <button
            type="button"
            onClick={() => update('isLibur', false)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              !form.isLibur ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Shift Khusus
          </button>
        </div>
      </div>

      {!form.isLibur && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Jam Masuk</label>
            <input
              type="time"
              value={form.shift_mulai}
              onChange={e => update('shift_mulai', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Jam Keluar</label>
            <input
              type="time"
              value={form.shift_selesai}
              onChange={e => update('shift_selesai', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Catatan (opsional)</label>
        <input
          type="text"
          value={form.catatan}
          onChange={e => update('catatan', e.target.value)}
          placeholder="Catatan tambahan"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
          canSubmit ? 'bg-navy text-white active:bg-navy-dark' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {saving ? 'Menyimpan...' : 'Tambah Hari Khusus'}
      </button>
    </form>
  );
}
