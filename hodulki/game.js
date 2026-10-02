// Логика игры «Ходульщик»: шаг на ходулях как у перевёрнутого маятника, уровни, монеты.
// Файл работает и в браузере (window.Hod), и в Node (для автотеста).
(function (root) {
  'use strict';

  const G = 900;         // сила тяжести, точек/с²
  const DAMP = 0.12;     // трение в шарнире
  const SWING = 3.2;     // скорость маха ноги, рад/с
  const PHI_MAX = 1.25;  // как далеко можно вынести ногу вперёд
  const PUSH = 100;       // толчок задней ногой при шаге
  const VMAX = 280;      // быстрее этого толчок уже не разгоняет, точек/с
  const LOSS =0.97;     // потеря скорости при постановке ноги
  const FALL = 1.15;     // наклон, после которого персонаж падает

  const SKINS = [
    { id: 'clown', name: 'Клоун', L: 150, need: 0, shirt: '#e63946', pants: '#1d3557', hat: '#ffb703', skin: '#ffd6b0', nose: '#ff2e2e' },
    { id: 'giraffe', name: 'Жирафик', L: 190, need: 12, shirt: '#f4a261', pants: '#8d5524', hat: '#2a9d8f', skin: '#f6d58e', nose: '#5c3b1e' },
    { id: 'robot', name: 'Робот', L: 120, need: 24, shirt: '#8d99ae', pants: '#2b2d42', hat: '#00b4d8', skin: '#cfd8dc', nose: '#00e5ff' },
  ];

  // ground: [от x, до x, высота] (минус — выше); между участками — ямы
  const LEVELS = [
    { name: 'Первые шаги', par: 16, finish: 2200, ground: [[-400, 2600, 0]], coins: [450, 800, 1150, 1500, 1850] },
    { name: 'Ямки', par: 20, finish: 2700, ground: [[-400, 710, 0], [780, 1350, 0], [1430, 2060, 0], [2125, 3100, 0]], coins: [600, 830, 1250, 1600, 2000, 2400] },
    { name: 'Ступеньки', par: 22, finish: 2800, ground: [[-400, 700, 0], [700, 950, -35], [950, 1200, -70], [1200, 1450, -35], [1450, 1750, 0], [1750, 2000, 40], [2000, 3200, 0]], coins: [500, 820, 1080, 1330, 1880, 2400] },
    { name: 'Мостики', par: 24, finish: 2700, ground: [[-400, 620, 0], [690, 880, 0], [960, 1170, -30], [1250, 1460, 0], [1540, 1770, 25], [1835, 3100, 0]], coins: [790, 1080, 1370, 1670, 2100, 2400, 2600] },
    { name: 'Большой цирк', par: 32, finish: 3800, ground: [[-400, 620, 0], [690, 1000, 0], [1000, 1250, -40], [1250, 1510, -80], [1575, 1800, -80], [1800, 2050, -40], [2050, 2300, 0], [2380, 2580, 0], [2660, 2870, 20], [2950, 4200, 0]], coins: [450, 850, 1120, 1380, 1700, 1930, 2490, 2780, 3300] },
  ];

  function groundAt(lv, x) {
    for (const g of lv.ground) if (x >= g[0] && x <= g[1]) return g[2];
    return null;
  }

  function create(levelIdx, skinIdx) {
    const lv = LEVELS[levelIdx], sk = SKINS[skinIdx];
    return {
      lv, sk, L: sk.L, t: 0,
      P: { x: 0, y: groundAt(lv, 0) }, Ls: sk.L, th: 0.05, w: 0, phi: -0.05,
      holding: false, steps: 0, got: 0,
      coins: lv.coins.map((x) => ({ x, y: groundAt(lv, x), got: false })),
      state: 'play', why: '', fallV: 0, endT: 0, events: [],
    };
  }

  function hip(s) {
    return { x: s.P.x + s.Ls * Math.sin(s.th), y: s.P.y - s.Ls * Math.cos(s.th) };
  }

  function fail(s, why, kind) {
    s.state = kind === 'pit' ? 'pit' : 'fall';
    s.why = why;
    if (Math.abs(s.th) < 0.3) s.w += s.th >= 0 ? 1.5 : -1.5;
    s.events.push('fall');
  }

  // Что будет, если поставить ногу под углом phi: куда встанет и с какой скоростью пойдёт дальше
  function predict(s, phi) {
    const H = hip(s);
    const fx = H.x + s.L * Math.sin(phi);
    const gy = groundAt(s.lv, fx);
    if (gy === null) return { bad: 'pit', why: 'Нога ушла в яму' };
    const dx = fx - H.x, dy = gy - H.y, d = Math.hypot(dx, dy);
    if (dy < 0.55 * s.L) return { bad: 'fall', why: 'Споткнулся о ступеньку' };
    if (d > 1.5 * s.L) return { bad: 'pit', why: 'Нога не достала до земли' };
    // скорость бедра переносится на новую ногу (только поперечная часть), плюс толчок
    const vx = s.w * s.Ls * Math.cos(s.th), vy = s.w * s.Ls * Math.sin(s.th);
    const th = Math.atan2(H.x - fx, gy - H.y);
    let w = ((vx * Math.cos(th) + vy * Math.sin(th)) / d) * LOSS;
    if (fx > s.P.x) w += (PUSH / d) * Math.max(0, 1 - (Math.abs(w) * d) / VMAX);
    // хватит ли скорости, чтобы перевалить через новую ногу
    const need = th < 0 ? Math.sqrt(2 * (G / d) * (1 - Math.cos(th))) : 0;
    return { H, fx, gy, d, th, w, margin: w - need };
  }

  function plant(s) {
    const p = predict(s, s.phi);
    s.events.push('step');
    if (p.bad) return fail(s, p.why, p.bad);
    const old = s.P;
    s.P = { x: p.fx, y: p.gy }; s.Ls = p.d; s.th = p.th; s.w = p.w;
    s.phi = Math.atan2(old.x - p.H.x, old.y - p.H.y);
    s.steps++;
    const fx = p.fx;
    for (const c of s.coins) {
      if (!c.got && Math.abs(c.x - fx) < 45) { c.got = true; s.got++; s.events.push('coin'); }
    }
  }

  function step(s, dt, hold) {
    s.events.length = 0;
    if (s.state === 'play') {
      s.t += dt;
      if (hold) { s.holding = true; s.phi = Math.min(s.phi + SWING * dt, PHI_MAX); }
      else if (s.holding) { s.holding = false; plant(s); }
    }
    if (s.state === 'play' || s.state === 'fall') {
      if (s.state === 'fall' && Math.abs(s.th) >= 1.45) {
        s.th = Math.sign(s.th) * 1.45; s.w = 0;
      } else {
        s.w += (G / s.Ls) * Math.sin(s.th) * dt;
        s.w *= 1 - DAMP * dt;
        s.th += s.w * dt;
        if (s.state === 'play') s.Ls += (s.L - s.Ls) * Math.min(1, 4 * dt); // ходуля плавно возвращается к своей длине
      }
      if (s.state === 'play') {
        if (s.th > FALL) fail(s, 'Упал вперёд — ставь ногу раньше');
        else if (s.th < -FALL) fail(s, 'Упал назад — шаг был слишком длинный или медленный');
        else if (hip(s).x >= s.lv.finish) { s.state = 'win'; s.events.push('win'); }
      }
    } else if (s.state === 'pit') {
      s.fallV += G * dt; s.P.y += s.fallV * dt;
    }
    if (s.state !== 'play') s.endT += dt;
  }

  function stars(s) {
    if (s.state !== 'win') return 0;
    return 1 + (s.got === s.coins.length ? 1 : 0) + (s.t <= s.lv.par ? 1 : 0);
  }

  // Простой автопилот: для заставки в меню и для автотеста
  function bot(s) {
    if (!s.holding) return s.th > 0.03 && s.w > 0;
    const now = predict(s, s.phi), next = predict(s, Math.min(s.phi + SWING / 60, PHI_MAX));
    const good = (p) => !p.bad && p.margin > 0.15 && p.th < 0;
    if (!good(now)) return s.phi < PHI_MAX;      // ещё рано (или над ямой) — тянем ногу дальше
    return good(next) && next.margin > 0.5;       // длиннее шаг — сильнее тормозит; отпускаем, пока запас скорости есть
  }

  root.Hod = { G, SKINS, LEVELS, groundAt, create, hip, step, stars, bot, predict };
  if (typeof module !== 'undefined') module.exports = root.Hod;
})(typeof window !== 'undefined' ? window : globalThis);
