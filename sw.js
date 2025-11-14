const CACHE = 'travel-v5';
const PRECACHE = ['/', '/assets/style.css', '/assets/app.js?v=7'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const isHTML = req.destination === 'document' || req.headers.get('accept')?.includes('text/html');
  const isJS = req.destination === 'script' || new URL(req.url).pathname.endsWith('.js');

  if (isHTML || isJS) {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});
async function networkFirst(req){
  try {
    const fresh = await fetch(req, { cache:'no-store' });
    const cache = await caches.open(CACHE); cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req); return cached || caches.match('/');
  }
}
async function cacheFirst(req){
  const cached = await caches.match(req); if (cached) return cached;
  const fresh = await fetch(req); const cache = await caches.open(CACHE); cache.put(req, fresh.clone()); return fresh;
}
