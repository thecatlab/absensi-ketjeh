import { useState } from 'react';
import DashboardPage from './DashboardPage';
import EmployeesPage from './EmployeesPage';
import ShiftsPage from './ShiftsPage';
import ReportsPage from './ReportsPage';
import NotesPage from './NotesPage';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'karyawan', label: 'Karyawan' },
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
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-xs font-medium py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
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
      {activeTab === 'dashboard' && <DashboardPage />}
      {activeTab === 'karyawan' && <EmployeesPage adminPassword={password} />}
      {activeTab === 'shift' && <ShiftsPage adminPassword={password} />}
      {activeTab === 'laporan' && <ReportsPage adminPassword={password} />}
      {activeTab === 'catatan' && <NotesPage adminPassword={password} role={role} />}
    </div>
  );
}