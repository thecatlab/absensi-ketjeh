import { useState } from 'react';
import DashboardPage from './DashboardPage';
import EmployeesPage from './EmployeesPage';
import ShiftsPage from './ShiftsPage';
import ReportsPage from './ReportsPage';
import NotesPage from './NotesPage';
import PengumumanPage from './PengumumanPage';
import ReservasiPage from './ReservasiPage';
import TodosPage from './TodosPage';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pengumuman', label: 'Pengumuman' },
  { id: 'reservasi', label: 'Reservasi' },
  { id: 'todo', label: 'To-do' },
  { id: 'karyawan', label: 'Pengaturan' },
  { id: 'shift', label: 'Shift' },
  { id: 'laporan', label: 'Laporan' },
  { id: 'catatan', label: 'Catatan' },
];

export default function AdminLayout({ role, password, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="px-5 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-navy">Admin Panel</h2>
          <p className="text-xs text-gray-400 capitalize">Role: {role}</p>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-danger font-medium px-3 py-1.5 border border-danger/30 rounded-lg hover:bg-danger/5"
        >
          Logout
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-4 gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-xs font-medium py-2 px-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-navy shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && <DashboardPage role={role} />}
      {activeTab === 'pengumuman' && <PengumumanPage adminPassword={password} role={role} />}
      {activeTab === 'reservasi' && <ReservasiPage adminPassword={password} startFormOpen={false} />}
      {activeTab === 'todo' && <TodosPage adminPassword={password} />}
      {activeTab === 'karyawan' && <EmployeesPage adminPassword={password} />}
      {activeTab === 'shift' && <ShiftsPage adminPassword={password} />}
      {activeTab === 'laporan' && <ReportsPage adminPassword={password} />}
      {activeTab === 'catatan' && <NotesPage adminPassword={password} role={role} />}
    </div>
  );
}
