// Работа без интернета: при первом заходе сохраняем файлы игры, потом берём их из памяти телефона.
// ВАЖНО: при каждом заметном обновлении игры версию ниже нужно увеличивать — иначе браузер не
// заметит, что sw.js изменился (файл проверяется побайтово), не обновит service worker и будет
// годами показывать старую, закэшированную версию игры, даже если на сервере уже новый код.
const CACHE = 'hodulki2-v7';
const FILES = ['./', 'index.html', 'style.css', 'physics.js', 'art.js', 'gfx.js', 'icons.js', 'audio.js', 'game.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // сначала пробуем сеть (чтобы получать обновления); cache:'no-cache' заставляет браузер
  // каждый раз спрашивать сервер «не изменилось ли это», а не молча отдавать старую копию
  // из обычного HTTP-кэша (на GitHub Pages файлы кэшируются на несколько минут по умолчанию).
  // Без сети — берём то, что сохранено на телефоне.
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((res) => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
