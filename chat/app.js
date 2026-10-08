// KAMOX Chat — мессенджер (Supabase: база, файлы, мгновенная доставка; звонки — WebRTC; уведомления — Web Push)
'use strict';
// Supabase в России заблокирован — ходим через посредника на сервере бота (Render открывается и с VPN, и без)
const SB_URL = 'https://vtoroy-mozg-bot.onrender.com/sb';
const SB_KEY = 'sb_publishable_s-wUfxpZmZKf0kEqoTMclQ_uPyuabsp';
const VAPID = 'BBD19_NqHMSkr_P_r-IV1ohfzI9UM0n614PaCsiUvaTPBvnOimS190hnDdXKTZS6aQZtvR8g5SWnVV7pnyIcJCk';
const MAIL = (u) => `${u}@kamox-chat.app`; // ник превращается в «почту» только для входа, писем никто не получает
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-zqhhczwewvvgeavpulas-auth-token' } });
// несколько серверов STUN: часть из них в России может не открываться
const ICE = [{ urls: ['stun:stun.sipnet.ru:3478', 'stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478', 'stun:global.stun.twilio.com:3478'] }];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { v3: false, contacts: new Set(), blocks: new Set(), pendingUser: null, me: null, chats: new Map(), profiles: new Map(), open: null, msgs: new Map(), screen: 'sAuth', history: [] };

// ---------- значки (свои, нарисованные линиями) ----------
const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  phone: '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  hangup: '<path d="M3 15.5v-2.2a2 2 0 0 1 1.3-1.9 21 21 0 0 1 15.4 0 2 2 0 0 1 1.3 1.9v2.2a1.5 1.5 0 0 1-1.8 1.5l-3-.6a1.5 1.5 0 0 1-1.2-1.4V13a14 14 0 0 0-6 0v2a1.5 1.5 0 0 1-1.2 1.4l-3 .6A1.5 1.5 0 0 1 3 15.5z"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>',
  clip: '<path d="M20.5 11.5l-8.2 8.2a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>',
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>',
  send: '<path d="M4 12L20 4l-4 16-4-7z" fill="currentColor" stroke-linejoin="round"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a6.5 6.5 0 0 1 3 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.5-4.5"/>',
  camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.8-2.5h5.4L16.5 6h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.8"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 16l4-4-4-4M19 12H9"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="M21 15.5l-5-5L5 21"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 3.5v11M7 10l5 5 5-5M5 20.5h14"/>',
  share: '<path d="M12 15V3.5M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
  missed: '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/><path d="M16 3l5 5M21 3l-5 5"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 7v7M9 11l3 3 3-3M10 18.5h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0M2 9.3a14.5 14.5 0 0 1 20 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
  devices: '<rect x="2.5" y="5" width="13" height="10" rx="2"/><path d="M5.5 19h7"/><rect x="16.5" y="8.5" width="5.5" height="11" rx="1.6"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  userAdd: '<circle cx="10" cy="8" r="3.8"/><path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  userOk: '<circle cx="10" cy="8" r="3.8"/><path d="M3 20a7 7 0 0 1 14 0M16 11.5l2 2 3.5-3.8"/>',
  block: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 18.5v2M18.5 14h2"/>',
  circle: '<circle cx="12" cy="12" r="9"/><rect x="7.5" y="9.5" width="6.5" height="5" rx="1.3"/><path d="M14 11.3l2.5-1.5v4.4L14 12.7"/>',
  sound: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  vibrate: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M3.5 8.5v7M20.5 8.5v7M11 17.5h2"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  flip: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8L10 4h4l1.7 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><path d="M9 12.5a3 3 0 0 1 5.5-1.6M15 12.5a3 3 0 0 1-5.5 1.6M14.6 9v2h-2M9.4 16v-2h2"/>',
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
function paintIcons(root = document) { root.querySelectorAll('i[data-ic]').forEach((i) => { i.outerHTML = ic(i.dataset.ic); }); }
paintIcons();

// ---------- настройки (хранятся на этом устройстве) ----------
const APP_VER = '1.9';
const THEMES = [['violet', 'Неон', '#7b61ff', '#ff5aa8'], ['ocean', 'Океан', '#2fd3f5', '#6366f1'], ['sunset', 'Закат', '#ff8a3d', '#e0408f'], ['mint', 'Мята', '#34d399', '#0ea5e9'], ['ruby', 'Рубин', '#ff3d5a', '#8b1d6b']];
const prefs = Object.assign({ theme: 'violet', anim: true, font: 'm', sound: true, vibro: true }, (() => { try { return JSON.parse(localStorage.getItem('kc-prefs')) || {}; } catch { return {}; } })());
function savePrefs() { try { localStorage.setItem('kc-prefs', JSON.stringify(prefs)); } catch {} applyPrefs(); }
function applyPrefs() {
  const h = document.documentElement;
  h.dataset.theme = prefs.theme; h.dataset.font = prefs.font; h.classList.toggle('noanim', !prefs.anim);
  document.querySelectorAll('.switch[data-set]').forEach((sw) => sw.classList.toggle('on', !!prefs[sw.dataset.set]));
  document.querySelectorAll('#fontSeg .segBtn').forEach((b) => b.classList.toggle('on', b.dataset.font === prefs.font));
  document.querySelectorAll('#themes button').forEach((b) => b.classList.toggle('on', b.dataset.theme === prefs.theme));
}
const VIBRO = (p) => { if (prefs.vibro) navigator.vibrate?.(p); };

// ---------- экраны ----------
function show(id, push = true) {
  if (push && state.screen && state.screen !== id) { state.history.push(state.screen); history.pushState({ s: id }, ''); }
  for (const s of document.querySelectorAll('.screen')) {
    const on = s.id === id; s.classList.toggle('hidden', !on);
    if (on) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); }
  }
  state.screen = id;
}
function back() {
  const prev = state.history.pop() || 'sChats';
  if (state.screen === 'sChat') { state.open = null; renderChats(); }
  show(prev, false);
}
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => history.back()));
window.addEventListener('popstate', () => { if (state.screen !== 'sChats' && state.screen !== 'sAuth') back(); });

let toastT;
function toast(text, ms = 2600) {
  const t = $('toast'); t.textContent = text; t.classList.remove('hidden');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- аватарки ----------
const GRADS = [['#7b61ff', '#b36bff'], ['#ff5aa8', '#ff8a6b'], ['#2fd3f5', '#3b82f6'], ['#34d399', '#10b3a3'], ['#ffae42', '#ff6b6b'], ['#a78bfa', '#ec4899'], ['#22c1c3', '#7b61ff'], ['#f472b6', '#8b5cf6']];
function avatarStyle(name, path) {
  if (path) return `background-image:url('${sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}')`;
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = GRADS[h % GRADS.length]; return `background:linear-gradient(135deg,${a},${b})`;
}
function avatarHtml(name, path, cls = '', online = false) {
  return `<div class="av ${cls}" style="${avatarStyle(name, path)}">${path ? '' : esc((name || '?').trim()[0]?.toUpperCase() || '?')}${online ? '<span class="online"></span>' : ''}</div>`;
}
const isOnline = (p) => p?.last_seen && Date.now() - new Date(p.last_seen) < 120000;

// ---------- время ----------
const pad2 = (n) => String(n).padStart(2, '0');
function hhmm(d) { d = new Date(d); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function dayLabel(d) {
  d = new Date(d); const now = new Date(); const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Сегодня';
  if (d.toDateString() === y.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function listTime(d) { d = new Date(d); return d.toDateString() === new Date().toDateString() ? hhmm(d) : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }
function seenText(p) {
  if (!p?.last_seen) return 'был(а) недавно';
  const min = (Date.now() - new Date(p.last_seen)) / 60000;
  if (min < 2) return 'в сети';
  if (min < 60) return `был(а) ${Math.round(min)} мин назад`;
  return `был(а) ${listTime(p.last_seen)}`;
}
const fmtDur = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ');

// ---------- вход / регистрация ----------
let authMode = 'login';
function setAuthMode(m) {
  authMode = m;
  document.querySelectorAll('.segBtn').forEach((x) => x.classList.toggle('on', x.dataset.mode === m));
  document.querySelector('.seg').classList.toggle('reg', m === 'register');
  document.querySelectorAll('.regOnly').forEach((x) => x.classList.toggle('hidden', m !== 'register'));
  $('aBtn').textContent = m === 'login' ? 'Войти' : 'Создать аккаунт';
  $('aPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('aErr').textContent = '';
}
document.querySelectorAll('.segBtn').forEach((t) => (t.onclick = () => setAuthMode(t.dataset.mode)));
setAuthMode('login');

// ник только латиницей: русские буквы сами превращаются в латинские прямо при вводе («илюшко» → «ilyushko»)
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
function toNick(v) {
  return v.toLowerCase().replace(/[а-яё]/g, (c) => TR[c] ?? '').replace(/[\s\-.]+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20);
}
$('aUser').addEventListener('input', () => {
  const el = $('aUser'), v = toNick(el.value);
  if (v !== el.value) { el.value = v; $('aErr').textContent = ''; }
});
// ошибка видна всегда: и под кнопкой, и всплывающей подсказкой сверху (под кнопкой её могло закрывать клавиатурой)
function authErr(text) { $('aErr').textContent = text; toast(text, 3500); VIBRO([60, 40, 60]); }

$('authForm').onsubmit = async (e) => {
  e.preventDefault();
  const user = toNick($('aUser').value.trim()), pass = $('aPass').value, name = $('aName').value.trim();
  $('aUser').value = user; $('aErr').textContent = '';
  if (!/^[a-z0-9_]{3,20}$/.test(user)) return authErr('Ник: от 3 до 20 символов — латинские буквы, цифры и _');
  if (pass.length < 6) return authErr('Пароль: минимум 6 символов');
  $('aBtn').textContent = authMode === 'login' ? 'Входим…' : 'Создаём…';
  $('aBtn').disabled = true;
  try {
    if (authMode === 'register') {
      const { error } = await sb.auth.signUp({ email: MAIL(user), password: pass, options: { data: { username: user, display_name: name || user } } });
      if (error) throw error;
    }
    const { data: si, error } = await sb.auth.signInWithPassword({ email: MAIL(user), password: pass });
    if (error) throw error;
    await start(si.session);
  } catch (err) {
    const m = String(err.message || err);
    authErr(/already registered|Database error/i.test(m) ? 'Этот ник уже занят — придумайте другой'
      : /Invalid login/i.test(m) ? 'Неверный ник или пароль'
      : /Email not confirmed/i.test(m) ? 'Аккаунт не подтверждён'
      : /fetch|network|Failed/i.test(m) ? 'Нет связи с сервером, попробуйте ещё раз'
      : 'Ошибка: ' + m);
  } finally { $('aBtn').disabled = false; $('aBtn').textContent = authMode === 'login' ? 'Войти' : 'Создать аккаунт'; }
};

// ---------- запуск после входа ----------
async function start(session) {
  const uid = session.user.id;
  // профиль из памяти телефона — экран открывается сразу, даже без интернета
  try { const cached = JSON.parse(localStorage.getItem('kc-me') || 'null'); if (cached?.id === uid) state.me = cached; } catch {}
  if (!state.me) state.me = { id: uid, username: session.user.user_metadata?.username || '', display_name: session.user.user_metadata?.display_name || 'Я', avatar_path: null };
  state.profiles.set(uid, state.me);
  refreshMe();
  paintMe();
  state.history = [];
  show('sChats', false);
  await loadChats();
  await loadV3();
  subscribe();
  listenCalls();
  heartbeat(); setInterval(heartbeat, 60000);
  installTip();
  syncPush(false);
  if (state.pendingUser) { const u = state.pendingUser; state.pendingUser = null; openByUsername(u); }
}
async function refreshMe() {
  const { data: me, error } = await sb.from('profiles').select('*').eq('id', state.me.id).single();
  if (error || !me) { netDown(); setTimeout(refreshMe, 5000); return; }
  netUp(); state.me = me; state.profiles.set(me.id, me); try { localStorage.setItem('kc-me', JSON.stringify(me)); } catch {}
  paintMe();
}
// полоса «нет связи»
let netTimer = null;
function netDown() { clearTimeout(netTimer); netTimer = setTimeout(() => $('netBar').classList.remove('hidden'), 1500); }
function netUp() { clearTimeout(netTimer); $('netBar').classList.add('hidden'); }
window.addEventListener('offline', netDown);
window.addEventListener('online', () => { if (state.me) { loadChats(); refreshMe(); } });
function paintMe() { $('meBtn').innerHTML = avatarHtml(state.me.display_name, state.me.avatar_path, 'sm'); }
function heartbeat() { if (state.me && !document.hidden) deviceBeat(); if (state.me && !document.hidden && state.me.show_last_seen !== false) sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', state.me.id).then(() => {}); }

// ---------- список чатов ----------
let chatsLoading = null;
function loadChats() { return (chatsLoading ??= loadChatsNow().finally(() => (chatsLoading = null))); }
async function loadChatsNow() {
  const { data, error } = await sb.from('chat_members')
    .select('last_read_at, chats(id,is_group,title,avatar_path,last_message_at, chat_members(user_id, profiles(id,username,display_name,avatar_path,last_seen)))')
    .eq('user_id', state.me.id);
  if (error) { netDown(); setTimeout(loadChats, 5000); return; }
  netUp();
  state.chats.clear();
  if (!state.listShown) { state.listShown = true; $('chatList').classList.add('animList'); setTimeout(() => $('chatList').classList.remove('animList'), 900); }
  for (const row of data) {
    const c = row.chats; if (!c) continue;
    const members = c.chat_members.map((m) => m.profiles).filter(Boolean);
    members.forEach((p) => state.profiles.set(p.id, p));
    state.chats.set(c.id, { ...c, members, lastRead: row.last_read_at, last: null, unread: 0 });
  }
  await Promise.all([...state.chats.values()].map(async (c) => {
    // сначала последнее сообщение, потом счёт строго до него: более новые досчитает addMsg — без двойного счёта
    const { data: last } = await sb.from('messages').select('*').eq('chat_id', c.id).order('id', { ascending: false }).limit(1);
    c.last = last?.[0] || null; c.unread = 0;
    if (c.last) {
      const { count } = await sb.from('messages').select('id', { count: 'exact', head: true }).eq('chat_id', c.id)
        .lte('id', c.last.id).gt('created_at', c.lastRead).neq('sender_id', state.me.id).neq('kind', 'system');
      c.unread = count || 0;
    }
  }));
  renderChats();
}
function chatPeer(c) { return c.is_group ? null : c.members.find((p) => p.id !== state.me.id) || state.me; }
function chatName(c) { return c.is_group ? c.title : chatPeer(c)?.display_name || 'Чат'; }
function chatAvatar(c, cls = '', withOnline = false) {
  const p = chatPeer(c);
  return c.is_group ? avatarHtml(c.title, c.avatar_path, cls) : avatarHtml(p?.display_name, p?.avatar_path, cls, withOnline && isOnline(p));
}
// краткое описание сообщения: значок + текст (для списка и уведомлений)
function previewParts(m) {
  if (!m) return [null, 'Нет сообщений'];
  if (m.kind === 'system') return [null, `${state.profiles.get(m.sender_id)?.display_name || ''} ${m.body}`.trim()];
  const map = { image: ['image', 'Фото'], file: ['file', m.file_name || 'Файл'], voice: isNote(m) ? ['circle', 'Видеосообщение'] : ['mic', 'Голосовое сообщение'], call: [/Пропущ|Отмен/.test(m.body || '') ? 'missed' : 'phone', m.body || 'Звонок'] };
  return map[m.kind] || [null, m.body || ''];
}
function previewHtml(m) {
  const [icon, text] = previewParts(m);
  return `${m && m.sender_id === state.me.id && m.kind !== 'system' ? '<span class="dim">Вы:</span>' : ''}${icon ? ic(icon) : ''}<span class="grow" style="overflow:hidden;text-overflow:ellipsis">${esc(text)}</span>`;
}
function renderChats() {
  const list = [...state.chats.values()].sort((a, b) => new Date(b.last?.created_at || b.last_message_at) - new Date(a.last?.created_at || a.last_message_at));
  $('emptyChats').classList.toggle('hidden', list.length > 0);
  $('chatList').innerHTML = list.map((c) => `
    <button class="item" data-chat="${c.id}">
      ${chatAvatar(c, '', true)}
      <div class="mid"><div class="t">${esc(chatName(c))}</div><div class="s">${previewHtml(c.last)}</div></div>
      <div class="side">${c.last ? listTime(c.last.created_at) : ''}${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
    </button>`).join('');
  $('chatList').querySelectorAll('[data-chat]').forEach((b) => (b.onclick = () => openChat(b.dataset.chat)));
  const total = list.reduce((s, c) => s + c.unread, 0);
  document.title = total ? `(${total}) KAMOX Chat` : 'KAMOX Chat';
  if (navigator.setAppBadge) (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {});
}

// ---------- новый чат и группа ----------
let groupMode = false; const picked = new Map();
$('newChatBtn').onclick = () => {
  groupMode = false; picked.clear(); $('userSearch').value = ''; $('groupTitle').value = '';
  syncNewUi(); $('userList').innerHTML = ''; show('sNew'); searchUsers();
};
$('groupMode').onclick = () => { groupMode = !groupMode; picked.clear(); syncNewUi(); searchUsers(); };
function syncNewUi() {
  $('groupMode').classList.toggle('on', groupMode);
  $('groupMode').querySelector('.grow').textContent = groupMode ? 'Выберите участников' : 'Создать группу';
  $('groupTitle').classList.toggle('hidden', !groupMode);
  $('groupNext').classList.toggle('hidden', !groupMode);
  $('newTitle').textContent = groupMode ? 'Новая группа' : 'Новый чат';
  $('picked').innerHTML = [...picked.values()].map((p) => `<span>${esc(p.display_name)}</span>`).join('');
}
let searchT;
$('userSearch').oninput = () => { clearTimeout(searchT); searchT = setTimeout(searchUsers, 250); };
async function searchUsers() {
  const raw = $('userSearch').value, q = toNick(raw.trim().replace(/^@/, ''));
  let list = [], title = '';
  if (q.length >= 3) {
    if (state.v3) { const { data } = await sb.rpc('search_users', { q }); list = data || []; }
    else { const { data } = await sb.from('profiles').select('id,username,display_name,avatar_path,last_seen').neq('id', state.me.id).ilike('username', q.replace(/_/g, '\\_') + '%').limit(20); list = data || []; }
    title = list.length ? 'Найдено по нику' : '';
  } else {
    // без запроса — только свои: контакты и те, с кем уже есть переписка (всех подряд больше не показываем)
    const ids = new Set(state.contacts);
    for (const c of state.chats.values()) if (!c.is_group) { const p = chatPeer(c); if (p && p.id !== state.me.id) ids.add(p.id); }
    const miss = [...ids].filter((id) => !state.profiles.has(id));
    if (miss.length) { const { data } = await sb.from('profiles').select('*').in('id', miss); (data || []).forEach((p) => state.profiles.set(p.id, p)); }
    list = [...ids].map((id) => state.profiles.get(id)).filter(Boolean)
      .sort((a, b) => (state.contacts.has(b.id) - state.contacts.has(a.id)) || String(a.display_name).localeCompare(b.display_name));
    title = list.length ? 'Контакты и недавние' : '';
  }
  if ($('userSearch').value !== raw) return; // пока искали, запрос уже поменялся
  list.forEach((p) => state.profiles.set(p.id, { ...(state.profiles.get(p.id) || {}), ...p }));
  const empty = q.length >= 3
    ? '<div class="empty" style="margin-top:10vh"><div class="emptyIc">' + ic('search') + '</div><p>Никого не нашли</p><span class="muted">Проверьте ник — его можно посмотреть в настройках у друга</span></div>'
    : '<div class="empty" style="margin-top:10vh"><div class="emptyIc">' + ic('search') + '</div><p>Найдите друга по нику</p><span class="muted">Введите ник целиком или первые 3 буквы</span></div>';
  $('userList').innerHTML = (title ? `<p class="listTitle">${title}</p>` : '') + (list.map((p) => `
    <button class="item ${picked.has(p.id) ? 'sel' : ''}" data-user="${p.id}">
      ${avatarHtml(p.display_name, p.avatar_path, '', isOnline(p))}
      <div class="mid"><div class="t">${esc(p.display_name)}</div><div class="s">@${esc(p.username)}${state.contacts.has(p.id) ? ' · контакт' : ''} · ${seenText(p)}</div></div>
      ${groupMode ? `<span class="check">${picked.has(p.id) ? ic('check') : ''}</span>` : ''}
    </button>`).join('') || empty);
  $('userList').querySelectorAll('[data-user]').forEach((b) => (b.onclick = async () => {
    const p = state.profiles.get(b.dataset.user);
    if (groupMode) {
      picked.has(p.id) ? picked.delete(p.id) : picked.set(p.id, p);
      b.classList.toggle('sel'); b.querySelector('.check').innerHTML = picked.has(p.id) ? ic('check') : ''; syncNewUi(); return;
    }
    const { data: id, error } = await sb.rpc('open_direct_chat', { other: p.id });
    if (error) return toast(errText(error));
    await loadChats(); state.history = ['sChats']; openChat(id, true);
  }));
}
$('groupNext').onclick = async () => {
  const title = $('groupTitle').value.trim();
  if (!title) return toast('Впишите название группы');
  if (!picked.size) return toast('Выберите участников');
  const { data: id, error } = await sb.rpc('create_group', { title, members: [...picked.keys()] });
  if (error) return toast('Ошибка: ' + error.message);
  await loadChats(); state.history = ['sChats']; openChat(id, true);
};

// ---------- переписка ----------
async function openChat(id, replace = false) {
  const c = state.chats.get(id); if (!c) return;
  state.open = id;
  const peer = chatPeer(c), on = !c.is_group && isOnline(peer);
  $('chatHead').innerHTML = `${chatAvatar(c, 'sm', true)}<div style="min-width:0"><div class="t">${esc(chatName(c))}</div>
    <div class="s ${on ? 'on' : ''}">${c.is_group ? c.members.length + ' участник(ов)' : seenText(peer)}</div></div>`;
  $('callAudio').classList.toggle('hidden', c.is_group); $('callVideo').classList.toggle('hidden', c.is_group);
  $('msgs').innerHTML = '';
  show('sChat', !replace);
  const { data } = await sb.from('messages').select('*').eq('chat_id', id).order('created_at', { ascending: false }).limit(80);
  if (state.open !== id) return;
  state.msgs.set(id, (data || []).reverse());
  renderMsgs(true);
  markRead(c);
}
function markRead(c) {
  c.unread = 0; c.lastRead = new Date().toISOString();
  sb.from('chat_members').update({ last_read_at: c.lastRead }).eq('chat_id', c.id).eq('user_id', state.me.id).then(() => {});
  renderChats();
}
function renderMsgs(toBottom) {
  const box = $('msgs'), c = state.chats.get(state.open), list = state.msgs.get(state.open) || [];
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  let html = '', day = '';
  for (const m of list) {
    const d = dayLabel(m.created_at); if (d !== day) { html += `<div class="day">${d}</div>`; day = d; }
    html += msgHtml(m, c);
  }
  box.innerHTML = html || '<div class="empty" style="margin-top:18vh"><div class="emptyIc">' + ic('chat') + '</div><p>Напишите первое сообщение</p></div>';
  box.querySelectorAll('[data-img]').forEach(loadImg);
  box.querySelectorAll('[data-voice]').forEach(wireVoice);
  box.querySelectorAll('[data-vnote]').forEach(wireNote);
  box.querySelectorAll('[data-file]').forEach((a) => (a.onclick = async (e) => { e.preventDefault(); const u = await fileUrl(a.dataset.file, a.dataset.name); if (u) window.open(u, '_blank'); }));
  if (toBottom || nearBottom) box.scrollTop = box.scrollHeight;
}
// «волна» голосового: высота столбиков зависит от id, чтобы у каждого сообщения своя
function waveBars(seed, n = 28) {
  let s = seed >>> 0, out = '';
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; const h = 25 + ((s >> 16) % 75); out += `<b style="height:${h}%"></b>`; }
  return out;
}
function msgHtml(m, c) {
  if (m.kind === 'system') { const p = state.profiles.get(m.sender_id); return `<p class="sys">${esc(p?.display_name || '')} ${esc(m.body)}</p>`; }
  const mine = m.sender_id === state.me.id, p = state.profiles.get(m.sender_id);
  const who = c?.is_group && !mine ? `<div class="who">${esc(p?.display_name || '?')}</div>` : '';
  const time = `<span class="time">${hhmm(m.created_at)}</span>`;
  let inner;
  if (m.kind === 'image') return `<div class="m media ${mine ? 'me' : ''} ${m.id === state.animId ? 'new' : ''}">${who}<img class="ph" data-img="${esc(m.file_path)}" alt="">${time}</div>`;
  if (isNote(m)) return `<div class="m note ${mine ? 'me' : ''} ${m.id === state.animId ? 'new' : ''}">${who}<div class="vnote" data-vnote="${esc(m.file_path)}" data-dur="${m.duration || 0}"><video playsinline preload="metadata"></video><svg class="vring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48"/></svg><span class="vplay">${ic('play')}</span><span class="vdur">${fmtDur(m.duration || 0)}</span></div>${time}</div>`;
  if (m.kind === 'file') inner = `<a class="file" href="#" data-file="${esc(m.file_path)}" data-name="${esc(m.file_name)}"><span class="fi">${ic('file')}</span><span><b>${esc(m.file_name)}</b><br><span class="small" style="opacity:.75">${fmtSize(m.file_size || 0)}</span></span></a>`;
  else if (m.kind === 'voice') inner = `<div class="voice" data-voice="${esc(m.file_path)}" data-dur="${m.duration || 0}"><button class="play">${ic('play')}</button><div class="bar">${waveBars(m.id)}</div><span class="dur">${fmtDur(m.duration || 0)}</span></div>`;
  else if (m.kind === 'call') inner = `${ic(/Пропущ|Отмен/.test(m.body || '') ? 'missed' : 'phone')}<span>${esc(m.body)}</span>`;
  else inner = esc(m.body);
  return `<div class="m ${mine ? 'me' : ''} k-${m.kind} ${m.id === state.animId ? 'new' : ''}">${who}${inner}${time}</div>`;
}

const urlCache = new Map();
async function fileUrl(path, download) {
  const key = path + (download ? '|d' : '');
  const hit = urlCache.get(key); if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await sb.storage.from('chat-files').createSignedUrl(path, 3600, download ? { download } : undefined);
  if (error) { toast('Файл недоступен'); return null; }
  urlCache.set(key, { url: data.signedUrl, exp: Date.now() + 3500e3 });
  return data.signedUrl;
}
async function loadImg(img) {
  const u = await fileUrl(img.dataset.img); if (!u) return;
  img.src = u; img.onload = () => { const b = $('msgs'); if (b.scrollHeight - b.scrollTop - b.clientHeight < 400) b.scrollTop = b.scrollHeight; };
  img.onclick = () => { $('viewerImg').src = u; $('viewer').classList.remove('hidden'); };
}
$('viewer').onclick = () => $('viewer').classList.add('hidden');

let playing = null;
function wireVoice(el) {
  const btn = el.querySelector('.play'), bars = [...el.querySelectorAll('.bar b')], dur = el.querySelector('.dur');
  const paint = (k) => bars.forEach((b, i) => b.classList.toggle('p', i / bars.length < k));
  btn.onclick = async () => {
    if (playing?.el === el) { playing.audio.paused ? playing.audio.play() : playing.audio.pause(); return; }
    if (playing) { playing.audio.pause(); playing.btn.innerHTML = ic('play'); }
    const u = await fileUrl(el.dataset.voice); if (!u) return;
    const audio = new Audio(u); playing = { el, audio, btn };
    audio.onplay = () => (btn.innerHTML = ic('pause')); audio.onpause = () => (btn.innerHTML = ic('play'));
    audio.ontimeupdate = () => { const d = audio.duration && isFinite(audio.duration) ? audio.duration : +el.dataset.dur || 1; paint(audio.currentTime / d); dur.textContent = fmtDur(audio.currentTime); };
    audio.onended = () => { btn.innerHTML = ic('play'); paint(0); dur.textContent = fmtDur(+el.dataset.dur); playing = null; };
    audio.play().catch(() => toast('Не удалось воспроизвести'));
  };
}

// ---------- отправка ----------
const input = $('msgInput');
input.oninput = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 130) + 'px'; syncSendBtn(); };
input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); sendText(); } };
function syncSendBtn() { const has = input.value.trim().length > 0; $('sendBtn').classList.toggle('hidden', !has); $('micBtn').classList.toggle('hidden', has); $('noteBtn').classList.toggle('hidden', has); }
syncSendBtn();
$('sendBtn').onclick = sendText;
async function sendText() {
  const body = input.value.trim(); if (!body || !state.open) return;
  const b = $('sendBtn'); b.classList.remove('fly'); void b.offsetWidth; b.classList.add('fly'); sfx.send(); VIBRO(15);
  input.value = ''; input.style.height = 'auto'; input.focus(); setTimeout(syncSendBtn, 420); // кнопка успевает «улететь»
  await insertMsg({ kind: 'text', body });
}
async function insertMsg(fields) {
  const chat_id = state.open;
  const { data, error } = await sb.from('messages').insert({ chat_id, sender_id: state.me.id, ...fields }).select().single();
  if (error) { toast(/banned/.test(error.message) ? BANNED_TEXT : /privacy/.test(error.message) ? PRIVACY_TEXT(error.message) : 'Не отправлено: ' + error.message); return null; }
  addMsg(data); return data;
}
function addMsg(m) {
  const list = state.msgs.get(m.chat_id);
  if (list && !list.some((x) => x.id === m.id)) {
    list.push(m);
    if (state.open === m.chat_id) {
      state.animId = m.id; renderMsgs(m.sender_id === state.me.id); state.animId = null; // анимация только у нового
      if (m.sender_id !== state.me.id && m.kind !== 'system' && !document.hidden) sfx.receive();
    }
  }
  if (state.open !== m.chat_id && m.sender_id !== state.me.id && m.kind !== 'system' && !document.hidden) sfx.receive();
  const c = state.chats.get(m.chat_id);
  if (c) {
    const isNew = !c.last || m.id > c.last.id; // уже могло попасть в список при загрузке — не считаем второй раз
    if (isNew) c.last = m;
    if (state.open === m.chat_id && !document.hidden) markRead(c); else if (isNew && m.sender_id !== state.me.id && m.kind !== 'system') c.unread++;
    renderChats();
  }
}

// файлы и фото
$('attachBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = async () => {
  const f = $('fileInput').files[0]; $('fileInput').value = ''; if (!f || !state.open) return;
  if (f.size > 25 * 1048576) return toast('Файл больше 25 МБ');
  const isImg = /^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(f.type);
  toast(isImg ? 'Отправляю фото…' : 'Отправляю файл…', 60000);
  try {
    const blob = isImg && !/gif/i.test(f.type) ? await shrinkImage(f, 1600, 0.82) : f;
    const ext = isImg && !/gif/i.test(f.type) ? 'jpg' : (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const path = await upload(blob, ext, blob.type || f.type);
    await insertMsg(isImg ? { kind: 'image', file_path: path, mime: blob.type, file_size: blob.size }
      : { kind: 'file', file_path: path, file_name: f.name.slice(0, 120), file_size: f.size, mime: f.type });
    $('toast').classList.add('hidden'); sfx.send();
  } catch (e) { toast('Ошибка загрузки: ' + (e.message || e)); }
};
async function upload(blob, ext, type) {
  const path = `${state.open}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('chat-files').upload(path, blob, { contentType: type || 'application/octet-stream' });
  if (error) throw error;
  return path;
}
function shrinkImage(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      cv.toBlob((b) => (b ? res(b) : rej(new Error('не удалось сжать'))), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}

// голосовые
let rec = null;
$('micBtn').onclick = async () => {
  if (!window.MediaRecorder) return toast('Запись голоса не поддерживается в этом браузере');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    rec = { mr, stream, chunks: [], t0: Date.now(), send: false };
    mr.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data);
    mr.onstop = finishVoice;
    mr.start(250); sfx.recStart(); VIBRO(20);
    $('composer').classList.add('hidden'); $('recBar').classList.remove('hidden');
    rec.timer = setInterval(() => { $('recTime').textContent = fmtDur((Date.now() - rec.t0) / 1000); if (Date.now() - rec.t0 > 300000) stopVoice(true); }, 250);
  } catch { toast('Нет доступа к микрофону'); }
};
function stopVoice(send) { if (!rec) return; rec.send = send; send ? sfx.send() : sfx.recStop(); clearInterval(rec.timer); rec.mr.stop(); rec.stream.getTracks().forEach((t) => t.stop()); $('recBar').classList.add('hidden'); $('composer').classList.remove('hidden'); $('recTime').textContent = '0:00'; }
$('recCancel').onclick = () => stopVoice(false);
$('recSend').onclick = () => stopVoice(true);
async function finishVoice() {
  const r = rec; rec = null; if (!r?.send) return;
  const dur = (Date.now() - r.t0) / 1000; if (dur < 0.7) return toast('Слишком коротко');
  const type = r.mr.mimeType || r.chunks[0]?.type || 'audio/webm';
  const blob = new Blob(r.chunks, { type });
  try {
    const path = await upload(blob, /mp4|aac/.test(type) ? 'm4a' : 'webm', type);
    await insertMsg({ kind: 'voice', file_path: path, mime: type, duration: Math.round(dur * 10) / 10, file_size: blob.size });
  } catch (e) { toast('Голосовое не отправлено: ' + (e.message || e)); }
}

// ---------- кружки (видеосообщения до минуты) ----------
// Камера рисуется на квадратный холст 400×400, с него и пишется видео — так кружок у всех одинаковый.
// В базе это голосовое (kind = voice) с видео-форматом: новая колонка не нужна, старые версии сыграют хотя бы звук.
const NOTE_MAX = 60, RING = 301.6;
let note = null;
const isNote = (m) => m?.kind === 'voice' && /^video\//.test(m.mime || '');
async function noteCamera(facing) {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } }, audio: false });
}
$('noteBtn').onclick = async () => {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return toast('Кружки не поддерживаются в этом браузере');
  if (note) return;
  let cam, mic;
  try {
    cam = await noteCamera('user');
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch { cam?.getTracks().forEach((t) => t.stop()); return toast('Нет доступа к камере и микрофону'); }
  const cv = document.createElement('canvas'); cv.width = cv.height = 400;
  const g = cv.getContext('2d'), prev = $('notePrev');
  const n = (note = { cam, mic, facing: 'user', t0: Date.now(), chunks: [], send: false, cv });
  prev.srcObject = cam; prev.play().catch(() => {});
  // каждый кадр: вырезаем квадрат из середины, фронтальную камеру отражаем как в зеркале
  const draw = () => {
    if (note !== n) return;
    const vw = prev.videoWidth, vh = prev.videoHeight;
    if (vw) {
      const s = Math.min(vw, vh);
      g.save(); if (n.facing === 'user') { g.translate(400, 0); g.scale(-1, 1); }
      g.drawImage(prev, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, 400, 400); g.restore();
    }
    n.raf = requestAnimationFrame(draw);
  };
  draw();
  n.drawT = setInterval(() => { if (document.hidden) draw(); }, 40); // в фоне requestAnimationFrame спит
  const stream = cv.captureStream(30); mic.getAudioTracks().forEach((t) => stream.addTrack(t));
  const type = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  try { n.mr = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 900000, audioBitsPerSecond: 64000 }); }
  catch { stopNote(false); return toast('Не удалось начать запись'); }
  n.mr.ondataavailable = (e) => e.data.size && n.chunks.push(e.data);
  n.mr.onstop = () => finishNote(n);
  n.mr.start(500); sfx.recStart(); VIBRO(20);
  $('noteWrap').classList.remove('back'); $('noteRing').style.strokeDashoffset = RING;
  $('noteRec').classList.remove('hidden');
  n.timer = setInterval(() => {
    const sec = (Date.now() - n.t0) / 1000;
    $('noteTime').textContent = fmtDur(sec);
    $('noteRing').style.strokeDashoffset = RING * (1 - Math.min(1, sec / NOTE_MAX));
    if (sec >= NOTE_MAX) stopNote(true);
  }, 100);
};
function stopNote(send) {
  const n = note; if (!n) return; note = null; n.send = send;
  send ? sfx.send() : sfx.recStop();
  clearInterval(n.timer); clearInterval(n.drawT); cancelAnimationFrame(n.raf);
  try { if (n.mr?.state === 'recording') n.mr.stop(); } catch {}
  n.cam.getTracks().forEach((t) => t.stop()); n.mic.getTracks().forEach((t) => t.stop());
  $('noteRec').classList.add('hidden'); $('notePrev').srcObject = null; $('noteTime').textContent = '0:00';
}
$('noteCancel').onclick = () => stopNote(false);
$('noteSend').onclick = () => stopNote(true);
$('noteFlip').onclick = async () => {
  const n = note; if (!n) return;
  const facing = n.facing === 'user' ? 'environment' : 'user';
  try {
    const cam = await noteCamera(facing); if (note !== n) return cam.getTracks().forEach((t) => t.stop());
    n.cam.getTracks().forEach((t) => t.stop()); n.cam = cam; n.facing = facing;
    $('notePrev').srcObject = cam; $('notePrev').play().catch(() => {});
    $('noteWrap').classList.toggle('back', facing !== 'user');
  } catch { toast('Не удалось переключить камеру'); }
};
async function finishNote(n) {
  if (!n.send) return;
  const dur = (Date.now() - n.t0) / 1000; if (dur < 1) return toast('Слишком коротко');
  const type = (n.mr.mimeType || n.chunks[0]?.type || 'video/webm').split(';')[0];
  const blob = new Blob(n.chunks, { type });
  toast('Отправляю кружок…', 60000);
  try {
    const path = await upload(blob, /mp4/.test(type) ? 'mp4' : 'webm', type);
    await insertMsg({ kind: 'voice', file_path: path, mime: type, duration: Math.round(Math.min(dur, NOTE_MAX) * 10) / 10, file_size: blob.size });
    $('toast').classList.add('hidden');
  } catch (e) { toast('Кружок не отправлен: ' + (e.message || e)); }
}
// кружок в переписке: первый кадр сразу, по нажатию — играет со звуком, обводка показывает прогресс
let notePlaying = null;
async function wireNote(el) {
  const v = el.querySelector('video'), ring = el.querySelector('.vring circle'), dur = el.querySelector('.vdur');
  const total = +el.dataset.dur || 0;
  fileUrl(el.dataset.vnote).then((u) => { if (u) v.src = u + '#t=0.1'; });
  v.ontimeupdate = () => {
    const d = isFinite(v.duration) && v.duration ? v.duration : total || 1;
    ring.style.strokeDashoffset = RING * (1 - v.currentTime / d); dur.textContent = fmtDur(v.currentTime);
  };
  v.onended = () => { el.classList.remove('on'); ring.style.strokeDashoffset = RING; dur.textContent = fmtDur(total); v.currentTime = 0.1; notePlaying = null; };
  el.onclick = () => {
    if (!v.src) return;
    if (notePlaying && notePlaying !== v) { notePlaying.pause(); notePlaying.closest('.vnote')?.classList.remove('on'); }
    if (playing) { playing.audio.pause(); }
    if (v.paused) { v.muted = false; v.play().then(() => { el.classList.add('on'); notePlaying = v; }).catch(() => toast('Не удалось воспроизвести')); }
    else { v.pause(); el.classList.remove('on'); }
  };
}

// ---------- контакты, конфиденциальность, устройства ----------
// Работает после step3.sql в базе. Пока его нет — state.v3 = false и всё ведёт себя как раньше.
const LINK = (u) => `https://kamox123.github.io/chat/#@${u}`;
const BANNED_TEXT = 'Ваш аккаунт заблокирован администратором';
const PRIVACY_TEXT = (m) => /группы/.test(m) ? 'Этот пользователь ограничил, кто может добавлять его в группы' : 'Этот пользователь ограничил, кто может ему писать';
const errText = (e) => (/privacy/.test(e?.message || '') ? PRIVACY_TEXT(e.message) : 'Ошибка: ' + (e?.message || e));
async function loadV3() {
  const { error } = await sb.from('contacts').select('contact').limit(1);
  state.v3 = !error;
  if (!state.v3) return;
  const [c, b] = await Promise.all([sb.from('contacts').select('contact').eq('owner', state.me.id), sb.from('blocks').select('blocked').eq('owner', state.me.id)]);
  state.contacts = new Set((c.data || []).map((x) => x.contact));
  state.blocks = new Set((b.data || []).map((x) => x.blocked));
  registerDevice();
  checkAdmin();
}
function copyText(text, done = 'Ссылка скопирована') {
  navigator.clipboard?.writeText(text).then(() => toast(done)).catch(() => prompt('Скопируйте:', text)) ?? prompt('Скопируйте:', text);
}

// карточка собеседника
let uCur = null;
function openUser(p) {
  if (!p) return;
  uCur = p;
  $('uAvatar').setAttribute('style', avatarStyle(p.display_name, p.avatar_path));
  $('uAvatar').textContent = p.avatar_path ? '' : (p.display_name?.[0] || '?').toUpperCase();
  $('uName').textContent = p.display_name; $('uSeen').textContent = seenText(p);
  $('uSeen').classList.toggle('on', isOnline(p));
  $('uUser').textContent = '@' + p.username;
  $('uBio').textContent = p.bio || ''; $('uBioRow').classList.toggle('hidden', !p.bio);
  paintUserBtns();
  show('sUser');
}
function paintUserBtns() {
  const p = uCur; if (!p) return;
  const isC = state.contacts.has(p.id), isB = state.blocks.has(p.id);
  $('uContactT').textContent = isC ? 'Удалить из контактов' : 'Добавить в контакты';
  $('uContact').querySelector('.rowIc').innerHTML = ic(isC ? 'userOk' : 'userAdd');
  $('uBlockT').textContent = isB ? 'Разблокировать' : 'Заблокировать';
  $('uContact').classList.toggle('hidden', !state.v3); $('uBlock').classList.toggle('hidden', !state.v3);
}
$('chatHead').onclick = () => { const c = state.chats.get(state.open); if (c && !c.is_group) openUser(chatPeer(c)); };
// открыть (или создать) личный чат с человеком из карточки
async function chatWith(p) {
  const cur = state.chats.get(state.open);
  if (cur && !cur.is_group && chatPeer(cur)?.id === p.id) { history.back(); return cur.id; }
  for (const c of state.chats.values()) if (!c.is_group && chatPeer(c)?.id === p.id) { openChat(c.id, true); return c.id; }
  const { data: id, error } = await sb.rpc('open_direct_chat', { other: p.id });
  if (error) { toast(errText(error)); return null; }
  await loadChats(); openChat(id, true); return id;
}
$('uMsg').onclick = () => uCur && chatWith(uCur);
$('uCall').onclick = async () => { if (!uCur) return; unlockAudio(); if (await chatWith(uCur)) setTimeout(() => startCall(false), 300); };
$('uVideo').onclick = async () => { if (!uCur) return; unlockAudio(); if (await chatWith(uCur)) setTimeout(() => startCall(true), 300); };
$('uLink').onclick = () => uCur && copyText(LINK(uCur.username));
$('uContact').onclick = async () => {
  const p = uCur; if (!p || !state.v3) return;
  const isC = state.contacts.has(p.id);
  const { error } = isC ? await sb.from('contacts').delete().eq('owner', state.me.id).eq('contact', p.id)
    : await sb.from('contacts').insert({ owner: state.me.id, contact: p.id });
  if (error) return toast('Ошибка: ' + error.message);
  isC ? state.contacts.delete(p.id) : state.contacts.add(p.id);
  paintUserBtns(); toast(isC ? 'Удалён из контактов' : 'Добавлен в контакты');
};
$('uBlock').onclick = async () => {
  const p = uCur; if (!p || !state.v3) return;
  const isB = state.blocks.has(p.id);
  if (!isB && !confirm(`Заблокировать ${p.display_name}? Он(а) не сможет вам писать и звонить.`)) return;
  const { error } = isB ? await sb.from('blocks').delete().eq('owner', state.me.id).eq('blocked', p.id)
    : await sb.from('blocks').insert({ owner: state.me.id, blocked: p.id });
  if (error) return toast('Ошибка: ' + error.message);
  isB ? state.blocks.delete(p.id) : state.blocks.add(p.id);
  paintUserBtns(); toast(isB ? 'Разблокирован' : 'Заблокирован');
};
async function openByUsername(u) {
  if (u === state.me.username) return toast('Это ваша ссылка');
  let p = null;
  if (state.v3) { const { data } = await sb.rpc('profile_by_username', { u }); p = data?.[0]; }
  else { const { data } = await sb.from('profiles').select('*').eq('username', u).maybeSingle(); p = data; }
  if (!p) return toast('Пользователь @' + u + ' не найден');
  state.profiles.set(p.id, { ...(state.profiles.get(p.id) || {}), ...p });
  openUser(state.profiles.get(p.id));
}

// экран «Конфиденциальность»
$('pPrivacy').onclick = () => { paintPrivacy(); show('sPrivacy'); loadBlocked(); };
function paintPrivacy() {
  $('privOld').classList.toggle('hidden', state.v3);
  document.querySelectorAll('[data-priv]').forEach((seg) => seg.querySelectorAll('.segBtn').forEach((b) => b.classList.toggle('on', (state.me[seg.dataset.priv] || 'everyone') === b.dataset.v)));
  document.querySelectorAll('[data-priv-sw]').forEach((sw) => sw.classList.toggle('on', state.me[sw.dataset.privSw] !== false));
}
async function savePriv(field, value) {
  if (!state.v3) return toast('Сначала нужно обновить базу (шаг 3)');
  const old = state.me[field]; state.me[field] = value; paintPrivacy();
  const patch = { [field]: value };
  if (field === 'show_last_seen' && value) patch.last_seen = new Date().toISOString();
  const { error } = await sb.from('profiles').update(patch).eq('id', state.me.id);
  if (error) { state.me[field] = old; paintPrivacy(); return toast('Ошибка: ' + error.message); }
  try { localStorage.setItem('kc-me', JSON.stringify(state.me)); } catch {}
  VIBRO(10);
}
document.querySelectorAll('[data-priv] .segBtn').forEach((b) => (b.onclick = () => savePriv(b.closest('[data-priv]').dataset.priv, b.dataset.v)));
document.querySelectorAll('[data-priv-sw]').forEach((sw) => (sw.onclick = () => savePriv(sw.dataset.privSw, state.me[sw.dataset.privSw] === false)));
async function loadBlocked() {
  const box = $('blockList');
  if (!state.v3) { box.innerHTML = '<p class="dim small cardNote">Появится после обновления базы</p>'; return; }
  const ids = [...state.blocks];
  const miss = ids.filter((id) => !state.profiles.has(id));
  if (miss.length) { const { data } = await sb.from('profiles').select('*').in('id', miss); (data || []).forEach((p) => state.profiles.set(p.id, p)); }
  box.innerHTML = ids.map((id) => { const p = state.profiles.get(id) || { display_name: 'Пользователь', username: '…' };
    return `<div class="rowBtn">${avatarHtml(p.display_name, p.avatar_path, 'sm')}<span class="grow">${esc(p.display_name)}<br><span class="dim small">@${esc(p.username)}</span></span><button class="chip" data-unblock="${id}">Разблокировать</button></div>`; }).join('')
    || '<p class="dim small cardNote">Никого нет. Заблокировать можно в профиле собеседника (нажмите на имя в чате).</p>';
  box.querySelectorAll('[data-unblock]').forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from('blocks').delete().eq('owner', state.me.id).eq('blocked', b.dataset.unblock);
    if (error) return toast('Ошибка: ' + error.message);
    state.blocks.delete(b.dataset.unblock); loadBlocked(); toast('Разблокирован');
  }));
}
// звонки: решает принимающая сторона — по своим настройкам и чёрному списку
const callerOk = new Map();
async function acceptsCall(from) {
  if (!state.v3) return true;
  if (state.blocks.has(from)) return false;
  const hit = callerOk.get(from); if (hit && hit.t > Date.now() - 30000) return hit.ok;
  const { data, error } = await sb.rpc('accepts_from', { caller: from, what: 'call' });
  const ok = error ? true : data !== false; callerOk.set(from, { ok, t: Date.now() }); return ok;
}

// экран «Устройства»
function deviceId() {
  try { let id = localStorage.getItem('kc-dev'); if (!id) { id = crypto.randomUUID(); localStorage.setItem('kc-dev', id); } return id; }
  catch { return (state.devTmp ??= crypto.randomUUID()); }
}
function deviceName() {
  const u = navigator.userAgent;
  const os = /iphone/i.test(u) ? 'iPhone' : /ipad/i.test(u) ? 'iPad' : /android/i.test(u) ? 'Android' : /windows/i.test(u) ? 'Windows' : /mac os/i.test(u) ? 'Mac' : /linux/i.test(u) ? 'Linux' : 'Устройство';
  if (window.Capacitor) return os + ' · приложение KAMOX Chat';
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return os + ' · приложение с экрана Домой';
  const br = /YaBrowser/.test(u) ? 'Яндекс Браузер' : /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /CriOS|Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'браузер';
  return `${os} · ${br}`;
}
async function registerDevice() {
  const row = () => ({ id: deviceId(), user_id: state.me.id, name: deviceName(), last_active: new Date().toISOString() });
  let { error } = await sb.from('devices').upsert(row());
  // этот номер устройства уже занят другим аккаунтом (входили под другим ником) — берём новый
  if (error) { try { localStorage.removeItem('kc-dev'); } catch {} state.devTmp = null; ({ error } = await sb.from('devices').upsert(row())); }
  state.devOk = !error;
}
async function deviceBeat() {
  if (!state.v3 || !state.devOk) return;
  const { data, error } = await sb.from('devices').update({ last_active: new Date().toISOString() }).eq('id', deviceId()).select('id');
  // запись об устройстве удалили с другого телефона — значит, сеанс здесь завершён
  if (!error && data && !data.length) { state.devOk = false; toast('Сеанс на этом устройстве завершён', 4000); setTimeout(() => $('pLogout').onclick(), 1500); }
}
$('pDevices').onclick = () => { $('devQrBox').classList.add('hidden'); show('sDevices'); paintDevices(); };
function devRow(d, me) {
  const pc = /Windows|Mac|Linux/.test(d.name);
  return `<div class="rowBtn"><span class="rowIc ${me ? 'teal' : 'blue'}">${ic(pc ? 'devices' : 'install')}</span>
    <span class="grow">${esc(d.name)}<br><span class="dim small">${me ? 'это устройство · в сети' : 'активно ' + listTime(d.last_active) + ', ' + hhmm(d.last_active)}</span></span>
    ${me ? '' : `<button class="chip" data-dev-end="${esc(d.id)}">Завершить</button>`}</div>`;
}
async function paintDevices() {
  $('devThis').innerHTML = devRow({ name: deviceName() }, true);
  if (!state.v3) { $('devOthers').innerHTML = '<p class="dim small cardNote">Список устройств появится после обновления базы</p>'; $('devKill').classList.remove('hidden'); return; }
  const { data } = await sb.from('devices').select('*').eq('user_id', state.me.id).order('last_active', { ascending: false });
  const others = (data || []).filter((d) => d.id !== deviceId());
  $('devOthers').innerHTML = others.map((d) => devRow(d, false)).join('') || '<p class="dim small cardNote">Других устройств нет</p>';
  $('devKill').classList.toggle('hidden', !others.length);
  $('devOthers').querySelectorAll('[data-dev-end]').forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from('devices').delete().eq('id', b.dataset.devEnd);
    if (error) return toast('Ошибка: ' + error.message);
    toast('Сеанс на том устройстве завершится в течение минуты'); paintDevices();
  }));
}
$('devKill').onclick = async () => {
  if (!confirm('Выйти из аккаунта на всех других устройствах?')) return;
  const { error } = await sb.auth.signOut({ scope: 'others' });
  if (error) return toast('Ошибка: ' + error.message);
  if (state.v3) await sb.from('devices').delete().eq('user_id', state.me.id).neq('id', deviceId());
  toast('Готово: на других устройствах нужно будет войти заново', 4000); paintDevices();
};
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
// «Добавить устройство»: QR-код со ссылкой, которая открывает вход с уже вписанным ником
$('devAdd').onclick = async () => {
  const box = $('devQrBox'); if (!box.classList.contains('hidden')) return box.classList.add('hidden');
  try { await loadScript('qr.js'); } catch { return toast('Не удалось загрузить QR-код, проверьте интернет'); }
  const link = `https://kamox123.github.io/chat/#login=${state.me.username}`;
  const q = qrcode(0, 'M'); q.addData(link); q.make();
  $('devQr').innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  $('devLink').textContent = link; box.classList.remove('hidden');
};
$('devCopy').onclick = () => copyText($('devLink').textContent);
// школьный чат без интернета — есть только в приложении для Android (версия 1.8 и новее)
const LOCAL_CHAT = !!window.KamoxLocal;
function openLocalChat() { location.href = 'https://localhost/offline.html#name=' + encodeURIComponent(state.me?.display_name || ''); }
if (LOCAL_CHAT) { $('pLocal').classList.remove('hidden'); $('netLocal').classList.remove('hidden'); }
$('pLocal').onclick = $('netLocal').onclick = openLocalChat;
$('pLink').onclick = () => copyText(LINK(state.me.username), 'Ссылка на ваш профиль скопирована');

// ---------- админ-панель (только служебные сведения: кто, когда, какие группы; тексты сообщений база не отдаёт) ----------
let adminTab = 'users', adminData = { users: [], groups: [] };
async function checkAdmin() {
  if (!state.v3) return;
  const { data } = await sb.rpc('is_admin');
  state.admin = data === true;
  $('pAdmin').classList.toggle('hidden', !state.admin);
}
$('pAdmin').onclick = () => { show('sAdmin'); loadAdmin(); };
async function loadAdmin() {
  $('admList').innerHTML = '<p class="dim small cardNote">Загружаю…</p>';
  const [st, us, gr] = await Promise.all([sb.rpc('admin_stats'), sb.rpc('admin_users'), sb.rpc('admin_groups')]);
  if (st.error) { $('admList').innerHTML = `<p class="dim small cardNote">${esc(st.error.message)}</p>`; return; }
  const s = st.data;
  const tiles = [['Пользователей', s.users], ['Сейчас в сети', s.online], ['Новых сегодня', s.new_today], ['Новых за неделю', s.new_week],
    ['Групп', s.groups], ['Личных чатов', s.direct], ['Сообщений сегодня', s.messages_today], ['Сообщений всего', s.messages]];
  $('admStats').innerHTML = tiles.map(([t, v]) => `<div class="admTile glass"><b>${v}</b><span>${t}</span></div>`).join('');
  adminData = { users: us.data || [], groups: gr.data || [] };
  paintAdmin();
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
function paintAdmin() {
  const q = $('admSearch').value.trim().toLowerCase();
  document.querySelectorAll('#admTabs .segBtn').forEach((b) => b.classList.toggle('on', b.dataset.tab === adminTab));
  if (adminTab === 'users') {
    const list = adminData.users.filter((u) => !q || u.username.includes(q) || u.display_name.toLowerCase().includes(q));
    $('admList').innerHTML = list.map((u) => `
      <div class="admRow glass">
        ${avatarHtml(u.display_name, u.avatar_path, '', isOnline(u))}
        <div class="mid"><div class="t">${esc(u.display_name)}${u.is_admin ? ' <span class="admTag">админ</span>' : ''}${u.banned ? ' <span class="admTag red">заблокирован</span>' : ''}</div>
          <div class="s">@${esc(u.username)} · с ${fmtDate(u.created_at)}</div>
          <div class="s">${u.last_seen ? seenText(u) : 'скрывает время в сети'} · чатов ${u.chats}, групп ${u.groups}, сообщений ${u.messages}</div></div>
        ${u.is_admin || u.id === state.me.id ? '' : `<button class="chip ${u.banned ? 'on' : ''}" data-ban="${u.id}" data-to="${u.banned ? '0' : '1'}">${u.banned ? 'Разблокировать' : 'Заблокировать'}</button>`}
      </div>`).join('') || '<p class="dim small cardNote">Никого не нашли</p>';
    $('admList').querySelectorAll('[data-ban]').forEach((b) => (b.onclick = async () => {
      const u = adminData.users.find((x) => x.id === b.dataset.ban), ban = b.dataset.to === '1';
      if (ban && !confirm(`Заблокировать @${u.username}? Он(а) не сможет отправлять сообщения.`)) return;
      const { error } = await sb.rpc('admin_set_ban', { target: u.id, ban });
      if (error) return toast('Ошибка: ' + error.message);
      u.banned = ban; paintAdmin(); toast(ban ? 'Заблокирован' : 'Разблокирован');
    }));
  } else {
    const list = adminData.groups.filter((g) => !q || g.title.toLowerCase().includes(q) || g.member_names.join(' ').toLowerCase().includes(q));
    $('admList').innerHTML = list.map((g) => `
      <div class="admRow glass">
        ${avatarHtml(g.title, g.avatar_path)}
        <div class="mid"><div class="t">${esc(g.title)}</div>
          <div class="s">создал(а) ${esc(g.creator || '—')} · ${fmtDate(g.created_at)} · сообщений ${g.messages}</div>
          <div class="s wrap">Участники (${g.members}): ${esc(g.member_names.join(', '))}</div></div>
      </div>`).join('') || '<p class="dim small cardNote">Групп нет</p>';
  }
}
document.querySelectorAll('#admTabs .segBtn').forEach((b) => (b.onclick = () => { adminTab = b.dataset.tab; paintAdmin(); }));
$('admSearch').oninput = paintAdmin;
$('admReload').onclick = loadAdmin;

// ---------- мгновенная доставка ----------
function subscribe() {
  sb.channel('db')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async ({ new: m }) => {
      if (!state.chats.has(m.chat_id)) { await loadChats(); }
      if (!state.profiles.has(m.sender_id)) { const { data } = await sb.from('profiles').select('*').eq('id', m.sender_id).single(); if (data) state.profiles.set(data.id, data); }
      addMsg(m);
      if (m.sender_id !== state.me.id && (state.open !== m.chat_id || document.hidden)) notifyLocal(m);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_members', filter: `user_id=eq.${state.me.id}` }, () => loadChats())
    .subscribe((st) => {
      // связь восстановилась после обрыва — догружаем то, что пропустили
      if (st === 'SUBSCRIBED') { netUp(); if (state.wasDown) { state.wasDown = false; loadChats(); if (state.open) openChat(state.open, true); } }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { state.wasDown = true; netDown(); }
    });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { heartbeat(); const c = state.chats.get(state.open); if (c) markRead(c); } });
}
// ---------- звуки (синтезируются на лету, без файлов) ----------
let audioCtx;
function ac() { audioCtx ??= new AudioContext(); if (audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx; }
function beep(f = 880, len = 0.12, vol = 0.12) {
  if (!prefs.sound) return;
  try { const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + len);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + len); } catch {}
}
const sfx = {
  // «вжух» при отправке: шум через фильтр, частота быстро уходит вверх
  send() {
    if (!prefs.sound) return;
    try {
      const a = ac(), t = a.currentTime, len = 0.22;
      const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = a.createBufferSource(); src.buffer = buf;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(4200, t + len);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      src.connect(f).connect(g).connect(a.destination); src.start(t); src.stop(t + len);
      const o = a.createOscillator(), og = a.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(660, t + 0.05); o.frequency.exponentialRampToValueAtTime(1320, t + 0.14);
      og.gain.setValueAtTime(0.0001, t + 0.05); og.gain.exponentialRampToValueAtTime(0.08, t + 0.08); og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(og).connect(a.destination); o.start(t + 0.05); o.stop(t + 0.22);
    } catch {}
  },
  // мягкий «дзынь» при входящем сообщении
  receive() { beep(988, 0.1, 0.1); setTimeout(() => beep(1480, 0.16, 0.08), 80); },
  // щелчок начала и конца записи голосового
  recStart() { beep(740, 0.07, 0.1); setTimeout(() => beep(1110, 0.09, 0.1), 70); },
  recStop() { beep(1110, 0.07, 0.08); setTimeout(() => beep(740, 0.09, 0.08), 70); },
};
// уведомление, пока приложение открыто (когда закрыто — их присылает сервер, см. push)
function notifyLocal(m) {
  const c = state.chats.get(m.chat_id), p = state.profiles.get(m.sender_id);
  const title = c?.is_group ? `${c.title}: ${p?.display_name}` : p?.display_name || 'Новое сообщение';
  const text = previewParts(m)[1];
  VIBRO(40);
  if (document.hidden) return; // свёрнутое приложение получит пуш от сервера
  if (state.open !== m.chat_id) toast(`${title}: ${text}`);
}

// ---------- push-уведомления (приходят, даже когда приложение закрыто) ----------
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function b64ToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(s + '='.repeat((4 - (s.length % 4)) % 4)); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); }
async function syncPush(ask) {
  paintNotifUi();
  if (!pushSupported()) return false;
  if (ask && Notification.permission === 'default') { const r = await Notification.requestPermission(); paintNotifUi(); if (r !== 'granted') return false; }
  if (Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID) });
    const j = sub.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: state.me.id, p256dh: j.keys.p256dh, auth: j.keys.auth });
    if (error) throw error;
    paintNotifUi(); return true;
  } catch (e) { if (ask) toast('Не удалось включить уведомления: ' + (e.message || e)); return false; }
}
function paintNotifUi() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let text = 'Включены', can = false;
  if (!pushSupported()) text = ios && !standalone ? 'Сначала добавьте на экран Домой' : 'Не поддерживаются';
  else if (Notification.permission === 'default') { text = 'Выключены'; can = true; }
  else if (Notification.permission === 'denied') text = 'Запрещены в настройках';
  $('pNotifState').textContent = text;
  $('notifTip').classList.toggle('hidden', !can || localStorage.getItem('kc-notif-hide') === '1');
}
$('notifGo').onclick = async () => { if (await syncPush(true)) toast('Уведомления включены'); };
$('pNotif').onclick = async () => {
  if (Notification?.permission === 'denied') return toast('Разрешите уведомления в настройках браузера или телефона');
  if (await syncPush(true)) toast('Уведомления включены');
};

// ---------- профиль ----------
$('meBtn').onclick = () => {
  const me = state.me;
  $('pAvatar').setAttribute('style', avatarStyle(me.display_name, me.avatar_path));
  $('pAvatar').textContent = me.avatar_path ? '' : (me.display_name[0] || '?').toUpperCase();
  $('pName').value = me.display_name; $('pUser').textContent = '@' + me.username; $('pBio').value = me.bio || ''; $('pBioWrap').classList.toggle('hidden', !state.v3);
  paintNotifUi();
  show('sProfile');
};
$('pSave').onclick = async () => {
  const name = $('pName').value.trim(); if (!name) return;
  const bio = $('pBio').value.trim().slice(0, 140);
  const { error } = await sb.from('profiles').update(state.v3 ? { display_name: name, bio } : { display_name: name }).eq('id', state.me.id);
  if (error) return toast('Ошибка: ' + error.message);
  state.me.display_name = name; if (state.v3) state.me.bio = bio; paintMe(); toast('Сохранено');
};
$('pAvatar').onclick = $('pAvatarBtn').onclick = () => $('avatarInput').click();
$('avatarInput').onchange = async () => {
  const f = $('avatarInput').files[0]; $('avatarInput').value = ''; if (!f) return;
  try {
    const blob = await shrinkImage(f, 400, 0.85), path = `${state.me.id}/avatar-${Date.now()}.jpg`;
    const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }); if (error) throw error;
    await sb.from('profiles').update({ avatar_path: path }).eq('id', state.me.id);
    state.me.avatar_path = path; paintMe();
    $('pAvatar').setAttribute('style', avatarStyle(state.me.display_name, path)); $('pAvatar').textContent = ''; toast('Фото обновлено');
  } catch (e) { toast('Ошибка: ' + (e.message || e)); }
};
$('pLogout').onclick = async () => {
  try { const sub = await (await navigator.serviceWorker?.ready)?.pushManager?.getSubscription(); if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } } catch {}
  try { if (state.v3 && state.devOk) await sb.from('devices').delete().eq('id', deviceId()); } catch {}
  try { localStorage.removeItem('kc-me'); } catch {}
  await sb.auth.signOut(); location.reload();
};

$('themes').innerHTML = THEMES.map(([id, name, a, b]) => `<button data-theme="${id}" style="background:linear-gradient(135deg,${a},${b})" aria-label="${name}"><span>${name}</span></button>`).join('');
$('themes').querySelectorAll('button').forEach((b) => (b.onclick = () => { prefs.theme = b.dataset.theme; savePrefs(); sfx.receive(); }));
document.querySelectorAll('.switch[data-set]').forEach((sw) => (sw.onclick = () => { prefs[sw.dataset.set] = !prefs[sw.dataset.set]; savePrefs(); if (sw.dataset.set === 'sound') sfx.receive(); if (sw.dataset.set === 'vibro') VIBRO(60); }));
document.querySelectorAll('#fontSeg .segBtn').forEach((b) => (b.onclick = () => { prefs.font = b.dataset.font; savePrefs(); }));
$('pPass').onclick = () => { $('passBox').classList.toggle('hidden'); $('newPass').focus(); };
$('passSave').onclick = async () => {
  const p = $('newPass').value; if (p.length < 6) return toast('Пароль минимум 6 символов');
  const { error } = await sb.auth.updateUser({ password: p });
  if (error) return toast('Ошибка: ' + error.message);
  $('newPass').value = ''; $('passBox').classList.add('hidden'); toast('Пароль изменён');
};
$('pTestPush').onclick = async () => {
  if (!(await syncPush(true))) return;
  const { error } = await sb.functions.invoke('notify', { body: { type: 'test' } });
  toast(error ? 'Сервер уведомлений ещё не подключён' : 'Отправил — сверните приложение, уведомление придёт через пару секунд', 4000);
};

// подсказка «установить как приложение»
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (state.me) installTip(); });
function installTip() {
  const tip = $('installTip');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone || window.Capacitor;
  if (standalone || localStorage.getItem('kc-tip-hide')) return tip.classList.add('hidden');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) tip.innerHTML = `${ic('install')}<span class="grow">Установите как приложение: «Поделиться» → «На экран Домой»</span><button class="icon" id="tipX">${ic('close')}</button>`;
  else if (deferredInstall) tip.innerHTML = `${ic('install')}<span class="grow">Установить KAMOX Chat на телефон</span><button class="chip on" id="tipGo">Установить</button><button class="icon" id="tipX">${ic('close')}</button>`;
  else return tip.classList.add('hidden');
  tip.classList.remove('hidden');
  $('tipX').onclick = () => { localStorage.setItem('kc-tip-hide', '1'); tip.classList.add('hidden'); };
  if ($('tipGo')) $('tipGo').onclick = async () => { deferredInstall.prompt(); deferredInstall = null; tip.classList.add('hidden'); };
}

// ---------- звонки (WebRTC, сигналы через Supabase Realtime) ----------
const RELAY = 'wss://vtoroy-mozg-bot.onrender.com/relay/'; // запасной канал звонков через сервер (см. startRelay)
const call = { id: null, relay: null, rctx: null, fallback: null, pc: null, local: null, peer: null, chat: null, video: false, started: 0, incoming: null, outCh: new Map(), timer: null, ring: null, resend: null, pendingIce: [] };
function sigChannel(uid) {
  if (!call.outCh.has(uid)) { const ch = sb.channel('call-' + uid); ch.subscribe(); call.outCh.set(uid, ch); }
  return call.outCh.get(uid);
}
function signal(uid, payload) { return sigChannel(uid).send({ type: 'broadcast', event: 'sig', payload: { ...payload, from: state.me.id } }); }
function listenCalls() { sb.channel('call-' + state.me.id).on('broadcast', { event: 'sig' }, ({ payload: s }) => onSignal(s)).subscribe(); }
async function onSignal(s) {
  if (s.type === 'offer') {
    if (call.pc || (call.incoming && call.incoming.from === s.from)) { if (call.peer !== s.from) signal(s.from, { type: 'busy' }); return; } // повтор того же вызова — не мешает
    if (!(await acceptsCall(s.from))) { signal(s.from, { type: 'decline' }); return; } // ограничил звонки или в чёрном списке
    if (call.pc || call.incoming) return;
    call.incoming = s; call.peer = s.from; call.chat = s.chat; call.video = !!s.video; call.id = s.id || null;
    if (!state.profiles.has(s.from)) { const { data } = await sb.from('profiles').select('*').eq('id', s.from).single(); if (data) state.profiles.set(data.id, data); }
    openCallUi('Входящий ' + (s.video ? 'видеозвонок' : 'звонок'), true);
    const ring = () => { beep(784, 0.22, 0.16); setTimeout(() => beep(988, 0.3, 0.16), 260); VIBRO([300, 200, 300]); };
    ring(); call.ring = setInterval(ring, 1800);
  } else if (s.from !== call.peer) return;
  else if (s.type === 'answer') { if (call.pc?.signalingState !== 'have-local-offer') return; clearInterval(call.resend); await call.pc.setRemoteDescription(s.sdp); flushIce(); setCallState('Соединение…'); armFallback(); }
  else if (s.type === 'relay') { if (call.local) startRelay(); }
  else if (s.type === 'ice') { if (call.pc?.remoteDescription) call.pc.addIceCandidate(s.c).catch(() => {}); else call.pendingIce.push(s.c); }
  else if (s.type === 'hangup' || s.type === 'decline' || s.type === 'busy') {
    const missed = s.type === 'hangup' && call.incoming && !call.started;
    endCall(false, s.type === 'busy' ? 'Абонент занят' : s.type === 'decline' ? 'Звонок отклонён' : missed ? 'Пропущенный звонок' : 'Звонок завершён');
  }
}
function flushIce() { call.pendingIce.forEach((c) => call.pc.addIceCandidate(c).catch(() => {})); call.pendingIce = []; }
function newPc() {
  // для проверки: localStorage kc-relay=1 — прямое соединение заведомо не получится, звонок пойдёт через сервер
  let force = false; try { force = localStorage.getItem('kc-relay') === '1'; } catch {}
  const pc = new RTCPeerConnection(force ? { iceServers: [], iceTransportPolicy: 'relay' } : { iceServers: ICE });
  pc.onicecandidate = (e) => e.candidate && signal(call.peer, { type: 'ice', c: e.candidate.toJSON() });
  pc.ontrack = (e) => {
    const st = e.streams[0] || new MediaStream([e.track]);
    if (e.track.kind === 'audio') { $('remoteAudio').srcObject = st; $('remoteAudio').play().catch(() => {}); }
    if (e.track.kind === 'video') { const v = $('remoteVideo'); v.srcObject = st; v.play().catch(() => {}); $('sCall').classList.add('video'); }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected' && !call.started) { call.started = Date.now(); call.timer = setInterval(() => setCallState(fmtDur((Date.now() - call.started) / 1000)), 1000); }
    // напрямую не вышло (в России так бывает часто) — переходим на запасной канал через сервер
    if (pc.connectionState === 'failed' && call.pc === pc) startRelay();
  };
  return pc;
}
async function getMedia(video) {
  try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { facingMode: 'user', width: 640, height: 480 } : false }); }
  catch { toast('Нет доступа к ' + (video ? 'камере и микрофону' : 'микрофону')); return null; }
}
async function startCall(video) {
  const c = state.chats.get(state.open); const peer = c && chatPeer(c); if (!peer || c.is_group) return;
  if (call.pc) return toast('Уже идёт звонок');
  if (state.v3) { const { data: can } = await sb.rpc('can_reach', { target: peer.id, what: 'call' }); if (can === false) return toast('Этот пользователь ограничил, кто может ему звонить'); }
  call.peer = peer.id; call.chat = c.id; call.video = video; call.incoming = null; call.id = crypto.randomUUID();
  const media = await getMedia(video); if (!media) return;
  call.local = media; call.pc = newPc();
  media.getTracks().forEach((t) => call.pc.addTrack(t, media));
  if (video) showSelf(media);
  openCallUi('Вызов…', false);
  const offer = await call.pc.createOffer(); await call.pc.setLocalDescription(offer);
  const send = () => signal(peer.id, { type: 'offer', sdp: call.pc?.localDescription?.toJSON(), video, chat: c.id, id: call.id });
  await send();
  // повторяем вызов, пока собеседник не ответит: если его приложение открылось по уведомлению, он всё равно получит звонок
  call.resend = setInterval(() => { if (call.pc && !call.started) send(); }, 3000);
  sb.functions.invoke('notify', { body: { type: 'ring', chat: c.id, video } }).catch(() => {});
  call.noAnswer = setTimeout(() => { if (!call.started) { signal(call.peer, { type: 'hangup' }); endCall(true, 'Нет ответа'); } }, 45000);
}
function showSelf(media) { const v = $('localVideo'); v.srcObject = media; v.play().catch(() => {}); $('sCall').classList.add('selfcam'); }
// телефоны разрешают звук только после нажатия: «разблокируем» плеер прямо в момент нажатия кнопки
function unlockAudio() {
  const a = $('remoteAudio'); a.muted = false; a.play().catch(() => {}); ac();
  // звук запасного канала: создаём заранее, пока есть нажатие (иначе телефон не даст его включить)
  try { if (!call.rctx || call.rctx.state === 'closed') call.rctx = new AudioContext({ sampleRate: 16000 }); call.rctx.resume(); } catch {}
}
$('callAudio').onclick = () => { unlockAudio(); startCall(false); };
$('callVideo').onclick = () => { unlockAudio(); startCall(true); };
$('callFlip').onclick = async () => {
  const old = call.local?.getVideoTracks()[0]; if (!old) return;
  call.facing = call.facing === 'environment' ? 'user' : 'environment';
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: call.facing, width: 640, height: 480 } });
    const t = st.getVideoTracks()[0];
    await call.pc?.getSenders().find((x) => x.track?.kind === 'video')?.replaceTrack(t);
    call.local.removeTrack(old); old.stop(); call.local.addTrack(t); showSelf(call.local);
  } catch { toast('Не удалось переключить камеру'); }
};
$('callAccept').onclick = async () => {
  unlockAudio(); clearInterval(call.ring); const s = call.incoming;
  const media = await getMedia(s.video); if (!media) { declineCall(); return; }
  call.local = media; call.pc = newPc();
  media.getTracks().forEach((t) => call.pc.addTrack(t, media));
  if (s.video) showSelf(media);
  await call.pc.setRemoteDescription(s.sdp); flushIce();
  const ans = await call.pc.createAnswer(); await call.pc.setLocalDescription(ans);
  signal(call.peer, { type: 'answer', sdp: call.pc.localDescription.toJSON() });
  $('callAccept').classList.add('hidden'); setCallState('Соединение…'); armFallback();
};
function declineCall() { signal(call.peer, { type: 'decline' }); endCall(false, null); }
$('callHang').onclick = () => {
  if (call.incoming && !call.pc) return declineCall();
  signal(call.peer, { type: 'hangup' }); endCall(true, call.started ? 'Звонок завершён' : 'Отменён');
};
$('callMute').onclick = () => { const t = call.local?.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; $('callMute').classList.toggle('off', !t.enabled); };
$('callCam').onclick = () => { const t = call.local?.getVideoTracks()[0]; if (!t) return toast('Камера не включена'); t.enabled = !t.enabled; $('callCam').classList.toggle('off', !t.enabled); };
function openCallUi(text, incoming) {
  const p = state.profiles.get(call.peer);
  $('callName').textContent = p?.display_name || 'Звонок';
  $('callAvatar').setAttribute('style', avatarStyle(p?.display_name, p?.avatar_path));
  $('callAvatar').textContent = p?.avatar_path ? '' : (p?.display_name?.[0] || '?').toUpperCase();
  $('callAccept').classList.toggle('hidden', !incoming);
  $('callCam').classList.toggle('hidden', !call.video);
  setCallState(text); $('sCall').classList.remove('hidden');
}
function setCallState(t) { $('callState').textContent = t; }
async function endCall(iRecord, text) {
  clearInterval(call.ring); clearInterval(call.timer); clearInterval(call.resend); clearTimeout(call.noAnswer); clearTimeout(call.fallback);
  stopRelay();
  const dur = call.started ? (Date.now() - call.started) / 1000 : 0, chat = call.chat, wasCaller = !call.incoming, video = call.video;
  call.local?.getTracks().forEach((t) => t.stop());
  call.pc?.close();
  Object.assign(call, { pc: null, local: null, started: 0, incoming: null, pendingIce: [], id: null });
  $('sCall').classList.add('hidden'); $('sCall').classList.remove('video', 'selfcam', 'relayvid'); call.facing = 'user';
  ['remoteVideo', 'localVideo', 'remoteAudio'].forEach((id) => ($(id).srcObject = null));
  $('callMute').classList.remove('off'); $('callCam').classList.remove('off');
  if (text) toast(text);
  if (iRecord && wasCaller && chat) {
    const body = dur ? `${video ? 'Видеозвонок' : 'Звонок'}, ${fmtDur(dur)}` : text === 'Нет ответа' ? 'Пропущенный звонок' : 'Отменённый звонок';
    const { data } = await sb.from('messages').insert({ chat_id: chat, sender_id: state.me.id, kind: 'call', body }).select().single();
    if (data) addMsg(data);
  }
}

// ---------- запасной канал звонка через сервер ----------
// Прямое соединение телефонов в России часто блокируется. Если за 7 секунд оно не установилось,
// оба собеседника подключаются к серверу на Render (он открывается без VPN), и тот пересылает звук и кадры видео.
function armFallback() {
  clearTimeout(call.fallback);
  call.fallback = setTimeout(() => { if (call.local && !call.started) startRelay(); }, 7000);
}
// обработчики звука: запись кусками по 20 мс (16 кГц) и проигрывание с небольшим запасом против рывков
const WORKLET = `
class Cap extends AudioWorkletProcessor {
  constructor() { super(); this.b = new Int16Array(320); this.n = 0; }
  process(inp) { const ch = inp[0] && inp[0][0]; if (ch) for (let k = 0; k < ch.length; k++) {
    const v = Math.max(-1, Math.min(1, ch[k])); this.b[this.n++] = v * 32767;
    if (this.n === 320) { this.port.postMessage(this.b.slice(0)); this.n = 0; } } return true; }
}
class Play extends AudioWorkletProcessor {
  constructor() { super(); this.q = []; this.cur = null; this.pos = 0; this.size = 0; this.on = false;
    this.port.onmessage = (e) => { this.q.push(e.data); this.size += e.data.length;
      if (this.size > 9600) while (this.size > 3200) this.size -= this.q.shift().length; }; }
  process(_, out) { const o = out[0][0];
    if (!this.on) { if (this.size < 1600) { o.fill(0); return true; } this.on = true; }
    for (let k = 0; k < o.length; k++) {
      if (!this.cur || this.pos >= this.cur.length) { this.cur = this.q.shift(); this.pos = 0;
        if (!this.cur) { o.fill(0, k); this.on = false; return true; } this.size -= this.cur.length; }
      o[k] = this.cur[this.pos++] / 32768; }
    return true; }
}
registerProcessor('kc-cap', Cap); registerProcessor('kc-play', Play);`;
async function startRelay() {
  if (call.relay || !call.local || !call.id) return;
  clearTimeout(call.fallback);
  const r = (call.relay = { ws: null, nodes: [], vt: null, busy: false, loop: null });
  signal(call.peer, { type: 'relay' });
  if (!call.started) setCallState('Соединение через сервер…');
  if (call.pc) { call.pc.onconnectionstatechange = null; call.pc.close(); }
  try {
    let ctx = call.rctx;
    if (!ctx || ctx.state === 'closed') ctx = call.rctx = new AudioContext({ sampleRate: 16000 });
    ctx.resume().catch(() => {});
    if (!ctx.kcReady) { const u = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })); await ctx.audioWorklet.addModule(u); ctx.kcReady = true; }
    if (call.relay !== r) return;
    const ws = (r.ws = new WebSocket(RELAY + call.id)); ws.binaryType = 'arraybuffer';
    const cap = new AudioWorkletNode(ctx, 'kc-cap'), play = new AudioWorkletNode(ctx, 'kc-play');
    const src = ctx.createMediaStreamSource(call.local), mute = ctx.createGain(); mute.gain.value = 0;
    src.connect(cap).connect(mute).connect(ctx.destination); // «заглушка»: запись идёт, но себя не слышно
    r.nodes = [src, cap, play, mute];
    playOut(ctx, play, r);
    cap.port.onmessage = (e) => {
      if (ws.readyState !== 1 || ws.bufferedAmount > 64000) return;
      const pkt = new Uint8Array(1 + e.data.byteLength); pkt[0] = 1; pkt.set(new Uint8Array(e.data.buffer), 1); ws.send(pkt);
    };
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        if (e.data === 'peer') relayLive();
        else if (e.data === 'bye' && call.relay === r) setCallState('Собеседник переподключается…');
        return;
      }
      const d = new Uint8Array(e.data);
      if (d[0] === 1) { const pcm = new Int16Array(d.slice(1).buffer); play.port.postMessage(pcm, [pcm.buffer]); }
      else if (d[0] === 2) drawRemote(d.subarray(1));
    };
    ws.onclose = () => { if (call.relay === r) endCall(true, call.started ? 'Связь прервалась' : 'Не удалось соединиться'); };
    if (call.video) r.vt = setInterval(() => sendFrame(ws, r), 140);
  } catch { if (call.relay === r) endCall(true, 'Не удалось соединиться'); }
}
// звук собеседника идёт через «петлю» WebRTC внутри телефона — так работает подавление эха; не вышло — напрямую
async function playOut(ctx, play, r) {
  const direct = () => play.connect(ctx.destination);
  if (IS_IOS) return direct();
  try {
    const dest = ctx.createMediaStreamDestination(); play.connect(dest);
    const a = new RTCPeerConnection(), b = new RTCPeerConnection(); r.loop = [a, b];
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate).catch(() => {});
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate).catch(() => {});
    b.ontrack = (e) => { const el = $('remoteAudio'); el.srcObject = new MediaStream([e.track]); el.play().catch(() => {}); };
    dest.stream.getTracks().forEach((t) => a.addTrack(t, dest.stream));
    const o = await a.createOffer(); await a.setLocalDescription(o); await b.setRemoteDescription(o);
    const an = await b.createAnswer(); await b.setLocalDescription(an); await a.setRemoteDescription(an);
    setTimeout(() => { if (call.relay === r && a.connectionState !== 'connected') { a.close(); b.close(); r.loop = null; play.disconnect(); direct(); } }, 3000);
  } catch { try { play.disconnect(); } catch {} direct(); }
}
function relayLive() {
  if (!call.started) { call.started = Date.now(); call.timer = setInterval(() => setCallState(fmtDur((Date.now() - call.started) / 1000)), 1000); }
  setCallState(fmtDur((Date.now() - call.started) / 1000));
}
const vCanvas = document.createElement('canvas');
function sendFrame(ws, r) {
  const v = $('localVideo'), t = call.local?.getVideoTracks()[0];
  if (r.busy || ws.readyState !== 1 || ws.bufferedAmount > 120000 || !t?.enabled || !v.videoWidth) return;
  const k = Math.min(1, 400 / Math.max(v.videoWidth, v.videoHeight));
  vCanvas.width = Math.round(v.videoWidth * k); vCanvas.height = Math.round(v.videoHeight * k);
  vCanvas.getContext('2d').drawImage(v, 0, 0, vCanvas.width, vCanvas.height);
  r.busy = true;
  vCanvas.toBlob(async (b) => {
    r.busy = false; if (!b || ws.readyState !== 1) return;
    const buf = new Uint8Array(await b.arrayBuffer()), pkt = new Uint8Array(buf.length + 1); pkt[0] = 2; pkt.set(buf, 1); ws.send(pkt);
  }, 'image/jpeg', 0.55);
}
async function drawRemote(bytes) {
  try {
    const img = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' })), cv = $('remoteCanvas');
    if (cv.width !== img.width || cv.height !== img.height) { cv.width = img.width; cv.height = img.height; }
    cv.getContext('2d').drawImage(img, 0, 0); img.close?.();
    $('sCall').classList.add('video', 'relayvid');
  } catch {}
}
function stopRelay() {
  const r = call.relay; if (!r) return; call.relay = null;
  clearInterval(r.vt);
  try { if (r.ws) { r.ws.onclose = null; r.ws.close(); } } catch {}
  r.nodes.forEach((n) => { try { n.disconnect(); } catch {} });
  r.loop?.forEach((pc) => pc.close());
}

// ---------- старт ----------
const UA = navigator.userAgent, IS_IOS = /iphone|ipad|ipod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const IS_APP = !!window.Capacitor || matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (/android/i.test(UA) && !window.Capacitor) $('apkLink').classList.remove('hidden');
if (IS_IOS && !navigator.standalone) $('iosHint').classList.remove('hidden');
// начальный экран: скачать приложение или продолжить в браузере
if (IS_IOS) { $('wAndroid').classList.add('hidden'); $('wIos').classList.remove('hidden'); }
// встроенные браузеры (Telegram, VK, Instagram…) часто не скачивают файлы — предлагаем Chrome
if (/android/i.test(UA) && /; wv\)|Telegram|VKAndroidApp|Instagram|FBAN|FB_IAB|YaApp|MiuiBrowser/i.test(UA)) {
  $('wInApp').classList.remove('hidden');
  $('wChrome').href = 'intent://' + location.host + location.pathname.replace(/[^/]*$/, '') + 'kamox-chat.apk#Intent;scheme=https;package=com.android.chrome;end';
}
$('wApk').addEventListener('click', () => $('wSteps').classList.remove('hidden'));
$('wWeb').onclick = () => { try { localStorage.setItem('kc-web', '1'); } catch {} show('sAuth', false); };
if (!IS_APP) { $('toWelcome').classList.remove('hidden'); $('apkLink').classList.add('hidden'); }
$('toWelcome').onclick = () => show('sWelcome', false);
// ссылки: #@ник — открыть профиль человека, #login=ник — вход на новом устройстве с уже вписанным ником
const HASH = decodeURIComponent(location.hash.slice(1));
const linkUser = /^@([a-z0-9_]{3,20})$/.exec(HASH)?.[1], linkLogin = /^login=([a-z0-9_]{3,20})$/.exec(HASH)?.[1];
if (linkUser || linkLogin) history.replaceState(null, '', location.pathname + location.search);
state.pendingUser = linkUser || null;
const firstScreen = () => { let web = false; try { web = !!localStorage.getItem('kc-web'); } catch {} return IS_APP || web ? 'sAuth' : 'sWelcome'; };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.chat && state.chats.has(e.data.chat)) openChat(e.data.chat); });
// открыли приложение нажатием на уведомление: ?chat=… — сразу в нужный чат
const openFromPush = new URLSearchParams(location.search).get('chat');
document.getElementById('appVer').textContent = APP_VER;
applyPrefs();
sb.auth.getSession().then(async ({ data }) => {
  if (!data.session) {
    if (linkLogin) { setAuthMode('login'); $('aUser').value = linkLogin; show('sAuth', false); return setTimeout(() => $('aPass').focus(), 300); }
    return show(firstScreen(), false);
  }
  await start(data.session);
  if (openFromPush && state.chats.has(openFromPush)) openChat(openFromPush);
});
