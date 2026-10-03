// «Ходульщик 2» — физика ходьбы на ходулях и генератор уровней.
// Модель: опорная ходуля — перевёрнутый маятник (тело качается вокруг стопы), вторая ходуля — отдельная
// нога со своим углом. Вынесенная вперёд нога смещает центр масс и тянет тело. Нога встаёт, когда коснётся
// поверхности. Поверхности бывают неподвижные, движущиеся, качающиеся; есть лёд, конвейеры, вода, шипы и
// опасности (лопасти, камни, прессы). Работает в браузере (window.Phys) и в Node (для автотестов).
(function (root) {
  'use strict';

  // ================= НАСТРОЙКИ ФИЗИКИ (можно менять) =================
  const CFG = {
    gravity: 10,          // сила тяжести, м/с²
    walkingSpeed: 0.8,    // предельная скорость наклона тела от «толчка», рад/с
    legLength: 2.6,       // длина ходули, м
    legMass: 0.3,         // насколько вынесенная нога тянет тело (масса ноги / масса тела)
    bodyMass: 1.0,        // масса тела (влияет на то, как сильно тянет нога)
    friction: 0.9,        // сколько скорости сохраняется при постановке ноги на обычную землю
    movementForce: 6.0,   // толчок вперёд, пока переносишь ногу, рад/с²
    balanceStrength: 2.2, // как сильно тело отклоняется назад, если жать опорную ногу, рад/с²
    legSpeed: 3.0,        // скорость переноса ноги, рад/с
    stepDistance: 0.9,    // как далеко вперёд можно вынести ногу (угол), рад
    fallThreshold: 1.0,   // наклон, после которого персонаж падает, рад
    legSag: 2.8,          // как быстро отпущенная нога опускается под своим весом, рад/с
    damping: 0.25,        // трение в шарнире
  };

  // ================= МИРЫ =================
  const WORLDS = [
    { id: 'forest', name: 'Лес', pieces: { flat: 3, slope: 2, steps: 2, pit: 2, log: 2, bridge: 2 }, pit: 'spikes' },
    { id: 'mountains', name: 'Горы', pieces: { flat: 2, slope: 3, steps: 2, pit: 2, narrow: 2, rocks: 2, swing: 2 }, pit: 'spikes' },
    { id: 'construction', name: 'Стройка', pieces: { flat: 2, steps: 2, pit: 2, movH: 2, movV: 2, narrow: 2, seesaw: 2, rocks: 2 }, pit: 'spikes' },
    { id: 'ice', name: 'Ледяной мир', pieces: { flat: 2, ice: 3, water: 3, floes: 3, slope: 2, narrow: 1 }, pit: 'water' },
    { id: 'factory', name: 'Фабрика', pieces: { flat: 2, conveyor: 3, rotor: 3, piston: 3, movV: 2, pit: 2 }, pit: 'spikes' },
    { id: 'fantasy', name: 'Страна чудес', pieces: { flat: 2, bounce: 3, lowg: 3, movH: 2, seesaw: 2, rotor: 2, swing: 2 }, pit: 'void' },
  ];
  const LEVELS_PER_WORLD = 5;

  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ================= ГЕНЕРАТОР УРОВНЕЙ =================
  // Уровень: segs — неподвижная земля [x1,y1,x2,y2,мат], objs — движущиеся/качающиеся поверхности,
  // haz — опасности, zones — зоны (низкая гравитация), coins, checkpoints, finish.
  function genLevel(world, idx) {
    const W = WORLDS[world];
    const r = rng(world * 100 + idx * 7 + 11);
    const d = Math.min(1, (world * LEVELS_PER_WORLD + idx) / (WORLDS.length * LEVELS_PER_WORLD - 1)); // общая сложность 0..1
    const ld = idx / (LEVELS_PER_WORLD - 1); // сложность внутри мира
    const lv = { world, idx, segs: [], objs: [], haz: [], zones: [], coins: [], checkpoints: [], finish: 0, finishY: 0, theme: W.id };
    let x = -14, y = 0;
    const seg = (x2, y2, mat = 'ground') => { lv.segs.push([x, y, x2, y2, mat]); x = x2; y = y2; };
    const coinsOver = (x0, x1, h = 3.4, n = 1) => { for (let i = 0; i < n; i++) lv.coins.push([x0 + ((x1 - x0) * (i + 0.5)) / n, y + h]); };
    const pitFloor = (x0, w, kind) => {
      // яма: стенки вниз, дно с шипами/водой/пустотой
      const y0 = y;
      if (kind === 'water') { lv.segs.push([x0, y0 - 1.2, x0 + w, y0 - 1.2, 'water']); }
      else if (kind === 'spikes') { lv.segs.push([x0, y0 - 3, x0 + w, y0 - 3, 'spikes']); }
      lv.segs.push([x0, y0, x0, y0 - 4, 'wall'], [x0 + w, y0 - 4, x0 + w, y0, 'wall']);
    };
    seg(6, 0);
    const pieceCount = 5 + idx + Math.floor(world * 0.6);
    const bag = [];
    for (const [k, wgt] of Object.entries(W.pieces)) for (let i = 0; i < wgt; i++) bag.push(k);
    const cpAt = [Math.floor(pieceCount / 3), Math.floor((2 * pieceCount) / 3)];
    let last = '';
    for (let i = 0; i < pieceCount; i++) {
      if (cpAt.includes(i)) { seg(x + 2.5, y); lv.checkpoints.push([x - 1.2, y]); seg(x + 2.5, y); }
      let k = bag[Math.floor(r() * bag.length)];
      if (i === 0 && idx === 0) k = 'flat';
      if (world === 0 && idx === 0) k = ['flat', 'log', 'flat', 'steps', 'flat', 'pit'][i % 6]; // обучающий уровень — простые препятствия по очереди
      if (root.PHYS_FORCE) k = root.PHYS_FORCE[i % root.PHYS_FORCE.length];
      if (k === last && k !== 'flat' && !root.PHYS_FORCE) k = bag[Math.floor(r() * bag.length)];
      last = k;
      lv.pieces = lv.pieces || []; const pieceStart = x;
      const pitKind = W.pit === 'void' ? 'void' : W.pit;
      switch (k) {
        case 'flat': { const len = 2.5 + r() * 3; coinsOver(x + 0.5, x + len, 3.4, 1); seg(x + len, y); break; }
        case 'slope': {
          const len = 5 + r() * 3, dy = (r() < 0.5 ? -1 : 1) * (0.25 + r() * (0.3 + d * 0.35));
          seg(x + len * 0.5, y + dy * 0.7); seg(x + len * 0.5, y + dy * 0.3); break;
        }
        case 'steps': {
          const n = 2 + Math.floor(r() * 2), up = r() < 0.6 ? 1 : -1;
          for (let s = 0; s < n; s++) { const h = 0.2 + r() * (0.12 + d * 0.13); seg(x + 1.7, y); seg(x, y + up * h); }
          seg(x + 1.6, y); break;
        }
        case 'pit': {
          seg(x + 1.6, y); const w = 0.8 + r() * (0.3 + d * 0.5);
          pitFloor(x, w, pitKind); coinsOver(x, x + w, 3.2, 1); x += w; seg(x + 1.6, y); break;
        }
        case 'water': {
          seg(x + 1.6, y); const w = 0.75 + r() * (0.25 + d * 0.3);
          pitFloor(x, w, 'water'); coinsOver(x, x + w, 3.2, 1); x += w; seg(x + 1.6, y); break;
        }
        case 'log': {
          seg(x + 1.5, y); const rad = 0.28 + r() * (0.12 + d * 0.2);
          lv.objs.push({ type: 'log', cx: x + rad + 0.2, cy: y, r: rad });
          coinsOver(x, x + 2 * rad + 0.4, 3.7, 1); seg(x + 2 * rad + 0.4 + 1.5, y); break;
        }
        case 'bridge': {
          seg(x + 1.4, y); const w = 2.4 + r() * (1 + d * 1.5);
          lv.objs.push({ type: 'bridge', x0: x, x1: x + w, y0: y, sag: 0.12 + r() * 0.12, load: 0 });
          pitFloor(x, w, pitKind); coinsOver(x, x + w, 3.4, 2); x += w; seg(x + 1.4, y); break;
        }
        case 'narrow': {
          seg(x + 1.4, y); const n = 2 + Math.floor(r() * (1 + d * 2)), gap = 0.7 + r() * (0.2 + d * 0.35), w0 = x;
          for (let s = 0; s < n; s++) lv.objs.push({ type: 'plat', x0: w0 + gap * (s + 0.5) + s * 0.65, w: 0.65, y0: y, ax: 0, ay: 0, per: 1, ph: 0, look: 'post' });
          const w = gap * (n + 0.5) + n * 0.65; pitFloor(w0, w, pitKind); coinsOver(w0, w0 + w, 3.6, 1); x = w0 + w; seg(x + 1.4, y); break;
        }
        case 'movH': case 'floes': {
          seg(x + 1.4, y); const pw = 2.6 - d * 0.4, w = pw + 0.7 + r() * (0.5 + d * 0.5), amp = (w - pw) / 2 - 0.1;
          lv.objs.push({ type: 'plat', x0: x + w / 2 - pw / 2, w: pw, y0: y, ax: amp, ay: 0, per: 4.5 - d + r(), ph: r() * 6, look: k === 'floes' ? 'floe' : 'plat' });
          pitFloor(x, w, k === 'floes' ? 'water' : pitKind); coinsOver(x, x + w, 3.5, 1); x += w; seg(x + 1.4, y); break;
        }
        case 'movV': {
          seg(x + 1.4, y); const w = 2.9, h = 0.5 + r() * (0.3 + d * 0.3), x0 = x;
          lv.objs.push({ type: 'plat', x0: x0 + 0.1, w: 2.7, y0: y + h / 2, ax: 0, ay: h / 2, per: 4.6 - d * 0.6 + r(), ph: r() * 6, look: 'lift' });
          pitFloor(x0, w, pitKind); x = x0 + w; y += h; seg(x, y); seg(x + 1.8, y);
          lv.segs.push([x0 + w, y - h, x0 + w, y, 'wall']); coinsOver(x0, x0 + w, 3.6 + h, 1); break;
        }
        case 'swing': {
          seg(x + 1.4, y); const w = 3.2 + r() * (0.4 + d * 0.6), x0 = x;
          lv.objs.push({ type: 'swing', px: x0 + w / 2, py: y + 4.2, R: 4.2, amp: 0.1 + d * 0.08, per: 4 + r(), ph: r() * 6, w: 2.8 });
          pitFloor(x0, w, pitKind); coinsOver(x0, x0 + w, 3.4, 1); x = x0 + w; seg(x + 1.4, y); break;
        }
        case 'seesaw': {
          seg(x + 1.2, y); const hl = 1.8 + r() * 0.6, x0 = x;
          lv.objs.push({ type: 'seesaw', px: x0 + hl, py: y + 0.15, hl, a: 0.25, av: 0 });
          pitFloor(x0, hl * 2, pitKind); coinsOver(x0, x0 + 2 * hl, 3.6, 1); x = x0 + 2 * hl; seg(x + 1.4, y); break;
        }
        case 'ice': { const len = 4 + r() * 4; seg(x + 0.8, y); seg(x + len, y, 'ice'); coinsOver(x - len, x, 3.4, 2); seg(x + 0.8, y); break; }
        case 'conveyor': { const len = 4 + r() * 3, sp = (r() < 0.65 ? -1 : 1) * (0.5 + d * 0.8); seg(x + 0.6, y); seg(x + len, y, 'conv:' + sp.toFixed(2)); seg(x + 0.6, y); break; }
        case 'rotor': {
          seg(x + 1.5, y); const len = 0.8 + r() * 0.25 + d * 0.2;
          lv.haz.push({ type: 'rotor', cx: x + 1.4, cy: y + 5.5 + r() * 0.2, len, w: (r() < 0.5 ? -1 : 1) * (0.8 + d * 0.6) });
          seg(x + 3.2, y); break;
        }
        case 'rocks': {
          seg(x + 1, y); const len = 4 + r() * 2;
          lv.haz.push({ type: 'rock', x: x + 1.5 + r() * 1.5, top: y + 9, ground: y, per: 3.6 - d * 0.6 + r() * 0.6, ph: r() * 3, r: 0.32 });
          coinsOver(x, x + len, 3.4, 1); seg(x + len, y); break;
        }
        case 'piston': {
          seg(x + 1.4, y); const w = 1.1;
          lv.haz.push({ type: 'piston', x0: x + 0.4, w, top: y + 6, low: y + 1.2, per: 4.2 - d * 0.8 + r() * 0.5, ph: r() * 3 });
          seg(x + 2.4, y); break;
        }
        case 'bounce': {
          seg(x + 1.2, y); const x0 = x; seg(x + 1.2, y, 'bounce'); seg(x + 0.4, y);
          const w = 1.2 + r() * (0.3 + d * 0.3); pitFloor(x, w, pitKind); coinsOver(x0, x + w, 4.2, 1); x += w; seg(x + 1.6, y); break;
        }
        case 'lowg': {
          seg(x + 0.8, y); const x0 = x, w = 1.1 + r() * (0.2 + d * 0.2);
          lv.zones.push({ type: 'lowg', x0: x0 - 1.5, x1: x0 + w + 2.5, k: 0.55 });
          pitFloor(x, w, pitKind); coinsOver(x0, x0 + w, 4.4, 2); x += w; seg(x + 1.8, y); break;
        }
      }
      lv.pieces.push({ k, x0: pieceStart, x1: x });
    }
    seg(x + 3, y);
    lv.finish = x; lv.finishY = y;
    seg(x + 16, y);
    lv.length = lv.finish;
    return lv;
  }

  // ================= ПОВЕРХНОСТИ И ОПАСНОСТИ =================
  function objState(o, t) {
    if (o.type === 'plat') {
      let s = Math.sin((2 * Math.PI * t) / o.per + o.ph), c = Math.cos((2 * Math.PI * t) / o.per + o.ph);
      const k = (2 * Math.PI) / o.per;
      if (o.look === 'lift' || o.look === 'plat' || o.look === 'floe') { const s2 = Math.max(-1, Math.min(1, s * 1.35)); c = Math.abs(s * 1.35) >= 1 ? 0 : c * 1.35; s = s2; } // платформа задерживается у краёв
      return { x0: o.x0 + o.ax * s, x1: o.x0 + o.ax * s + o.w, y: o.y0 + o.ay * s, vx: o.ax * k * c, vy: o.ay * k * c };
    }
    if (o.type === 'swing') {
      const ang = o.amp * Math.sin((2 * Math.PI * t) / o.per + o.ph);
      const av = o.amp * ((2 * Math.PI) / o.per) * Math.cos((2 * Math.PI * t) / o.per + o.ph);
      const cx = o.px + o.R * Math.sin(ang), cy = o.py - o.R * Math.cos(ang);
      return { x0: cx - o.w / 2, x1: cx + o.w / 2, y: cy, vx: av * o.R * Math.cos(ang), vy: av * o.R * Math.sin(ang), ang };
    }
    return null;
  }

  // Высота поверхности под точкой x: { y, obj, mat } — берём самую верхнюю, но не выше maxY (чтобы не «прилипать» к потолку)
  function surface(lv, x, t, maxY = 1e9) {
    let best = { y: -1e9, obj: null, mat: 'none' };
    const take = (yy, obj, mat) => { if (yy <= maxY + 0.05 && yy > best.y) best = { y: yy, obj, mat }; };
    for (const s of lv.segs) {
      const [x1, y1, x2, y2, mat] = s;
      if (x1 === x2 || mat === 'wall') continue;
      if (x >= Math.min(x1, x2) && x <= Math.max(x1, x2)) take(y1 + ((y2 - y1) * (x - x1)) / (x2 - x1), s, mat);
    }
    for (const o of lv.objs) {
      if (o.type === 'log') { const dx = x - o.cx; if (Math.abs(dx) < o.r) take(o.cy + Math.sqrt(o.r * o.r - dx * dx), o, 'log'); }
      else if (o.type === 'bridge') {
        if (x >= o.x0 && x <= o.x1) { const u = (x - o.x0) / (o.x1 - o.x0); take(o.y0 - (o.sag + o.load * 0.12) * Math.sin(Math.PI * u), o, 'bridge'); }
      } else if (o.type === 'seesaw') {
        const dx = x - o.px, ca = Math.cos(o.a);
        if (Math.abs(dx) <= o.hl * ca) take(o.py + dx * Math.tan(o.a), o, 'seesaw');
      } else {
        const st = objState(o, t);
        if (x >= st.x0 && x <= st.x1) take(st.y, o, o.look || 'plat');
      }
    }
    return best;
  }

  function hazardsHit(lv, t, pts) {
    for (const h of lv.haz) {
      if (h.type === 'rotor') {
        const a = h.w * t;
        for (const k of [0, Math.PI]) {
          const ex = h.cx + Math.cos(a + k) * h.len, ey = h.cy + Math.sin(a + k) * h.len;
          for (const p of pts) if (distSeg(p.x, p.y, h.cx, h.cy, ex, ey) < p.r + 0.12) return { h, why: 'Сбило лопастью!' };
        }
      } else if (h.type === 'rock') {
        const ry = rockY(h, t);
        if (ry !== null) for (const p of pts) if (Math.hypot(p.x - h.x, p.y - ry) < p.r + h.r) return { h, why: 'Попал под камень!' };
      } else if (h.type === 'piston') {
        const by = pistonY(h, t);
        for (const p of pts) if (p.x > h.x0 - p.r && p.x < h.x0 + h.w + p.r && p.y + p.r > by) return { h, why: 'Раздавило прессом!' };
      }
    }
    return null;
  }
  function rockY(h, t) {
    const u = ((t + h.ph) % h.per) / h.per; // 0..1
    const fall = u * h.per; const y = h.top - 0.5 * 9 * fall * fall;
    return y < h.ground - 1 ? null : Math.max(y, h.ground + h.r);
  }
  function pistonY(h, t) {
    const u = ((t + h.ph) % h.per) / h.per;
    // долго наверху, быстро вниз, пауза внизу, медленно вверх
    let k;
    if (u < 0.55) k = 0; else if (u < 0.62) k = (u - 0.55) / 0.07; else if (u < 0.7) k = 1; else k = 1 - (u - 0.7) / 0.3;
    return h.top - (h.top - h.low) * k;
  }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    return Math.hypot(px - ax - u * dx, py - ay - u * dy);
  }

  // ================= ПЕРСОНАЖ =================
  const CLEAR = 0.08; // насколько стопа может «вдавиться» в землю (подошва, колено)
  const TIPS = { 'Сбило лопастью!': 'Подожди, пока лопасть пройдёт, и шагай сразу за ней.', 'Попал под камень!': 'Смотри на тень на земле: темнеет — значит камень летит.', 'Раздавило прессом!': 'Проходи, когда пресс только поднялся.', 'Ходуля ушла под воду!': 'Ставь ногу на берег или льдину, а не в воду.', 'Упал в воду!': 'Льдина уплыла — переходи на неё обеими ногами или сразу шагай дальше.', 'Наступил на шипы!': 'Перешагивай яму: держи ногу дольше, чтобы шаг был длиннее.', 'Упал в пропасть!': 'Перешагивай яму длинным шагом.' };
  // Опорная нога s — перевёрнутый маятник: th (плюс — бедро впереди стопы), w — скорость наклона.
  // Свободная нога: phi (0 — вниз, плюс — вперёд). Держишь её зону — она идёт вперёд и тянет тело.
  // Отпустил — опускается и встаёт, как только коснётся поверхности. Только что оставленная сзади нога
  // упирается в землю (pin) — на ней можно стоять «домиком» и переждать опасность.
  function createGame(world, idx, fromCheckpoint = -1) {
    const lv = genLevel(world, idx);
    const L = CFG.legLength;
    let sx = 0;
    if (fromCheckpoint >= 0 && lv.checkpoints[fromCheckpoint]) sx = lv.checkpoints[fromCheckpoint][0];
    const g = {
      lv, L, t: 0, time: 0, state: 'ready', why: '',
      s: 1, P: { x: sx + 0.5, y: 0 }, att: null, mat: 'ground', Ls: L, th: 0, w: 0,
      legs: [{ phi: 0, held: false, rel: false, pin: null, back: false }, { phi: 0, held: false, rel: false, pin: null, back: false }],
      checkpoint: fromCheckpoint, coinsTaken: new Set(), coinsGot: 0, events: [], deadT: 0, winT: 0,
      ta: 0, tw: 0, fallV: 0, splash: false,
    };
    // старт: стоим «домиком» — правая нога чуть впереди (опора), левая сзади упирается в землю
    const a = 0.2, hipX = sx, front = hipX + L * Math.sin(a), backX = hipX - L * Math.sin(a);
    g.P = { x: front, y: surface(lv, front, 0).y };
    const hipY = g.P.y + L * Math.cos(a);
    g.th = Math.atan2(hipX - g.P.x, hipY - g.P.y); g.Ls = Math.hypot(hipX - g.P.x, hipY - g.P.y);
    // левая нога впереди (опора), правая сзади упирается — первой шагает правая, как в обучении
    g.s = 0;
    g.legs[1].pin = { x: backX, y: surface(lv, backX, 0).y };
    g.legs[1].phi = -a; g.legs[0].phi = a;
    attach(g, surface(lv, g.P.x, 0));
    return g;
  }

  function hipPos(g) { return { x: g.P.x + g.Ls * Math.sin(g.th), y: g.P.y + g.Ls * Math.cos(g.th) }; }
  function footPos(g, i) {
    if (i === g.s) return { x: g.P.x, y: g.P.y };
    const l = g.legs[i];
    if (l.pin) return { x: l.pin.x, y: l.pin.y };
    if (l.push && l.pushAt) return { x: l.pushAt.x, y: l.pushAt.y };
    const h = hipPos(g);
    return { x: h.x + g.L * Math.sin(l.phi), y: h.y - g.L * Math.cos(l.phi) };
  }
  function legAngle(g, i) {
    if (i === g.s) return -g.th;
    const l = g.legs[i];
    if (l.pin) { const h = hipPos(g); return Math.atan2(l.pin.x - h.x, h.y - l.pin.y); }
    return l.phi;
  }
  function headPos(g) { const h = hipPos(g); return { x: h.x - Math.sin(g.ta) * 1.55, y: h.y + Math.cos(g.ta) * 1.55 }; }

  // стопа «приклеивается» к поверхности, на которую встала (едет вместе с платформой)
  function attach(g, surf) {
    const o = surf.obj;
    if (o && (o.type === 'plat' || o.type === 'swing')) { const st = objState(o, g.t); g.att = { o, dx: g.P.x - st.x0 }; }
    else if (o && o.type === 'seesaw') g.att = { o, s: (g.P.x - o.px) / Math.cos(o.a) };
    else if (o && o.type === 'bridge') g.att = { o };
    else g.att = null;
    g.mat = surf.mat; g.lostSupport = false;
  }
  function followSurface(g, dt) {
    const a = g.att;
    if (a) {
      if (a.o.type === 'plat' || a.o.type === 'swing') { const st = objState(a.o, g.t); g.P.x = st.x0 + a.dx; g.P.y = st.y; g.lostSupport = a.dx < -0.2 || a.dx > st.x1 - st.x0 + 0.2; }
      else if (a.o.type === 'seesaw') { g.P.x = a.o.px + a.s * Math.cos(a.o.a); g.P.y = a.o.py + a.s * Math.sin(a.o.a); }
      else if (a.o.type === 'bridge') { const s = surface(g.lv, g.P.x, g.t, g.P.y + 0.5); if (s.obj === a.o) g.P.y = s.y; }
    }
    for (const l of g.legs) {
      const pa = l.pin && l.pin.att; if (!pa) continue;
      if (pa.o.type === 'plat' || pa.o.type === 'swing') { const st = objState(pa.o, g.t); l.pin.x = st.x0 + pa.dx; l.pin.y = st.y; }
      else if (pa.o.type === 'seesaw') { l.pin.x = pa.o.px + pa.s * Math.cos(pa.o.a); l.pin.y = pa.o.py + pa.s * Math.sin(pa.o.a); }
    }
    if (typeof g.mat === 'string' && g.mat.startsWith('conv:')) g.P.x += parseFloat(g.mat.slice(5)) * dt;
    if (g.mat === 'ice') g.P.x += g.w * g.Ls * Math.cos(g.th) * 0.15 * dt; // на льду опора скользит по ходу
  }

  function die(g, why, tip = '') {
    if (g.state !== 'play') return;
    g.state = 'dead'; g.why = why; g.tip = tip || TIPS[why] || ''; g.events.push('fall');
  }

  // нога i становится опорной в точке F; keep — сколько скорости сохраняется (0 — тело стоит)
  function setStance(g, i, F, keep) {
    const H = hipPos(g);
    const dx = H.x - F.x, dy = H.y - F.y, d = Math.max(0.6, Math.hypot(dx, dy));
    const thn = Math.atan2(dx, dy);
    let wn = 0;
    if (keep) {
      const vx = g.w * g.Ls * Math.cos(g.th), vy = -g.w * g.Ls * Math.sin(g.th);
      const proj = (vx * Math.cos(thn) - vy * Math.sin(thn)) / d, full = (g.w * g.Ls) / d;
      wn = (0.45 * proj + 0.55 * full) * keep;
    }
    const old = g.s, oldP = { x: g.P.x, y: g.P.y };
    if (keep) g.lastStep = { t: g.t, len: Math.abs(F.x - oldP.x) };
    if (g.att && g.att.o.type !== 'bridge') oldP.att = { ...g.att };
    g.legs[old].pin = oldP; g.legs[old].phi = Math.atan2(oldP.x - H.x, H.y - oldP.y); g.legs[old].rel = false;
    g.s = i; g.P = { x: F.x, y: F.y }; g.Ls = d; g.th = thn; g.w = wn;
    g.legs[i].pin = null; g.legs[i].rel = false;
    attach(g, surface(g.lv, F.x, g.t, F.y + 0.3));
  }

  function plant(g, i, F, surf) {
    if (surf.mat === 'water') { g.splash = true; return die(g, 'Ходуля ушла под воду!'); }
    if (surf.mat === 'spikes') return die(g, 'Наступил на шипы!');
    setStance(g, i, { x: F.x, y: surf.y }, surf.mat === 'ice' ? 0.98 : CFG.friction);
    if (surf.mat === 'bounce') { g.w = Math.min(1.1, Math.max(0, g.w) + 0.5); g.events.push('bounce'); }
    g.events.push('land');
  }

  // hold = [левая, правая] — держит ли игрок зону ноги; back = [..] — ведёт ли палец вниз (нога назад)
  function step(g, dt, hold, back = [false, false]) {
    g.events.length = 0;
    g.t += dt;
    for (const o of g.lv.objs) {
      if (o.type === 'seesaw') {
        let torque = -o.a * 6 - o.av * 2.5;
        if (g.att && g.att.o === o) torque += -(g.P.x - o.px) * 1.4 * Math.cos(o.a);
        o.av += torque * dt; o.a = Math.max(-0.26, Math.min(0.26, o.a + o.av * dt));
      }
      if (o.type === 'bridge') o.load = g.att && g.att.o === o ? Math.min(1, o.load + dt * 3) : Math.max(0, o.load - dt * 2);
    }
    if (g.state === 'ready' && (hold[0] || hold[1])) g.state = 'play';
    followSurface(g, dt);
    if (g.state === 'ready') { updateTorso(g, dt); return; }
    const playing = g.state === 'play';
    if (playing) g.time += dt;
    const H0 = hipPos(g);
    const zone = g.lv.zones.find((z) => z.type === 'lowg' && H0.x > z.x0 && H0.x < z.x1);
    const G = CFG.gravity * (zone ? zone.k : 1);

    if (playing) {
      // нажали зону опорной ноги, а другая стоит на земле — вес переходит на другую, эта поднимается
      const o = 1 - g.s;
      if (hold[g.s] && !g.legs[g.s].held && g.legs[o].pin && !hold[o]) setStance(g, o, g.legs[o].pin, 0);
      for (let i = 0; i < 2; i++) { const l = g.legs[i]; if (l.held && !hold[i] && i !== g.s) { if (l.push && l.pushAt) { l.pin = { x: l.pushAt.x, y: l.pushAt.y }; l.push = false; } else l.rel = true; } l.held = hold[i]; l.back = back[i]; }
      const sw = 1 - g.s, l = g.legs[sw];
      if (l.held) {
        if (l.pin) { l.phi = legAngle(g, sw); l.pin = null; l.v = 0; l.push = !l.back && g.th < -0.06; l.pushAt = l.push ? { ...footPos(g, sw), ...l.pinSave } : null; if (!l.push) g.events.push('lift'); }
        // перенос веса: пока тело позади опоры, задняя нога стоит на земле и толкает его вперёд
        if (l.push) {
          if (g.th >= -0.06 || l.back) { l.push = false; g.events.push('lift'); }
          else { const H = hipPos(g); l.phi = Math.atan2(footPos(g, sw).x - H.x, H.y - footPos(g, sw).y); if (g.w < CFG.walkingSpeed) g.w += (CFG.movementForce - (G / g.Ls) * Math.min(0, Math.sin(g.th))) * dt; l.blocked = true; }
        }
        l.rel = false;
        if (!l.push) {
        const dir = l.back ? -1 : 1;
        // нога разгоняется (небольшая инерция), а не едет по готовой траектории
        l.v = (l.v || 0) + (dir * CFG.legSpeed - (l.v || 0)) * Math.min(1, 12 * dt);
        const H = hipPos(g);
        const next = Math.max(-CFG.stepDistance, Math.min(CFG.stepDistance, l.phi + l.v * dt));
        const fx = H.x + g.L * Math.sin(next), fy = H.y - g.L * Math.cos(next);
        const s = surface(g.lv, fx, g.t, H.y - 0.3);
        const lift = dir > 0 ? (next > 0.12 || g.th > 0.08 ? 0.45 : CLEAR) : CLEAR; // персонаж чуть сгибает колено: под собой стопа проходит, впереди перешагивает невысокое
        if (s.y > -1e8 && fy < s.y - lift) {
          // ходуля упёрлась в землю — сквозь неё не проходит
          const wasBlocked = l.blocked; l.blocked = true; l.v = 0;
          if (!wasBlocked) g.events.push('scrape');
          if (dir > 0 && next < 0.35 && g.th < 0.1) {
            // нога сзади упирается и толкает тело вперёд — это и есть «перенос веса»
            if (g.w < CFG.walkingSpeed) g.w += (CFG.movementForce - (G / g.Ls) * Math.min(0, Math.sin(g.th))) * dt; // толчок пересиливает наклон назад
            const k = (H.y - s.y + CLEAR) / g.L;
            if (k < 1) l.phi = Math.max(l.phi, -Math.acos(Math.max(-1, k))); // стопа скользит по земле вслед за телом
          } else if (dir < 0 && next > -0.2) {
            if (g.w > -CFG.walkingSpeed * 0.6) g.w -= CFG.movementForce * 0.7 * dt;
          }
        } else {
          l.blocked = false; l.phi = next;
          // нога в воздухе тянет тело чуть-чуть (основное — центр масс ниже)
          if (dir > 0 && g.w < CFG.walkingSpeed * 0.5) g.w += CFG.movementForce * 0.12 * dt;
        }
        }
      } else if (l.rel) {
        // отпущенная нога падает под своим весом, как маятник
        l.blocked = false;
        const kk = CFG.legSag * 14; l.v = (l.v || 0) + (-kk * Math.sin(l.phi) - 1.2 * Math.sqrt(kk) * (l.v || 0)) * dt;
        l.phi += l.v * dt;
      }
      if (hold[g.s] && !g.legs[sw].pin) g.w -= CFG.balanceStrength * dt; // жмёшь опорную — вес назад
    }

    // маятник: тяжесть + вынесенная нога тянет центр масс
    const sw = 1 - g.s, l = g.legs[sw];
    const pull = playing && !l.pin ? (CFG.legMass / CFG.bodyMass) * (Math.sin(l.phi) + Math.sin(g.th)) : 0;
    if (g.state === 'play' || (g.state === 'dead' && Math.abs(g.th) < 1.45)) {
      g.w += (G / g.Ls) * (Math.sin(g.th) + pull) * dt;
      g.w *= 1 - CFG.damping * dt;
      g.th += g.w * dt;
      if (playing) g.Ls += (g.L - g.Ls) * Math.min(1, 3 * dt);
    } else if (g.state === 'dead') { g.th = Math.sign(g.th) * 1.45; g.w = 0; }

    if (playing) {
      const H = hipPos(g);
      if (l.pin) {
        // упёртая нога держит тело «домиком»: падать в её сторону нельзя
        const dist = Math.hypot(H.x - l.pin.x, H.y - l.pin.y);
        const toward = (l.pin.x - H.x) * g.w * Math.cos(g.th) > 0;
        // обе стопы на земле: ходули жёсткие, тело стоит «домиком» и никуда не едет, пока не поднимешь ногу
        if (toward || (!l.held && dist >= g.L * 0.995 && Math.abs(g.w) < 0.35)) { g.w *= Math.exp(-12 * dt); if (Math.abs(g.w) < 0.03) g.w = 0; }
        if (dist > g.L * 1.06) { l.phi = Math.atan2(l.pin.x - H.x, H.y - l.pin.y); l.pin = null; l.rel = true; l.v = 0; } // нога оторвалась — висит и снова встанет, коснувшись земли
      } else if (l.held && !l.push && !l.back && l.phi >= CFG.stepDistance - 0.02) {
        const F = footPos(g, sw), surf = surface(g.lv, F.x, g.t, H.y - 0.3);
        if (surf.y > -1e8 && F.y <= surf.y + 0.02 && surf.y - F.y < 0.7) plant(g, sw, F, surf);
      } else if (l.rel) {
        const F = footPos(g, sw), surf = surface(g.lv, F.x, g.t, H.y - 0.3);
        if (surf.y > -1e8 && F.y <= surf.y + 0.02) {
          if (surf.y - F.y > 0.7) { l.phi -= Math.sign(l.phi) * 0.03; l.v = 0; g.events.push('bump'); } // упёрлась в бок препятствия
          else if (l.phi < -0.12 && surf.mat !== 'water' && surf.mat !== 'spikes') { l.pin = { x: F.x, y: surf.y }; l.rel = false; l.v = 0; g.events.push('touch'); } // сзади — просто подпорка
          else plant(g, sw, F, surf);
        } else if (surf.y > -1e8 && surf.mat !== 'water' && surf.mat !== 'spikes' && Math.abs(l.phi) <= Math.abs(g.th) + 0.05 && F.y - surf.y < 0.8 && Math.sign(l.phi) !== Math.sign(g.th)) {
          plant(g, sw, F, surf); // ступенька вниз: ходуля чуть выдвигается
        }
      }
      // опасности
      const head = headPos(g), Hh = hipPos(g);
      const hit = hazardsHit(g.lv, g.t, [{ x: head.x, y: head.y, r: 0.42 }, { x: Hh.x - Math.sin(g.ta) * 0.6, y: Hh.y + Math.cos(g.ta) * 0.6, r: 0.38 }]);
      if (hit) { g.w += hit.h.type === 'rotor' ? -Math.sign(hit.h.w) * 1.2 : 0.6; die(g, hit.why); }
      const under = surface(g.lv, g.P.x, g.t, g.P.y + 0.3);
      if (under.mat === 'water' && g.P.y <= under.y + 0.05) { g.splash = true; die(g, 'Упал в воду!'); }
      // опора: стопа не должна висеть над пустотой или съехать с платформы
      if (g.lostSupport) die(g, 'Потерял опору', 'Платформа уехала из-под ноги. Переноси вес, пока стопа стоит на ней.');
      else { const sp = surface(g.lv, g.P.x, g.t, g.P.y + 0.2); if (!g.att && (sp.y < g.P.y - 0.25)) die(g, 'Потерял опору', 'Стопа соскользнула с края. Ставь ногу дальше от края.'); }
      if (g.th > CFG.fallThreshold) {
        if (l.held && !l.blocked) die(g, 'Слишком сильно наклонился вперёд', 'Ты слишком долго нёс ногу. Отпускай её раньше — она сама встанет.');
        else if (l.rel) die(g, 'Нога не успела встать', 'Ты отпустил ногу слишком высоко. Отпускай, когда она впереди внизу.');
        else if (l.held && l.blocked) die(g, 'Тело перевалилось вперёд', 'Нога упёрлась, а тело уже ушло вперёд. Выноси ногу, когда тело над опорой.');
        else if (l.pin) die(g, 'Не сделал шаг вовремя', 'Тело ушло вперёд, а ноги стояли. Как только нога встала — сразу шагай другой.');
        else die(g, 'Слишком сильно наклонился вперёд', 'Не задерживайся в наклоне — сразу делай следующий шаг.');
      } else if (g.th < -CFG.fallThreshold) {
        if (g.lastStep && g.t - g.lastStep.t < 1.6 && g.lastStep.len > 1.75) die(g, 'Слишком далеко поставил ногу', 'Длинный шаг гасит скорость. Делай шаги короче.');
        else die(g, 'Не перенёс вес вперёд', 'Держи заднюю ногу: она упрётся в землю и толкнёт тело вперёд.');
      }
      if (Hh.y < -6) die(g, 'Упал в пропасть!');
      g.lv.checkpoints.forEach(([cx], k) => { if (Hh.x > cx && g.checkpoint < k) { g.checkpoint = k; g.events.push('checkpoint'); } });
      if (Hh.x >= g.lv.finish && g.state === 'play') { g.state = 'win'; g.events.push('win'); }
      const F2 = footPos(g, 1 - g.s);
      g.lv.coins.forEach(([cx, cy], k) => {
        if (g.coinsTaken.has(k)) return;
        const near = (p, rr) => Math.hypot(p.x - cx, p.y - cy) < rr;
        if (near(head, 0.75) || near(Hh, 0.8) || near(F2, 0.5)) { g.coinsTaken.add(k); g.coinsGot++; g.events.push('coin'); }
      });
    }
    if (g.state === 'dead') {
      g.deadT += dt;
      const H = hipPos(g);
      if (g.splash || surface(g.lv, H.x, g.t, H.y).y < g.P.y - 2) { g.fallV += G * dt; g.P.y -= g.fallV * dt * (g.splash ? 0.35 : 1); }
    }
    if (g.state === 'win') g.winT += dt;
    updateTorso(g, dt);
  }

  function updateTorso(g, dt) {
    const target = g.state === 'dead' ? Math.sign(g.th || 1) * -1.3 : -(g.th * 0.3 + g.w * 0.1);
    g.tw += ((target - g.ta) * 70 - g.tw * 10) * dt;
    g.ta += g.tw * dt;
  }

  // ================= АВТОПИЛОТ (для проверки уровней) =================
  function danger(g, x0, x1, tAhead) {
    for (let dtk = 0; dtk <= tAhead; dtk += 0.1) for (let x = x0; x <= x1; x += 0.3) {
      const s = surface(g.lv, x, g.t + dtk).y; const y = (s > -1e8 ? s : g.P.y) + g.L;
      if (hazardsHit(g.lv, g.t + dtk, [{ x, y: y + 1.2, r: 0.6 }, { x, y: y + 0.4, r: 0.55 }])) return true;
    }
    return false;
  }
  function bot(g) {
    const out = [false, false];
    if (g.state !== 'play' && g.state !== 'ready') return out;
    const sw = 1 - g.s, l = g.legs[sw], H = hipPos(g);
    if (l.held) {
      const land = H.x + g.L * Math.sin(Math.max(g.th, 0.05)) * 1.05;
      const ok = (x) => { const s = surface(g.lv, x, g.t + 0.35, H.y - 0.5); return s.y > -1e8 && s.mat !== 'water' && s.mat !== 'spikes' && s.y > H.y - g.L - 0.6; };
      const good = ok(land) && ok(land + 0.25) && ok(land - 0.15);
      out[sw] = (g.th < (g._lean ?? 0.25) && l.phi < 1.0) || (!good && g.th < 0.85);
      return out;
    }
    if (l.rel) return out; // нога опускается — ждём шага
    // стоим или идём по инерции: перед опасностью ждём «домиком»
    if (l.pin) {
      g._wait = (g._wait || 0) + 1 / 60;
      if (danger(g, H.x - 0.3, H.x + 2.8, 1.5) && g._wait < 8 && g.th < 0.1) return out;
      const tgt = H.x + 1.4, sA = surface(g.lv, tgt, g.t + 0.8, H.y - 0.5), sB = surface(g.lv, tgt + 0.5, g.t + 0.8, H.y - 0.5);
      const bad = (s) => s.y < -1e8 || s.mat === 'water' || s.mat === 'spikes';
      const moving = g.lv.objs.some((o) => (o.type === 'plat' || o.type === 'swing') && Math.abs((o.px ?? o.x0) - tgt) < 3.5);
      if (moving && bad(sA) && bad(sB) && g._wait < 8) return out;
      g._wait = 0;
    }
    out[sw] = true;
    return out;
  }
  root.Phys = { CFG, WORLDS, LEVELS_PER_WORLD, genLevel, surface, objState, rockY, pistonY, createGame, step, hipPos, footPos, legAngle, headPos, bot };
  if (typeof module !== 'undefined') module.exports = root.Phys;
})(typeof window !== 'undefined' ? window : globalThis);
