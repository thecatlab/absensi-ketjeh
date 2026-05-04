import { useCallback, useEffect, useState } from 'react';
import { addReservasi, deleteReservasi, getReservasiAdmin, updateReservasi } from '../../api/client';

export default function ReservasiPage({ adminPassword, canManage = true, startFormOpen = true }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [items, setItems] = useState([]);
  const [viewMode, setViewMode] = useState('calendar');
  const [showForm, setShowForm] = useState(startFormOpen);
  const [selectedDate, setSelectedDate] = useState(today);
  const [archiveDate, setArchiveDate] = useState('');
  const [listDate, setListDate] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    tanggal: today,
    jam: '',
    nama_pelanggan: '',
    area: '',
    pesanan: '',
    keterangan: '',
    status: 'confirmed',
  });

  const loadItems = useCallback(() => {
    setLoading(true);
    getReservasiAdmin()
      .then(res => { if (res.success) setItems(res.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadItems, 0);
    return () => clearTimeout(timer);
  }, [loadItems]);

  function showMessage(text, isError = false) {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 3000);
  }

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canManage) return;
    if (!form.tanggal || !form.jam || !form.nama_pelanggan.trim()) return;
    setSaving(true);
    const res = editingId
      ? await updateReservasi(editingId, form, adminPassword)
      : await addReservasi(form, adminPassword);
    setSaving(false);
    if (res.error) {
      showMessage(res.error, true);
    } else {
      showMessage(editingId ? 'Reservasi diperbarui' : 'Reservasi ditambahkan');
      resetForm();
      setShowForm(startFormOpen);
      loadItems();
    }
  }

  function handleEdit(item) {
    if (!canManage) return;
    setShowForm(true);
    setEditingId(item.id);
    setForm({
      tanggal: item.tanggal || today,
      jam: item.jam || '',
      nama_pelanggan: item.nama_pelanggan || '',
      area: item.area || '',
      pesanan: item.pesanan || '',
      keterangan: item.keterangan || '',
      status: item.status || 'confirmed',
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ tanggal: today, jam: '', nama_pelanggan: '', area: '', pesanan: '', keterangan: '', status: 'confirmed' });
  }

  async function handleDelete(id) {
    if (!canManage) return;
    if (!confirm('Hapus reservasi ini?')) return;
    const res = await deleteReservasi(id, adminPassword);
    if (res.error) showMessage(res.error, true);
    else { showMessage('Reservasi dihapus'); loadItems(); }
  }

  const sorted = [...items].sort((a, b) => String(b.tanggal + b.jam).localeCompare(String(a.tanggal + a.jam)));
  const activeReservations = sorted.filter(item => String(item.tanggal) >= today);
  const archivedReservations = sorted.filter(item => String(item.tanggal) < today);
  const filteredActiveReservations = activeReservations.filter(item => {
    const matchesDate = !listDate || String(item.tanggal) === listDate;
    const haystack = `${item.nama_pelanggan || ''} ${item.area || ''} ${item.pesanan || ''} ${item.keterangan || ''}`.toLowerCase();
    const matchesSearch = !listSearch.trim() || haystack.includes(listSearch.trim().toLowerCase());
    return matchesDate && matchesSearch;
  });
  const filteredArchiveReservations = archiveDate
    ? archivedReservations.filter(item => String(item.tanggal) === archiveDate)
    : archivedReservations;
  const visibleItems = viewMode === 'archive' ? filteredArchiveReservations : filteredActiveReservations;
  const calendarItems = sorted;

  return (
    <div>
      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
          message.isError ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
        }`}>
          {message.text}
        </div>
      )}

      {canManage && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full mb-5 py-3 rounded-xl text-sm font-semibold bg-navy text-white"
        >
          + Tambahkan Reservasi
        </button>
      )}

      {canManage && showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.tanggal} onChange={e => update('tanggal', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy" />
            <input type="time" value={form.jam} onChange={e => update('jam', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy" />
          </div>
          <input type="text" value={form.nama_pelanggan} onChange={e => update('nama_pelanggan', e.target.value)} placeholder="Nama Pelanggan" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy" />
          <input type="text" value={form.area} onChange={e => update('area', e.target.value)} placeholder="Area / Meja" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy" />
          <textarea value={form.pesanan} onChange={e => update('pesanan', e.target.value)} placeholder="Pesanan" rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy resize-none" />
          <input type="text" value={form.keterangan} onChange={e => update('keterangan', e.target.value)} placeholder="DP / Keterangan / Permintaan Khusus" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy" />
          <button type="submit" disabled={saving || !form.tanggal || !form.jam || !form.nama_pelanggan.trim()} className={`w-full py-3 rounded-xl text-sm font-semibold ${
            saving || !form.tanggal || !form.jam || !form.nama_pelanggan.trim()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-navy text-white'
          }`}>
            {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : '+ Tambah Reservasi'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { resetForm(); setShowForm(startFormOpen); }} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-500">
              Batal Edit
            </button>
          )}
          {!editingId && !startFormOpen && (
            <button type="button" onClick={() => setShowForm(false)} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-500">
              Tutup Form
            </button>
          )}
        </form>
      )}

      <div className="flex items-center justify-between mb-3 text-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewMode('calendar')}
            className={`font-medium ${viewMode === 'calendar' ? 'text-navy' : 'text-gray-400'}`}
          >
            Kalender
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`font-medium ${viewMode === 'list' ? 'text-navy' : 'text-gray-400'}`}
          >
            Daftar Reservasi
          </button>
        </div>
        <button
          onClick={() => setViewMode('archive')}
          className={`font-medium ${viewMode === 'archive' ? 'text-navy' : 'text-gray-400'}`}
        >
          Arsip
        </button>
      </div>

      {loading ? (
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
      ) : viewMode === 'calendar' ? (
        <CalendarView items={calendarItems} selectedDate={selectedDate} onSelectDate={setSelectedDate} onDelete={handleDelete} onEdit={handleEdit} canManage={canManage} />
      ) : (
        <div className="space-y-3">
          {viewMode === 'list' && (
            <div className="space-y-2">
              <input
                type="date"
                value={listDate}
                onChange={e => setListDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
              />
              <input
                type="text"
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Cari pelanggan, area, pesanan, atau keterangan"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
              />
              {(listDate || listSearch) && (
                <button onClick={() => { setListDate(''); setListSearch(''); }} className="text-xs font-medium text-navy">
                  Reset filter
                </button>
              )}
            </div>
          )}

          {viewMode === 'archive' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Filter tanggal arsip</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={archiveDate}
                  onChange={e => setArchiveDate(e.target.value)}
                  className="min-w-0 flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy"
                />
                {archiveDate && (
                  <button onClick={() => setArchiveDate('')} className="px-3 py-2.5 rounded-xl bg-gray-100 text-xs font-medium text-gray-500">
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {visibleItems.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">Belum ada reservasi.</div>
          ) : (
            <div className="space-y-2">
              {visibleItems.map(item => <ReservationCard key={item.id} item={item} onDelete={handleDelete} onEdit={handleEdit} canManage={canManage} />)}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function ReservationCard({ item, onDelete, onEdit, canManage = true }) {
  const [showAllPesanan, setShowAllPesanan] = useState(false);
  const pesananLines = splitPesananLines(item.pesanan);
  const shouldCollapsePesanan = pesananLines.length > 3;
  const visiblePesananLines = shouldCollapsePesanan && !showAllPesanan
    ? pesananLines.slice(0, 3)
    : pesananLines;

  return (
    <div className="border border-gray-100 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{item.nama_pelanggan}</p>
          <p className="text-xs text-gray-400">
            {formatDateIndonesian(item.tanggal)} · {item.jam}
            {item.area ? <span className="italic"> · {item.area}</span> : null}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button onClick={() => onEdit(item)} className="text-xs text-navy font-medium">Edit</button>
            <button onClick={() => onDelete(item.id)} className="text-xs text-danger font-medium">Hapus</button>
          </div>
        )}
      </div>
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
              className="mt-1 text-navy italic"
            >
              Sembunyikan
            </button>
          )}
        </div>
      )}
      {item.keterangan && <p className="text-xs text-gray-400 mt-1">{item.keterangan}</p>}
    </div>
  );
}

function splitPesananLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function CalendarView({ items, selectedDate, onSelectDate, onDelete, onEdit, canManage = true }) {
  const selected = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let day = 1; day <= monthEnd.getDate(); day++) {
    days.push(new Date(selected.getFullYear(), selected.getMonth(), day));
  }

  const countByDate = items.reduce((acc, item) => {
    acc[item.tanggal] = (acc[item.tanggal] || 0) + 1;
    return acc;
  }, {});
  const selectedItems = items
    .filter(item => String(item.tanggal) === String(selectedDate))
    .sort((a, b) => String(a.jam).localeCompare(String(b.jam)));

  return (
    <div className="space-y-3">
      <div className="border border-gray-100 rounded-xl p-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => onSelectDate(shiftMonth(selectedDate, -1))} className="text-sm text-navy font-semibold">Sebelumnya</button>
          <p className="text-sm font-semibold text-gray-800">
            {selected.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </p>
          <button onClick={() => onSelectDate(shiftMonth(selectedDate, 1))} className="text-sm text-navy font-semibold">Berikutnya</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => <span key={day}>{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            const dateKey = date ? toDateKey(date) : '';
            const count = countByDate[dateKey] || 0;
            const selectedDay = dateKey === selectedDate;
            return (
              <button
                key={dateKey || `blank-${index}`}
                type="button"
                disabled={!date}
                onClick={() => onSelectDate(dateKey)}
                className={`aspect-square rounded-lg text-xs ${selectedDay ? 'bg-navy text-white' : count ? 'bg-accent/10 text-navy' : 'bg-gray-50 text-gray-400'}`}
              >
                {date && (
                  <span className="flex h-full flex-col items-center justify-center">
                    <span>{date.getDate()}</span>
                    {count > 0 && <span className="text-[10px] leading-none">{count}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedItems.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">Tidak ada reservasi di tanggal ini.</div>
      ) : (
        <div className="space-y-2">
          {selectedItems.map(item => <ReservationCard key={item.id} item={item} onDelete={onDelete} onEdit={onEdit} canManage={canManage} />)}
        </div>
      )}
    </div>
  );
}

function shiftMonth(dateKey, direction) {
  const current = new Date(`${dateKey}T00:00:00`);
  return toDateKey(new Date(current.getFullYear(), current.getMonth() + direction, 1));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateIndonesian(dateKey) {
  if (!dateKey) return '-';
  return new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}
