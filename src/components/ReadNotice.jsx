export default function ReadNotice({ query }) {
  if (!query.error) return null;
  return <div role="status" className="text-xs text-danger bg-danger/5 rounded-lg px-3 py-2 mb-3">
    {query.stale ? 'Data mungkin belum terbaru. ' : ''}{query.error.message}
    <button type="button" className="font-semibold underline ml-2" onClick={() => query.refresh().catch(() => {})}>Coba lagi</button>
  </div>;
}
