// KAMOX Chat — мессенджер (Supabase: база, файлы, мгновенная доставка; звонки — WebRTC)
'use strict';
const SB_URL = 'https://zqhhczwewvvgeavpulas.supabase.co';
const SB_KEY = 'sb_publishable_s-wUfxpZmZKf0kEqoTMclQ_uPyuabsp';
const MAIL = (u) => `${u}@kamox-chat.app`; // ник превращается в «почту» только для входа, писем никто не получает
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { me: null, chats: new Map(), profiles: new Map(), open: null, msgs: new Map(), screen: 'sAuth', history: [] };

// ---------- экраны ----------
function show(id, push = true) {
  if (push && state.screen && state.screen !== id) { state.history.push(state.screen); history.pushState({ s: id }, ''); }
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  state.screen = id;
}
function back() {
  const prev = state.history.pop() || 'sChats';
  if (state.screen === 'sChat') { state.open = null; renderChats(); }
  show(prev, false);
}
// кнопка «‹» в приложении шагает назад по истории браузера, а системная «Назад» на Android — тоже
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => history.back()));
window.addEventListener('popstate', () => { if (state.screen !== 'sChats' && state.screen !== 'sAuth') back(); });

let toastT;
function toast(text, ms = 2600) {
  const t = $('toast'); t.textContent = text; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- аватарки ----------
const COLORS = ['#7b5cff', '#ff5ab4', '#ff8a3d', '#2fb6a3', '#3d8bff', '#e5483a', '#c97df0', '#3ddc84'];
function avatarStyle(name, path) {
  if (path) return `background-image:url('${sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}')`;
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `background:${COLORS[h % COLORS.length]}`;
}
function avatarHtml(name, path, cls = '') {
  return `<div class="av ${cls}" style="${avatarStyle(name, path)}">${path ? '' : esc((name || '?').trim()[0]?.toUpperCase() || '?')}</div>`;
}

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
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => {
  authMode = t.dataset.mode;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
  document.querySelectorAll('.regOnly').forEach((x) => x.classList.toggle('hidden', authMode !== 'register'));
  $('aBtn').textContent = authMode === 'login' ? 'Войти' : 'Создать аккаунт';
  $('aErr').textContent = '';
}));
document.querySelectorAll('.regOnly').forEach((x) => x.classList.add('hidden'));

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
      : /Email not confirmed/i.test(m) ? 'Аккаунт не подтверждён (нужно выключить подтверждение почты в Supabase)'
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
}
function paintMe() {
  const me = state.me;
  $('meBtn').innerHTML = avatarHtml(me.display_name, me.avatar_path, 'sm');
}
function heartbeat() { if (state.me && !document.hidden) sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', state.me.id).then(() => {}); }

// ---------- список чатов ----------
// несколько одновременных запросов на обновление списка объединяются в один
let chatsLoading = null;
function loadChats() { return (chatsLoading ??= loadChatsNow().finally(() => (chatsLoading = null))); }
async function loadChatsNow() {
  const { data, error } = await sb.from('chat_members')
    .select('last_read_at, chats(id,is_group,title,avatar_path,last_message_at, chat_members(user_id, profiles(id,username,display_name,avatar_path,last_seen)))')
    .eq('user_id', state.me.id);
  if (error) { toast('Не удалось загрузить чаты'); return; }
  state.chats.clear();
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
function chatAvatar(c, cls = '') { const p = chatPeer(c); return c.is_group ? avatarHtml(c.title, c.avatar_path, cls) : avatarHtml(p?.display_name, p?.avatar_path, cls); }
function preview(m) {
  if (!m) return 'Нет сообщений';
  if (m.kind === 'system') return `${state.profiles.get(m.sender_id)?.display_name || ''} ${m.body}`.trim();
  const t = { image: '📷 Фото', file: '📎 ' + (m.file_name || 'Файл'), voice: '🎤 Голосовое', call: '📞 ' + (m.body || 'Звонок') }[m.kind] || m.body || '';
  return (m.sender_id === state.me.id ? 'Вы: ' : '') + t;
}
function renderChats() {
  const list = [...state.chats.values()].sort((a, b) => new Date(b.last?.created_at || b.last_message_at) - new Date(a.last?.created_at || a.last_message_at));
  $('emptyChats').classList.toggle('hidden', list.length > 0);
  $('chatList').innerHTML = list.map((c) => `
    <button class="item" data-chat="${c.id}">
      ${chatAvatar(c)}
      <div class="mid"><div class="t">${esc(chatName(c))}</div><div class="s">${esc(preview(c.last))}</div></div>
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
      ${avatarHtml(p.display_name, p.avatar_path)}
      <div class="mid"><div class="t">${esc(p.display_name)}</div><div class="s">@${esc(p.username)} · ${seenText(p)}</div></div>
      ${groupMode ? '<span class="check"></span>' : ''}
    </button>`).join('') || '<p class="empty" style="margin-top:20px">Никого не нашли</p>';
  $('userList').querySelectorAll('[data-user]').forEach((b) => (b.onclick = async () => {
    const p = state.profiles.get(b.dataset.user);
    if (groupMode) { picked.has(p.id) ? picked.delete(p.id) : picked.set(p.id, p); b.classList.toggle('sel'); syncNewUi(); return; }
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
  const peer = chatPeer(c);
  $('chatHead').innerHTML = `${chatAvatar(c, 'sm')}<div style="min-width:0"><div class="t">${esc(chatName(c))}</div>
    <div class="s">${c.is_group ? c.members.length + ' участн.' : seenText(peer)}</div></div>`;
  $('callAudio').classList.toggle('hidden', c.is_group); $('callVideo').classList.toggle('hidden', c.is_group);
  $('msgs').innerHTML = '<p class="sys">Загрузка…</p>';
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
  box.innerHTML = html || '<p class="sys">Напишите первое сообщение 👋</p>';
  box.querySelectorAll('[data-img]').forEach(loadImg);
  box.querySelectorAll('[data-voice]').forEach(wireVoice);
  box.querySelectorAll('[data-file]').forEach((a) => (a.onclick = async (e) => { e.preventDefault(); const u = await fileUrl(a.dataset.file, a.dataset.name); if (u) window.open(u, '_blank'); }));
  if (toBottom || nearBottom) box.scrollTop = box.scrollHeight;
}
function msgHtml(m, c) {
  if (m.kind === 'system') { const p = state.profiles.get(m.sender_id); return `<p class="sys">${esc(p?.display_name || '')} ${esc(m.body)}</p>`; }
  const mine = m.sender_id === state.me.id, p = state.profiles.get(m.sender_id);
  const who = c?.is_group && !mine ? `<div class="who">${esc(p?.display_name || '?')}</div>` : '';
  const time = `<span class="time">${hhmm(m.created_at)}</span>`;
  let inner;
  if (m.kind === 'image') return `<div class="m media ${mine ? 'me' : ''}">${who}<img class="ph" data-img="${esc(m.file_path)}" alt="">${time}</div>`;
  if (m.kind === 'file') inner = `<a class="file" href="#" data-file="${esc(m.file_path)}" data-name="${esc(m.file_name)}"><span class="fi">📄</span><span><b>${esc(m.file_name)}</b><br><span class="small">${fmtSize(m.file_size || 0)}</span></span></a>`;
  else if (m.kind === 'voice') inner = `<div class="voice" data-voice="${esc(m.file_path)}" data-dur="${m.duration || 0}"><button class="play">▶</button><div class="bar"><i></i></div><span class="dur">${fmtDur(m.duration || 0)}</span></div>`;
  else if (m.kind === 'call') inner = `📞 ${esc(m.body)}`;
  else inner = esc(m.body);
  return `<div class="m ${mine ? 'me' : ''} ${m.kind}">${who}${inner}${time}</div>`;
}

// подписанные ссылки на файлы (файлы закрыты, ссылка живёт час)
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
  const btn = el.querySelector('.play'), bar = el.querySelector('.bar i'), dur = el.querySelector('.dur');
  btn.onclick = async () => {
    if (playing?.el === el) { playing.audio.paused ? playing.audio.play() : playing.audio.pause(); return; }
    if (playing) { playing.audio.pause(); playing.btn.textContent = '▶'; }
    const u = await fileUrl(el.dataset.voice); if (!u) return;
    const audio = new Audio(u); playing = { el, audio, btn };
    audio.onplay = () => (btn.textContent = '❚❚'); audio.onpause = () => (btn.textContent = '▶');
    audio.ontimeupdate = () => { const d = audio.duration && isFinite(audio.duration) ? audio.duration : +el.dataset.dur || 1; bar.style.width = (audio.currentTime / d) * 100 + '%'; dur.textContent = fmtDur(audio.currentTime); };
    audio.onended = () => { btn.textContent = '▶'; bar.style.width = '0'; dur.textContent = fmtDur(+el.dataset.dur); playing = null; };
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
  input.value = ''; input.oninput();
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
  if (list && !list.some((x) => x.id === m.id)) { list.push(m); if (state.open === m.chat_id) renderMsgs(m.sender_id === state.me.id); }
  const c = state.chats.get(m.chat_id);
  if (c) { if (!c.last || new Date(m.created_at) >= new Date(c.last.created_at)) c.last = m; if (state.open === m.chat_id && !document.hidden) markRead(c); else if (m.sender_id !== state.me.id) c.unread++; renderChats(); }
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
    $('toast').classList.add('hidden');
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
    mr.start(250);
    $('composer').classList.add('hidden'); $('recBar').classList.remove('hidden');
    rec.timer = setInterval(() => { $('recTime').textContent = fmtDur((Date.now() - rec.t0) / 1000); if (Date.now() - rec.t0 > 300000) stopVoice(true); }, 250);
  } catch { toast('Нет доступа к микрофону'); }
};
function stopVoice(send) { if (!rec) return; rec.send = send; clearInterval(rec.timer); rec.mr.stop(); rec.stream.getTracks().forEach((t) => t.stop()); $('recBar').classList.add('hidden'); $('composer').classList.remove('hidden'); $('recTime').textContent = '0:00'; }
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
      if (m.sender_id !== state.me.id && (state.open !== m.chat_id || document.hidden)) notify(m);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_members', filter: `user_id=eq.${state.me.id}` }, () => loadChats())
    .subscribe();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { heartbeat(); const c = state.chats.get(state.open); if (c) markRead(c); } });
}
let audioCtx;
function beep(f = 880, len = 0.12, vol = 0.15) {
  try { audioCtx ??= new AudioContext(); const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(vol, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + len);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + len); } catch {}
}
function notify(m) {
  const c = state.chats.get(m.chat_id), p = state.profiles.get(m.sender_id);
  const title = c?.is_group ? `${c.title}: ${p?.display_name}` : p?.display_name || 'Новое сообщение';
  const text = preview({ ...m, sender_id: null }).replace(/^Вы: /, '');
  beep(); navigator.vibrate?.(60);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body: text, icon: 'icon-192.png', tag: m.chat_id, data: { chat: m.chat_id } }))
      .catch(() => new Notification(title, { body: text }));
  } else if (state.open !== m.chat_id) toast(`${title}: ${text}`);
}

// ---------- профиль ----------
$('meBtn').onclick = () => {
  const me = state.me;
  $('pAvatar').setAttribute('style', avatarStyle(me.display_name, me.avatar_path));
  $('pAvatar').textContent = me.avatar_path ? '' : (me.display_name[0] || '?').toUpperCase();
  $('pName').value = me.display_name; $('pUser').textContent = '@' + me.username;
  $('pNotif').classList.toggle('hidden', !('Notification' in window) || Notification.permission === 'granted');
  show('sProfile');
};
$('pSave').onclick = async () => {
  const name = $('pName').value.trim(); if (!name) return;
  const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', state.me.id);
  if (error) return toast('Ошибка: ' + error.message);
  state.me.display_name = name; paintMe(); toast('Сохранено');
};
$('pAvatar').onclick = () => $('avatarInput').click();
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
$('pNotif').onclick = async () => {
  const r = await Notification.requestPermission();
  toast(r === 'granted' ? 'Уведомления включены' : 'Уведомления запрещены в настройках');
  $('pNotif').classList.toggle('hidden', r === 'granted');
};
$('pLogout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

// подсказка «установить как приложение»
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; installTip(); });
function installTip() {
  const tip = $('installTip');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || localStorage.getItem('kc-tip-hide')) return tip.classList.add('hidden');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) tip.innerHTML = '<span>📲 Установите как приложение: <b>Поделиться</b> → <b>На экран «Домой»</b></span><button class="icon" id="tipX">✕</button>';
  else if (deferredInstall) tip.innerHTML = '<span class="grow">📲 Установить KAMOX Chat на телефон</span><button class="chip on" id="tipGo">Установить</button><button class="icon" id="tipX">✕</button>';
  else return tip.classList.add('hidden');
  tip.classList.remove('hidden');
  $('tipX').onclick = () => { localStorage.setItem('kc-tip-hide', '1'); tip.classList.add('hidden'); };
  if ($('tipGo')) $('tipGo').onclick = async () => { deferredInstall.prompt(); deferredInstall = null; tip.classList.add('hidden'); };
}

// ---------- звонки (WebRTC, сигналы через Supabase Realtime) ----------
const call = { pc: null, local: null, peer: null, chat: null, video: false, started: 0, incoming: null, outCh: new Map(), timer: null, ring: null, pendingIce: [] };
function sigChannel(uid) {
  if (!call.outCh.has(uid)) { const ch = sb.channel('call-' + uid); ch.subscribe(); call.outCh.set(uid, ch); }
  return call.outCh.get(uid);
}
function signal(uid, payload) { return sigChannel(uid).send({ type: 'broadcast', event: 'sig', payload: { ...payload, from: state.me.id } }); }
function listenCalls() {
  sb.channel('call-' + state.me.id).on('broadcast', { event: 'sig' }, ({ payload: s }) => onSignal(s)).subscribe();
}
async function onSignal(s) {
  if (s.type === 'offer') {
    if (call.pc) { signal(s.from, { type: 'busy' }); return; }
    call.incoming = s; call.peer = s.from; call.chat = s.chat; call.video = !!s.video;
    if (!state.profiles.has(s.from)) { const { data } = await sb.from('profiles').select('*').eq('id', s.from).single(); if (data) state.profiles.set(data.id, data); }
    openCallUi('Входящий ' + (s.video ? 'видеозвонок' : 'звонок'), true);
    call.ring = setInterval(() => { beep(660, 0.25, 0.2); setTimeout(() => beep(880, 0.25, 0.2), 300); navigator.vibrate?.([300, 200, 300]); }, 1600);
    if (document.hidden && Notification.permission === 'granted') navigator.serviceWorker?.ready.then((r) => r.showNotification('Входящий звонок', { body: state.profiles.get(s.from)?.display_name || '', tag: 'call', requireInteraction: true }));
  } else if (s.from !== call.peer) return;
  else if (s.type === 'answer') { await call.pc.setRemoteDescription(s.sdp); flushIce(); setCallState('Соединение…'); }
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
  catch { toast('Нет доступа к ' + (video ? 'камере/микрофону' : 'микрофону')); return null; }
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
  await signal(peer.id, { type: 'offer', sdp: call.pc.localDescription.toJSON(), video, chat: c.id });
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
  clearInterval(call.ring); clearInterval(call.timer); clearTimeout(call.noAnswer);
  const dur = call.started ? (Date.now() - call.started) / 1000 : 0, chat = call.chat, wasCaller = !call.incoming;
  call.local?.getTracks().forEach((t) => t.stop());
  call.pc?.close();
  Object.assign(call, { pc: null, local: null, started: 0, incoming: null, pendingIce: [] });
  $('sCall').classList.add('hidden'); $('sCall').classList.remove('video');
  ['remoteVideo', 'localVideo', 'remoteAudio'].forEach((id) => ($(id).srcObject = null));
  $('callMute').classList.remove('off'); $('callCam').classList.remove('off');
  if (text) toast(text);
  // запись о звонке в переписке пишет тот, кто звонил
  if (iRecord && wasCaller && chat) {
    const body = dur ? `${call.video ? 'Видеозвонок' : 'Звонок'}, ${fmtDur(dur)}` : text === 'Нет ответа' ? 'Пропущенный звонок' : 'Отменённый звонок';
    const { data } = await sb.from('messages').insert({ chat_id: chat, sender_id: state.me.id, kind: 'call', body }).select().single();
    if (data) addMsg(data);
  }
}

// ---------- старт ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.chat && state.chats.has(e.data.chat)) openChat(e.data.chat); });
sb.auth.getSession().then(({ data }) => (data.session ? start() : show('sAuth', false)));
