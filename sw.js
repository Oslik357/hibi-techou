// 日々の手帳 — offline support.
// Online: always load the newest app from the server (bypassing caches). Offline or slow: use the saved copy.
const CACHE = 'hibi-techou-v9';
const FILES = ['./', './index.html', './xlsx.full.min.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); }
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = isPage ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const net = fetch(req, { cache: 'no-store' }).then(res => { if (res && res.ok) cache.put(key, res.clone()); return res; });
    if (isPage) {
      // page: newest first, saved copy if offline or no answer within 4 s
      try { return await withTimeout(net, 4000); }
      catch (err) { return cached || new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    }
    // other files: saved copy first, refresh in the background
    if (cached) { e.waitUntil(net.catch(() => {})); return cached; }
    try { return await net; } catch (err) { return new Response('', { status: 504 }); }
  }));
});
