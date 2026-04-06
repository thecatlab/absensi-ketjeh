import { useState } from 'react'

/**
 * Normalize Google Drive URLs to a format that works for embedding.
 * Handles multiple URL formats:
 *   - https://lh3.googleusercontent.com/d/FILE_ID
 *   - https://drive.google.com/file/d/FILE_ID/view
 *   - https://drive.google.com/open?id=FILE_ID
 *   - https://drive.google.com/uc?id=FILE_ID
 */
function normalizePhotoUrl(url) {
  if (!url) return null

  // Already a direct lh3 URL — use as-is
  if (url.includes('lh3.googleusercontent.com')) {
    return url
  }

  // Extract file ID from various Drive URL formats
  let fileId = null

  // /file/d/FILE_ID/
  const match1 = url.match(/\/file\/d\/([^/]+)/)
  if (match1) fileId = match1[1]

  // ?id=FILE_ID
  const match2 = url.match(/[?&]id=([^&]+)/)
  if (match2) fileId = match2[1]

  // /d/FILE_ID (generic)
  const match3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match3) fileId = match3[1]

  if (fileId) {
    return 'https://lh3.googleusercontent.com/d/' + fileId
  }

  // Not a Drive URL — return as-is (may be external)
  return url
}

/**
 * Displays a photo thumbnail with error fallback and lightbox zoom.
 * Used in Riwayat (HistoryPage) and Laporan (ReportsPage).
 */
export default function PhotoDisplay({ url, alt }) {
  const [error, setError] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  const normalizedUrl = normalizePhotoUrl(url)

  if (!normalizedUrl || error) {
    return (
      <div className="mb-3 w-20 h-20 rounded-xl bg-gray-200 flex items-center justify-center">
        <CameraIcon />
      </div>
    )
  }

  return (
    <>
      <div className="mb-3">
        <img
          src={normalizedUrl}
          alt={alt}
          className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-sm cursor-pointer active:opacity-80"
          onError={() => setError(true)}
          onClick={() => setShowLightbox(true)}
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <img
            src={normalizedUrl}
            alt={alt}
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </>
  )
}

export function CameraIcon() {
  return (
    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
    </svg>
  )
}
