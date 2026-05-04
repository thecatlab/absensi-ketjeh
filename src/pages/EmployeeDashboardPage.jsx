import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Camera from '../components/Camera';
import { getEmployeeDashboard, setTodoStatus, uploadBriefingPhoto } from '../api/client';
import { CONFIG } from '../config';

export default function EmployeeDashboardPage({ employee, embedded = false }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reservasiOpen, setReservasiOpen] = useState(true);
  const [expandedReservasi, setExpandedReservasi] = useState({});
  const [briefingPhoto, setBriefingPhoto] = useState(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingSaving, setBriefingSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const canUploadBriefing = ['manager', 'captain floor'].includes(String(employee.jabatan).toLowerCase());

  const loadDashboard = useCallback(() => {
    setLoading(true);
    getEmployeeDashboard(employee)
      .then(res => {
        if (res.success) setData(res);
      })
      .finally(() => setLoading(false));
  }, [employee]);

  useEffect(() => {
    const timer = setTimeout(loadDashboard, 0);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  function showMessage(text, isError = false) {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleTodoChange(todoId, checked) {
    setData(prev => ({
      ...prev,
      todos: prev.todos.map(todo => todo.id === todoId ? { ...todo, selesai: checked } : todo),
    }));
    const res = await setTodoStatus(todoId, employee, checked);
    if (res.error) {
      showMessage(res.error, true);
      loadDashboard();
    }
  }

  async function handleBriefingUpload() {
    if (!briefingPhoto) return;
    setBriefingSaving(true);
    const res = await uploadBriefingPhoto(employee, briefingPhoto);
    setBriefingSaving(false);
    if (res.error) {
      showMessage(res.error, true);
    } else {
      showMessage('Foto briefing tersimpan');
      setBriefingOpen(false);
      setBriefingPhoto(null);
      loadDashboard();
    }
  }

  const todayStr = new Date().toLocaleDateString('id-ID', {
    timeZone: CONFIG.TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const pengumuman = data?.pengumuman || [];
  const reservasi = data?.reservasi || [];
  const statusHariIni = data?.status_hari_ini || null;
  const todos = data?.todos || [];
  const sortedTodos = [...todos].sort((a, b) => Number(Boolean(a.selesai)) - Number(Boolean(b.selesai)));
  const briefing = data?.briefing || null;
  const doneCount = todos.filter(todo => todo.selesai).length;

  return (
    <div className={embedded ? 'bg-white pb-6' : 'min-h-dvh bg-white pb-28'}>
      {!embedded && <header className="bg-navy text-white px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold shrink-0">
            {employee.nama.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white/60">Dashboard hari ini</p>
            <h1 className="text-lg font-semibold leading-tight truncate">{employee.nama}</h1>
            <p className="text-xs text-white/60">{employee.jabatan} di {CONFIG.COMPANY_NAME}</p>
          </div>
        </div>
      </header>}

      <div className={embedded ? 'py-1' : 'px-5 py-5'}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400 capitalize">{todayStr}</p>
          <button onClick={loadDashboard} className="text-xs text-navy font-medium">Refresh</button>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
            message.isError ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-4">
            <Section title="Pengumuman" count={pengumuman.length}>
              {pengumuman.length === 0 ? (
                <EmptyState text="Tidak ada pengumuman aktif hari ini." />
              ) : (
                <div className="space-y-4">
                  {pengumuman.map(item => (
                    <div key={item.id}>
                      <h3 className="text-sm font-semibold text-gray-800">{item.judul}</h3>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">{item.isi}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Reservasi Hari Ini"
              count={reservasi.length}
              collapsible
              open={reservasiOpen}
              onToggle={() => setReservasiOpen(prev => !prev)}
            >
              {reservasi.length === 0 ? (
                <EmptyState text="Belum ada reservasi untuk hari ini." />
              ) : (
                <div className="space-y-2">
                  {reservasi.map(item => {
                    const isOpen = Boolean(expandedReservasi[item.id]);
                    return (
                      <ReservationItem
                        key={item.id}
                        item={item}
                        expanded={isOpen}
                        onToggle={() => setExpandedReservasi(prev => ({ ...prev, [item.id]: !isOpen }))}
                      />
                    );
                  })}
                </div>
              )}
            </Section>

            <Section title="To-do" count={`${doneCount}/${todos.length}`}>
              {todos.length === 0 ? (
                <EmptyState text="Tidak ada to-do untuk jabatan atau nama kamu hari ini." />
              ) : (
                <div className="space-y-2">
                  {sortedTodos.map(todo => (
                    <label key={todo.id} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                      <input
                        type="checkbox"
                        checked={Boolean(todo.selesai)}
                        onChange={e => handleTodoChange(todo.id, e.target.checked)}
                        className="mt-1 w-4 h-4 accent-navy shrink-0"
                      />
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${todo.selesai ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {todo.judul}
                        </span>
                        {todo.deskripsi && (
                          <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{todo.deskripsi}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </Section>

            {canUploadBriefing && (
              <Section title="Foto Briefing" count={briefing ? 'Selesai' : 'Wajib'}>
                {briefing ? (
                  <div className="bg-success/10 border border-success/20 rounded-xl p-4">
                    <p className="text-sm font-semibold text-success">Foto briefing sudah diupload</p>
                    <p className="text-xs text-gray-500 mt-1">Jam upload: {briefing.jam_upload || '-'}</p>
                    {briefing.foto_url && <img src={briefing.foto_url} alt="Foto briefing" className="mt-3 w-full rounded-xl" />}
                  </div>
                ) : briefingOpen ? (
                  <div className="space-y-3">
                    <Camera onCapture={setBriefingPhoto} />
                    <button
                      onClick={handleBriefingUpload}
                      disabled={!briefingPhoto || briefingSaving}
                      className={`w-full py-3 rounded-xl text-sm font-semibold ${
                        briefingPhoto && !briefingSaving
                          ? 'bg-navy text-white'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {briefingSaving ? 'Menyimpan...' : 'Upload Foto Briefing'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setBriefingOpen(true)}
                    className="w-full bg-warning/10 border border-warning/20 text-warning rounded-xl py-3 text-sm font-semibold"
                  >
                    Ambil Foto Briefing
                  </button>
                )}
              </Section>
            )}

            <Section title="Status Hari Ini" count={getStatusLabel(statusHariIni)}>
              <AttendanceStatus status={statusHariIni} />
              <ClockAction status={statusHariIni} onClockIn={() => navigate('/clock-in')} onClockOut={() => navigate('/clock-out')} />
            </Section>
          </div>
        )}
      </div>

      {!embedded && <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 px-5 py-3">
        <button
          onClick={() => navigate('/clock-out')}
          className="w-full bg-danger text-white py-4 rounded-2xl text-lg font-semibold active:bg-red-600"
        >
          Clock Out
        </button>
      </div>}
    </div>
  );
}

function Section({ title, count, children, simple = false, collapsible = false, open = true, onToggle }) {
  return (
    <section className={simple ? 'px-1 py-2' : 'border border-gray-100 rounded-2xl p-4'}>
      {collapsible ? (
        <button type="button" onClick={onToggle} className={`w-full flex items-center justify-between text-left ${open ? 'mb-3' : ''}`}>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <span className="flex items-center gap-3 text-xs">
            <span className="font-medium text-navy">{open ? 'Sembunyikan' : 'Tampilkan'}</span>
            <span className="text-gray-400">{count}</span>
          </span>
        </button>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <span className="text-xs text-gray-400">{count}</span>
        </div>
      )}
      {open && children}
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
      {text}
    </div>
  );
}

function ClockAction({ status, onClockIn, onClockOut }) {
  const state = status?.status;
  if (state === 'sudah_keluar') {
    return (
      <div className="mt-3 w-full bg-gray-100 text-gray-400 py-3 rounded-xl text-center text-sm font-semibold">
        Shift selesai hari ini
      </div>
    );
  }

  return (
    <button
      onClick={state === 'sudah_masuk' ? onClockOut : onClockIn}
      className={`mt-3 w-full py-3 rounded-xl text-sm font-semibold ${
        state === 'sudah_masuk'
          ? 'bg-danger text-white active:bg-red-600'
          : 'bg-success text-white active:bg-green-600'
      }`}
    >
      {state === 'sudah_masuk' ? 'Clock Out' : 'Clock In'}
    </button>
  );
}

function splitPesananLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function ReservationItem({ item, expanded, onToggle }) {
  const [showAllPesanan, setShowAllPesanan] = useState(false);
  const detail = item.keterangan || '';
  const preview = detail.length > 64 ? `${detail.slice(0, 64)}...` : detail;
  const canExpand = detail.length > 64;
  const pesananLines = splitPesananLines(item.pesanan);
  const shouldCollapsePesanan = pesananLines.length > 3;
  const visiblePesananLines = shouldCollapsePesanan && !showAllPesanan
    ? pesananLines.slice(0, 3)
    : pesananLines;

  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="font-semibold text-gray-800 text-sm">
        {item.jam} - {item.nama_pelanggan}{item.area ? ` - ${item.area}` : ''}
      </p>
      {pesananLines.length > 0 && (
        <div className="text-sm text-gray-600 mt-1">
          {visiblePesananLines.map((line, index) => (
            <span key={`${line}-${index}`} className="block">
              {line}
            </span>
          ))}
          {shouldCollapsePesanan && !showAllPesanan && (
            <button
              type="button"
              onClick={() => setShowAllPesanan(true)}
              className="mt-1 block text-navy italic"
            >
              Tampilkan Semua...
            </button>
          )}
          {shouldCollapsePesanan && showAllPesanan && (
            <button
              type="button"
              onClick={() => setShowAllPesanan(false)}
              className="mt-1 block text-navy italic"
            >
              Sembunyikan
            </button>
          )}
        </div>
      )}
      {detail && (
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          {expanded || !canExpand ? detail : preview}
        </p>
      )}
      {canExpand && (
        <button onClick={onToggle} className="text-xs text-navy font-semibold mt-2">
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function AttendanceStatus({ status }) {
  const state = status?.status;

  if (state === 'sudah_masuk') {
    return (
      <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-accent rounded-full shrink-0" />
          <p className="text-sm font-semibold text-gray-800">Sudah Clock In</p>
        </div>
        <div className="ml-6 text-xs text-gray-500">
          <span>Masuk </span>
          <span className="font-semibold text-gray-700">{extractTime(status.jam_masuk)}</span>
        </div>
      </div>
    );
  }

  if (state === 'sudah_keluar') {
    return (
      <div className="bg-success/10 border border-success/20 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-success rounded-full shrink-0" />
          <p className="text-sm font-semibold text-gray-800">Sudah Clock Out</p>
        </div>
        <div className="ml-6 flex gap-5 text-xs text-gray-500">
          <div>
            <span>Masuk </span>
            <span className="font-semibold text-gray-700">{extractTime(status.jam_masuk)}</span>
          </div>
          <div>
            <span>Keluar </span>
            <span className="font-semibold text-gray-700">{extractTime(status.jam_keluar)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-center gap-3">
      <div className="w-3 h-3 bg-warning rounded-full shrink-0" />
      <p className="text-sm text-gray-700">Belum clock in hari ini</p>
    </div>
  );
}

function getStatusLabel(status) {
  if (status?.status === 'sudah_masuk') return 'Aktif';
  if (status?.status === 'sudah_keluar') return 'Selesai';
  return 'Belum masuk';
}

function extractTime(dateTimeStr) {
  if (!dateTimeStr) return '-';
  const parts = String(dateTimeStr).split(' ');
  if (parts.length >= 2) return parts[1].substring(0, 5);
  return dateTimeStr;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="border border-gray-100 rounded-2xl p-4">
          <div className="h-4 w-32 bg-gray-100 rounded mb-3 animate-pulse" />
          <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ))}
    </div>
  );
}
