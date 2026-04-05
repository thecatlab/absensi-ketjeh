import { useState, useRef, useEffect, useCallback } from 'react';
import { CONFIG } from '../config';

export default function Camera({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: CONFIG.PHOTO_MAX_WIDTH }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Izin kamera ditolak. Aktifkan kamera di pengaturan browser.');
      } else if (err.name === 'NotFoundError') {
        setError('Kamera tidak ditemukan.');
      } else {
        setError('Gagal membuka kamera: ' + err.message);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Scale down to max width
    const scale = Math.min(1, CONFIG.PHOTO_MAX_WIDTH / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext('2d');
    // Mirror horizontally for selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL('image/jpeg', CONFIG.PHOTO_QUALITY).split(',')[1];
    const dataUrl = canvas.toDataURL('image/jpeg', CONFIG.PHOTO_QUALITY);

    setPhoto(dataUrl);
    onCapture(base64);
    stopCamera();
  }

  function retake() {
    setPhoto(null);
    onCapture(null);
    startCamera();
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-sm text-red-600 mb-2">{error}</p>
        <button onClick={startCamera} className="text-sm text-navy font-semibold">Coba Lagi</button>
      </div>
    );
  }

  if (photo) {
    return (
      <div className="relative">
        <img src={photo} alt="Selfie" className="w-full rounded-xl" />
        <button
          onClick={retake}
          className="absolute bottom-3 right-3 bg-white/90 text-navy text-xs font-semibold px-3 py-2 rounded-lg shadow"
        >
          Ulangi Foto
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded-xl bg-gray-900"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />
      {cameraReady && (
        <button
          onClick={capture}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 bg-white rounded-full border-4 border-navy shadow-lg active:scale-95 transition-transform"
          aria-label="Ambil Foto"
        >
          <div className="w-10 h-10 bg-navy rounded-full mx-auto" />
        </button>
      )}
      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-xl">
          <p className="text-white text-sm">Membuka kamera...</p>
        </div>
      )}
    </div>
  );
}
