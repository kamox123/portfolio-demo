// «Ходульщик 2» — игровой цикл, управление, камера, экраны, прогресс и настройки.
(function () {
  'use strict';
  const { CFG, WORLDS, LEVELS_PER_WORLD, createGame, step, hipPos, footPos, legAngle, headPos, surface } = Phys;
  const { THEMES, CHARS, STILTS } = Art;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const CFG_DEFAULT = { ...CFG };

  // ================= СОХРАНЕНИЕ =================
  const KEY = 'hodulki2-save';
  const fresh = () => ({ tutorialDone: false, sound: true, musicOn: true, totalDeaths: 0, coins: 0, owned: ['novice'], stilts: ['wood'], sel: 'novice', stilt: 'wood', done: {}, cur: [0, 0], sfx: 0.8, music: 0.5, swap: false, pads: true, shake: true, phys: {} });
  let save = fresh();
  try { save = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
  Object.assign(CFG, save.phys || {});
  if (!save.owned.includes('novice')) save.owned.unshift('novice');
  const applyVolume = () => { Snd.setVolume('sfx', save.sound ? save.sfx : 0); Snd.setVolume('music', save.musicOn ? save.music : 0); };
  applyVolume();
  const lvKey = (w, i) => w + ':' + i;
  const levelOpen = (w, i) => (w === 0 && i === 0) || !!save.done[i > 0 ? lvKey(w, i - 1) : lvKey(w - 1, LEVELS_PER_WORLD - 1)];
  const worldOpen = (w) => levelOpen(w, 0);
  const charOf = () => CHARS.find((c) => c.id === save.sel) || CHARS[0];
  const stiltOf = () => STILTS.find((s) => s.id === save.stilt) || STILTS[0];

  // ================= ЭКРАН И КАМЕРА =================
  let W = 0, H = 0, DPR = 1, PPM = 50;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize); resize();
  const cam = { x: 0, y: 2, zoom: 1 };
  const V = { get W() { return W; }, get H() { return H; }, get PPM() { return PPM; }, cam, sx: (x) => (x - cam.x) * PPM + W * 0.36, sy: (y) => H * 0.56 - (y - cam.y) * PPM };

  // ================= СОСТОЯНИЕ ИГРЫ =================
  let g = null, mode = 'menu', world = 0, level = 0, deaths = 0, particles = [], shake = 0, slowmo = 0, tut = null, floaters = [];
  const input = { hold: [false, false], back: [false, false] };
  function startLevel(w, i, fromCp = -1, keep = null) {
    world = w; level = i; save.cur = [w, i]; persist();
    g = createGame(w, i, fromCp);
    if (keep) { g.time = keep.time; g.coinsTaken = keep.coinsTaken; g.coinsGot = keep.coinsGot; } else deaths = 0;
    if (!keep) tut = w === 0 && i === 0 && !save.tutorialDone ? { stage: 0, steps: 0, t: 0 } : null;
    const h = hipPos(g); cam.x = h.x + 1; cam.y = h.y - 1; cam.zoom = 1;
    particles = []; input.hold = [false, false]; input.back = [false, false];
    mode = 'play'; showScreen(null);
    $('hud').classList.remove('hidden'); $('pads').classList.remove('hidden');
    $('pads').classList.toggle('nopads', !save.pads);
    $('hTitle').textContent = `${WORLDS[w].name} ${w + 1}-${i + 1}`;
    const cps = g.lv.checkpoints;
    [$('hCp1'), $('hCp2')].forEach((el, k) => { if (cps[k]) { el.style.display = ''; el.style.left = (cps[k][0] / g.lv.finish) * 100 + '%'; el.classList.toggle('on', g.checkpoint >= k); } else el.style.display = 'none'; });
    $('hCoins').textContent = save.coins;
    hint(''); if (tut) tutorial(tut.stage);
    hDeaths.textContent = deaths;
    Snd.music(w);
  }
  // ---------- обучение на первом уровне ----------
  const TUT = [
    { title: 'ПРАВАЯ НОГА', text: 'Держи <b>правую</b> половину экрана — правая ходуля упрётся в землю, толкнёт тебя и пойдёт вперёд. Отпусти — она встанет.', pad: 1 },
    { title: 'ЛЕВАЯ НОГА', text: 'Теперь держи <b>левую</b> половину. Шагай по очереди: правая, левая.', pad: 0 },
    { title: 'ПЕРЕНЕСИ ВЕС', text: 'Задняя нога сначала упирается и толкает тело. Пронести её вперёд можно, когда тело встанет над опорой.', pad: -1 },
    { title: 'НЕ НАКЛОНЯЙСЯ СЛИШКОМ СИЛЬНО', text: 'Долго держишь ногу — тело наклоняется. Отпускай вовремя, и нога встанет сама.', pad: -1 },
    { title: 'ОТЛИЧНО!', text: 'Собирай монеты и дойди до финиша. Флажки по пути — контрольные точки.', pad: -1 },
  ];
  function tutorial(stage) {
    if (!tut) return;
    tut.stage = stage; tut.t = 0;
    const s = TUT[stage];
    if (!s) { hint(''); tut = null; document.querySelectorAll('.pad').forEach((p) => p.classList.remove('teach')); return; }
    hint(`<div class="tut-title">${s.title}</div>${s.text}`);
    const pads = [$('padL'), $('padR')]; if (save.swap) pads.reverse();
    pads.forEach((p, k) => p.classList.toggle('teach', k === s.pad));
  }
  function hint(html) { const el = $('hint'); if (html) { el.innerHTML = html; el.classList.remove('hidden'); } else el.classList.add('hidden'); }
  function banner(text) { const el = $('banner'); el.textContent = text; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(banner._t); banner._t = setTimeout(() => el.classList.add('hidden'), 1300); }
  function toast(text) { const el = $('toast'); el.textContent = text; el.classList.remove('hidden'); el.style.opacity = 1; clearTimeout(toast._t); toast._t = setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.classList.add('hidden'), 400); }, 1800); }

  // ================= УПРАВЛЕНИЕ =================
  // касания: левая половина — левая нога, правая — правая; палец вниз — нога назад
  const touches = new Map();
  function sideOf(x) { let s = x < W / 2 ? 0 : 1; if (save.swap) s = 1 - s; return s; }
  function recomputeInput() {
    const h = [false, false], b = [false, false];
    for (const t of touches.values()) { h[t.side] = true; if (t.dy > 40) b[t.side] = true; }
    for (const k of [0, 1]) if (keys[k]) { h[k] = true; if (keys.back) b[k] = true; }
    input.hold = h; input.back = b;
    $('padL').classList.toggle('on', h[save.swap ? 1 : 0]); $('padR').classList.toggle('on', h[save.swap ? 0 : 1]);
  }
  const keys = { 0: false, 1: false, back: false };
  window.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || e.target.closest('button, .modal, .screen, input, details')) return;
    e.preventDefault(); Snd.unlock();
    touches.set(e.pointerId, { side: sideOf(e.clientX), y0: e.clientY, dy: 0 }); recomputeInput(); if (!tut) hint('');
  });
  window.addEventListener('pointermove', (e) => { const t = touches.get(e.pointerId); if (t) { t.dy = e.clientY - t.y0; recomputeInput(); } });
  const lift = (e) => { if (touches.delete(e.pointerId)) recomputeInput(); };
  window.addEventListener('pointerup', lift); window.addEventListener('pointercancel', lift);
  window.addEventListener('blur', () => { touches.clear(); keys[0] = keys[1] = false; recomputeInput(); });
  document.addEventListener('touchstart', (e) => { if (!e.target.closest('button, .modal, .screen, input, details, summary')) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  const keyMap = { KeyA: 0, ArrowLeft: 0, KeyD: 1, ArrowRight: 1 };
  window.addEventListener('keydown', (e) => {
    if (e.code in keyMap) { keys[keyMap[e.code]] = true; recomputeInput(); if (!tut) hint(''); e.preventDefault(); Snd.unlock(); }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') { keys.back = true; recomputeInput(); }
    if (e.code === 'Escape' && mode === 'play') pause();
    if (e.code === 'KeyR' && (mode === 'play' || mode === 'lose')) startLevel(world, level);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code in keyMap) { keys[keyMap[e.code]] = false; recomputeInput(); }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') { keys.back = false; recomputeInput(); }
  });

  // ================= ЭКРАНЫ =================
  const screens = ['sMenu', 'sWorlds', 'sChars', 'sSettings'];
  function showScreen(id) {
    screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
    if (id) { $('hud').classList.add('hidden'); $('pads').classList.add('hidden'); hint(''); }
    document.querySelectorAll('.tCoins').forEach((el) => (el.textContent = save.coins));
  }
  function toMenu() {
    mode = 'menu'; ['mPause', 'mWin', 'mLose'].forEach((m) => $(m).classList.add('hidden'));
    // на фоне меню — демо-уровень
    g = createGame(save.cur[0], save.cur[1]); world = save.cur[0];
    const [w, i] = nextLevel();
    $('mPlaySub').textContent = save.done[lvKey(WORLDS.length - 1, LEVELS_PER_WORLD - 1)] && !nextLevel(true) ? 'Все уровни пройдены!' : `${WORLDS[w].name} · уровень ${w + 1}-${i + 1}`;
    showScreen('sMenu'); Snd.music(save.cur[0]);
  }
  function nextLevel(strict) {
    for (let w = 0; w < WORLDS.length; w++) for (let i = 0; i < LEVELS_PER_WORLD; i++) if (!save.done[lvKey(w, i)]) return [w, i];
    return strict ? null : save.cur;
  }
  $('mPlay').onclick = () => { Snd.unlock(); Snd.sfx.click(); const [w, i] = nextLevel(); startLevel(w, i); };
  $('mWorlds').onclick = () => { Snd.unlock(); Snd.sfx.click(); renderWorlds(); showScreen('sWorlds'); };
  $('mChars').onclick = () => { Snd.unlock(); Snd.sfx.click(); shopTab = 'chars'; view = save.sel; renderShop(); showScreen('sChars'); };
  $('mSettings').onclick = () => { Snd.unlock(); Snd.sfx.click(); renderSettings(); showScreen('sSettings'); };
  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { Snd.sfx.click(); toMenu(); }));

  function renderWorlds() {
    const list = $('worldList'); list.innerHTML = '';
    WORLDS.forEach((Wd, w) => {
      const th = THEMES[Wd.id], open = worldOpen(w);
      const stars = Array.from({ length: LEVELS_PER_WORLD }, (_, i) => (save.done[lvKey(w, i)] || {}).stars || 0).reduce((a, b) => a + b, 0);
      const card = document.createElement('div'); card.className = 'wcard' + (open ? '' : ' locked');
      card.innerHTML = `<h3><span>${w + 1}. ${Wd.name}</span><span>⭐ ${stars}/${LEVELS_PER_WORLD * 3}</span></h3><div class="wthumb" style="background:linear-gradient(${th.sky[0]},${th.sky[1]} 55%,${th.top} 55%,${th.top} 62%,${th.face} 62%)"></div>`;
      const lv = document.createElement('div'); lv.className = 'lvls';
      for (let i = 0; i < LEVELS_PER_WORLD; i++) {
        const b = document.createElement('button'); b.className = 'lvl' + (save.cur[0] === w && save.cur[1] === i ? ' cur' : '');
        const d = save.done[lvKey(w, i)]; const ok = levelOpen(w, i);
        b.innerHTML = ok ? `${i + 1}<small>${'★'.repeat(d ? d.stars : 0)}${'☆'.repeat(3 - (d ? d.stars : 0))}</small>` : '🔒';
        b.disabled = !ok; b.onclick = () => { Snd.sfx.click(); startLevel(w, i); };
        lv.appendChild(b);
      }
      card.appendChild(lv); list.appendChild(card);
    });
  }

  // ---------- персонажи и ходули ----------
  let shopTab = 'chars', view = save.sel;
  document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { Snd.sfx.click(); shopTab = t.dataset.tab; view = shopTab === 'chars' ? save.sel : save.stilt; document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t)); renderShop(); }));
  function paintHero(canvas, ch, sk, big) {
    const c2 = canvas.getContext('2d'); c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, canvas.width, canvas.height);
    const u = canvas.width / (big ? 3.4 : 2.6), t = performance.now() / 1000;
    Art.drawCharacter(c2, ch, sk, { hx: canvas.width * 0.5, hy: canvas.height * 0.62, ta: 0, a: [-0.22, 0.22], L: [1.0, 1.0], t, mood: big ? 'win' : 'idle' }, u);
  }
  function renderShop() {
    document.querySelectorAll('.tCoins').forEach((el) => (el.textContent = save.coins));
    const isChar = shopTab === 'chars', items = isChar ? CHARS : STILTS, ownedList = isChar ? save.owned : save.stilts;
    const it = items.find((x) => x.id === view) || items[0], owned = ownedList.includes(it.id);
    const selected = isChar ? save.sel === it.id : save.stilt === it.id;
    $('heroName').textContent = it.name; $('heroInfo').textContent = it.info || 'Раскраска ходуль. На физику не влияет.';
    paintHero($('heroCv'), isChar ? it : charOf(), isChar ? stiltOf() : it, true);
    const btn = $('heroBtn'); btn.className = 'act'; btn.onclick = null;
    if (selected) btn.textContent = 'Выбрано ✓';
    else if (owned) { btn.textContent = 'Выбрать'; btn.onclick = () => { if (isChar) save.sel = it.id; else save.stilt = it.id; persist(); Snd.sfx.click(); renderShop(); }; }
    else {
      btn.innerHTML = `Купить <span class="coin"></span> ${it.price}`;
      if (save.coins < it.price) btn.classList.add('off');
      btn.onclick = () => {
        if (save.coins < it.price) { toast(`Не хватает ${it.price - save.coins} монет — пройди ещё уровни`); return; }
        save.coins -= it.price; ownedList.push(it.id); if (isChar) save.sel = it.id; else save.stilt = it.id;
        persist(); Snd.sfx.unlock(); toast(`${it.name} — открыто!`); renderShop();
      };
    }
    const grid = $('charGrid'); grid.innerHTML = '';
    items.forEach((x) => {
      const own = ownedList.includes(x.id);
      const b = document.createElement('button'); b.className = 'cell' + (x.id === view ? ' sel' : '') + (own ? ' owned' : ' locked');
      const c = document.createElement('canvas'); c.width = 170; c.height = 200; b.appendChild(c);
      if (!own) { const p = document.createElement('span'); p.className = 'price'; p.innerHTML = `<span class="coin"></span>${x.price}`; b.appendChild(p); }
      b.onclick = () => { Snd.sfx.click(); view = x.id; renderShop(); };
      grid.appendChild(b); paintHero(c, isChar ? x : charOf(), isChar ? stiltOf() : x, false);
    });
  }

  // ---------- настройки ----------
  const PHYS_LABELS = { gravity: 'Гравитация', walkingSpeed: 'Скорость ходьбы', legLength: 'Длина ходуль', legMass: 'Вес ноги', bodyMass: 'Вес тела', friction: 'Сцепление с землёй', movementForce: 'Сила шага', balanceStrength: 'Сила равновесия', legSpeed: 'Скорость ноги', stepDistance: 'Длина шага (угол)', fallThreshold: 'Порог падения', legSag: 'Как быстро опускается нога', damping: 'Затухание' };
  function renderSettings() {
    $('oSfx').value = save.sfx; $('oMusic').value = save.music; $('oSound').checked = save.sound; $('oMusicOn').checked = save.musicOn; $('oSwap').checked = save.swap; $('oPads').checked = save.pads; $('oShake').checked = save.shake;
    const rows = $('physRows'); rows.innerHTML = '';
    for (const [k, label] of Object.entries(PHYS_LABELS)) {
      const base = CFG_DEFAULT[k], l = document.createElement('label');
      l.innerHTML = `${label} <input type="range" min="${(base * 0.3).toFixed(3)}" max="${(base * 2).toFixed(3)}" step="${(base / 50).toFixed(4)}" value="${CFG[k]}"><span>${(+CFG[k]).toFixed(2)}</span>`;
      const inp = l.querySelector('input'), sp = l.querySelector('span');
      inp.oninput = () => { CFG[k] = +inp.value; sp.textContent = (+inp.value).toFixed(2); save.phys[k] = CFG[k]; persist(); };
      rows.appendChild(l);
    }
  }
  $('oSound').onchange = (e) => { save.sound = e.target.checked; applyVolume(); persist(); };
  $('oMusicOn').onchange = (e) => { save.musicOn = e.target.checked; applyVolume(); persist(); };
  $('oSfx').oninput = (e) => { save.sfx = +e.target.value; applyVolume(); persist(); };
  $('oSfx').onchange = () => Snd.sfx.coin();
  $('oMusic').oninput = (e) => { save.music = +e.target.value; applyVolume(); persist(); };
  $('oSwap').onchange = (e) => { save.swap = e.target.checked; persist(); };
  $('oPads').onchange = (e) => { save.pads = e.target.checked; persist(); };
  $('oShake').onchange = (e) => { save.shake = e.target.checked; persist(); };
  $('oPhysReset').onclick = () => { Object.assign(CFG, CFG_DEFAULT); save.phys = {}; persist(); renderSettings(); toast('Физика как была'); };
  $('oReset').onclick = () => $('mConfirm').classList.remove('hidden');
  $('cNo').onclick = () => $('mConfirm').classList.add('hidden');
  $('cYes').onclick = () => { const keep = { sfx: save.sfx, music: save.music, sound: save.sound, musicOn: save.musicOn }; save = Object.assign(fresh(), keep); Object.assign(CFG, CFG_DEFAULT); persist(); $('mConfirm').classList.add('hidden'); toast('Прогресс сброшен'); toMenu(); };

  // ---------- пауза, победа, поражение ----------
  function pause() { if (mode !== 'play') return; mode = 'pause'; $('mPause').classList.remove('hidden'); $('pCheckpoint').classList.toggle('hidden', g.checkpoint < 0); }
  $('bPause').onclick = (e) => { e.stopPropagation(); Snd.sfx.click(); pause(); };
  $('pResume').onclick = () => { mode = 'play'; $('mPause').classList.add('hidden'); touches.clear(); recomputeInput(); };
  $('pRestart').onclick = () => { $('mPause').classList.add('hidden'); startLevel(world, level); };
  $('pCheckpoint').onclick = () => { $('mPause').classList.add('hidden'); startLevel(world, level, g.checkpoint); };
  $('pMenu').onclick = () => toMenu();
  $('lCheckpoint').onclick = () => { $('mLose').classList.add('hidden'); startLevel(world, level, lastCp); };
  $('lRestart').onclick = () => { $('mLose').classList.add('hidden'); startLevel(world, level); };
  $('lMenu').onclick = () => toMenu();
  $('wNext').onclick = () => { $('mWin').classList.add('hidden'); const nx = level + 1 < LEVELS_PER_WORLD ? [world, level + 1] : world + 1 < WORLDS.length ? [world + 1, 0] : null; if (nx) startLevel(nx[0], nx[1]); else toMenu(); };
  $('wRetry').onclick = () => { $('mWin').classList.add('hidden'); startLevel(world, level); };
  $('wMenu').onclick = () => toMenu();
  let lastCp = -1;

  function onWin() {
    mode = 'win';
    const total = g.lv.coins.length, got = g.coinsGot;
    const stars = 1 + (got >= Math.ceil(total * 0.8) ? 1 : 0) + (deaths === 0 ? 1 : 0);
    const reward = 20 + (world * LEVELS_PER_WORLD + level) * 4;
    save.coins += reward;
    const prev = save.done[lvKey(world, level)];
    const record = !prev || g.time < prev.time;
    save.done[lvKey(world, level)] = { stars: Math.max(stars, prev ? prev.stars : 0), time: Math.min(g.time, prev ? prev.time : 1e9), deaths: Math.min(deaths, prev && prev.deaths !== undefined ? prev.deaths : 1e9) };
    if (world === 0 && level === 0) save.tutorialDone = true;
    tut = null; hint('');
    const nowOpenWorld = level === LEVELS_PER_WORLD - 1 && world + 1 < WORLDS.length;
    persist();
    setTimeout(() => {
      $('wStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'off'}">⭐</span>`).join('');
      const best = save.done[lvKey(world, level)];
      $('wText').innerHTML = `<div class="stats"><div><small>Время</small><b>${g.time.toFixed(1)} с</b>${record ? '<i>рекорд!</i>' : `<i>лучшее ${best.time.toFixed(1)} с</i>`}</div><div><small>Падения</small><b>${deaths}</b>${deaths ? '' : '<i>ни одного!</i>'}</div><div><small>Монеты</small><b>${got}/${total}</b><i>+${reward} награда</i></div></div>${nowOpenWorld ? `<b class="newworld">Открыт новый мир: ${WORLDS[world + 1].name}!</b>` : ''}`;
      $('wNext').textContent = world === WORLDS.length - 1 && level === LEVELS_PER_WORLD - 1 ? 'В меню' : 'Дальше ▶';
      $('mWin').classList.remove('hidden'); $('hud').classList.add('hidden'); $('pads').classList.add('hidden');
      if (nowOpenWorld) Snd.sfx.unlock();
    }, 1600);
  }
  function onLose() {
    mode = 'lose'; deaths++; lastCp = g.checkpoint; save.totalDeaths++; persist();
    $('hDeaths').textContent = deaths;
    const card = $('fallCard'); card.innerHTML = `<b>${g.why}</b>${g.tip ? `<br><span>💡 ${g.tip}</span>` : ''}<br><small>${lastCp >= 0 ? 'Возвращаемся на контрольную точку…' : 'Начинаем сначала…'}</small>`;
    card.classList.remove('hidden'); hint('');
    const keep = { time: g.time, coinsTaken: g.coinsTaken, coinsGot: g.coinsGot };
    clearTimeout(onLose._t);
    onLose._t = setTimeout(() => { card.classList.add('hidden'); if (mode === 'lose') startLevel(world, level, lastCp, keep); }, g.tip ? 2600 : 1700);
  }

  // ================= ЧАСТИЦЫ =================
  function burst(x, y, n, colors, spd = 1, up = 3, size = 0.08) {
    if (particles.length > 260) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (0.8 + Math.random() * 2.6) * spd; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + up, life: 0.6 + Math.random() * 0.7, c: colors[i % colors.length], r: size * (0.6 + Math.random()), rot: Math.random() * 6 }); }
  }
  function drawParticles(dt) {
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 7;
      ctx.save(); ctx.translate(V.sx(p.x), V.sy(p.y)); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r * PPM, -p.r * PPM * 0.5, p.r * PPM * 2, p.r * PPM); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ================= ГЛАВНЫЙ ЦИКЛ =================
  let last = performance.now(), acc = 0, fpsAvg = 60;
  const DEMO = /demo|auto/.test(location.hash);
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    const t = now / 1000;
    if (slowmo > 0) { slowmo -= dt; dt *= 0.35; }
    acc += dt;
    while (acc >= 1 / 60) {
      acc -= 1 / 60;
      if (!g) break;
      let hold = [false, false], back = [false, false];
      if (mode === 'play') { hold = input.hold; back = input.back; if (DEMO) hold = Phys.bot(g); }
      else if (mode === 'menu') hold = Phys.bot(g);
      if (mode === 'pause') continue;
      step(g, 1 / 60, hold, back);
      for (const e of g.events) {
        if (mode !== 'play' && mode !== 'win' && mode !== 'lose') continue;
        if (e === 'scrape') Snd.sfx.scrape();
        if (e === 'bump') Snd.sfx.bump();
        if (e === 'touch') Snd.sfx.touch();
        if (e === 'land' && tut) { tut.steps++; if (tut.stage === 0 && g.s === 1) tutorial(1); else if (tut.stage === 1 && g.s === 0) tutorial(2); else if (tut.stage === 2 && tut.steps >= 5) tutorial(3); else if (tut.stage === 3 && tut.steps >= 8) tutorial(4); else if (tut.stage === 4 && tut.steps >= 10) tutorial(5); }
        if (e === 'land') { Snd.sfx.step(); const f = g.P; burst(f.x, f.y + 0.05, 6, ['rgba(255,255,255,.8)', 'rgba(200,180,150,.8)'], 0.5, 1.5, 0.05); }
        if (e === 'lift') Snd.sfx.lift();
        if (e === 'bounce') { Snd.sfx.bounce(); burst(g.P.x, g.P.y, 12, ['#ff6fb5', '#fff'], 1, 3); }
        if (e === 'coin') { Snd.sfx.coin(); save.coins++; persist(); $('hCoins').textContent = save.coins; const h = hipPos(g); burst(h.x, h.y + 1.5, 10, ['#ffcf3f', '#fff3a0'], 0.8, 2); floaters.push({ x: h.x, y: h.y + 2, t: 0, text: '+1' }); $('hCoinChip').classList.remove('bump'); void $('hCoinChip').offsetWidth; $('hCoinChip').classList.add('bump'); }
        if (e === 'checkpoint') { Snd.sfx.checkpoint(); banner('Контрольная точка!'); const cp = g.lv.checkpoints[g.checkpoint]; burst(cp[0], cp[1] + 2.3, 20, ['#3fbf5a', '#fff', '#ffcf3f'], 1.2, 3); [$('hCp1'), $('hCp2')].forEach((el, k) => el.classList.toggle('on', g.checkpoint >= k)); }
        if (e === 'fall') { if (g.splash) Snd.sfx.splash(); else Snd.sfx.fall(); if (save.shake) shake = 0.45; slowmo = 0.5; onLose(); if (g.splash) burst(g.P.x, g.P.y, 30, ['#9fdcff', '#fff'], 1.4, 4); }
        if (e === 'win') { Snd.sfx.win(); const h = hipPos(g); burst(h.x, h.y + 2, 90, ['#ffcf3f', '#e5483a', '#3fbf5a', '#3a8bff', '#fff', '#ff6fb5'], 2.2, 5); onWin(); }
      }
      if (mode === 'menu' && g.state !== 'play' && g.state !== 'ready' && (g.deadT > 2 || g.winT > 2)) g = createGame(save.cur[0], save.cur[1]);
    }
    if (!g) { requestAnimationFrame(frame); return; }
    // камера: плавно за бедром, с запасом вперёд, отдаляется на скорости
    const h = hipPos(g), speed = Math.abs(g.w);
    const k = 1 - Math.pow(0.03, dt);
    const zoomT = 1 + Math.min(0.22, speed * 0.18);
    cam.zoom += (zoomT - cam.zoom) * (1 - Math.pow(0.2, dt));
    PPM = Math.min(W / 10.5, H / 13) / cam.zoom;
    cam.x += (h.x + 1.6 + g.w * 0.8 - cam.x) * k;
    const groundHere = surface(g.lv, h.x, g.t, h.y).y;
    cam.y += ((groundHere > -1e8 ? Math.max(h.y - 0.6, groundHere + 1.6) : h.y - 0.6) - cam.y) * k * 0.6;
    if (mode === 'play') $('hBar').style.width = Math.max(0, Math.min(100, (h.x / g.lv.finish) * 100)) + '%';

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shake > 0) { shake -= dt; ctx.translate((Math.random() - 0.5) * 16 * shake, (Math.random() - 0.5) * 16 * shake); }
    const theme = g.lv.theme;
    Art.drawBackground(ctx, V, theme, t);
    Art.drawLevel(ctx, V, g, theme, t);
    Art.drawFlags(ctx, V, g, t);
    Art.drawCoins(ctx, V, g, t);
    Art.drawHazards(ctx, V, g, t);
    // персонаж
    const Ls = [0, 1].map((i) => {
      if (i === g.s) return g.Ls;
      const a = legAngle(g, i), c = Math.cos(a), f = footPos(g, i), gy = surface(g.lv, f.x, g.t, h.y - 0.3).y;
      return c > 0.05 && f.y < gy && gy > -1e8 ? Math.max(0.4, (h.y - gy) / c) : g.L; // нога не уходит под землю
    });
    const mood = g.state === 'dead' ? 'dead' : g.state === 'win' ? 'win' : Math.abs(g.th) > 0.65 ? 'scared' : 'idle';
    const playing = mode === 'play' || mode === 'lose';
    // опорная нога — зелёное кольцо под стопой
    if (playing && g.state === 'play') {
      const sx0 = V.sx(g.P.x), sy0 = V.sy(g.P.y);
      ctx.strokeStyle = 'rgba(80,255,140,.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx0, sy0, PPM * 0.32, PPM * 0.1, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(80,255,140,.18)'; ctx.fill();
    }
    Art.drawCharacter(ctx, charOf(), stiltOf(), { hx: V.sx(h.x), hy: V.sy(h.y), ta: g.ta, a: [legAngle(g, 0), legAngle(g, 1)], L: Ls, t, mood, legCol: ['#4aa3ff', '#ff8a2a'], held: playing ? input.hold : [false, false], stance: g.s, speed: g.w }, PPM);
    // нога в движении — стрелка, куда она идёт
    if (playing && g.state === 'play') {
      const sw = 1 - g.s, lg = g.legs[sw];
      if (lg.held) {
        const f = footPos(g, sw), x = V.sx(f.x), y = V.sy(f.y), a = legAngle(g, sw), dir = lg.back ? -1 : 1;
        const col = sw === 0 ? '#4aa3ff' : '#ff8a2a', r = PPM * 0.55;
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
        const hx = V.sx(h.x), hy = V.sy(h.y), R = Math.hypot(x - hx, y - hy);
        const a0 = Math.atan2(y - hy, x - hx), a1 = a0 - dir * 0.35;
        ctx.beginPath(); ctx.arc(hx, hy, R, a0, a1, dir > 0); ctx.stroke();
        const ex = hx + Math.cos(a1) * R, ey = hy + Math.sin(a1) * R, tg = a1 - dir * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(ex + Math.cos(tg) * 12, ey + Math.sin(tg) * 12); ctx.lineTo(ex + Math.cos(tg + 2.5) * 10, ey + Math.sin(tg + 2.5) * 10); ctx.lineTo(ex + Math.cos(tg - 2.5) * 10, ey + Math.sin(tg - 2.5) * 10); ctx.fill();
        if (lg.blocked) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 13px Rubik,sans-serif'; ctx.fillText('упор', x - 16, y + 22); }
        void r; void a;
      }
    }
    // всплывающие «+1»
    floaters = floaters.filter((fl) => (fl.t += dt) < 0.9);
    for (const fl of floaters) { ctx.globalAlpha = 1 - fl.t / 0.9; ctx.fillStyle = '#ffcf3f'; ctx.strokeStyle = '#6b3a00'; ctx.lineWidth = 3; ctx.font = `900 ${Math.round(PPM * 0.45)}px Rubik,sans-serif`; const x = V.sx(fl.x), y = V.sy(fl.y + fl.t * 1.2); ctx.strokeText(fl.text, x, y); ctx.fillText(fl.text, x, y); }
    ctx.globalAlpha = 1;
    // обучение: сильный наклон
    if (tut && tut.stage >= 2 && tut.stage < 3 && Math.abs(g.th) > 0.55) tutorial(3);
    if (g.state === 'dead' && g.deadT > 0.5) { const hd = headPos(g); Art.drawDizzy(ctx, V.sx(hd.x), V.sy(hd.y + 0.6), PPM, t); }
    drawParticles(dt);
    requestAnimationFrame(frame);
  }

  // для проверки: #w2l3 — сразу мир 2 уровень 3; #demo — играет автопилот
  const m = location.hash.match(/w(\d)l(\d)/);
  toMenu();
  if (m) startLevel(+m[1] - 1, +m[2] - 1);
  requestAnimationFrame(frame);
  window.__game = () => ({ g, mode, save });
})();
