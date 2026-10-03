// Работа без интернета: при первом заходе сохраняем файлы игры, потом берём их из памяти телефона
const CACHE = 'hodulki2-v5';
const FILES = ['./', 'index.html', 'style.css', 'physics.js', 'art.js', 'gfx.js', 'icons.js', 'audio.js', 'game.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // сначала пробуем сеть (чтобы получать обновления), без сети — берём сохранённое
  e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
