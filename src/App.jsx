import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import HistoryPage from './pages/HistoryPage'
import ReservasiPanelPage from './pages/ReservasiPanelPage'
import AdminPage from './pages/AdminPage'
import ClockPage from './pages/ClockPage'
import InstallPrompt from './components/InstallPrompt'
import { setEmployeeCredential, seedDashboard } from './api/client'
import { useBootstrap, useReadClock } from './api/useRead'
import ReadNotice from './components/ReadNotice'

const DASHBOARD_SESSION_KEY = 'employee_dashboard_session'

function getTodayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

function readDashboardSession() {
  try {
    const stored = localStorage.getItem(DASHBOARD_SESSION_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (parsed.date !== getTodayKey() || !parsed.employeeId) {
      localStorage.removeItem(DASHBOARD_SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(DASHBOARD_SESSION_KEY)
    return null
  }
}

function App() {
  const bootstrap = useBootstrap()
  useReadClock()
  const employees = bootstrap.data?.data.employees || []
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => readDashboardSession()?.employeeId)
  const selectedEmployee = employees.find(employee => String(employee.id) === String(selectedEmployeeId)) || null
  const [dashboardSession, setDashboardSession] = useState(() => readDashboardSession())
  const [verifiedAccess, setVerifiedAccess] = useState(null)
  const loading = bootstrap.loading
  const location = useLocation()

  useEffect(() => {
    const onExpired = event => {
      if (!event.detail.scope.startsWith('employee:')) return
      localStorage.removeItem(DASHBOARD_SESSION_KEY)
      setDashboardSession(null)
      setVerifiedAccess(null)
    }
    window.addEventListener('ketjeh-auth-expired', onExpired)
    return () => window.removeEventListener('ketjeh-auth-expired', onExpired)
  }, [])

  const isClockPage = location.pathname.startsWith('/clock')
  const shouldHideChrome = isClockPage

  function handleSelectEmployee(employee) {
    setEmployeeCredential(null, null);
    setSelectedEmployeeId(employee?.id)
    localStorage.removeItem(DASHBOARD_SESSION_KEY)
    setDashboardSession(null)
    setVerifiedAccess(null)
  }

  function startDashboardSession(employee, pin, dashboard) {
    setEmployeeCredential(employee.id, pin);
    if (dashboard) seedDashboard(dashboard, employee.id)
    const session = {
      employeeId: employee.id,
      role: employee.jabatan || '',
      name: employee.nama || '',
      date: getTodayKey(),
    }
    localStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(session))
    setDashboardSession(session)
    setSelectedEmployeeId(employee.id)
    setVerifiedAccess({ employeeId: employee.id, pin })
  }

  function handleClockInSuccess(employee, pin) {
    startDashboardSession(employee, pin || verifiedPin)
  }

  function handleClockOutSuccess() {
    setEmployeeCredential(null, null);
    localStorage.removeItem(DASHBOARD_SESSION_KEY)
    setDashboardSession(null)
    setVerifiedAccess(null)
  }

  const sessionEmployee = dashboardSession?.employeeId
    ? employees.find(emp => String(emp.id) === String(dashboardSession.employeeId))
    : null
  const dashboardEmployee = sessionEmployee || selectedEmployee
  const verifiedPin =
    verifiedAccess && dashboardEmployee && String(verifiedAccess.employeeId) === String(dashboardEmployee.id)
      ? verifiedAccess.pin
      : ''

  return (
    <>
      {!shouldHideChrome && <Header employee={selectedEmployee} />}
      {!shouldHideChrome && <InstallPrompt />}
      <main className="flex-1 overflow-y-auto pb-20">
        <ReadNotice query={bootstrap} />
        <Routes>
          <Route path="/" element={
            <HomePage
              employees={employees}
              selectedEmployee={selectedEmployee}
              onSelectEmployee={handleSelectEmployee}
              verifiedAccess={verifiedAccess}
              onPinVerified={startDashboardSession}
              loading={loading}
            />
          } />
          <Route path="/clock-in" element={
            selectedEmployee
              ? <ClockPage employee={selectedEmployee} mode="in" verifiedPin={verifiedPin} onClockInSuccess={handleClockInSuccess} />
              : <Navigate to="/" replace />
          } />
          <Route path="/clock-out" element={
            dashboardEmployee
              ? <ClockPage employee={dashboardEmployee} mode="out" verifiedPin={verifiedPin} onClockOutSuccess={handleClockOutSuccess} />
              : <Navigate to="/" replace />
          } />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/history" element={
            <HistoryPage
              selectedEmployee={selectedEmployee}
              employees={employees}
              onSelectEmployee={handleSelectEmployee}
              verifiedAccess={verifiedAccess}
              onPinVerified={startDashboardSession}
            />
          } />
          <Route path="/reservasi" element={
            <ReservasiPanelPage
              selectedEmployee={selectedEmployee}
              verifiedAccess={verifiedAccess}
            />
          } />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!shouldHideChrome && <BottomNav employee={selectedEmployee} />}
    </>
  )
}

export default App
