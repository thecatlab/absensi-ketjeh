import { useEffect, useState } from 'react';
import ReservasiPage from './admin/ReservasiPage';
import { getPengaturan } from '../api/client';
import { DEFAULT_RESERVATION_ROLES, isRoleAllowed } from '../utils/permissions';

export default function ReservasiPanelPage({ selectedEmployee, verifiedAccess }) {
  const [settings, setSettings] = useState(null);
  const isVerified = selectedEmployee && String(verifiedAccess?.employeeId) === String(selectedEmployee.id);
  const canManage = isVerified && isRoleAllowed(selectedEmployee?.jabatan, settings, 'reservation_manage_roles', DEFAULT_RESERVATION_ROLES);

  useEffect(() => {
    getPengaturan().then(res => { if (res.success) setSettings(res.data); });
  }, []);

  return (
    <div className="px-5 py-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-navy">Reservasi</h2>
        {selectedEmployee && (
          <p className="text-xs text-gray-400 mt-1">
            {selectedEmployee.nama} · {selectedEmployee.jabatan}
          </p>
        )}
      </div>

      {!selectedEmployee ? (
        <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
          Pilih nama karyawan di Beranda untuk melihat reservasi.
        </div>
      ) : !isVerified ? (
        <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
          Masukkan PIN di Beranda untuk membuka data reservasi.
        </div>
      ) : (
        <ReservasiPage canManage={canManage} startFormOpen={false} />
      )}
    </div>
  );
}
