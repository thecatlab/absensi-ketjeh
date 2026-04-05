import { useState, useRef, useEffect } from 'react';

export default function EmployeeSelect({ employees, selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const filtered = employees.filter(e =>
    e.nama.toLowerCase().includes(query.toLowerCase()) ||
    e.jabatan.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(emp) {
    onSelect(emp);
    setQuery('');
    setIsOpen(false);
  }

  function handleClear() {
    onSelect(null);
    setQuery('');
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-navy/5 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center text-white font-bold text-sm">
            {selected.nama.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{selected.nama}</p>
            <p className="text-xs text-gray-500">{selected.jabatan} • {selected.kategori === 'on-site' ? 'On-site' : 'Mobile'}</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label="Ganti karyawan"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Cari nama karyawan..."
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 bg-white"
        />
      </div>

      {isOpen && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">Tidak ditemukan</p>
          ) : (
            filtered.map(emp => (
              <button
                key={emp.id}
                onClick={() => handleSelect(emp)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left border-b border-gray-100 last:border-b-0"
              >
                <div className="w-8 h-8 bg-navy/10 rounded-full flex items-center justify-center text-navy font-bold text-xs">
                  {emp.nama.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{emp.nama}</p>
                  <p className="text-xs text-gray-500">{emp.jabatan}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
