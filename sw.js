const CACHE = 'travel-v1';
const ASSETS = [
  '/',
  '/assets/style.css',
  '/assets/app.js',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e)=>{
  const { request } = e;
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res=>{
      const resClone = res.clone();
      caches.open(CACHE).then(c=>c.put(request, resClone));
      return res;
    }).catch(()=> caches.match('/')))
  );
});
