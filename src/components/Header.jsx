import { CONFIG } from '../config'

export default function Header({ employee }) {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

  return (
    <header className="bg-navy text-white px-5 pt-10 pb-6 rounded-b-3xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold shrink-0">
          {employee ? employee.nama.charAt(0) : 'K'}
        </div>
        <div className="min-w-0">
          {employee ? (
            <>
              <p className="text-xs text-white/60 capitalize">{formattedDate}</p>
              <h1 className="text-lg font-semibold leading-tight truncate">{employee.nama}</h1>
              <p className="text-xs text-white/60">{employee.jabatan} di {CONFIG.COMPANY_NAME}</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold leading-tight">{CONFIG.APP_NAME}</h1>
              <p className="text-xs text-white/60">{CONFIG.COMPANY_NAME}</p>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
