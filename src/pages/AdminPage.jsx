import { useState, useEffect } from 'react';
import AdminLogin from '../components/AdminLogin';
import AdminLayout from './admin/AdminLayout';

export default function AdminPage() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    localStorage.removeItem('admin_session');
  }, []);

  function handleLogin(role, password) {
    setSession({ role, password });
  }

  function handleLogout() {
    setSession(null);
  }

  if (!session) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminLayout role={session.role} password={session.password} onLogout={handleLogout} />;
}
