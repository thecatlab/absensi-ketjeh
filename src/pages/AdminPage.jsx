import { useState, useEffect } from 'react';
import AdminLogin from '../components/AdminLogin';
import AdminLayout from './admin/AdminLayout';

export default function AdminPage() {
  const [session, setSession] = useState(null);

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('admin_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.expiry > Date.now()) {
          setSession(parsed);
        } else {
          localStorage.removeItem('admin_session');
        }
      } catch {
        localStorage.removeItem('admin_session');
      }
    }
  }, []);

  function handleLogin(role, password) {
    setSession({ role, password, expiry: Date.now() + 8 * 60 * 60 * 1000 });
  }

  function handleLogout() {
    setSession(null);
    localStorage.removeItem('admin_session');
  }

  if (!session) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminLayout role={session.role} password={session.password} onLogout={handleLogout} />;
}
