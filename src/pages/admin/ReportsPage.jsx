import { useState } from 'react';
import Modal from '../../components/Modal';
import PhotoDisplay from '../../components/PhotoDisplay';
import { useRead, useBootstrap } from '../../api/useRead';
import ReadNotice from '../../components/ReadNotice';
import { compareRecordsByLatestInput, diffMinutes, extractTime, getArrivalStatus, getEarlyLeaveMinutes, getLateMinutes, shiftSettingsForDate, summarizeLateness } from '../../utils/attendanceStatus';
import { arrayToCSV, downloadCSV } from '../../utils/csvExport';

export default function ReportsPage() {
  const reference = useBootstrap();
  const employees = reference.data?.data.employees || [];
  const settings = reference.data?.data.settings;
  const [dari, setDari] = useState(getDefaultDari());
  const [sampai, setSampai] = useState(getDefaultSampai());
  const [karyawanId, setKaryawanId] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeQuick, setActiveQuick] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState('detail');
  const query = useRead('getReport', { dari, sampai, karyawan_id: karyawanId });
  const shiftQuery = useRead('getShiftKhusus');
  const { data } = query;
  const loading = query.loading || shiftQuery.loading;
  const specialShifts = shiftQuery.data?.data;
  // Special shifts replace the general working hours on their dates.
  const settingsFor = record => shiftSettingsForDate(settings, specialShifts, record.tanggal);

  function handleExport() {
    if (view === 'rekap') return exportRecap();
    const exportRecords = getFilteredRecords(data?.data || [], statusFilter, settingsFor);
    if (!exportRecords.length) return;

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
      { key: 'pulang_awal', label: 'Pulang Lebih Awal (menit)' },
    ];

    const rows = exportRecords.map(r => {
      const masuk = extractTime(r.jam_masuk);
      const keluar = extractTime(r.jam_keluar);
      const daySettings = settingsFor(r);
      const shiftSelesai = daySettings?.shift_selesai || '17:00';

      // Terlambat: minutes past shift_mulai + toleransi, same as the table.
      const menitTerlambat = getLateMinutes(r, daySettings);
      const menitPulangAwal = getEarlyLeaveMinutes(r, daySettings);

      // Lembur: keluar > shift_selesai
      const lembur = keluar && keluar !== '-' && keluar > shiftSelesai;
      const menitLembur = lembur ? diffMinutes(shiftSelesai, keluar) : 0;

      return {
        ...r,
        jam_masuk: masuk,
        jam_keluar: keluar,
        status_kehadiran: menitTerlambat > 0 ? 'Terlambat' : 'Tepat Waktu',
        durasi_terlambat: menitTerlambat > 0 ? menitTerlambat : '',
        durasi_lembur: menitLembur > 0 ? menitLembur : '',
        pulang_awal: menitPulangAwal > 0 ? menitPulangAwal : '',
      };
    });

    const csv = arrayToCSV(headers, rows);
    const filename = `absensi_${dari}_${sampai}.csv`;
    downloadCSV(filename, csv);
  }

  function exportRecap() {
    if (!recap.length) return;
    const headers = [
      { key: 'nama', label: 'Nama' },
      { key: 'jabatan', label: 'Jabatan' },
      { key: 'hadir', label: 'Hari Hadir' },
      { key: 'hariTerlambat', label: 'Hari Terlambat' },
      { key: 'lateMinutes', label: 'Total Terlambat (menit)' },
    ];
    downloadCSV(`rekap_terlambat_${dari}_${sampai}.csv`, arrayToCSV(headers, recap));
  }

  function handlePrint() {
    window.print();
  }

  function openEmployeeDetail(row) {
    setKaryawanId(row.karyawan_id ? String(row.karyawan_id) : '');
    setStatusFilter('all');
    setView('detail');
  }

  const allRecords = data?.data || [];
  // Attendance rows carry no job title; take it from the employee list.
  const jabatanById = new Map(employees.map(employee => [String(employee.id), employee.jabatan]));
  const recap = summarizeLateness(allRecords, settingsFor)
    .map(row => ({ ...row, jabatan: jabatanById.get(String(row.karyawan_id)) || row.jabatan || '' }));
  const records = view === 'rekap' ? allRecords : getFilteredRecords(allRecords, statusFilter, settingsFor);

  // Group by date for display
  const grouped = {};
  const recordOrder = new Map(records.map((record, index) => [record, index]));
  records.forEach(r => {
    if (!grouped[r.tanggal]) grouped[r.tanggal] = [];
    grouped[r.tanggal].push(r);
  });
  Object.values(grouped).forEach(dayRecords => {
    dayRecords.sort((a, b) => compareRecordsByLatestInput(a, b, recordOrder));
  });
  const dates = Object.keys(grouped).sort().reverse();

  return (
    <div>
      <ReadNotice query={query} />
      <ReadNotice query={shiftQuery} />
      <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 mb-4 print:hidden">
        {[
          { id: 'detail', label: 'Detail' },
          { id: 'rekap', label: 'Rekap Terlambat' },
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
              view === item.id ? 'bg-white text-navy shadow-sm' : 'text-gray-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {/* Quick Date Buttons */}
      <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2 mb-3">
        {getQuickDateOptions().map(opt => (
          <button
            key={opt.label}
            onClick={() => { setDari(opt.dari); setSampai(opt.sampai); setActiveQuick(opt.label); }}
            className={`min-h-10 px-3 py-2 rounded-lg text-xs font-medium leading-tight transition-colors ${
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
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Dari</label>
            <input
              type="date"
              value={dari}
              onChange={e => { setDari(e.target.value); setActiveQuick(null); }}
              className="w-full min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Sampai</label>
            <input
              type="date"
              value={sampai}
              onChange={e => { setSampai(e.target.value); setActiveQuick(null); }}
              className="w-full min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy"
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
        {view === 'detail' && <div>
          <label className="text-xs text-gray-500 mb-1 block">Filter keterlambatan</label>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
            {[
              { value: 'all', label: 'Semua' },
              { value: 'late_any', label: 'Toleransi & Terlambat' },
              { value: 'late_only', label: 'Terlambat' },
            ].map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`min-h-10 px-2 py-2 rounded-lg text-xs font-medium leading-tight ${
                  statusFilter === option.value
                    ? 'bg-navy text-white'
                    : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>}
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
          ) : view === 'rekap' ? (
            <LatenessRecap rows={recap} onSelect={openEmployeeDetail} />
          ) : (
            <div className="space-y-4">
              {dates.map(date => (
                <DateGroup key={date} date={date} records={grouped[date]} settingsFor={settingsFor} onViewRecord={setSelectedRecord} />
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
  const note = getRecordNote(record);

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

      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-400 mb-1">Catatan</p>
        <p className="text-sm text-gray-700 whitespace-pre-line">{note || 'Tidak ada catatan'}</p>
      </div>
    </div>
  );
}

function DateGroup({ date, records, settingsFor, onViewRecord }) {
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
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-400 text-left">
              <th className="w-[31%] py-2 px-3 font-medium">Nama</th>
              <th className="w-[16%] py-2 px-3 font-medium">Masuk</th>
              <th className="w-[16%] py-2 px-3 font-medium">Keluar</th>
              <th className="w-[25%] py-2 px-3 font-medium">Terlambat</th>
              <th className="w-[12%] py-2 px-3 font-medium text-center">Lok</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const masuk = extractTime(r.jam_masuk);
              const keluar = extractTime(r.jam_keluar);
              const arrivalStatus = getArrivalStatus(r, settingsFor(r));
              const masukClass = getArrivalTimeClass(arrivalStatus);
              const isOffSite = r.status_lokasi_masuk !== 'On-site';
              return (
                <tr key={i} className="border-t border-gray-50 cursor-pointer hover:bg-gray-50 active:bg-gray-100" onClick={() => onViewRecord(r)}>
                  <td className="py-2 px-3 font-medium text-gray-700 truncate">{r.nama}</td>
                  <td className={`py-2 px-3 font-semibold ${masukClass}`}>{masuk}</td>
                  <td className="py-2 px-3 text-gray-600">{keluar}</td>
                  <td className="py-2 px-3"><LatenessCell minutes={getLateMinutes(r, settingsFor(r))} /></td>
                  <td className="py-2 px-3 text-center">
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

function LatenessCell({ minutes }) {
  if (!minutes) return <span className="text-gray-300">-</span>;
  return <span className="font-semibold text-danger">{formatMinutes(minutes)}</span>;
}

function LatenessRecap({ rows, onSelect }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-2">Total menit terlambat per karyawan. Hari tanpa absensi tidak dihitung. Ketuk nama untuk melihat detail.</p>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-400 text-left">
              <th className="w-[40%] py-2 px-3 font-medium">Nama</th>
              <th className="w-[16%] py-2 px-3 font-medium text-center">Hadir</th>
              <th className="w-[18%] py-2 px-3 font-medium text-center">Telat</th>
              <th className="w-[26%] py-2 px-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.karyawan_id || row.nama} className="border-t border-gray-50 cursor-pointer hover:bg-gray-50 active:bg-gray-100" onClick={() => onSelect(row)}>
                <td className="py-2 px-3">
                  <p className="font-medium text-gray-700 truncate">{row.nama}</p>
                  {row.jabatan && <p className="text-[10px] text-gray-400 truncate">{row.jabatan}</p>}
                </td>
                <td className="py-2 px-3 text-center text-gray-600">{row.hadir}</td>
                <td className="py-2 px-3 text-center text-gray-600">{row.hariTerlambat}x</td>
                <td className="py-2 px-3"><LatenessCell minutes={row.lateMinutes} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMinutes(total) {
  if (total < 60) return `${total}m`;
  const minutes = total % 60;
  return minutes ? `${Math.floor(total / 60)}j ${minutes}m` : `${total / 60}j`;
}

function getArrivalTimeClass(status) {
  if (status === 'tolerance') return 'text-warning';
  if (status === 'late') return 'text-danger';
  return 'text-success';
}

function getFilteredRecords(records, statusFilter, settingsFor) {
  if (statusFilter === 'all') return records;
  return records.filter(record => {
    const status = getArrivalStatus(record, settingsFor(record));
    if (statusFilter === 'late_any') return status === 'tolerance' || status === 'late';
    if (statusFilter === 'late_only') return status === 'late';
    return true;
  });
}

function getRecordNote(record) {
  return String(record.catatan || record.notes || record.note || record.keterangan || '').trim();
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

  return [
    { label: 'Hari Ini', dari: todayStr, sampai: todayStr },
    { label: 'Minggu Ini', dari: mingguIniDari, sampai: todayStr },
    { label: 'Minggu Kemarin', dari: mingguLaluDari, sampai: mingguLaluSampai },
    { label: 'Bulan Ini', dari: bulanIniDari, sampai: todayStr },
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
