import { useState, useEffect } from 'react';
import StatCard from '../../components/StatCard';
import { getDashboardData } from '../../api/client';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setLoading(true);
    getDashboardData()
      .then(res => { if (res.success) setData(res); })
      .finally(() => setLoading(false));
  }

  const todayStr = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const { summary, records } = data || { summary: {}, records: [] };

  return (
    <div>
      {/* Date + refresh */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400 capitalize">{todayStr}</p>
        <button onClick={loadData} className="text-xs text-navy font-medium">Refresh</button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total Karyawan" value={summary.totalKaryawan || 0} color="blue" />
        <StatCard label="Hadir" value={summary.hadir || 0} color="green" />
        <StatCard label="Terlambat" value={summary.terlambat || 0} color="yellow" />
        <StatCard label="Belum Hadir" value={summary.belumHadir || 0} color="red" />
      </div>

      {/* Attendance Table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Absensi Hari Ini</h3>
          <span className="text-xs text-gray-400">{records.length} record</span>
        </div>

        {records.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
            Belum ada yang absen hari ini
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(record => (
              <AttendanceRow key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceRow({ record }) {
  const masuk = extractTime(record.jam_masuk);
  const keluar = extractTime(record.jam_keluar);
  const isLate = masuk > '08:15';
  const isOffSite = record.status_lokasi_masuk && record.status_lokasi_masuk !== 'On-site';

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-navy/10 rounded-full flex items-center justify-center text-navy font-bold text-xs shrink-0">
            {record.nama?.charAt(0) || '?'}
          </div>
          <div>
            <p className="font-medium text-gray-800 text-sm">{record.nama}</p>
            <p className="text-xs text-gray-400">{record.jabatan || ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLate && (
            <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
              Terlambat
            </span>
          )}
          {isOffSite && (
            <span className="text-[10px] bg-danger/10 text-danger px-2 py-0.5 rounded-full font-medium">
              Off-site
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-6 mt-2 ml-12 text-xs">
        <div>
          <span className="text-gray-400">Masuk </span>
          <span className="font-semibold text-success">{masuk}</span>
        </div>
        <div>
          <span className="text-gray-400">Keluar </span>
          <span className={`font-semibold ${keluar === '-' ? 'text-gray-300' : 'text-danger'}`}>{keluar}</span>
        </div>
        {record.durasi_jam && (
          <div>
            <span className="text-gray-400">Durasi </span>
            <span className="font-semibold text-gray-600">{record.durasi_jam}j</span>
          </div>
        )}
      </div>
    </div>
  );
}

function extractTime(dtStr) {
  if (!dtStr) return '-';
  const parts = String(dtStr).split(' ');
  return parts.length >= 2 ? parts[1].substring(0, 5) : dtStr;
}
