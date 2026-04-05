import { useState, useEffect } from 'react'
import EmployeeSelect from '../components/EmployeeSelect'
import Modal from '../components/Modal'
import { getAbsensi } from '../api/client'

export default function HistoryPage({ selectedEmployee, employees, onSelectEmployee }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedEmployee) {
      setHistory([])
      return
    }
    setLoading(true)
    const today = new Date()
    const dari = new Date(today)
    dari.setDate(dari.getDate() - 30)
    const dariStr = dari.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    const sampaiStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    getAbsensi(dariStr, sampaiStr, selectedEmployee.id)
      .then(res => {
        if (res.success) setHistory(res.data)
      })
      .finally(() => setLoading(false))
  }, [selectedEmployee])

  return (
    <div className="px-5 py-6">
      <h2 className="text-xl font-bold text-navy mb-4">Riwayat Absensi</h2>

      {!selectedEmployee && (
        <div className="mb-5">
          <label className="text-xs font-medium text-gray-500 mb-2 block">Pilih Karyawan</label>
          <EmployeeSelect
            employees={employees}
            selected={selectedEmployee}
            onSelect={onSelectEmployee}
          />
        </div>
      )}

      {!selectedEmployee ? (
        <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
          Pilih nama karyawan untuk melihat riwayat
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-100 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
          Belum ada riwayat absensi
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(record => (
            <HistoryRow key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryRow({ record }) {
  const [showDetail, setShowDetail] = useState(false)
  const date = new Date(record.tanggal + 'T00:00:00+07:00')
  const dayName = date.toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' })
  const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

  const masuk = extractTime(record.jam_masuk)
  const keluar = extractTime(record.jam_keluar)
  const isOnSite = record.status_lokasi_masuk === 'On-site'

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="w-full text-left bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between active:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-center min-w-[40px]">
            <p className="text-xs text-gray-400">{dayName}</p>
            <p className="text-sm font-bold text-gray-700">{dateStr}</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="flex gap-4 text-xs">
            <div>
              <p className="text-gray-400">Masuk</p>
              <p className="font-semibold text-success">{masuk}</p>
            </div>
            <div>
              <p className="text-gray-400">Keluar</p>
              <p className="font-semibold text-danger">{keluar || '-'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isOnSite ? 'bg-success' : 'bg-warning'}`} />
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="Detail Absensi">
        <AttendanceDetail record={record} />
      </Modal>
    </>
  )
}

function AttendanceDetail({ record }) {
  const dateObj = new Date(record.tanggal + 'T00:00:00+07:00')
  const fullDate = dateObj.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  })
  const masuk = extractTime(record.jam_masuk)
  const keluar = extractTime(record.jam_keluar)
  const isOnSite = record.status_lokasi_masuk === 'On-site'

  return (
    <div className="space-y-4">
      {/* Date header */}
      <p className="text-sm text-gray-500 text-center">{fullDate}</p>

      {/* Clock In Section */}
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

        {/* Photo */}
        {record.foto_masuk_url ? (
          <div className="mb-3">
            <img
              src={record.foto_masuk_url}
              alt="Foto Masuk"
              className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-sm"
            />
          </div>
        ) : (
          <div className="mb-3 w-20 h-20 rounded-xl bg-gray-200 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
        )}

        {/* GPS Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnSite ? 'bg-success' : 'bg-warning'}`} />
          <span className={`text-xs font-medium ${isOnSite ? 'text-success' : 'text-warning'}`}>
            {record.status_lokasi_masuk || 'Tidak tersedia'}
          </span>
        </div>
      </div>

      {/* Clock Out Section */}
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

        {/* Photo */}
        {record.foto_keluar_url ? (
          <div className="mb-3">
            <img
              src={record.foto_keluar_url}
              alt="Foto Keluar"
              className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-sm"
            />
          </div>
        ) : (
          <div className="mb-3 w-20 h-20 rounded-xl bg-gray-200 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
        )}

        {/* GPS Status */}
        {record.status_lokasi_keluar && (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${record.status_lokasi_keluar === 'On-site' ? 'bg-success' : 'bg-warning'}`} />
            <span className={`text-xs font-medium ${record.status_lokasi_keluar === 'On-site' ? 'text-success' : 'text-warning'}`}>
              {record.status_lokasi_keluar}
            </span>
          </div>
        )}
      </div>

      {/* Duration */}
      {record.durasi_jam && (
        <div className="text-center text-sm text-gray-500">
          Durasi kerja: <span className="font-semibold text-gray-700">{record.durasi_jam} jam</span>
        </div>
      )}
    </div>
  )
}

function extractTime(dateTimeStr) {
  if (!dateTimeStr) return null
  const parts = String(dateTimeStr).split(' ')
  if (parts.length >= 2) return parts[1].substring(0, 5)
  return dateTimeStr
}
