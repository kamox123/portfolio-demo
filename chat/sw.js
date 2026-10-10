// Фоновая часть приложения: работа без сети и уведомления, когда приложение закрыто
const CACHE = 'kamox-chat-v28';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'supabase.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'badge-96.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('.apk')) return;
  // сразу из памяти телефона (мгновенный запуск даже при плохой сети), а свежую версию тихо скачиваем в фоне —
  // она откроется при следующем запуске. Новая версия приложения (новый CACHE) скачивается целиком при установке.
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(async () => (await c.match('index.html')) || Response.error());
  }));
});

// пуш от сервера: новое сообщение или входящий звонок
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'KAMOX Chat', body: e.data?.text() || '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ios = /iphone|ipad|ipod|macintosh/i.test(self.navigator.userAgent);
    // если приложение открыто и на экране — оно само покажет сообщение (на iPhone пуш обязан показаться всегда)
    if (!ios && d.type !== 'ring' && wins.some((w) => w.visibilityState === 'visible' && w.focused)) return;
    const ring = d.type === 'ring';
    await self.registration.showNotification(d.title || 'KAMOX Chat', {
      body: d.body || '', icon: 'icon-192.png', badge: 'badge-96.png',
      tag: ring ? 'call-' + d.chat : 'chat-' + d.chat, renotify: true,
      requireInteraction: ring, vibrate: ring ? [400, 200, 400, 200, 400] : [80],
      data: { chat: d.chat },
    });
  })());
});

// нажатие на уведомление: открыть приложение сразу в нужном чате
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const chat = e.notification.data?.chat;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { c.focus(); if (chat) c.postMessage({ chat }); return; }
    return self.clients.openWindow(chat ? './?chat=' + chat : './');
  }));
});
