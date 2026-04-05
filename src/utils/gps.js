import { CONFIG } from '../config';

/**
 * Get current GPS position.
 * Returns { lat, lng, accuracy } or throws error.
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS tidak didukung oleh browser ini'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Izin lokasi ditolak. Aktifkan GPS di pengaturan browser.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Lokasi tidak tersedia. Pastikan GPS aktif.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Waktu pengambilan lokasi habis. Coba lagi.'));
            break;
          default:
            reject(new Error('Gagal mengambil lokasi.'));
        }
      },
      {
        enableHighAccuracy: CONFIG.GPS_HIGH_ACCURACY,
        timeout: CONFIG.GPS_TIMEOUT,
        maximumAge: 0,
      }
    );
  });
}
