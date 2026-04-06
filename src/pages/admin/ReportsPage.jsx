import { useState, useEffect } from 'react';
import StatCard from '../../components/StatCard';
import Modal from '../../components/Modal';
import PhotoDisplay from '../../components/PhotoDisplay';
import { getReport, getAllEmployees, getPengaturan } from '../../api/client';
import { arrayToCSV, downloadCSV } from '../../utils/csvExport';

export default function ReportsPage({ adminPassword }) {
  const [employees, setEmployees] = useState([]);
  const [dari, setDari] = useState(getDefaultDari());
  const [sampai, setSampai] = useState(getDefaultSampai());
  const [karyawanId, setKaryawanId] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeQuick, setActiveQuick] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    getAllEmployees().then(res => { if (res.success) setEmployees(res.data); });
    getPengaturan().then(res => { if (res.success) setSettings(res.data); });
  }, []);

  useEffect(() => {
    loadReport();
  }, [dari, sampai, karyawanId]);

  function loadReport() {
    setLoading(true);
    getReport(dari, sampai, karyawanId || null, adminPassword)
      .then(res => { if (res.success) setData(res); })
      .finally(() => setLoading(false));
  }

  function handleExport() {
    if (!data?.data?.length) return;

    const shiftMulai = settings?.shift_mulai || '08:00';
    const shiftSelesai = settings?.shift_selesai || '17:00';
    const toleransi = parseInt(settings?.toleransi_terlambat_menit) || 15;

    const headers = [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'nama', label: 'Nama' },
      { key: 'jabatan', label: 'Jabatan' },
      { key: 'jam_masuk', label: 'Jam Masuk' },
      { key: 'jam_keluar', label: 'Jam Keluar' },
      { key: 'durasi_jam', label: 'Durasi (jam)' },
      { key: 'status_kehadiran', label: 'Status Kehadiran' },
      { key: 'durasi_terlambat', label: 'Durasi Terlambat (menit)' },
      { key: 'durasi_lembur', label: 'Durasi Lembur (menit)' },
      { key: 'status_lokasi_masuk', label: 'Lokasi Masuk' },
    ];

    const batasTerlambat = addMinutes(shiftMulai, toleransi);

    const rows = data.data.map(r => {
      const masuk = extractTime(r.jam_masuk);
      const keluar = extractTime(r.jam_keluar);

      // Terlambat: masuk > shift_mulai + toleransi
      const terlambat = masuk > batasTerlambat;
      const menitTerlambat = terlambat ? diffMinutes(shiftMulai, masuk) : 0;

      // Lembur: keluar > shift_selesai
      const lembur = keluar && keluar !== '-' && keluar > shiftSelesai;
      const menitLembur = lembur ? diffMinutes(shiftSelesai, keluar) : 0;

      return {
        ...r,
        jam_masuk: masuk,
        jam_keluar: keluar,
        status_kehadiran: terlambat ? 'Terlambat' : 'Tepat Waktu',
        durasi_terlambat: menitTerlambat > 0 ? menitTerlambat : '',
        durasi_lembur: menitLembur > 0 ? menitLembur : '',
      };
    });

    const csv = arrayToCSV(headers, rows);
    const filename = `absensi_${dari}_${sampai}.csv`;
    downloadCSV(filename, csv);
  }

  function handlePrint() {
    window.print();
  }

  const summary = data?.summary || {};
  const records = data?.data || [];

  // Group by date for display
  const grouped = {};
  records.forEach(r => {
    if (!grouped[r.tanggal]) grouped[r.tanggal] = [];
    grouped[r.tanggal].push(r);
  });
  const dates = Object.keys(grouped).sort().reverse();

  return (
    <div>
      {/* Quick Date Buttons */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {getQuickDateOptions().map(opt => (
          <button
            key={opt.label}
            onClick={() => { setDari(opt.dari); setSampai(opt.sampai); setActiveQuick(opt.label); }}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeQuick === opt.label
                ? 'bg-navy text-white'
                : 'bg-gray-100 text-gray-500 active:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Dari</label>
            <input
              type="date"
              value={dari}
              onChange={e => { setDari(e.target.value); setActiveQuick(null); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Sampai</label>
            <input
              type="date"
              value={sampai}
              onChange={e => { setSampai(e.target.value); setActiveQuick(null); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Karyawan (opsional)</label>
          <select
            value={karyawanId}
            onChange={e => setKaryawanId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy bg-white"
          >
            <option value="">Semua karyawan</option>
            {employees.filter(e => e.aktif).map(e => (
              <option key={e.id} value={e.id}>{e.nama} ({e.jabatan})</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse mt-2" />)}
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3 mb-5 print:grid-cols-4">
            <StatCard label="Hari Kerja" value={summary.total_hari || 0} color="blue" />
            <StatCard label="Total Hadir" value={summary.total_hadir || 0} color="green" />
            <StatCard label="Terlambat" value={summary.total_terlambat || 0} color="yellow" />
            <StatCard label="Rata-rata Durasi" value={`${summary.rata_rata_durasi || 0}j`} color="gray" />
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 mb-4 print:hidden">
            <button
              onClick={handleExport}
              disabled={records.length === 0}
              className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                records.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-navy text-white active:bg-navy-dark'
              }`}
            >
              <DownloadIcon />
              Download CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={records.length === 0}
              className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                records.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 active:bg-gray-300'
              }`}
            >
              <PrintIcon />
              Print
            </button>
          </div>

          {/* Records Table grouped by date */}
          {records.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
              Tidak ada data untuk periode ini
            </div>
          ) : (
            <div className="space-y-4">
              {dates.map(date => (
                <DateGroup key={date} date={date} records={grouped[date]} onViewRecord={setSelectedRecord} />
              ))}
            </div>
          )}

          {/* Record Detail Modal */}
          <Modal isOpen={selectedRecord !== null} onClose={() => setSelectedRecord(null)} title="Detail Absensi">
            {selectedRecord && <RecordDetail record={selectedRecord} />}
          </Modal>
        </>
      )}
    </div>
  );
}

function RecordDetail({ record }) {
  const masuk = extractTime(record.jam_masuk);
  const keluar = extractTime(record.jam_keluar);
  const isOnSiteMasuk = record.status_lokasi_masuk === 'On-site';

  return (
    <div className="space-y-4">
      {/* Employee info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-navy/10 rounded-full flex items-center justify-center text-navy font-bold text-sm">
          {record.nama?.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-gray-800">{record.nama}</p>
          <p className="text-xs text-gray-400">{record.jabatan} {record.kategori ? `• ${record.kategori === 'on-site' ? 'On-site' : 'Mobile'}` : ''}</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center">{record.tanggal}</p>

      {/* Clock In */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-success/10 rounded-full flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">Clock In</p>
          <span className="text-sm font-bold text-success ml-auto">{masuk}</span>
        </div>
        <PhotoDisplay url={record.foto_masuk_url} alt="Foto Masuk" />
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnSiteMasuk ? 'bg-success' : 'bg-warning'}`} />
          <span className={`text-xs font-medium ${isOnSiteMasuk ? 'text-success' : 'text-warning'}`}>
            {record.status_lokasi_masuk || 'Tidak tersedia'}
          </span>
        </div>
      </div>

      {/* Clock Out */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-danger/10 rounded-full flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">Clock Out</p>
          <span className={`text-sm font-bold ml-auto ${keluar && keluar !== '-' ? 'text-danger' : 'text-gray-300'}`}>
            {keluar || '-'}
          </span>
        </div>
        <PhotoDisplay url={record.foto_keluar_url} alt="Foto Keluar" />
      </div>

      {record.durasi_jam && (
        <div className="text-center text-sm text-gray-500">
          Durasi kerja: <span className="font-semibold text-gray-700">{record.durasi_jam} jam</span>
        </div>
      )}
    </div>
  );
}

function DateGroup({ date, records, onViewRecord }) {
  const d = new Date(date + 'T00:00:00+07:00');
  const label = d.toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
        <span className="text-[10px] text-gray-400">{records.length} orang</span>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-400 text-left">
              <th className="py-2 px-3 font-medium">Nama</th>
              <th className="py-2 px-3 font-medium">Masuk</th>
              <th className="py-2 px-3 font-medium">Keluar</th>
              <th className="py-2 px-3 font-medium">Durasi</th>
              <th className="py-2 px-3 font-medium">Lok</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const masuk = extractTime(r.jam_masuk);
              const keluar = extractTime(r.jam_keluar);
              const isLate = masuk > '08:15';
              const isOffSite = r.status_lokasi_masuk !== 'On-site';
              return (
                <tr key={i} className="border-t border-gray-50 cursor-pointer hover:bg-gray-50 active:bg-gray-100" onClick={() => onViewRecord(r)}>
                  <td className="py-2 px-3 font-medium text-gray-700">{r.nama}</td>
                  <td className={`py-2 px-3 ${isLate ? 'text-warning font-semibold' : 'text-success'}`}>{masuk}</td>
                  <td className="py-2 px-3 text-gray-600">{keluar}</td>
                  <td className="py-2 px-3 text-gray-600">{r.durasi_jam}j</td>
                  <td className="py-2 px-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${isOffSite ? 'bg-warning' : 'bg-success'}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function extractTime(dtStr) {
  if (!dtStr) return '-';
  const parts = String(dtStr).split(' ');
  return parts.length >= 2 ? parts[1].substring(0, 5) : dtStr;
}

/**
 * Add minutes to a "HH:MM" time string. Returns "HH:MM".
 */
function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Calculate difference in minutes between two "HH:MM" strings.
 * Returns positive number if endTime > startTime.
 */
function diffMinutes(startTime, endTime) {
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

function getQuickDateOptions() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  // Minggu ini (Monday to today)
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(monday.getDate() - mondayOffset);
  const mingguIniDari = monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  // Minggu lalu (last Monday to last Sunday)
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(monday);
  lastSunday.setDate(lastSunday.getDate() - 1);
  const mingguLaluDari = lastMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const mingguLaluSampai = lastSunday.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  // Bulan ini (1st of month to today)
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const bulanIniDari = firstOfMonth.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  // Bulan kemarin (1st to last day of previous month)
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const bulanKemarinDari = firstOfLastMonth.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const bulanKemarinSampai = lastOfLastMonth.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  return [
    { label: 'Hari Ini', dari: todayStr, sampai: todayStr },
    { label: 'Minggu Ini', dari: mingguIniDari, sampai: todayStr },
    { label: 'Minggu Kemarin', dari: mingguLaluDari, sampai: mingguLaluSampai },
    { label: 'Bulan Ini', dari: bulanIniDari, sampai: todayStr },
    { label: 'Bulan Kemarin', dari: bulanKemarinDari, sampai: bulanKemarinSampai },
  ];
}

function getDefaultDari() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function getDefaultSampai() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}
