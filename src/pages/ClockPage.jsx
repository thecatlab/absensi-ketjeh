import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Camera from '../components/Camera';
import LocationStatus from '../components/LocationStatus';
import { getCurrentPosition } from '../utils/gps';
import { getNowTimeString } from '../utils/dateHelpers';
import { clockIn, clockOut } from '../api/client';
import { CONFIG } from '../config';

export default function ClockPage({ employee, mode }) {
  const navigate = useNavigate();
  const isClockIn = mode === 'in';

  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [pin, setPin] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch GPS on mount
  useEffect(() => {
    getCurrentPosition()
      .then(pos => setLocation(pos))
      .catch(err => setLocation({ error: err.message, lat: null, lng: null }));
  }, []);

  const canSubmit = photo && pin.length >= 4 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    const data = {
      karyawan_id: employee.id,
      nama: employee.nama,
      lat: location?.lat || null,
      lng: location?.lng || null,
      foto_base64: photo,
      pin,
      catatan: catatan || undefined,
    };

    try {
      const res = isClockIn ? await clockIn(data) : await clockOut(data);
      if (res.error) {
        setError(res.error);
        setSubmitting(false);
      } else {
        setResult(res);
      }
    } catch (err) {
      setError('Gagal mengirim data. Coba lagi.');
      setSubmitting(false);
    }
  }

  // Success screen
  if (result) {
    return (
      <SuccessScreen
        isClockIn={isClockIn}
        employee={employee}
        result={result}
        onDone={() => navigate('/')}
      />
    );
  }

  return (
    <div className="px-5 py-6">
      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-navy">
          {isClockIn ? 'Clock In' : 'Clock Out'}
        </h2>
      </div>

      {/* Employee info */}
      <div className="flex items-center gap-3 mb-5 bg-navy/5 rounded-xl px-4 py-3">
        <div className="w-9 h-9 bg-navy rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
          {employee.nama.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{employee.nama}</p>
          <p className="text-xs text-gray-500">{employee.jabatan}</p>
        </div>
      </div>

      {/* Camera */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-2 block">Foto Selfie</label>
        <Camera onCapture={setPhoto} />
      </div>

      {/* Location */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-2 block">Lokasi</label>
        <LocationStatus location={location} />
      </div>

      {/* PIN */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-2 block">PIN Verifikasi</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="Masukkan PIN (4-6 digit)"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-center tracking-widest focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30"
        />
      </div>

      {/* Notes (optional) */}
      <div className="mb-5">
        <label className="text-xs font-medium text-gray-500 mb-2 block">Catatan (opsional)</label>
        <input
          type="text"
          placeholder="Contoh: Beli bahan di pasar"
          value={catatan}
          onChange={e => setCatatan(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-4 rounded-2xl text-lg font-semibold transition-colors ${
          !canSubmit
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : isClockIn
              ? 'bg-success text-white active:bg-green-600'
              : 'bg-danger text-white active:bg-red-600'
        }`}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Mengirim...
          </span>
        ) : (
          isClockIn ? 'Kirim Clock In' : 'Kirim Clock Out'
        )}
      </button>
    </div>
  );
}

function SuccessScreen({ isClockIn, employee, result, onDone }) {
  const [countdown, setCountdown] = useState(CONFIG.AUTO_RESET_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <div className="px-5 py-10 text-center">
      {/* Checkmark */}
      <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 ${
        isClockIn ? 'bg-success/10' : 'bg-danger/10'
      }`}>
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-10 h-10 ${isClockIn ? 'text-success' : 'text-danger'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-gray-800 mb-1">
        {isClockIn ? 'Clock In Berhasil!' : 'Clock Out Berhasil!'}
      </h2>
      <p className="text-sm text-gray-500 mb-6">{employee.nama}</p>

      {/* Details */}
      <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left space-y-3">
        {result.jam_masuk && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Jam Masuk</span>
            <span className="font-semibold text-gray-700">{formatResultTime(result.jam_masuk)}</span>
          </div>
        )}
        {result.jam_keluar && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Jam Keluar</span>
            <span className="font-semibold text-gray-700">{formatResultTime(result.jam_keluar)}</span>
          </div>
        )}
        {result.durasi_jam && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Durasi</span>
            <span className="font-semibold text-gray-700">{result.durasi_jam} jam</span>
          </div>
        )}
        {result.status_lokasi && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Lokasi</span>
            <span className="font-semibold text-gray-700">{result.status_lokasi}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">Kembali otomatis dalam {countdown} detik</p>

      <button
        onClick={onDone}
        className="text-navy font-semibold text-sm"
      >
        Kembali Sekarang
      </button>
    </div>
  );
}

function formatResultTime(str) {
  if (!str) return '-';
  const parts = String(str).split(' ');
  if (parts.length >= 2) return parts[1].substring(0, 5);
  return str;
}
