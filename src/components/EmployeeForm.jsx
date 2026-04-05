import { useState } from 'react';

const JABATAN_OPTIONS = ['Kasir', 'Chef', 'Waitress', 'Purchasing', 'Security', 'Admin', 'Delivery', 'Maintenance', 'Manager'];
const KATEGORI_OPTIONS = ['on-site', 'mobile'];

export default function EmployeeForm({ employee, onSubmit, loading }) {
  const isEdit = !!employee;

  const [form, setForm] = useState({
    nama: employee?.nama || '',
    jabatan: employee?.jabatan || '',
    kategori: employee?.kategori || 'on-site',
    pin: employee?.pin || '',
    aktif: employee?.aktif !== undefined ? employee.aktif : true,
  });

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nama.trim() || !form.jabatan) return;
    onSubmit(form);
  }

  const canSubmit = form.nama.trim() && form.jabatan && !loading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nama */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Nama Lengkap *</label>
        <input
          type="text"
          value={form.nama}
          onChange={e => update('nama', e.target.value)}
          placeholder="Nama karyawan"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30"
          autoFocus
        />
      </div>

      {/* Jabatan */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Jabatan *</label>
        <select
          value={form.jabatan}
          onChange={e => update('jabatan', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 bg-white"
        >
          <option value="">Pilih jabatan</option>
          {JABATAN_OPTIONS.map(j => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>
      </div>

      {/* Kategori */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Kategori Lokasi</label>
        <div className="flex gap-2">
          {KATEGORI_OPTIONS.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => update('kategori', k)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.kategori === k
                  ? 'bg-navy text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {k === 'on-site' ? 'On-site' : 'Mobile'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          {form.kategori === 'on-site'
            ? 'Wajib absen dari area kerja (dalam radius GPS)'
            : 'Boleh absen dari luar area kerja (misal: Purchasing, Delivery)'}
        </p>
      </div>

      {/* PIN */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">
          PIN {isEdit ? '(kosongkan jika tidak diubah)' : '(4-6 digit)'}
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={form.pin}
          onChange={e => update('pin', e.target.value.replace(/\D/g, ''))}
          placeholder={isEdit ? '****' : '1234'}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30"
        />
      </div>

      {/* Aktif toggle (edit only) */}
      {isEdit && (
        <div className="flex items-center justify-between py-2">
          <label className="text-sm text-gray-700">Status Aktif</label>
          <button
            type="button"
            onClick={() => update('aktif', !form.aktif)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              form.aktif ? 'bg-success' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              form.aktif ? 'left-5.5' : 'left-0.5'
            }`} />
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
          canSubmit
            ? 'bg-navy text-white active:bg-navy-dark'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Karyawan'}
      </button>
    </form>
  );
}
