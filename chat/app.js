// KAMOX Chat — мессенджер (Supabase: база, файлы, мгновенная доставка; звонки — WebRTC; уведомления — Web Push)
'use strict';
const SB_URL = 'https://zqhhczwewvvgeavpulas.supabase.co';
const SB_KEY = 'sb_publishable_s-wUfxpZmZKf0kEqoTMclQ_uPyuabsp';
const VAPID = 'BBD19_NqHMSkr_P_r-IV1ohfzI9UM0n614PaCsiUvaTPBvnOimS190hnDdXKTZS6aQZtvR8g5SWnVV7pnyIcJCk';
const MAIL = (u) => `${u}@kamox-chat.app`; // ник превращается в «почту» только для входа, писем никто не получает
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { me: null, chats: new Map(), profiles: new Map(), open: null, msgs: new Map(), screen: 'sAuth', history: [] };

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
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
function paintIcons(root = document) { root.querySelectorAll('i[data-ic]').forEach((i) => { i.outerHTML = ic(i.dataset.ic); }); }
paintIcons();

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
  if (!p?.last_seen) return '';
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

$('authForm').onsubmit = async (e) => {
  e.preventDefault();
  const user = $('aUser').value.trim().toLowerCase(), pass = $('aPass').value, name = $('aName').value.trim();
  $('aErr').textContent = '';
  if (!/^[a-z0-9_]{3,20}$/.test(user)) { $('aErr').textContent = 'Ник: 3–20 символов, латинские буквы, цифры и _'; return; }
  if (pass.length < 6) { $('aErr').textContent = 'Пароль минимум 6 символов'; return; }
  $('aBtn').disabled = true;
  try {
    if (authMode === 'register') {
      const { error } = await sb.auth.signUp({ email: MAIL(user), password: pass, options: { data: { username: user, display_name: name || user } } });
      if (error) throw error;
    }
    const { error } = await sb.auth.signInWithPassword({ email: MAIL(user), password: pass });
    if (error) throw error;
    await start();
  } catch (err) {
    const m = String(err.message || err);
    $('aErr').textContent = /already registered|Database error/i.test(m) ? 'Этот ник уже занят'
      : /Invalid login/i.test(m) ? 'Неверный ник или пароль'
      : /Email not confirmed/i.test(m) ? 'Аккаунт не подтверждён'
      : 'Ошибка: ' + m;
  } finally { $('aBtn').disabled = false; }
};

// ---------- запуск после входа ----------
async function start() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { show('sAuth', false); return; }
  const { data: me } = await sb.from('profiles').select('*').eq('id', user.id).single();
  state.me = me; state.profiles.set(me.id, me);
  paintMe();
  state.history = [];
  show('sChats', false);
  await loadChats();
  subscribe();
  listenCalls();
  heartbeat(); setInterval(heartbeat, 60000);
  installTip();
  syncPush(false);
}
function paintMe() { $('meBtn').innerHTML = avatarHtml(state.me.display_name, state.me.avatar_path, 'sm'); }
function heartbeat() { if (state.me && !document.hidden) sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', state.me.id).then(() => {}); }

// ---------- список чатов ----------
let chatsLoading = null;
function loadChats() { return (chatsLoading ??= loadChatsNow().finally(() => (chatsLoading = null))); }
async function loadChatsNow() {
  const { data, error } = await sb.from('chat_members')
    .select('last_read_at, chats(id,is_group,title,avatar_path,last_message_at, chat_members(user_id, profiles(id,username,display_name,avatar_path,last_seen)))')
    .eq('user_id', state.me.id);
  if (error) { toast('Не удалось загрузить чаты'); return; }
  state.chats.clear();
  if (!state.listShown) { state.listShown = true; $('chatList').classList.add('animList'); setTimeout(() => $('chatList').classList.remove('animList'), 900); }
  for (const row of data) {
    const c = row.chats; if (!c) continue;
    const members = c.chat_members.map((m) => m.profiles).filter(Boolean);
    members.forEach((p) => state.profiles.set(p.id, p));
    state.chats.set(c.id, { ...c, members, lastRead: row.last_read_at, last: null, unread: 0 });
  }
  await Promise.all([...state.chats.values()].map(async (c) => {
    const [{ data: last }, { count }] = await Promise.all([
      sb.from('messages').select('*').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(1),
      sb.from('messages').select('id', { count: 'exact', head: true }).eq('chat_id', c.id).gt('created_at', c.lastRead).neq('sender_id', state.me.id),
    ]);
    c.last = last?.[0] || null; c.unread = count || 0;
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
  const map = { image: ['image', 'Фото'], file: ['file', m.file_name || 'Файл'], voice: ['mic', 'Голосовое сообщение'], call: [/Пропущ|Отмен/.test(m.body || '') ? 'missed' : 'phone', m.body || 'Звонок'] };
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
  const q = $('userSearch').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  let req = sb.from('profiles').select('id,username,display_name,avatar_path,last_seen').neq('id', state.me.id).order('last_seen', { ascending: false }).limit(30);
  if (q) req = req.ilike('username', `%${q}%`);
  const { data } = await req;
  (data || []).forEach((p) => state.profiles.set(p.id, p));
  $('userList').innerHTML = (data || []).map((p) => `
    <button class="item ${picked.has(p.id) ? 'sel' : ''}" data-user="${p.id}">
      ${avatarHtml(p.display_name, p.avatar_path, '', isOnline(p))}
      <div class="mid"><div class="t">${esc(p.display_name)}</div><div class="s">@${esc(p.username)} · ${seenText(p)}</div></div>
      ${groupMode ? `<span class="check">${picked.has(p.id) ? ic('check') : ''}</span>` : ''}
    </button>`).join('') || '<div class="empty" style="margin-top:12vh"><div class="emptyIc">' + ic('search') + '</div><p>Никого не нашли</p><span class="muted">Проверьте ник</span></div>';
  $('userList').querySelectorAll('[data-user]').forEach((b) => (b.onclick = async () => {
    const p = state.profiles.get(b.dataset.user);
    if (groupMode) {
      picked.has(p.id) ? picked.delete(p.id) : picked.set(p.id, p);
      b.classList.toggle('sel'); b.querySelector('.check').innerHTML = picked.has(p.id) ? ic('check') : ''; syncNewUi(); return;
    }
    const { data: id, error } = await sb.rpc('open_direct_chat', { other: p.id });
    if (error) return toast('Ошибка: ' + error.message);
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
function syncSendBtn() { const has = input.value.trim().length > 0; $('sendBtn').classList.toggle('hidden', !has); $('micBtn').classList.toggle('hidden', has); }
syncSendBtn();
$('sendBtn').onclick = sendText;
async function sendText() {
  const body = input.value.trim(); if (!body || !state.open) return;
  const b = $('sendBtn'); b.classList.remove('fly'); void b.offsetWidth; b.classList.add('fly'); sfx.send(); navigator.vibrate?.(15);
  input.value = ''; input.style.height = 'auto'; input.focus(); setTimeout(syncSendBtn, 420); // кнопка успевает «улететь»
  await insertMsg({ kind: 'text', body });
}
async function insertMsg(fields) {
  const chat_id = state.open;
  const { data, error } = await sb.from('messages').insert({ chat_id, sender_id: state.me.id, ...fields }).select().single();
  if (error) { toast('Не отправлено: ' + error.message); return null; }
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
    if (state.open === m.chat_id && !document.hidden) markRead(c); else if (isNew && m.sender_id !== state.me.id) c.unread++;
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
    mr.start(250); sfx.recStart(); navigator.vibrate?.(20);
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
    .subscribe();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { heartbeat(); const c = state.chats.get(state.open); if (c) markRead(c); } });
}
// ---------- звуки (синтезируются на лету, без файлов) ----------
let audioCtx;
function ac() { audioCtx ??= new AudioContext(); if (audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx; }
function beep(f = 880, len = 0.12, vol = 0.12) {
  try { const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + len);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + len); } catch {}
}
const sfx = {
  // «вжух» при отправке: шум через фильтр, частота быстро уходит вверх
  send() {
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
  navigator.vibrate?.(40);
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
  $('pName').value = me.display_name; $('pUser').textContent = '@' + me.username;
  paintNotifUi();
  show('sProfile');
};
$('pSave').onclick = async () => {
  const name = $('pName').value.trim(); if (!name) return;
  const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', state.me.id);
  if (error) return toast('Ошибка: ' + error.message);
  state.me.display_name = name; paintMe(); toast('Сохранено');
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
  await sb.auth.signOut(); location.reload();
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
const call = { pc: null, local: null, peer: null, chat: null, video: false, started: 0, incoming: null, outCh: new Map(), timer: null, ring: null, resend: null, pendingIce: [] };
function sigChannel(uid) {
  if (!call.outCh.has(uid)) { const ch = sb.channel('call-' + uid); ch.subscribe(); call.outCh.set(uid, ch); }
  return call.outCh.get(uid);
}
function signal(uid, payload) { return sigChannel(uid).send({ type: 'broadcast', event: 'sig', payload: { ...payload, from: state.me.id } }); }
function listenCalls() { sb.channel('call-' + state.me.id).on('broadcast', { event: 'sig' }, ({ payload: s }) => onSignal(s)).subscribe(); }
async function onSignal(s) {
  if (s.type === 'offer') {
    if (call.pc || (call.incoming && call.incoming.from === s.from)) { if (call.peer !== s.from) signal(s.from, { type: 'busy' }); return; } // повтор того же вызова — не мешает
    call.incoming = s; call.peer = s.from; call.chat = s.chat; call.video = !!s.video;
    if (!state.profiles.has(s.from)) { const { data } = await sb.from('profiles').select('*').eq('id', s.from).single(); if (data) state.profiles.set(data.id, data); }
    openCallUi('Входящий ' + (s.video ? 'видеозвонок' : 'звонок'), true);
    const ring = () => { beep(784, 0.22, 0.16); setTimeout(() => beep(988, 0.3, 0.16), 260); navigator.vibrate?.([300, 200, 300]); };
    ring(); call.ring = setInterval(ring, 1800);
  } else if (s.from !== call.peer) return;
  else if (s.type === 'answer') { clearInterval(call.resend); await call.pc.setRemoteDescription(s.sdp); flushIce(); setCallState('Соединение…'); }
  else if (s.type === 'ice') { if (call.pc?.remoteDescription) call.pc.addIceCandidate(s.c).catch(() => {}); else call.pendingIce.push(s.c); }
  else if (s.type === 'hangup' || s.type === 'decline' || s.type === 'busy') {
    const missed = s.type === 'hangup' && call.incoming && !call.started;
    endCall(false, s.type === 'busy' ? 'Абонент занят' : s.type === 'decline' ? 'Звонок отклонён' : missed ? 'Пропущенный звонок' : 'Звонок завершён');
  }
}
function flushIce() { call.pendingIce.forEach((c) => call.pc.addIceCandidate(c).catch(() => {})); call.pendingIce = []; }
function newPc() {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  pc.onicecandidate = (e) => e.candidate && signal(call.peer, { type: 'ice', c: e.candidate.toJSON() });
  pc.ontrack = (e) => { const st = e.streams[0]; $('remoteAudio').srcObject = st; if (e.track.kind === 'video') { $('remoteVideo').srcObject = st; $('sCall').classList.add('video'); } };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected' && !call.started) { call.started = Date.now(); call.timer = setInterval(() => setCallState(fmtDur((Date.now() - call.started) / 1000)), 1000); }
    if (pc.connectionState === 'failed') endCall(true, 'Не удалось соединиться');
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
  call.peer = peer.id; call.chat = c.id; call.video = video; call.incoming = null;
  const media = await getMedia(video); if (!media) return;
  call.local = media; call.pc = newPc();
  media.getTracks().forEach((t) => call.pc.addTrack(t, media));
  if (video) { $('localVideo').srcObject = media; $('sCall').classList.add('video'); }
  openCallUi('Вызов…', false);
  const offer = await call.pc.createOffer(); await call.pc.setLocalDescription(offer);
  const send = () => signal(peer.id, { type: 'offer', sdp: call.pc?.localDescription?.toJSON(), video, chat: c.id });
  await send();
  // повторяем вызов, пока собеседник не ответит: если его приложение открылось по уведомлению, он всё равно получит звонок
  call.resend = setInterval(() => { if (call.pc && !call.started) send(); }, 3000);
  sb.functions.invoke('notify', { body: { type: 'ring', chat: c.id, video } }).catch(() => {});
  call.noAnswer = setTimeout(() => { if (!call.started) { signal(call.peer, { type: 'hangup' }); endCall(true, 'Нет ответа'); } }, 45000);
}
$('callAudio').onclick = () => startCall(false);
$('callVideo').onclick = () => startCall(true);
$('callAccept').onclick = async () => {
  clearInterval(call.ring); const s = call.incoming;
  const media = await getMedia(s.video); if (!media) { declineCall(); return; }
  call.local = media; call.pc = newPc();
  media.getTracks().forEach((t) => call.pc.addTrack(t, media));
  if (s.video) { $('localVideo').srcObject = media; $('sCall').classList.add('video'); }
  await call.pc.setRemoteDescription(s.sdp); flushIce();
  const ans = await call.pc.createAnswer(); await call.pc.setLocalDescription(ans);
  signal(call.peer, { type: 'answer', sdp: call.pc.localDescription.toJSON() });
  $('callAccept').classList.add('hidden'); setCallState('Соединение…');
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
  clearInterval(call.ring); clearInterval(call.timer); clearInterval(call.resend); clearTimeout(call.noAnswer);
  const dur = call.started ? (Date.now() - call.started) / 1000 : 0, chat = call.chat, wasCaller = !call.incoming, video = call.video;
  call.local?.getTracks().forEach((t) => t.stop());
  call.pc?.close();
  Object.assign(call, { pc: null, local: null, started: 0, incoming: null, pendingIce: [] });
  $('sCall').classList.add('hidden'); $('sCall').classList.remove('video');
  ['remoteVideo', 'localVideo', 'remoteAudio'].forEach((id) => ($(id).srcObject = null));
  $('callMute').classList.remove('off'); $('callCam').classList.remove('off');
  if (text) toast(text);
  if (iRecord && wasCaller && chat) {
    const body = dur ? `${video ? 'Видеозвонок' : 'Звонок'}, ${fmtDur(dur)}` : text === 'Нет ответа' ? 'Пропущенный звонок' : 'Отменённый звонок';
    const { data } = await sb.from('messages').insert({ chat_id: chat, sender_id: state.me.id, kind: 'call', body }).select().single();
    if (data) addMsg(data);
  }
}

// ---------- старт ----------
if (/android/i.test(navigator.userAgent) && !window.Capacitor) $('apkLink').classList.remove('hidden');
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone) $('iosHint').classList.remove('hidden');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.chat && state.chats.has(e.data.chat)) openChat(e.data.chat); });
// открыли приложение нажатием на уведомление: ?chat=… — сразу в нужный чат
const openFromPush = new URLSearchParams(location.search).get('chat');
sb.auth.getSession().then(async ({ data }) => {
  if (!data.session) return show('sAuth', false);
  await start();
  if (openFromPush && state.chats.has(openFromPush)) openChat(openFromPush);
});
