const CACHE_NAME = 'av-tech-v124';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './topology.js',
  './manifest.json',
  'https://unpkg.com/html5-qrcode',
  'https://cdn.jsdelivr.net/npm/@antv/x6@3/dist/x6.min.js',
  'https://unpkg.com/elkjs@0.8.2/lib/elk.bundled.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
