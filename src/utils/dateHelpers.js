const TZ = 'Asia/Jakarta';

export function formatTime(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split(' ');
  if (parts.length >= 2) return parts[1].substring(0, 5);
  return dateStr;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00+07:00');
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function getTodayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

export function getNowTimeString() {
  return new Date().toLocaleTimeString('id-ID', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
