// Enabled only on the isolated QA preview. No persistent storage or network logging.
const samples = { initial: [], pages: {}, requests: [] };
let pending = { label: 'initial', start: 0 };
const publish = () => document.documentElement.setAttribute('data-qa-performance', JSON.stringify(samples));
const headings = { Beranda: 'Pengumuman', Riwayat: 'Riwayat Absensi', Reservasi: 'Reservasi' };
document.addEventListener('click', event => {
  const link = event.target.closest('nav a');
  const label = link?.textContent.trim();
  if (headings[label]) pending = { label, start: performance.now() };
}, true);
function checkReady() {
  if (!pending || document.querySelector('main .animate-pulse')) return;
  const ready = pending.label === 'initial'
    ? document.querySelector('input[placeholder="Cari nama karyawan..."], button[aria-label="Ganti karyawan"]')
    : [...document.querySelectorAll('main h2')].some(node => node.textContent === headings[pending.label]);
  if (!ready) return;
  const sample = pending;
  pending = null;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const values = sample.label === 'initial' ? samples.initial : (samples.pages[sample.label] ||= []);
    values.push(Math.round((performance.now() - sample.start) * 10) / 10);
    publish();
  }));
}
new MutationObserver(checkReady).observe(document.getElementById('root'), { subtree: true, childList: true, characterData: true });
checkReady();
new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (new URL(entry.name).pathname === '/api/read') samples.requests.push(Math.round(entry.duration * 10) / 10);
  }
  publish();
}).observe({ type: 'resource', buffered: true });
