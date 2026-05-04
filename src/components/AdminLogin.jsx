import { useState } from 'react';
import { adminLogin } from '../api/client';

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    const res = await adminLogin(password);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.success) {
      onLogin(res.role, password);
    }
  }

  return (
    <div className="px-5 py-10">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-navy/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-navy">Admin Login</h2>
        <p className="text-sm text-gray-500 mt-1">Masukkan password untuk mengakses dashboard</p>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Password admin"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 mb-4"
          autoFocus
        />

        {error && (
          <p className="text-sm text-danger text-center mb-4">{error}</p>
        )}

        <button
          type="submit"
          disabled={!password || loading}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
            !password || loading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-navy text-white active:bg-navy-dark'
          }`}
        >
          {loading ? 'Memverifikasi...' : 'Masuk'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-6">
        Hubungi admin jika lupa password
      </p>
    </div>
  );
}
