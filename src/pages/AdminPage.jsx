import { useState, useEffect } from 'react';
import { setAdminCredential, seedDashboard } from '../api/client';
import AdminLogin from '../components/AdminLogin';
import AdminLayout from './admin/AdminLayout';

export default function AdminPage() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    localStorage.removeItem('admin_session');
    const onExpired = event => { if (event.detail.scope === 'admin') setSession(null); };
    window.addEventListener('ketjeh-auth-expired', onExpired);
    return () => { setAdminCredential(''); window.removeEventListener('ketjeh-auth-expired', onExpired); };
  }, []);

  function handleLogin(role, password, dashboard) {
    setAdminCredential(password);
    if (dashboard) seedDashboard(dashboard);
    setSession({ role, password });
  }

  function handleLogout() {
    setAdminCredential('');
    setSession(null);
  }

  if (!session) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminLayout role={session.role} password={session.password} onLogout={handleLogout} />;
}
