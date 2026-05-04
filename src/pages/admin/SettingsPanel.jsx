import { useMemo, useState } from 'react';
import { updateSettings } from '../../api/client';
import {
  DEFAULT_BRIEFING_ROLES,
  DEFAULT_RESERVATION_ROLES,
  joinRoleList,
  splitRoleList,
} from '../../utils/permissions';

export default function SettingsPanel({ settings, employees, adminPassword, onSaved, onError }) {
  const roleOptions = useMemo(() => {
    const employeeRoles = employees.map(emp => emp.jabatan).filter(Boolean);
    return [...new Set([...DEFAULT_BRIEFING_ROLES, ...DEFAULT_RESERVATION_ROLES, ...employeeRoles])];
  }, [employees]);

  const [form, setForm] = useState(() => buildForm(settings));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleRole(field, role) {
    const roles = splitRoleList(form[field]);
    const exists = roles.some(item => item.toLowerCase() === role.toLowerCase());
    update(field, joinRoleList(exists
      ? roles.filter(item => item.toLowerCase() !== role.toLowerCase())
      : [...roles, role]));
  }

  async function handleSave() {
    setSaving(true);
    const res = await updateSettings(form, adminPassword);
    setSaving(false);
    if (res.error) {
      onError?.(res.error);
      return;
    }
    setEditing(false);
    onSaved?.('Pengaturan berhasil disimpan');
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Pengaturan</h3>
            <p className="text-xs text-gray-400 mt-0.5">Jam kerja, GPS, dan akses staff</p>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-navy font-medium shrink-0">Edit</button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoItem label="Jam Masuk" value={form.shift_mulai} />
              <InfoItem label="Jam Keluar" value={form.shift_selesai} />
              <InfoItem label="Toleransi" value={`${form.toleransi_terlambat_menit} menit`} />
              <InfoItem label="Radius GPS" value={`${form.geofence_radius_meter} meter`} />
              <InfoItem label="Latitude" value={form.geofence_lat || '-'} />
              <InfoItem label="Longitude" value={form.geofence_lng || '-'} />
            </div>
            <PermissionSummary label="Foto Briefing" value={form.briefing_photo_roles} />
            <PermissionSummary label="Tambah Reservasi" value={form.reservation_manage_roles} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
              <FieldInput label="Jam Masuk" type="time" value={form.shift_mulai} onChange={v => update('shift_mulai', v)} />
              <FieldInput label="Jam Keluar" type="time" value={form.shift_selesai} onChange={v => update('shift_selesai', v)} />
              <FieldInput label="Toleransi (menit)" type="number" value={form.toleransi_terlambat_menit} onChange={v => update('toleransi_terlambat_menit', v)} />
              <FieldInput label="Radius GPS (m)" type="number" value={form.geofence_radius_meter} onChange={v => update('geofence_radius_meter', v)} />
              <FieldInput label="Latitude" type="text" value={form.geofence_lat} onChange={v => update('geofence_lat', v)} placeholder="-7.6xxx" />
              <FieldInput label="Longitude" type="text" value={form.geofence_lng} onChange={v => update('geofence_lng', v)} placeholder="110.6xxx" />
            </div>

            <RoleToggleGroup
              label="Wajib Foto Briefing"
              description="Jabatan yang perlu upload foto briefing harian."
              roles={roleOptions}
              selected={splitRoleList(form.briefing_photo_roles)}
              onToggle={role => toggleRole('briefing_photo_roles', role)}
            />
            <RoleToggleGroup
              label="Bisa Tambah Reservasi"
              description="Jabatan yang boleh tambah, edit, dan hapus reservasi dari panel staff."
              roles={roleOptions}
              selected={splitRoleList(form.reservation_manage_roles)}
              onToggle={role => toggleRole('reservation_manage_roles', role)}
            />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setEditing(false); setForm(buildForm(settings)); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-600"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-navy text-white active:bg-navy-dark disabled:bg-gray-200 disabled:text-gray-400"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildForm(settings) {
  return {
    shift_mulai: settings?.shift_mulai || '08:00',
    shift_selesai: settings?.shift_selesai || '17:00',
    toleransi_terlambat_menit: settings?.toleransi_terlambat_menit || '15',
    geofence_lat: settings?.geofence_lat || '',
    geofence_lng: settings?.geofence_lng || '',
    geofence_radius_meter: settings?.geofence_radius_meter || '200',
    briefing_photo_roles: settings?.briefing_photo_roles || joinRoleList(DEFAULT_BRIEFING_ROLES),
    reservation_manage_roles: settings?.reservation_manage_roles || joinRoleList(DEFAULT_RESERVATION_ROLES),
  };
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-700 break-words">{value}</p>
    </div>
  );
}

function PermissionSummary({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {splitRoleList(value).map(role => (
          <span key={role} className="bg-white border border-gray-200 text-gray-600 text-[11px] font-medium px-2 py-1 rounded-lg">
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}

function RoleToggleGroup({ label, description, roles, selected, onToggle }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="text-[11px] text-gray-400 mt-0.5 mb-2">{description}</p>
      <div className="flex flex-wrap gap-2">
        {roles.map(role => {
          const active = selected.some(item => item.toLowerCase() === role.toLowerCase());
          return (
            <button
              key={role}
              type="button"
              onClick={() => onToggle(role)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                active ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-500'
              }`}
            >
              {role}
            </button>
          );
        })}
      </div>
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
        className="w-full min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy bg-white"
      />
    </div>
  );
}
