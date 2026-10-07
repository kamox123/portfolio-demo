// Работа без интернета: оболочка приложения хранится на телефоне, сообщения грузятся из сети
const CACHE = 'kamox-chat-v3';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'supabase.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // запросы к серверу не трогаем
  // сначала сеть (чтобы обновления приходили сразу), без сети — из памяти
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
// уведомления: нажатие открывает приложение и нужный чат
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const chat = e.notification.data?.chat;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { c.focus(); if (chat) c.postMessage({ chat }); return; }
    return self.clients.openWindow('./');
  }));
});
// пуш-уведомления (будут работать после подключения сервера уведомлений)
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'KAMOX Chat', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'KAMOX Chat', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.chat || 'msg', data: { chat: d.chat } }));
});
