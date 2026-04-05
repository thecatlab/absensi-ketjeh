import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import HistoryPage from './pages/HistoryPage'
import AdminPage from './pages/AdminPage'
import ClockPage from './pages/ClockPage'
import InstallPrompt from './components/InstallPrompt'
import { getKaryawan } from './api/client'

function App() {
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    getKaryawan()
      .then(res => {
        if (res.success) setEmployees(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const isClockPage = location.pathname.startsWith('/clock')

  return (
    <>
      {!isClockPage && <Header employee={selectedEmployee} />}
      {!isClockPage && <InstallPrompt />}
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={
            <HomePage
              employees={employees}
              selectedEmployee={selectedEmployee}
              onSelectEmployee={setSelectedEmployee}
              loading={loading}
            />
          } />
          <Route path="/clock-in" element={
            selectedEmployee
              ? <ClockPage employee={selectedEmployee} mode="in" />
              : <Navigate to="/" replace />
          } />
          <Route path="/clock-out" element={
            selectedEmployee
              ? <ClockPage employee={selectedEmployee} mode="out" />
              : <Navigate to="/" replace />
          } />
          <Route path="/history" element={
            <HistoryPage
              selectedEmployee={selectedEmployee}
              employees={employees}
              onSelectEmployee={setSelectedEmployee}
            />
          } />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isClockPage && <BottomNav />}
    </>
  )
}

export default App
