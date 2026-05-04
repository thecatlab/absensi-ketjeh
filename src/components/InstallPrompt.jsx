import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const shouldDisablePrompt = import.meta.env.DEV || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    return Boolean(dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000);
  });

  useEffect(() => {
    if (shouldDisablePrompt) return undefined;
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [shouldDisablePrompt]);

  if (shouldDisablePrompt || !deferredPrompt || dismissed) return null;

  async function handleInstall() {
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  }

  return (
    <div className="mx-5 mb-4 bg-navy rounded-xl p-4 flex items-center gap-3 animate-slide-up">
      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Install Aplikasi</p>
        <p className="text-xs text-white/70">Akses lebih cepat dari home screen</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleDismiss}
          className="text-xs text-white/50 px-2 py-1"
        >
          Nanti
        </button>
        <button
          onClick={handleInstall}
          className="text-xs font-semibold text-navy bg-white px-3 py-1.5 rounded-lg"
        >
          Install
        </button>
      </div>
    </div>
  );
}
