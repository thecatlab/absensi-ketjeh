export default function LocationStatus({ location }) {
  if (!location) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Spinner />
        <span>Mengambil lokasi...</span>
      </div>
    );
  }

  if (location.error) {
    return (
      <div className="flex items-center gap-2 text-sm text-warning">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>{location.error}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${location.accuracy > 100 ? 'text-warning' : 'text-success'}`} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
      <span className="text-gray-600">
        GPS diperoleh
        {location.accuracy && (
          <span className="text-gray-400"> (akurasi {Math.round(location.accuracy)}m)</span>
        )}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
