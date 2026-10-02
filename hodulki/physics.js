// Физика «Ходульщика»: шаг на ходулях как в Walk Master.
// Опорная ходуля — перевёрнутый маятник. Пока держишь палец, задняя ходуля идёт вперёд и вверх,
// а тело наклоняется вперёд. Отпустил — ходуля замирает, тело падает на неё, и она встаёт на землю.
// Работает в браузере (window.Phys) и в Node (для автотеста).
(function (root) {
  'use strict';

  const CFG = {
    gravity: 10,
    stiltLen: 2.6,
    spin: 6.0,      // как быстро ходуля догоняет палец, рад/с
    legMass: 0.32,  // насколько вынесенная вперёд ходуля тянет тело за собой
    spinMax: 2.7,   // дальше вверх ходуля не поднимается
    drop: 5,        // скорость, с которой отпущенная ходуля опускается, рад/с
    push: 3,        // пока держишь, тело разгоняется вперёд, рад/с²
    wMax: 1.0,      // предельная скорость наклона от толчка, рад/с
    damp: 0.25,     // трение в шарнире
    keep: 0.9,      // сколько скорости остаётся после шага
    fall: 1.05,     // наклон, после которого персонаж падает, рад
  };

  // ---- случайные числа с зерном: тропа N всегда одна и та же ----
  function rng(seed) {
    let a = seed * 9301 + 49297;
    return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
  }

  // ---- тропа: линии земли, блоки, шипы, монеты ----
  function genTrail(n) {
    const r = rng(n * 7 + 3);
    const lv = { n, edges: [], blocks: [], spikes: [], coins: [], ice: [], finish: 0, biome: Math.floor((n - 1) / 5) % 3 };
    let x = -12, y = 0;
    const line = (x2, y2, ice) => { lv.edges.push([x, y, x2, y2, !!ice]); if (ice) lv.ice.push([x, x2]); x = x2; y = y2; };
    line(5, 0);
    const pieces = Math.min(4 + Math.floor(n * 0.8), 22);
    const diff = Math.min(1, (n - 1) / 25);
    const kinds = ['flat', 'hill', 'gap', 'block', 'stumps', 'step', 'ice'];
    const avail = n === 1 ? ['flat', 'hill', 'block'] : n === 2 ? ['flat', 'hill', 'block', 'gap', 'step'] : kinds;
    let last = '';
    for (let i = 0; i < pieces; i++) {
      let k = avail[Math.floor(r() * avail.length)];
      if (k === last && k !== 'flat') k = 'flat';
      last = k;
      if (i % 2 === 0) lv.coins.push([x + 1.5, y + 3.6]);
      if (k === 'flat') line(x + 2 + r() * 3, y);
      else if (k === 'hill') {
        const len = 4 + r() * 3, dy = (r() < 0.5 ? -1 : 1) * (0.3 + r() * (0.4 + diff * 0.6));
        line(x + len / 2, y + dy * 0.6); line(x + len / 2, y + dy * 0.4 * (r() < 0.5 ? 1 : 0));
      } else if (k === 'gap') {
        const w = 0.9 + r() * (0.4 + diff * 0.9);
        line(x + 1.8, y); const x0 = x, y0 = y;
        line(x, y0 - 3); line(x + w, y0 - 3); line(x, y0);
        lv.spikes.push([x0, y0 - 3, x0 + w]);
        lv.coins.push([x0 + w / 2, y0 + 3.4]);
        line(x + 1.8, y);
      } else if (k === 'block') {
        line(x + 1.5, y);
        const w = 1.2 + r() * 1.2, h = 0.3 + r() * (0.25 + diff * 0.45);
        lv.blocks.push([x + w / 2, y + h / 2, w, h, false]);
        line(x + w + 1.5, y);
      } else if (k === 'stumps') {
        line(x + 1.5, y);
        const cnt = 2 + Math.floor(r() * 2);
        for (let j = 0; j < cnt; j++) { lv.blocks.push([x + 0.2, y + 0.3, 0.4, 0.6 + r() * 0.3 * diff, true]); line(x + 1.6, y); }
        line(x + 1, y);
      } else if (k === 'step') {
        const dy = (r() < 0.55 ? 1 : -1) * (0.3 + r() * (0.25 + diff * 0.35));
        line(x + 1.5, y); line(x, y + dy); line(x + 2.5, y);
      } else if (k === 'ice') {
        line(x + 1, y); line(x + 4 + r() * 3, y, true); line(x + 1, y);
      }
    }
    line(x + 3, y);
    lv.finish = x; lv.finishY = y;
    line(x + 14, y);
    return lv;
  }

  function groundY(lv, gx) {
    let best = -1e9;
    for (const [x1, y1, x2, y2] of lv.edges) {
      if (x2 === x1) continue;
      const a = Math.min(x1, x2), b = Math.max(x1, x2);
      if (gx >= a && gx <= b) best = Math.max(best, y1 + (y2 - y1) * ((gx - x1) / (x2 - x1)));
    }
    for (const [cx, cy, w, h] of lv.blocks) if (Math.abs(gx - cx) <= w / 2) best = Math.max(best, cy + h / 2);
    return best;
  }
  const onIce = (lv, x) => lv.ice.some(([a, b]) => x >= a && x <= b);

  // ---- персонаж ----
  // th — наклон опорной ходули (плюс — бедро впереди ноги), w — скорость наклона,
  // phi — угол переносимой ходули (0 — вниз, плюс — вперёд, π/2 — горизонтально вперёд)
  function createGame(n) {
    const lv = genTrail(n);
    const L = CFG.stiltLen;
    const g = {
      lv, L, t: 0, state: 'ready', holding: false, released: false,
      P: { x: 0, y: groundY(lv, 0) }, Ls: L, th: 0.03, w: 0, phi: -0.3,
      stance: 1, ta: 0, tw: 0,
      coinsGot: 0, coinsTaken: new Set(), events: [], deadT: 0, why: '', fallV: 0,
    };
    // интерфейс как у тел физического движка — чтобы рисовалка не менялась
    g.torso = { getAngle: () => g.ta };
    g.stilts = [0, 1].map((i) => ({ getAngle: () => (i === g.stance ? -g.th : g.phi) }));
    return g;
  }

  function hipPos(g) { return { x: g.P.x + g.Ls * Math.sin(g.th), y: g.P.y + g.Ls * Math.cos(g.th) }; }
  function footPos(g, i) {
    const h = hipPos(g);
    if (i === g.stance) return { x: g.P.x, y: g.P.y };
    return { x: h.x + g.L * Math.sin(g.phi), y: h.y - g.L * Math.cos(g.phi) };
  }
  function stiltAngle(g, i) { return i === g.stance ? -g.th : g.phi; }

  function die(g, why) {
    if (g.state !== 'play') return;
    g.state = 'dead'; g.why = why; g.events.push('fall');
  }

  // ставим переносимую ходулю на землю: она становится опорной
  function plant(g, fx, fy) {
    const H = hipPos(g);
    const dx = H.x - fx, dy = H.y - fy, d = Math.hypot(dx, dy);
    const thn = Math.atan2(dx, dy);
    // скорость бедра переносится на новую опору (только поперечная часть)
    const vx = g.w * g.Ls * Math.cos(g.th), vy = -g.w * g.Ls * Math.sin(g.th);
    // при длинном шаге теряется часть скорости, но не вся — иначе игра слишком злая
    const proj = (vx * Math.cos(thn) - vy * Math.sin(thn)) / d, full = (g.w * g.Ls) / d;
    const wn = (0.45 * proj + 0.55 * full) * (onIce(g.lv, fx) ? 0.98 : CFG.keep);
    const old = g.P;
    g.P = { x: fx, y: fy }; g.Ls = d; g.th = thn; g.w = wn;
    g.phi = Math.atan2(old.x - H.x, H.y - old.y); // старая опора теперь сзади
    g.stance = 1 - g.stance;
    g.released = false;
    g.events.push('land');
  }

  // hold — палец на экране; target — куда палец ведёт ходулю (угол), null — управление с клавиатуры
  function step(g, dt, hold, target = null) {
    g.events.length = 0;
    if (g.state === 'ready' && hold) { g.state = 'play'; g.w = 0.1; }
    const H0 = hipPos(g);
    if (g.state === 'play') {
      g.t += dt;
      if (hold) {
        if (!g.holding) { g.holding = true; g.released = false; g.phi0 = g.phi; g.events.push('swing'); }
        // ходуля идёт за пальцем (быстро, но не мгновенно); с клавиатуры — сама вперёд
        const want = target === null ? CFG.spinMax : Math.max(-0.9, Math.min(CFG.spinMax, target));
        const maxd = CFG.spin * dt;
        g.phi += Math.max(-maxd, Math.min(maxd, want - g.phi));
        if (CFG.push && g.w < CFG.wMax) g.w += (CFG.wMax - g.w) * Math.min(1, CFG.push * dt); // лёгкая помощь: пока держишь, тело идёт вперёд
      } else if (g.holding) { g.holding = false; g.released = true; g.events.push('release'); }
    }
    if (g.state === 'play' || g.state === 'dead') {
      const lying = g.state === 'dead' && Math.abs(g.th) >= 1.45;
      if (!lying) {
        const legPull = g.state === 'play' ? CFG.legMass * (Math.sin(g.phi) + Math.sin(g.th)) : 0;
        g.w += (CFG.gravity / g.Ls) * (Math.sin(g.th) + legPull) * dt;
        g.w *= 1 - CFG.damp * dt;
        g.th += g.w * dt;
      } else { g.th = Math.sign(g.th) * 1.45; g.w = 0; }
      if (g.state === 'play') {
        g.Ls += (g.L - g.Ls) * Math.min(1, 3 * dt);
        if (onIce(g.lv, g.P.x)) g.P.x += g.w * g.Ls * Math.cos(g.th) * 0.25 * dt; // на льду опора скользит
      }
    }
    if (g.state === 'play') {
      // отпущенная ходуля быстро опускается и встаёт, как только коснётся земли
      if (g.released) {
        const prev = g.phi;
        g.phi = Math.max(-0.6, g.phi - CFG.drop * dt);
        const F1 = footPos(g, 1 - g.stance), gy1 = groundY(g.lv, F1.x);
        if (gy1 - F1.y > 0.7) g.phi = prev; // упёрлась в бок ящика — дальше не опускается
      }
      const F = footPos(g, 1 - g.stance), gy = groundY(g.lv, F.x);
      if (g.released) {
        if (F.y <= gy + 0.02) plant(g, F.x, gy);
        // ступенька вниз: ходуля чуть выдвигается, чтобы достать до земли
        else if (g.phi <= g.th + 0.05 && F.y - gy < 0.8) plant(g, F.x, gy);
      }
      const H = hipPos(g);
      if (g.th > CFG.fall) die(g, groundY(g.lv, H.x + 1) < H.y - 4 ? 'Упал в яму!' : 'Упал вперёд!');
      else if (g.th < -CFG.fall) die(g, 'Упал назад!');
      else if (H.x >= g.lv.finish) { g.state = 'win'; g.events.push('win'); }
      // монеты: собирает голова, тело или ноги
      const head = { x: H.x - Math.sin(g.ta) * 1.5, y: H.y + Math.cos(g.ta) * 1.5 };
      g.lv.coins.forEach(([cx, cy], i) => {
        if (g.coinsTaken.has(i)) return;
        const near = (p, r) => Math.hypot(p.x - cx, p.y - cy) < r;
        if (near(head, 0.75) || near(H, 0.8) || near(F, 0.5)) { g.coinsTaken.add(i); g.coinsGot++; g.events.push('coin'); }
      });
      // шипы: нога в яме
      for (const [x0, y0, x1] of g.lv.spikes) if (F.x > x0 && F.x < x1 && F.y < y0 + 0.6) die(g, 'На шипы!');
    }
    if (g.state === 'dead') {
      // если упал над ямой — проваливается вниз
      const H = hipPos(g);
      if (groundY(g.lv, H.x) < g.P.y - 2) { g.fallV += CFG.gravity * dt; g.P.y -= g.fallV * dt; }
    }
    // туловище: держится почти ровно, слегка наклоняется по ходу и раскачивается
    const H1 = hipPos(g);
    const lean = g.state === 'dead' ? Math.sign(g.th || 1) * -1.35 : -(g.th * 0.35 + g.w * 0.12);
    g.tw += ((lean - g.ta) * 60 - g.tw * 9) * dt;
    g.ta += g.tw * dt;
    g.hipV = { x: (H1.x - H0.x) / dt, y: (H1.y - H0.y) / dt };
    if (g.state === 'dead' || g.state === 'win') g.deadT += dt;
  }

  // Автопилот для проверки: держать, пока ходуля не выйдет вперёд на нужный угол, потом ждать шага
  function bot(g) {
    if (g.state !== 'play' && g.state !== 'ready') return false;
    g.botTarget = g._target ?? 0.8;
    if (g.state === 'ready') return true;
    if (!g.holding) return !g.released && g.th > (g._go ?? -2);
    // ногу ставим примерно туда, куда наклонилось тело; над ямой — тянем дальше
    const H = hipPos(g), land = H.x + g.L * Math.sin(g.th) * 1.05;
    const pit = (x) => groundY(g.lv, x) < H.y - g.L - 0.5;
    const bad = pit(land) || pit(land + 0.25) || pit(land - 0.15);
    if (bad) return g.th < 0.85;
    return g.th < (g._lean ?? 0.25) && g.phi < (g._up ?? 1.0);
  }
  root.Phys = { CFG, genTrail, groundY, createGame, step, hipPos, footPos, stiltAngle, bot };
  if (typeof module !== 'undefined') module.exports = root.Phys;
})(typeof window !== 'undefined' ? window : globalThis);
