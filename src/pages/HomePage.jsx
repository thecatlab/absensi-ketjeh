import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import EmployeeSelect from '../components/EmployeeSelect'
import { cekStatusHariIni, getPengaturan } from '../api/client'

export default function HomePage({ employees, selectedEmployee, onSelectEmployee, loading }) {
  const [clockStatus, setClockStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [settings, setSettings] = useState({ shift_mulai: '08:00', shift_selesai: '17:00' })

  // Fetch settings on mount
  useEffect(() => {
    getPengaturan().then(res => {
      if (res.success) setSettings(res.data)
    })
  }, [])

  // Fetch clock status when employee is selected
  useEffect(() => {
    if (!selectedEmployee) {
      setClockStatus(null)
      return
    }
    setStatusLoading(true)
    cekStatusHariIni(selectedEmployee.id)
      .then(res => {
        if (res.success) setClockStatus(res)
      })
      .finally(() => setStatusLoading(false))
  }, [selectedEmployee])

  const todayStr = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="px-5 py-6">
      {/* Employee Selection */}
      <div className="mb-5">
        <label className="text-xs font-medium text-gray-500 mb-2 block">Pilih Karyawan</label>
        {loading ? (
          <div className="bg-gray-100 rounded-xl h-12 animate-pulse" />
        ) : (
          <EmployeeSelect
            employees={employees}
            selected={selectedEmployee}
            onSelect={onSelectEmployee}
          />
        )}
      </div>

      {/* Date Display */}
      <p className="text-xs text-gray-400 mb-4 capitalize">{todayStr}</p>

      {/* Shift Info Card */}
      <div className="bg-navy/5 rounded-2xl p-5 mb-5">
        <p className="text-xs text-gray-500 mb-1">Jadwal Shift Hari Ini</p>
        <p className="text-2xl font-bold text-navy">
          {settings.shift_mulai} - {settings.shift_selesai}
        </p>
      </div>

      {/* Clock Button */}
      {selectedEmployee && (
        <ClockButton status={clockStatus} loading={statusLoading} />
      )}

      {/* Today's Status */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Hari Ini</h3>
        {!selectedEmployee ? (
          <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
            Pilih nama karyawan untuk melihat status
          </div>
        ) : statusLoading ? (
          <div className="bg-gray-50 rounded-xl p-4 animate-pulse h-20" />
        ) : (
          <StatusCard status={clockStatus} />
        )}
      </div>
    </div>
  )
}

function ClockButton({ status, loading }) {
  const navigate = useNavigate()

  if (loading) {
    return <div className="w-full h-14 bg-gray-200 rounded-2xl animate-pulse mb-1" />
  }

  const s = status?.status
  const isClockIn = s === 'belum_masuk'
  const isDone = s === 'sudah_keluar'

  if (isDone) {
    return (
      <div className="w-full bg-gray-100 text-gray-400 py-4 rounded-2xl text-center text-lg font-semibold">
        Sudah Selesai Hari Ini
      </div>
    )
  }

  return (
    <button
      onClick={() => navigate(isClockIn ? '/clock-in' : '/clock-out')}
      className={`w-full py-4 rounded-2xl text-lg font-semibold transition-colors ${
        isClockIn
          ? 'bg-success text-white active:bg-green-600'
          : 'bg-danger text-white active:bg-red-600'
      }`}
    >
      {isClockIn ? 'Clock In' : 'Clock Out'}
    </button>
  )
}

function StatusCard({ status }) {
  const s = status?.status

  if (s === 'belum_masuk') {
    return (
      <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-center gap-3">
        <div className="w-3 h-3 bg-warning rounded-full shrink-0" />
        <p className="text-sm text-gray-700">Belum absen hari ini</p>
      </div>
    )
  }

  if (s === 'sudah_masuk') {
    const time = extractTime(status.jam_masuk)
    return (
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-accent rounded-full shrink-0" />
          <p className="text-sm font-medium text-gray-700">Sudah Clock In</p>
        </div>
        <div className="ml-6 flex gap-6 text-xs text-gray-500">
          <div>
            <p className="text-gray-400">Masuk</p>
            <p className="font-semibold text-gray-700">{time}</p>
          </div>
          <div>
            <p className="text-gray-400">Keluar</p>
            <p className="font-semibold text-gray-400">-</p>
          </div>
        </div>
      </div>
    )
  }

  if (s === 'sudah_keluar') {
    const masuk = extractTime(status.jam_masuk)
    const keluar = extractTime(status.jam_keluar)
    return (
      <div className="bg-success/10 border border-success/30 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-success rounded-full shrink-0" />
          <p className="text-sm font-medium text-gray-700">Sudah Selesai</p>
        </div>
        <div className="ml-6 flex gap-6 text-xs text-gray-500">
          <div>
            <p className="text-gray-400">Masuk</p>
            <p className="font-semibold text-gray-700">{masuk}</p>
          </div>
          <div>
            <p className="text-gray-400">Keluar</p>
            <p className="font-semibold text-gray-700">{keluar}</p>
          </div>
          {status.durasi_jam && (
            <div>
              <p className="text-gray-400">Durasi</p>
              <p className="font-semibold text-gray-700">{status.durasi_jam} jam</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

function extractTime(dateTimeStr) {
  if (!dateTimeStr) return '-'
  const parts = String(dateTimeStr).split(' ')
  if (parts.length >= 2) {
    return parts[1].substring(0, 5) // HH:mm
  }
  return dateTimeStr
}
