import { useCallback, useEffect, useState } from 'react';
import { getDashboardData, getPengaturan } from '../../api/client';
import { extractTime, getArrivalStatus } from '../../utils/attendanceStatus';

export default function DashboardPage({ role }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([getDashboardData(), getPengaturan()])
      .then(([dashboardRes, settingsRes]) => {
        if (dashboardRes.success) setData(dashboardRes);
        if (settingsRes.success) setSettings(settingsRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const todayStr = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const { records = [] } = data || { records: [] };
  const sortedRecords = [...records].sort((a, b) => extractTime(b.jam_masuk).localeCompare(extractTime(a.jam_masuk)));
  const canViewAttendanceDetails = ['admin', 'owner'].includes(String(role || '').toLowerCase());

  return (
    <div>
      {/* Date + refresh */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400 capitalize">{todayStr}</p>
        <button onClick={loadData} className="text-xs text-navy font-medium">Refresh</button>
      </div>

      {/* Attendance Table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Absensi Hari Ini</h3>
          <span className="text-xs text-gray-400">{sortedRecords.length} record</span>
        </div>

        {sortedRecords.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
            Belum ada yang absen hari ini
          </div>
        ) : (
          <div className="space-y-2">
            {sortedRecords.map(record => (
              <AttendanceRow
                key={record.id}
                record={record}
                settings={settings}
                canViewDetails={canViewAttendanceDetails}
                onSelect={() => setSelectedRecord(record)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedRecord && canViewAttendanceDetails && (
        <AttendanceDetailModal record={selectedRecord} settings={settings} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}

function AttendanceRow({ record, settings, canViewDetails = false, onSelect }) {
  const masuk = extractTime(record.jam_masuk);
  const keluar = extractTime(record.jam_keluar);
  const timingStatus = getArrivalStatus(record, settings);
  const masukClass = getArrivalTimeClass(timingStatus);
  const isOffSite = record.status_lokasi_masuk && record.status_lokasi_masuk !== 'On-site';

  return (
    <div
      onClick={canViewDetails ? onSelect : undefined}
      className={`bg-white border border-gray-100 rounded-xl px-4 py-3 ${canViewDetails ? 'cursor-pointer active:bg-gray-50' : ''}`}
    >
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
          {timingStatus === 'tolerance' && (
            <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
              Toleransi
            </span>
          )}
          {timingStatus === 'late' && (
            <span className="text-[10px] bg-danger/10 text-danger px-2 py-0.5 rounded-full font-medium">
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
          <span className={`font-semibold ${masukClass}`}>{masuk}</span>
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

function AttendanceDetailModal({ record, settings, onClose }) {
  const masuk = extractTime(record.jam_masuk);
  const keluar = extractTime(record.jam_keluar);
  const timingStatus = getArrivalStatus(record, settings);
  const clockInPhoto = getRecordImage(record, 'masuk');
  const clockOutPhoto = getRecordImage(record, 'keluar');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-5 py-6">
      <div className="w-full max-w-[440px] max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-800">{record.nama}</h3>
            <p className="text-xs text-gray-400">{record.jabatan || '-'}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-400">Tutup</button>
        </div>

        <div className="space-y-2">
          <DetailRow label="Masuk" value={masuk} />
          <DetailRow label="Keluar" value={keluar} />
          <DetailRow label="Status Keterlambatan" value={getTimingStatusText(timingStatus)} />
          <DetailRow label="Notes" value={getRecordNote(record)} />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <AttendancePhoto label="Clock-in image" url={clockInPhoto} />
          <AttendancePhoto label="Clock-out image" url={clockOutPhoto} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-700 text-right">{value || '-'}</span>
    </div>
  );
}

function AttendancePhoto({ label, url }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      {url ? (
        <img src={url} alt={label} className="aspect-square w-full rounded-xl object-cover bg-gray-50" />
      ) : (
        <div className="aspect-square w-full rounded-xl bg-gray-50 flex items-center justify-center text-xs text-gray-400">
          Belum ada foto
        </div>
      )}
    </div>
  );
}

function getArrivalTimeClass(status) {
  if (status === 'tolerance') return 'text-warning';
  if (status === 'late') return 'text-danger';
  return 'text-success';
}

function getTimingStatusText(status) {
  if (status === 'tolerance') return 'Toleransi';
  if (status === 'late') return 'Terlambat';
  return 'Tepat waktu';
}

function getRecordNote(record) {
  return record.catatan || record.notes || record.note || record.keterangan || '-';
}

function getRecordImage(record, type) {
  const keys = type === 'masuk'
    ? ['foto_masuk_url', 'foto_masuk', 'clock_in_image', 'clock_in_photo', 'selfie_masuk', 'gambar_masuk']
    : ['foto_keluar_url', 'foto_keluar', 'clock_out_image', 'clock_out_photo', 'selfie_keluar', 'gambar_keluar'];
  return keys.map(key => record[key]).find(Boolean);
}
