import { useState, useEffect } from 'react';
import Modal from '../../components/Modal';
import EmployeeForm from '../../components/EmployeeForm';
import { getAllEmployees, addEmployee, updateEmployee, deactivateEmployee } from '../../api/client';

export default function EmployeesPage({ adminPassword }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalMode, setModalMode] = useState(null); // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { loadEmployees(); }, []);

  function loadEmployees() {
    setLoading(true);
    getAllEmployees()
      .then(res => { if (res.success) setEmployees(res.data); })
      .finally(() => setLoading(false));
  }

  function showMessage(text, isError = false) {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleAdd(form) {
    setSaving(true);
    const res = await addEmployee(form, adminPassword);
    setSaving(false);
    if (res.error) {
      showMessage(res.error, true);
    } else {
      showMessage('Karyawan berhasil ditambahkan');
      setModalMode(null);
      loadEmployees();
    }
  }

  async function handleEdit(form) {
    setSaving(true);
    const res = await updateEmployee(editTarget.id, form, adminPassword);
    setSaving(false);
    if (res.error) {
      showMessage(res.error, true);
    } else {
      showMessage('Karyawan berhasil diperbarui');
      setModalMode(null);
      setEditTarget(null);
      loadEmployees();
    }
  }

  async function handleDeactivate(emp) {
    if (!confirm(`Nonaktifkan ${emp.nama}?`)) return;
    const res = await deactivateEmployee(emp.id, adminPassword);
    if (res.error) {
      showMessage(res.error, true);
    } else {
      showMessage(`${emp.nama} berhasil dinonaktifkan`);
      loadEmployees();
    }
  }

  function openEdit(emp) {
    setEditTarget(emp);
    setModalMode('edit');
  }

  const filtered = employees.filter(e => {
    if (!showInactive && !e.aktif) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.nama.toLowerCase().includes(q) || e.jabatan.toLowerCase().includes(q);
    }
    return true;
  });

  const activeCount = employees.filter(e => e.aktif).length;
  const inactiveCount = employees.length - activeCount;

  return (
    <div>
      {/* Message toast */}
      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
          message.isError ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400">{activeCount} aktif, {inactiveCount} nonaktif</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setModalMode('add'); }}
          className="bg-navy text-white text-xs font-semibold px-4 py-2 rounded-lg active:bg-navy-dark"
        >
          + Tambah
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Cari karyawan..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
        />
      </div>

      {/* Show inactive toggle */}
      {inactiveCount > 0 && (
        <button
          onClick={() => setShowInactive(!showInactive)}
          className="text-xs text-gray-400 mb-3 block"
        >
          {showInactive ? 'Sembunyikan nonaktif' : `Tampilkan ${inactiveCount} nonaktif`}
        </button>
      )}

      {/* Employee List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
          {search ? 'Tidak ditemukan' : 'Belum ada karyawan'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(emp => (
            <EmployeeRow
              key={emp.id}
              employee={emp}
              onEdit={() => openEdit(emp)}
              onDeactivate={() => handleDeactivate(emp)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalMode !== null}
        onClose={() => { setModalMode(null); setEditTarget(null); }}
        title={modalMode === 'edit' ? 'Edit Karyawan' : 'Tambah Karyawan'}
      >
        <EmployeeForm
          employee={modalMode === 'edit' ? editTarget : null}
          onSubmit={modalMode === 'edit' ? handleEdit : handleAdd}
          loading={saving}
        />
      </Modal>
    </div>
  );
}

function EmployeeRow({ employee, onEdit, onDeactivate }) {
  const isActive = employee.aktif;

  return (
    <div className={`border rounded-xl px-4 py-3 ${isActive ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
            isActive ? 'bg-navy/10 text-navy' : 'bg-gray-200 text-gray-400'
          }`}>
            {employee.nama.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-800 text-sm">{employee.nama}</p>
              {!isActive && (
                <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Nonaktif</span>
              )}
            </div>
            <p className="text-xs text-gray-400">{employee.jabatan} • {employee.kategori === 'on-site' ? 'On-site' : 'Mobile'} • {employee.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-navy rounded-lg hover:bg-gray-100"
            title="Edit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {isActive && (
            <button
              onClick={onDeactivate}
              className="p-1.5 text-gray-400 hover:text-danger rounded-lg hover:bg-red-50"
              title="Nonaktifkan"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
