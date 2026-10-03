// «Ходульщик 2» — игровой цикл, управление, камера, экраны, прогресс и настройки.
(function () {
  'use strict';
  const { CFG, WORLDS, levelCount, createGame, step, hipPos, footPos, legAngle, headPos, surface } = Phys;
  const { THEMES, CHARS, STILTS } = Art;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const CFG_DEFAULT = { ...CFG };

  // ================= СОХРАНЕНИЕ =================
  const KEY = 'hodulki2-save';
  const fresh = () => ({ vibe: true, tutorialDone: false, sound: true, musicOn: true, totalDeaths: 0, coins: 0, owned: ['novice'], stilts: ['wood'], sel: 'novice', stilt: 'wood', done: {}, cur: [0, 0], sfx: 0.8, music: 0.5, swap: false, pads: true, shake: true, phys: {} });
  let save = fresh();
  try { save = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
  Object.assign(CFG, save.phys || {});
  if (!save.owned.includes('novice')) save.owned.unshift('novice');
  const applyVolume = () => { Snd.setVolume('sfx', save.sound ? save.sfx : 0); Snd.setVolume('music', save.musicOn ? save.music : 0); };
  applyVolume();
  const lvKey = (w, i) => w + ':' + i;
  const levelOpen = (w, i) => (w === 0 && i === 0) || !!save.done[i > 0 ? lvKey(w, i - 1) : lvKey(w - 1, levelCount(w - 1) - 1)];
  const fmtT = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); };
  // звёзды: 1 — прошёл; 2 — собрал 60% монет и упал не больше 2 раз; 3 — 85% монет, без падений и быстрее нормы уровня
  function starsFor(lv, time, dz, got) {
    const total = lv.coins.length || 1; let s = 1;
    if (got >= total * 0.6 && dz <= 2) s = 2;
    if (s === 2 && got >= total * 0.85 && dz === 0 && time <= (lv.par || 999)) s = 3;
    return s;
  }
  const worldOpen = (w) => levelOpen(w, 0);
  const charOf = () => CHARS.find((c) => c.id === save.sel) || CHARS[0];
  const stiltOf = () => STILTS.find((s) => s.id === save.stilt) || STILTS[0];

  // ================= ЭКРАН И КАМЕРА =================
  let W = 0, H = 0, DPR = 1, PPM = 50;
  let lowQ = false, slowT = 0; // упрощённая графика для слабых телефонов
  function resize() {
    DPR = lowQ ? 1 : Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize); resize();
  const cam = { x: 0, y: 2, zoom: 1 };
  const V = { low: false, get W() { return W; }, get H() { return H; }, get PPM() { return PPM; }, cam, sx: (x) => (x - cam.x) * PPM + W * (W < H ? 0.42 : 0.36), sy: (y) => H * (W < H ? 0.62 : 0.58) - (y - cam.y) * PPM };

  // ================= СОСТОЯНИЕ ИГРЫ =================
  let g = null, mode = 'menu', world = 0, level = 0, deaths = 0, particles = [], shake = 0, slowmo = 0, tut = null, floaters = [];
  let flyCoins = [], flash = [], puffs = [], cpAct = {}, lastLand = -9, whiteFlash = 0, aimAmt = 0, leaves = [];
  // свайп: одна общая зона управления; нога выбирается сама и меняется после каждого шага
  const aim = { on: false, x0: 0, y0: 0, dx: 0, dy: 0, dist: 0, up: 0, id: null, t0: 0 };
  let pendingCmd = null;
  function startLevel(w, i, fromCp = -1, keep = null) {
    world = w; level = i; save.cur = [w, i]; persist();
    g = createGame(w, i, fromCp);
    if (keep) { g.time = keep.time; g.coinsTaken = keep.coinsTaken; g.coinsGot = keep.coinsGot; } else deaths = 0;
    if (!keep) tut = w === 0 && i === 0 && !save.tutorialDone ? { stage: 0, steps: 0, t: 0 } : null;
    const h = hipPos(g); cam.x = h.x + 1; cam.y = h.y - 1; cam.zoom = 1;
    particles = []; aim.on = false; pendingCmd = null; puffs = []; flyCoins = []; cpAct = {};
    mode = 'play'; showScreen(null);
    $('hud').classList.remove('hidden'); $('legChip').classList.remove('hidden'); $('legChip').dataset.leg = g.active;
    $('hTitle').textContent = w === 0 ? `${i + 1}. ${g.lv.name}` : `${WORLDS[w].name} ${i + 1}`;
    const cps = g.lv.checkpoints;
    [$('hCp1'), $('hCp2')].forEach((el, k) => { if (cps[k]) { el.style.display = ''; el.style.left = (cps[k][0] / g.lv.finish) * 100 + '%'; el.classList.toggle('on', g.checkpoint >= k); } else el.style.display = 'none'; });
    $('hCoins').textContent = save.coins;
    hint(''); if (tut) tutorial(tut.stage);
    hDeaths.textContent = deaths;
    Snd.music(w);
  }
  // ---------- обучение на первом уровне ----------
  const TUT = [
    { title: 'ПРОВЕДИ ПАЛЬЦЕМ ВПРАВО', text: 'Коснись экрана в любом месте и веди палец вправо. На земле появится метка — туда встанет нога. Отпусти — шаг.' },
    { title: 'ТЕПЕРЬ ДРУГАЯ НОГА', text: 'Нога меняется сама после каждого шага — светится та, что пойдёт следующей. Снова свайп вправо.' },
    { title: 'ДЛИНА СВАЙПА = ДЛИНА ШАГА', text: 'Короткий свайп — маленький шаг, длинный — большой. Метка показывает, куда встанет нога.' },
    { title: 'НЕ ШАГАЙ СЛИШКОМ ШИРОКО', text: 'Если ноги окажутся слишком далеко друг от друга — они разъедутся. И не ставь ногу на самый край.' },
    { title: 'ВЕДИ ЧУТЬ ВВЕРХ', text: 'Свайп вправо-вверх поднимает ногу выше — так перешагивают брёвна и ступеньки.' },
    { title: 'ОТЛИЧНО!', text: 'Собирай монеты и дойди до финиша. Флажки по пути — контрольные точки.' },
  ];
  function tutorial(stage) {
    if (!tut) return;
    tut.stage = stage; tut.t = 0;
    const s = TUT[stage];
    if (!s) { hint(''); tut = null; return; }
    hint(`<div class="tut-title">${s.title}</div>${s.text}`);
  }
  function hint(html) { const el = $('hint'); if (html) { el.innerHTML = html; el.classList.remove('hidden'); } else el.classList.add('hidden'); }
  function banner(text) { const el = $('banner'); el.textContent = text; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(banner._t); banner._t = setTimeout(() => el.classList.add('hidden'), 1300); }
  function toast(text) { const el = $('toast'); el.textContent = text; el.classList.remove('hidden'); el.style.opacity = 1; clearTimeout(toast._t); toast._t = setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.classList.add('hidden'), 400); }, 1800); }

  // ================= УПРАВЛЕНИЕ =================
  // Свайп в любом месте экрана: вправо — шаг вперёд, влево — назад, длина свайпа — длина шага,
  // вверх — нога поднимается выше (перешагнуть препятствие). Отпустил палец — нога летит к метке.
  function swipeScale() { return Math.max(180, Math.min(W, H) * 0.62); }
  function updateAim() {
    const s = swipeScale();
    aim.dist = Math.sign(aim.dx) * Math.min(CFG.maxStep, (Math.abs(aim.dx) / s) * 3.2);
    aim.up = Math.max(0, Math.min(1, -aim.dy / (s * 0.55)));
  }
  window.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || aim.on || e.target.closest('button, .modal, .screen, input, details')) return;
    e.preventDefault(); Snd.unlock();
    Object.assign(aim, { on: true, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, dist: 0, up: 0, t0: performance.now() });
  });
  window.addEventListener('pointermove', (e) => { if (aim.on && e.pointerId === aim.id) { aim.dx = e.clientX - aim.x0; aim.dy = e.clientY - aim.y0; updateAim(); } });
  const release = (e) => {
    if (!aim.on || (e && e.pointerId !== aim.id)) return;
    aim.on = false;
    if (mode === 'play' && (Math.abs(aim.dist) >= 0.15 || aim.up >= 0.15)) { pendingCmd = { dist: aim.dist, up: aim.up }; if (!tut) hint(''); }
  };
  window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => { aim.on = false; });
  document.addEventListener('touchstart', (e) => { if (!e.target.closest('button, .modal, .screen, input, details, summary')) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  // клавиатура: держи → (или D) — шаг растёт; ↑ — выше; отпусти — шаг. ← (A) — шаг назад
  const kb = { dir: 0, t0: 0, up: false };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const d = e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space' ? 1 : e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 0;
    if (d && mode === 'play' && !kb.dir) { kb.dir = d; kb.t0 = performance.now(); e.preventDefault(); Snd.unlock(); Object.assign(aim, { on: true, id: 'kb', dx: 0, dy: 0 }); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') kb.up = true;
    if (e.code === 'Escape' && mode === 'play') pause();
    if (e.code === 'KeyR' && (mode === 'play' || mode === 'lose')) startLevel(world, level);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') kb.up = false;
    const d = e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space' ? 1 : e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 0;
    if (d && d === kb.dir) { kb.dir = 0; release({ pointerId: 'kb' }); }
  });
  function keyboardAim() {
    if (!kb.dir || !aim.on) return;
    const t = (performance.now() - kb.t0) / 1000; // шаг растёт, пока держишь клавишу
    aim.dist = kb.dir * Math.min(CFG.maxStep, 0.3 + t * 2.2); aim.up = kb.up ? 0.7 : 0;
  }
  // ================= ЭКРАНЫ =================
  const screens = ['sMenu', 'sWorlds', 'sChars', 'sSettings'];
  function showScreen(id) {
    screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
    if (id) { $('hud').classList.add('hidden'); $('legChip').classList.add('hidden'); hint(''); }
    document.querySelectorAll('.tCoins').forEach((el) => (el.textContent = save.coins));
  }
  function toMenu() {
    mode = 'menu'; ['mPause', 'mWin', 'mLose'].forEach((m) => $(m).classList.add('hidden'));
    // на фоне меню — демо-уровень
    g = createGame(save.cur[0], save.cur[1]); world = save.cur[0];
    const [w, i] = nextLevel();
    $('mPlaySub').textContent = !nextLevel(true) ? 'Все уровни пройдены!' : `${WORLDS[w].name} · уровень ${i + 1}`;
    $('dotChars').classList.toggle('hidden', !CHARS.some((ch) => !save.owned.includes(ch.id) && ch.price <= save.coins));
    showScreen('sMenu'); Snd.music(save.cur[0]);
  }
  function nextLevel(strict) {
    for (let w = 0; w < WORLDS.length; w++) for (let i = 0; i < levelCount(w); i++) if (!save.done[lvKey(w, i)]) return [w, i];
    return strict ? null : save.cur;
  }
  $('mPlay').onclick = () => { Snd.unlock(); Snd.sfx.click(); const [w, i] = nextLevel(); startLevel(w, i); };
  $('mWorlds').onclick = () => { Snd.unlock(); Snd.sfx.click(); mapWorld = save.cur[0]; renderWorlds(); showScreen('sWorlds'); };
  $('mChars').onclick = () => { Snd.unlock(); Snd.sfx.click(); shopTab = 'chars'; view = save.sel; showScreen('sChars'); renderShop(); };
  $('mSettings').onclick = () => { Snd.unlock(); Snd.sfx.click(); renderSettings(); showScreen('sSettings'); };
  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { Snd.sfx.click(); toMenu(); }));

  // карта мира: тропинка с уровнями, вкладки миров сверху
  let mapWorld = save.cur[0];
  function renderWorlds() {
    const tabs = $('worldTabs'); tabs.innerHTML = '';
    WORLDS.forEach((Wd, w) => {
      const open = worldOpen(w), stars = Array.from({ length: levelCount(w) }, (_, i) => (save.done[lvKey(w, i)] || {}).stars || 0).reduce((a, b) => a + b, 0);
      const b = document.createElement('button'); b.className = 'wtab' + (w === mapWorld ? ' on' : '') + (open ? '' : ' locked');
      b.innerHTML = `${open ? '' : ICON.lock}${w + 1}. ${Wd.name}${open ? ` <small>${ICON.star}${stars}</small>` : ''}`;
      b.onclick = () => { if (!open) { toast('Пройди предыдущий мир, чтобы открыть этот'); return; } Snd.sfx.click(); mapWorld = w; renderWorlds(); };
      tabs.appendChild(b);
    });
    const map = $('worldMap'), th = THEMES[WORLDS[mapWorld].id], n = levelCount(mapWorld);
    map.innerHTML = '';
    // уровни идут змейкой снизу вверх: по 4 в ряд, ряды чередуют направление
    const perRow = n > 5 ? 4 : 5, rows = Math.ceil(n / perRow), rowH = 210, Hpx = rows * rowH + 170;
    const inner = document.createElement('div'); inner.className = 'wmap-in'; inner.style.height = Hpx + 'px';
    inner.style.background = `linear-gradient(${th.sky[0]} 0px, ${th.sky[1]} 120px, ${th.top} 121px, ${th.top2} 100%)`;
    map.appendChild(inner);
    const pts = [];
    for (let i = 0; i < n; i++) { const r = Math.floor(i / perRow), c = i % perRow, cc = r % 2 ? perRow - 1 - c : c; pts.push([14 + (cc * 72) / (perRow - 1), Hpx - 90 - r * rowH - (c % 2 ? 46 : 0) - (c === perRow - 1 ? 30 : 0)]); }
    pts.push([pts[n - 1][0] > 50 ? pts[n - 1][0] - 20 : pts[n - 1][0] + 20, pts[n - 1][1] - 110]); // флаг мира
    // плавная тропинка (сплайн через точки)
    const W2 = map.clientWidth || 360, X = (p) => (p[0] / 100) * W2;
    let d = `M${X(pts[0])},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; d += ` C${X(p1) + (X(p2) - X(p0)) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${X(p2) - (X(p3) - X(p1)) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${X(p2)},${p2[1]}`; }
    inner.insertAdjacentHTML('beforeend', `<svg class="path" width="${W2}" height="${Hpx}"><path d="${d}" fill="none" stroke="rgba(90,55,25,.55)" stroke-width="26" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#f1d9a6" stroke-width="18" stroke-linecap="round"/><path d="${d}" fill="none" stroke="rgba(150,100,50,.55)" stroke-width="3" stroke-dasharray="7 9" stroke-linecap="round"/></svg>`);
    // ручей поперёк карты с мостиком
    if (rows > 2) inner.insertAdjacentHTML('beforeend', `<div class="river" style="top:${Hpx - 2 * rowH - 30}px"></div>`);
    // декор: деревья, кусты, камни, грибы — нарисованы кодом игры
    const deco = (spr, x, y, w) => { const img = document.createElement('img'); img.src = spr.toDataURL(); img.className = 'mapdeco'; img.style.cssText = `left:${x}%;top:${y}px;width:${w}px;transform:translate(-50%,-92%)`; inner.appendChild(img); };
    for (let k = 0; k < rows * 4 + 3; k++) {
      const y = 150 + ((k * 137) % (Hpx - 180)), x = (k * 53) % 100, near = pts.some((p) => Math.abs(p[0] - x) < 14 && Math.abs(p[1] - y) < 70);
      if (near) continue;
      const kind = k % 4; deco(kind === 0 ? Gfx.treeSprite(3 + (k % 6), 0) : kind === 1 ? Gfx.bushSprite(4 + (k % 4), 0) : kind === 2 ? Gfx.treeSprite(11 + (k % 4), 0) : Gfx.bushSprite(9 + (k % 3), 0), x, y, kind % 2 ? 70 : 96);
    }
    inner.insertAdjacentHTML('afterbegin', `<div class="mapname">${WORLDS[mapWorld].name}</div>`);
    let curNode = null;
    for (let i = 0; i < n; i++) {
      const p = pts[i], d2 = save.done[lvKey(mapWorld, i)], ok = levelOpen(mapWorld, i), cur = ok && !d2;
      const b = document.createElement('button'); b.className = 'node' + (d2 ? ' done' : '') + (!ok ? ' locked' : '') + (cur ? ' cur' : '');
      b.style.left = p[0] + '%'; b.style.top = p[1] + 'px';
      const st = d2 ? d2.stars : 0;
      b.innerHTML = ok ? `${d2 ? `<span class="stars3">${[0, 1, 2].map((k) => (k < st ? ICON.star : ICON.starOff)).join('')}</span>` : ''}${i + 1}${d2 && d2.time ? `<span class="lbl">${fmtT(d2.time)}</span>` : ''}` : `<span class="ico big">${ICON.lock}</span>`;
      b.title = mapWorld === 0 ? Phys.GV[i].name : '';
      b.onclick = () => { if (!ok) { toast('Сначала пройди уровень ' + i); return; } Snd.sfx.click(); startLevel(mapWorld, i); };
      inner.appendChild(b);
      if (cur || (!curNode && i === n - 1)) curNode = b;
    }
    const fp = pts[n], fl = document.createElement('div'); fl.className = 'node locked flagnode'; fl.style.left = fp[0] + '%'; fl.style.top = fp[1] + 'px'; fl.innerHTML = ICON.flag; inner.appendChild(fl);
    // прокрутка к текущему уровню
    setTimeout(() => { if (curNode) map.scrollTop = Math.max(0, parseFloat(curNode.style.top) - map.clientHeight * 0.55); }, 0);
  }
  // ---------- персонажи и ходули ----------
  let shopTab = 'chars', view = save.sel;
  document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { Snd.sfx.click(); shopTab = t.dataset.tab; view = shopTab === 'chars' ? save.sel : save.stilt; document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t)); renderShop(); }));
  function paintHero(canvas, ch, sk, big, t = performance.now() / 1000) {
    const c2 = canvas.getContext('2d'); c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, canvas.width, canvas.height);
    const u = canvas.width / (big ? 4.4 : 3.4), sway = Math.sin(t * 1.6) * 0.04;
    const wave = big && (t % 5) < 1.4;
    Gfx.softShadow(c2, canvas.width * 0.5, canvas.height * 0.93, canvas.width * 0.6, canvas.height * 0.06, 0.35);
    Art.drawCharacter(c2, ch, sk, { hx: canvas.width * 0.5, hy: canvas.height * (big ? 0.6 : 0.62), ta: sway * 0.5, a: [-0.2 + sway, 0.2 + sway], L: [big ? 1.25 : 1.05, big ? 1.25 : 1.05], t, mood: wave ? 'win' : 'idle', legCol: ['#4aa3ff', '#ff8a2a'], anim: {} }, u);
  }
  let heroAnim = 0;
  function animateHero() {
    cancelAnimationFrame(heroAnim);
    const loop = () => {
      if ($('sChars').classList.contains('hidden')) return;
      const isChar = shopTab === 'chars', it = (isChar ? CHARS : STILTS).find((x) => x.id === view);
      if (it) paintHero($('heroCv'), isChar ? it : charOf(), isChar ? stiltOf() : it, true);
      heroAnim = requestAnimationFrame(loop);
    };
    loop();
  }
  function stepView(dir) {
    const items = shopTab === 'chars' ? CHARS : STILTS, i = items.findIndex((x) => x.id === view);
    view = items[(i + dir + items.length) % items.length].id; Snd.sfx.click(); renderShop();
    const pod = document.querySelector('.podium'); pod.animate([{ transform: `translateX(${dir * 30}px)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }
  $('hPrev').onclick = () => stepView(-1); $('hNext').onclick = () => stepView(1);
  function renderShop() {
    document.querySelectorAll('.tCoins').forEach((el) => (el.textContent = save.coins));
    const isChar = shopTab === 'chars', items = isChar ? CHARS : STILTS, ownedList = isChar ? save.owned : save.stilts;
    const it = items.find((x) => x.id === view) || items[0], owned = ownedList.includes(it.id);
    const selected = isChar ? save.sel === it.id : save.stilt === it.id;
    $('heroName').textContent = it.name; $('heroInfo').textContent = it.info || 'Раскраска ходуль. На физику не влияет — только красота.';
    const btn = $('heroBtn'); btn.className = 'act'; btn.onclick = null;
    if (selected) btn.innerHTML = `${ICON.star} Выбрано`;
    else if (owned) { btn.textContent = 'Выбрать'; btn.onclick = () => { if (isChar) save.sel = it.id; else save.stilt = it.id; persist(); Snd.sfx.click(); renderShop(); }; }
    else {
      btn.innerHTML = `Открыть за ${ICON.coin} ${it.price}`;
      if (save.coins < it.price) btn.classList.add('off');
      btn.onclick = () => {
        if (save.coins < it.price) { toast(`Не хватает ${it.price - save.coins} монет — пройди ещё уровни`); return; }
        save.coins -= it.price; ownedList.push(it.id); if (isChar) save.sel = it.id; else save.stilt = it.id;
        persist(); Snd.sfx.unlock(); toast(`${it.name} — открыто!`); renderShop();
        document.querySelector('.podium').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 400 });
      };
    }
    const grid = $('charGrid'); grid.innerHTML = '';
    items.forEach((x) => {
      const own = ownedList.includes(x.id);
      const b = document.createElement('button'); b.className = 'cell' + (x.id === view ? ' sel' : '') + (own ? ' owned' : ' locked');
      const c = document.createElement('canvas'); c.width = 170; c.height = 210; b.appendChild(c);
      if (!own) b.insertAdjacentHTML('beforeend', `<span class="lockI">${ICON.lock}</span><span class="price">${ICON.coin}${x.price}</span>`);
      b.onclick = () => { Snd.sfx.click(); view = x.id; renderShop(); };
      grid.appendChild(b); paintHero(c, isChar ? x : charOf(), isChar ? stiltOf() : x, false, 1);
      if (x.id === view) setTimeout(() => b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 0);
    });
    animateHero();
  }
  // ---------- настройки ----------
  const PHYS_LABELS = { gravity: 'Гравитация (падение)', legLength: 'Длина ходуль', maxSpread: 'Насколько широко можно расставить ноги', maxStep: 'Самый длинный шаг', swingTime: 'Время шага', swingPerMeter: 'Замедление длинного шага', stepLift: 'Высота подъёма ноги', edgeSlip: 'Опасная зона у края', maxRise: 'На сколько можно шагнуть вверх', maxDrop: 'На сколько можно шагнуть вниз', bodyLag: 'Запаздывание тела', sway: 'Раскачивание тела' };
  function renderSettings() {
    $('oSfx').value = save.sfx; $('oMusic').value = save.music; $('oSound').checked = save.sound; $('oMusicOn').checked = save.musicOn; $('oShake').checked = save.shake; $('oVibe').checked = save.vibe;
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

  $('oShake').onchange = (e) => { save.shake = e.target.checked; persist(); };
  $('oVibe').onchange = (e) => { save.vibe = e.target.checked; persist(); buzz(30); };
  $('oPhysReset').onclick = () => { Object.assign(CFG, CFG_DEFAULT); save.phys = {}; persist(); renderSettings(); toast('Физика как была'); };
  $('oReset').onclick = () => $('mConfirm').classList.remove('hidden');
  $('cNo').onclick = () => $('mConfirm').classList.add('hidden');
  $('cYes').onclick = () => { const keep = { sfx: save.sfx, music: save.music, sound: save.sound, musicOn: save.musicOn }; save = Object.assign(fresh(), keep); Object.assign(CFG, CFG_DEFAULT); persist(); $('mConfirm').classList.add('hidden'); toast('Прогресс сброшен'); toMenu(); };

  // ---------- пауза, победа, поражение ----------
  function pause() { if (mode !== 'play') return; mode = 'pause'; $('mPause').classList.remove('hidden'); $('pCheckpoint').classList.toggle('hidden', g.checkpoint < 0); }
  $('bPause').onclick = (e) => { e.stopPropagation(); Snd.sfx.click(); pause(); };
  $('pResume').onclick = () => { mode = 'play'; $('mPause').classList.add('hidden'); aim.on = false; };
  $('pRestart').onclick = () => { $('mPause').classList.add('hidden'); startLevel(world, level); };
  $('pCheckpoint').onclick = () => { $('mPause').classList.add('hidden'); startLevel(world, level, g.checkpoint); };
  $('pMenu').onclick = () => toMenu();
  let settingsFromPause = false;
  $('pSettings').onclick = () => { Snd.sfx.click(); settingsFromPause = true; $('mPause').classList.add('hidden'); renderSettings(); screens.forEach((s) => $(s).classList.toggle('hidden', s !== 'sSettings')); };
  $('sSettings').querySelector('[data-back]').onclick = () => { Snd.sfx.click(); if (settingsFromPause) { settingsFromPause = false; $('sSettings').classList.add('hidden'); $('mPause').classList.remove('hidden'); } else toMenu(); };
  $('lCheckpoint').onclick = () => { $('mLose').classList.add('hidden'); startLevel(world, level, lastCp); };
  $('lRestart').onclick = () => { $('mLose').classList.add('hidden'); startLevel(world, level); };
  $('lMenu').onclick = () => toMenu();
  $('wNext').onclick = () => { Snd.sfx.click(); $('mWin').classList.add('hidden'); const nx = level + 1 < levelCount(world) ? [world, level + 1] : world + 1 < WORLDS.length ? [world + 1, 0] : null; if (nx) startLevel(nx[0], nx[1]); else toMenu(); };
  $('wRetry').onclick = () => { $('mWin').classList.add('hidden'); startLevel(world, level); };
  $('wMenu').onclick = () => toMenu();
  let lastCp = -1;

  function onWin() {
    mode = 'win';
    const lv = g.lv, total = lv.coins.length, got = g.coinsGot;
    const stars = starsFor(lv, g.time, deaths, got);
    const reward = 15 + (world === 0 ? level : 20 + world * 5 + level) * 2 + stars * 5;
    save.coins += reward;
    const key = lvKey(world, level), prev = save.done[key];
    const record = !prev || g.time < prev.time;
    save.done[key] = { stars: Math.max(stars, prev ? prev.stars : 0), time: Math.min(g.time, prev ? prev.time : 1e9), deaths: Math.min(deaths, prev && prev.deaths !== undefined ? prev.deaths : 1e9), coins: Math.max(got, prev ? prev.coins || 0 : 0) };
    if (world === 0 && level === 0) save.tutorialDone = true;
    tut = null; hint('');
    const last = level === levelCount(world) - 1, nowOpenWorld = last && world + 1 < WORLDS.length;
    const newLevel = !prev && !last;
    persist();
    setTimeout(() => {
      const best = save.done[key];
      $('wStars').innerHTML = [0, 1, 2].map((i) => `<span class="wstar" style="animation-delay:${0.25 + i * 0.35}s">${i < stars ? ICON.star : ICON.starOff}</span>`).join('');
      for (let i = 0; i < stars; i++) setTimeout(() => Snd.sfx.star(i), 250 + i * 350);
      $('wRecord').classList.toggle('hidden', !(record && prev));
      const ok = (b) => (b ? '<b class="ck on">✓</b>' : '<b class="ck">—</b>');
      $('wText').innerHTML = `<div class="stats4">
        <div><small>${ICON.clock}Время</small><b>${fmtT(g.time)}</b></div>
        <div><small>${ICON.coin}Монеты</small><b>${got}/${total}</b></div>
        <div><small>${ICON.bonk}Падения</small><b>${deaths}</b></div>
        <div><small>${ICON.star}Лучшее</small><b>${fmtT(best.time)}</b></div></div>
        <ul class="crit"><li>${ok(true)}<span>Дойти до финиша</span></li>
        <li>${ok(stars >= 2)}<span>Собрать 60% монет, падений не больше 2</span></li>
        <li>${ok(stars >= 3)}<span>85% монет, без падений, быстрее ${fmtT(lv.par || 0)}</span></li></ul>
        <div class="reward">Награда: ${ICON.coin}<b>+${reward}</b></div>
        ${nowOpenWorld ? `<b class="newworld">Открыт новый мир: ${WORLDS[world + 1].name}!</b>` : newLevel ? `<b class="newworld">Открыт уровень ${level + 2}!</b>` : ''}`;
      $('wNext').textContent = !last ? 'СЛЕДУЮЩИЙ УРОВЕНЬ' : world + 1 < WORLDS.length ? 'СЛЕДУЮЩИЙ МИР' : 'В МЕНЮ';
      $('mWin').classList.remove('hidden'); $('hud').classList.add('hidden'); $('legChip').classList.add('hidden');
      if (nowOpenWorld || newLevel) setTimeout(() => Snd.sfx.unlock(), 1400);
      if (record && prev) setTimeout(() => Snd.sfx.checkpoint(), 1300);
    }, 1700);
  }  function onLose() {
    mode = 'lose'; deaths++; lastCp = g.checkpoint; save.totalDeaths++; persist();
    $('hDeaths').textContent = deaths;
    const card = $('fallCard'); card.innerHTML = `<b>${g.why}</b>${g.tip ? `<br><span>${ICON.bulb}${g.tip}</span>` : ''}<br><small>${lastCp >= 0 ? 'Возвращаемся на контрольную точку…' : 'Начинаем сначала…'}</small>`;
    card.classList.remove('hidden'); hint('');
    const keep = { time: g.time, coinsTaken: g.coinsTaken, coinsGot: g.coinsGot };
    clearTimeout(onLose._t);
    onLose._t = setTimeout(() => { card.classList.add('hidden'); if (mode === 'lose') startLevel(world, level, lastCp, keep); }, g.tip ? 2600 : 1700);
  }

  // вибрация (работает на Android; айфон в браузере её не поддерживает)
  const buzz = (p) => { if (save.vibe && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(p); } catch (e) {} };

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
    if (!lowQ && fpsAvg < 48) { slowT += dt; if (slowT > 2) { lowQ = true; V.low = true; resize(); } } else slowT = 0;
    const t = now / 1000;
    if (slowmo > 0) { slowmo -= dt; dt *= 0.35; }
    acc += dt;
    while (acc >= 1 / 60) {
      acc -= 1 / 60;
      if (!g) break;
      if (mode === 'pause') continue;
      let cmd = null;
      if (mode === 'play') { cmd = pendingCmd; pendingCmd = null; if (DEMO) cmd = Phys.bot(g); }
      else if (mode === 'menu') cmd = Phys.bot(g);
      step(g, 1 / 60, cmd);
      for (const e of g.events) {
        if (mode !== 'play' && mode !== 'win' && mode !== 'lose') continue;
        if (e === 'bump' || e === 'slip') Snd.sfx.bump();
        if (e === 'land' && tut) { tut.steps++; const st = [1, 2, 4, 6, 8]; for (let k = 0; k < st.length; k++) if (tut.stage === k && tut.steps >= st[k]) { tutorial(k + 1); break; } }
        if (e === 'land') { buzz(12); Snd.sfx.step(); const f = g.F[1 - g.active]; dust(f.x, f.y, 7, 1); burst(f.x, f.y + 0.05, 6, ['#8a5a32', '#6b4424', '#a8d870'], 0.6, 2, 0.04); lastLand = performance.now() / 1000; $('legChip').dataset.leg = g.active; }
        if (e === 'lift') Snd.sfx.lift();
        if (e === 'bounce') { Snd.sfx.bounce(); const f = g.F[1 - g.active]; burst(f.x, f.y, 12, ['#ff6fb5', '#fff'], 1, 3); }
        if (e === 'coin') { Snd.sfx.coin(); save.coins++; persist(); const k2 = [...g.coinsTaken].pop(), cc = g.lv.coins[k2] || [hipPos(g).x, hipPos(g).y + 1.5]; burst(cc[0], cc[1], 12, ['#ffcf3f', '#fff3a0', '#ffffff'], 0.9, 1.5, 0.05); flash.push({ x: cc[0], y: cc[1], t: 0 }); flyCoins.push({ x: V.sx(cc[0]), y: V.sy(cc[1]), t: 0 }); floaters.push({ x: cc[0], y: cc[1] + 0.4, t: 0, text: '+1' }); }
        if (e === 'checkpoint') { cpAct[g.checkpoint] = performance.now() / 1000; buzz([15, 40, 15]); Snd.sfx.checkpoint(); banner('Контрольная точка!'); const cp = g.lv.checkpoints[g.checkpoint]; burst(cp[0], cp[1] + 2.3, 20, ['#3fbf5a', '#fff', '#ffcf3f'], 1.2, 3); [$('hCp1'), $('hCp2')].forEach((el, k) => el.classList.toggle('on', g.checkpoint >= k)); }
        if (e === 'fall') { const H0 = hipPos(g); dust(H0.x, surface(g.lv, H0.x, g.t, H0.y).y, 14, 1.6); buzz([40, 50, 90]); if (g.splash) Snd.sfx.splash(); else Snd.sfx.fall(); if (save.shake) shake = 0.45; slowmo = 0.5; onLose(); if (g.splash && g.P) burst(g.P.x, g.P.y, 30, ['#9fdcff', '#fff'], 1.4, 4); }
        if (e === 'win') { buzz([20, 60, 20, 60, 40]); Snd.sfx.win(); const h = hipPos(g); burst(h.x, h.y + 2, 90, ['#ffcf3f', '#e5483a', '#3fbf5a', '#3a8bff', '#fff', '#ff6fb5'], 2.2, 5); whiteFlash = 0.35; onWin(); }
      }
      if (mode === 'menu' && g.state !== 'play' && g.state !== 'ready' && (g.deadT > 2 || g.winT > 2)) g = createGame(save.cur[0], save.cur[1]);
    }
    if (mode === 'menu') { menuScene(dt, t); requestAnimationFrame(frame); return; }
    if (!g) { requestAnimationFrame(frame); return; }
    // камера: плавно за бедром, с запасом вперёд; при падении и победе — чуть ближе
    keyboardAim();
    const h = hipPos(g), speed = Math.abs(g.hv ? g.hv.x : 0) / 2.5;
    const k = 1 - Math.pow(0.03, dt);
    const close = g.state === 'dead' || g.state === 'win';
    const zoomT = close ? 0.82 : 1 + Math.min(0.15, speed * 0.12) + (aim.on ? Math.min(0.1, Math.abs(aim.dist) * 0.03) : 0);
    cam.zoom += (zoomT - cam.zoom) * (1 - Math.pow(0.15, dt));
    PPM = Math.min(W / 9.2, H / 11.5) / cam.zoom;
    const lookAhead = close ? 0.4 : (W < H ? 1.0 : 1.8) + (aim.on ? aim.dist * 0.35 : 0);
    cam.x += (h.x + lookAhead + (g.hv ? g.hv.x : 0) * 0.25 - cam.x) * k;
    const groundHere = surface(g.lv, h.x, g.t, h.y).y;
    cam.y += ((groundHere > -1e8 ? Math.max(h.y - 0.6, groundHere + 1.6) : h.y - 0.6) + (close ? 0.6 : 0) - cam.y) * k * 0.6;
    if (mode === 'play') {
      $('hBar').style.width = Math.max(0, Math.min(100, (h.x / g.lv.finish) * 100)) + '%';
      const tt = fmtT(g.time); if ($('hTime').textContent !== tt) $('hTime').textContent = tt;
      const pot = deaths > 2 ? 1 : deaths > 0 || g.time > (g.lv.par || 999) ? 2 : 3; // сколько звёзд ещё можно получить
      if ($('hStars').dataset.n !== String(pot)) { $('hStars').dataset.n = pot; $('hStars').innerHTML = [0, 1, 2].map((i) => (i < pot ? ICON.star : ICON.starOff)).join(''); }
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shake > 0) { shake -= dt; ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake); }
    const theme = g.lv.theme, forest = theme === 'forest';
    if (forest) { Gfx.drawForestBackground(ctx, V, t); Gfx.drawNearTrees(ctx, V, t, g.lv); Gfx.drawForestGround(ctx, V, g, t); Gfx.drawObjects(ctx, V, g, t, theme); }
    else { Art.drawBackground(ctx, V, theme, t); Art.drawLevel(ctx, V, g, theme, t); }
    Gfx.drawCheckpoints(ctx, V, g, performance.now() / 1000, cpAct);
    Gfx.drawFinish(ctx, V, g, t, g.state === 'win');
    Gfx.drawCoins(ctx, V, g, t);
    Art.drawHazards(ctx, V, g, t);
    // персонаж: ходули — от бедра до стопы; анимации связаны с шагом
    const Ls = [0, 1].map((i) => { const f = footPos(g, i); return Math.max(0.5, Math.hypot(f.x - h.x, f.y - h.y)); });
    const playing = mode === 'play' || mode === 'lose';
    const act = g.active, actCol = act === 0 ? '#4aa3ff' : '#ff8a2a';
    aimAmt += ((aim.on && playing ? Math.min(1, Math.abs(aim.dist) / 1.6 + aim.up * 0.5) : 0) - aimAmt) * Math.min(1, dt * 12);
    const spread = Math.abs(g.F[0].x - g.F[1].x) / CFG.maxSpread;
    const wobble = g.state === 'play' ? Math.max(0, (spread - 0.78) / 0.22) + Math.max(0, Math.abs(g.ta) - 0.35) * 2 : 0;
    const anim = { aim: aimAmt, aimDir: aim.on ? aim.dist : 0, swing: g.swing ? g.swing.t / g.swing.T : 0, swingLeg: g.swing ? g.swing.a : -1, landT: performance.now() / 1000 - lastLand, wobble };
    const mood = g.state === 'dead' ? 'dead' : g.state === 'win' ? 'win' : 'idle';
    Gfx.drawHeroShadows(ctx, V, g);
    // подсказка шага: дуга и метка, куда встанет нога
    if (playing && g.state !== 'dead' && aim.on && !g.swing && (Math.abs(aim.dist) > 0.05 || aim.up > 0.05)) {
      const pv = Phys.preview(g, aim.dist, aim.up);
      ctx.setLineDash([7, 8]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 6;
      ctx.beginPath(); pv.pts.forEach((p, i) => (i ? ctx.lineTo(V.sx(p.x), V.sy(p.y) + 2) : ctx.moveTo(V.sx(p.x), V.sy(p.y) + 2))); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); pv.pts.forEach((p, i) => (i ? ctx.lineTo(V.sx(p.x), V.sy(p.y)) : ctx.moveTo(V.sx(p.x), V.sy(p.y)))); ctx.stroke(); ctx.setLineDash([]);
      const mx = V.sx(pv.tx), my = V.sy(pv.ok ? pv.ty : g.F[1 - act].y), pulse = 1 + Math.sin(t * 8) * 0.08;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const mg = ctx.createRadialGradient(mx, my, 2, mx, my, PPM * 0.6); mg.addColorStop(0, actCol + 'aa'); mg.addColorStop(1, actCol + '00'); ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(mx, my, PPM * 0.6, PPM * 0.22, 0, 0, 7); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(mx, my, PPM * 0.32 * pulse, PPM * 0.11 * pulse, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = actCol; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my - PPM * 0.16); ctx.lineTo(mx - PPM * 0.16, my - PPM * 0.48); ctx.lineTo(mx + PPM * 0.16, my - PPM * 0.48); ctx.closePath(); ctx.fillStyle = actCol; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
      const lbl = Math.abs(aim.dist).toFixed(1) + ' м'; ctx.font = `900 ${Math.round(PPM * 0.3)}px Rubik,sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,20,10,.75)'; ctx.strokeText(lbl, mx, my - PPM * 0.62); ctx.fillStyle = '#fff'; ctx.fillText(lbl, mx, my - PPM * 0.62); ctx.textAlign = 'left';
    }
    // опорная нога — мягкое зелёное кольцо
    if (playing && g.state === 'play') {
      const sf = g.F[1 - act];
      ctx.strokeStyle = 'rgba(90,255,150,.75)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(V.sx(sf.x), V.sy(sf.y) + 1, PPM * 0.28, PPM * 0.08, 0, 0, 7); ctx.stroke();
    }
    const glow = [false, false]; if (playing && g.state === 'play' && !g.swing) glow[act] = true;
    Art.drawCharacter(ctx, charOf(), stiltOf(), { hx: V.sx(h.x), hy: V.sy(h.y), ta: g.ta, a: [legAngle(g, 0), legAngle(g, 1)], L: Ls, t, mood, legCol: ['#4aa3ff', '#ff8a2a'], held: glow, speed: (g.hv ? g.hv.x : 0) / 2.5, anim }, PPM);
    if (g.state === 'dead' && g.deadT > 0.5) { const hd = headPos(g); Art.drawDizzy(ctx, V.sx(hd.x), V.sy(hd.y + 0.6), PPM, t); }
    if (forest) { Gfx.drawGroundDeco(ctx, V, g, g.lv.segs.filter((s) => s[0] !== s[2] && s[4] === 'ground'), true); }
    drawPuffs(dt);
    drawParticles(dt);
    if (forest) { drawLeaves(dt); Gfx.drawForeground(ctx, V, t); }
    // вспышки монет и «+1»
    flash = flash.filter((fl) => (fl.t += dt) < 0.35);
    for (const fl of flash) { const x = V.sx(fl.x), y = V.sy(fl.y), r = PPM * (0.3 + fl.t * 3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - fl.t / 0.35; const fg = ctx.createRadialGradient(x, y, 1, x, y, r); fg.addColorStop(0, 'rgba(255,250,200,1)'); fg.addColorStop(1, 'rgba(255,220,90,0)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }
    floaters = floaters.filter((fl) => (fl.t += dt) < 0.8);
    for (const fl of floaters) { ctx.globalAlpha = 1 - fl.t / 0.8; ctx.font = `900 ${Math.round(PPM * 0.42)}px Rubik,sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = '#6b3a00'; ctx.fillStyle = '#ffd34d'; const x = V.sx(fl.x), y = V.sy(fl.y + fl.t * 1.1); ctx.strokeText(fl.text, x, y); ctx.fillText(fl.text, x, y); }
    ctx.globalAlpha = 1;
    // монеты летят к счётчику
    const chip = $('hCoinChip').getBoundingClientRect(), tx = chip.left + 18, ty = chip.top + chip.height / 2;
    flyCoins = flyCoins.filter((fc) => {
      fc.t += dt / 0.55; const e = fc.t * fc.t * (3 - 2 * fc.t), x = fc.x + (tx - fc.x) * e, y = fc.y + (ty - fc.y) * e - Math.sin(Math.PI * fc.t) * 60;
      if (fc.t >= 1) { $('hCoins').textContent = save.coins; $('hCoinChip').classList.remove('bump'); void $('hCoinChip').offsetWidth; $('hCoinChip').classList.add('bump'); return false; }
      ctx.save(); ctx.translate(x, y); Gfx.coinFace(ctx, PPM * 0.22 * (1 - fc.t * 0.35), t * 9, t); ctx.restore(); return true;
    });
    if (whiteFlash > 0) { whiteFlash -= dt; ctx.fillStyle = `rgba(255,250,225,${Math.max(0, whiteFlash) * 1.6})`; ctx.fillRect(0, 0, W, H); }
    requestAnimationFrame(frame);
  }
  // сцена главного меню: живой лес, холм, герой покачивается и иногда машет
  let menuX = 0;
  function menuScene(dt, t) {
    menuX += dt * 0.5; cam.x = menuX; cam.y = 2; cam.zoom = 1; PPM = Math.min(W / 9, H / 11);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    Gfx.drawForestBackground(ctx, V, t);
    // холм
    const hy = H * (W < H ? 0.72 : 0.8), hx = W < H ? W / 2 : W * 0.3;
    const hg = ctx.createLinearGradient(0, hy - H * 0.08, 0, H); hg.addColorStop(0, '#8fe06a'); hg.addColorStop(0.12, '#4fb24a'); hg.addColorStop(0.13, '#7a4d2b'); hg.addColorStop(1, '#4e2f17');
    ctx.beginPath(); ctx.moveTo(-20, H); ctx.lineTo(-20, hy + H * 0.04); ctx.quadraticCurveTo(hx, hy - H * 0.1, W + 20, hy + H * 0.04); ctx.lineTo(W + 20, H); ctx.closePath();
    ctx.fillStyle = hg; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(38,24,14,.9)'; ctx.stroke();
    for (let i = 0; i < 9; i++) { const x = W * (0.05 + i * 0.11), spr = i % 3 ? Gfx.bushSprite(30 + i, 0) : Gfx.treeSprite(20 + i, 0.1); const s = (i % 3 ? 0.6 : 0.9) * PPM / 60, w = spr.width * s, h = spr.height * s; if (Math.abs(x - hx) < W * 0.18) continue; ctx.drawImage(spr, x - w / 2, hy + H * 0.02 - h * 0.92 + Math.abs(x - hx) * 0.08, w, h); }
    // герой стоит на вершине холма
    const u = Math.min(W * 0.95, H * (W < H ? 0.5 : 0.62)) / 6.4, sway = Math.sin(t * 1.4) * 0.05, wave = (t % 6) < 1.5;
    const feetY = hy - H * 0.035, L = 2.4, a0 = -0.2 + sway, a1 = 0.2 + sway, hipY = feetY - Math.cos(0.2) * L * u;
    Gfx.softShadow(ctx, hx, feetY + 4, u * 2.4, u * 0.35, 0.35);
    Art.drawCharacter(ctx, charOf(), stiltOf(), { hx: hx + Math.sin(sway) * u * 0.4, hy: hipY, ta: sway * 0.6, a: [a0, a1], L: [L, L], t, mood: wave ? 'win' : 'idle', legCol: ['#4aa3ff', '#ff8a2a'], anim: {} }, u);
    Gfx.drawForeground(ctx, V, t);
  }
  // облачка пыли
  function dust(x, y, n, s) { for (let i = 0; i < n; i++) puffs.push({ x: x + (Math.random() - 0.5) * 0.4 * s, y: y + 0.05, vx: (Math.random() - 0.5) * 1.6 * s, vy: Math.random() * 0.6, r: 0.12 + Math.random() * 0.12 * s, t: 0, life: 0.5 + Math.random() * 0.4 }); }
  function drawPuffs(dt) {
    puffs = puffs.filter((p) => (p.t += dt) < p.life);
    for (const p of puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 3; const k = p.t / p.life, r = (p.r + k * 0.35) * PPM; ctx.globalAlpha = (1 - k) * 0.55; ctx.fillStyle = '#f1e6d0'; ctx.beginPath(); ctx.arc(V.sx(p.x), V.sy(p.y), r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // падающие листья в лесу (немного, для живости)
  function drawLeaves(dt) {
    if (leaves.length < 7 && Math.random() < dt * 1.2) leaves.push({ x: Math.random() * W, y: -10, vy: 25 + Math.random() * 25, ph: Math.random() * 6, s: 0.7 + Math.random() * 0.6, c: Math.random() < 0.5 ? '#7fd65c' : '#e8b33a' });
    leaves = leaves.filter((l) => (l.y += l.vy * dt) < H + 20);
    for (const l of leaves) { l.ph += dt * 2; const x = l.x + Math.sin(l.ph) * 30; ctx.save(); ctx.translate(x, l.y); ctx.rotate(Math.sin(l.ph * 1.3) * 1.2); ctx.fillStyle = l.c; ctx.beginPath(); ctx.ellipse(0, 0, 7 * l.s, 3.5 * l.s, 0, 0, 7); ctx.fill(); ctx.restore(); }
  }

  // для проверки: #w2l3 — сразу мир 2 уровень 3; #demo — играет автопилот
  const m = location.hash.match(/w(\d+)l(\d+)/);
  // приложение без интернета (только когда игра открыта с сайта, а не из файла)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  applyIcons();
  toMenu();
  if (m) startLevel(+m[1] - 1, +m[2] - 1);
  requestAnimationFrame(frame);
  window.__game = () => ({ g, mode, save });
})();
