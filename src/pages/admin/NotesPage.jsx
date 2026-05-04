import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminNotes, addAdminNote, deleteAdminNote } from '../../api/client';

export default function NotesPage({ adminPassword, role }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const res = await getAdminNotes();
    if (res.success) setNotes(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadNotes, 0);
    return () => clearTimeout(timer);
  }, [loadNotes]);

  useEffect(() => {
    // Scroll to bottom when notes change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes]);

  async function handleSend(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    const res = await addAdminNote({
      pesan: message.trim(),
      pengirim: role,
    }, adminPassword);
    if (res.success) {
      setMessage('');
      loadNotes();
    }
    setSending(false);
  }

  async function handleDelete(noteId) {
    if (!confirm('Hapus catatan ini?')) return;
    const res = await deleteAdminNote(noteId, adminPassword);
    if (res.success) loadNotes();
  }

  // Group notes by date
  const grouped = {};
  notes.forEach(n => {
    const dateKey = n.tanggal || 'unknown';
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(n);
  });
  const dateKeys = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>
      {/* Header */}
      <div className="mb-3">
        <p className="text-xs text-gray-400">
          Catatan internal untuk admin dan manager. Semua yang memiliki akses admin dapat melihat catatan ini.
        </p>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-3 pb-2">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
            Belum ada catatan. Mulai tulis catatan pertama!
          </div>
        ) : (
          dateKeys.map(dateKey => (
            <div key={dateKey}>
              <DateDivider date={dateKey} />
              <div className="space-y-2">
                {grouped[dateKey].map(note => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    currentRole={role}
                    onDelete={() => handleDelete(note.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-gray-100">
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tulis catatan..."
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${
            message.trim() && !sending
              ? 'bg-navy text-white active:bg-navy-dark'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {sending ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}

function DateDivider({ date }) {
  const d = new Date(date + 'T00:00:00+07:00');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  let label;
  if (date === today) {
    label = 'Hari Ini';
  } else if (date === yesterdayStr) {
    label = 'Kemarin';
  } else {
    label = d.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
    });
  }

  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

function NoteItem({ note, currentRole, onDelete }) {
  const isOwn = note.pengirim === currentRole;
  const time = note.jam || '';
  const roleLabel = note.pengirim === 'admin' ? 'Admin' : 'Manager';
  const roleColor = note.pengirim === 'admin' ? 'bg-navy' : 'bg-accent';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isOwn ? 'order-1' : 'order-1'}`}>
        {/* Sender label */}
        {!isOwn && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[10px] text-white px-1.5 py-0.5 rounded ${roleColor}`}>{roleLabel}</span>
          </div>
        )}
        <div
          className={`relative group rounded-2xl px-4 py-2.5 text-sm ${
            isOwn
              ? 'bg-navy text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{note.pesan}</p>
          <div className={`flex items-center justify-end gap-2 mt-1 ${isOwn ? 'text-white/50' : 'text-gray-400'}`}>
            <span className="text-[10px]">{time}</span>
            {isOwn && (
              <button
                onClick={onDelete}
                className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-danger"
                title="Hapus"
              >
                hapus
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
