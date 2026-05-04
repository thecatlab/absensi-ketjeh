import { useState, useEffect } from 'react'
import EmployeeSelect from '../components/EmployeeSelect'
import EmployeeDashboardPage from './EmployeeDashboardPage'
import { getPengaturan, verifyEmployeePin } from '../api/client'

export default function HomePage({ employees, selectedEmployee, onSelectEmployee, verifiedAccess, onPinVerified, loading }) {
  const [settings, setSettings] = useState({ shift_mulai: '08:00', shift_selesai: '17:00' })

  // Fetch settings on mount
  useEffect(() => {
    getPengaturan().then(res => {
      if (res.success) setSettings(res.data)
    })
  }, [])

  const isVerified = selectedEmployee && verifiedAccess?.employeeId === selectedEmployee.id

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

      {selectedEmployee && !isVerified && (
        <PinGate employee={selectedEmployee} onVerified={onPinVerified} />
      )}

      {selectedEmployee && isVerified && (
        <EmployeeDashboardPage employee={selectedEmployee} embedded />
      )}

      {!selectedEmployee && (
        <>
      {/* Shift Info Card */}
      <div className="bg-navy/5 rounded-2xl p-5 mb-5 text-center">
        <p className="text-xs text-gray-500 mb-1">Jadwal Shift Hari Ini</p>
        <p className="text-2xl font-bold text-navy">
          {settings.shift_mulai} - {settings.shift_selesai}
        </p>
      </div>

      {/* Today's Status */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Hari Ini</h3>
        <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
          Pilih nama karyawan untuk masuk ke dashboard staff
        </div>
      </div>
        </>
      )}
    </div>
  )
}

function PinGate({ employee, onVerified }) {
  const [pin, setPin] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (pin.length < 4 || checking) return
    setChecking(true)
    setError(null)
    const res = await verifyEmployeePin(employee.id, pin)
    setChecking(false)
    if (res.error) {
      setError(res.error)
      return
    }
    if (!res.verified) {
      setError('PIN salah')
      return
    }
    onVerified(employee, pin)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-navy/5 rounded-2xl p-5 mb-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Masukkan PIN</h2>
      <p className="text-xs text-gray-500 mb-4">Verifikasi PIN untuk membuka dashboard dan akses clock in/out.</p>
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="PIN 4-6 digit"
        value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-center tracking-widest focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 bg-white"
      />
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
      <button
        type="submit"
        disabled={pin.length < 4 || checking}
        className={`w-full mt-4 py-3 rounded-xl text-sm font-semibold ${
          pin.length >= 4 && !checking
            ? 'bg-navy text-white active:bg-navy-dark'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {checking ? 'Memeriksa...' : 'Buka Dashboard'}
      </button>
    </form>
  )
}
