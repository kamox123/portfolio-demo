// Физика «Ходульщика» на движке Planck (Box2D): тело, две ходули на шарнирах, тропы с препятствиями.
// Работает в браузере (window.Phys) и в Node (для автотеста).
(function (root) {
  'use strict';
  const pl = root.planck || (typeof require !== 'undefined' ? require('planck') : null);
  const { World, Vec2, Box, Circle, Edge, RevoluteJoint } = pl;

  // ---- настройки управления ----
  const CFG = {
    gravity: 10,
    stiltLen: 2.6,
    spin: 6.5,        // скорость прокрутки свободной ходули, рад/с
    push: 1.6,        // насколько опорная ходуля толкает тело вперёд, пока держишь
    pushTorque: 140,  // сила этого толчка
    holdTorque: 400,  // как крепко руки держат ходулю
    uprightK: 120,     // как сильно тело старается стоять ровно
    uprightD: 16,
  };

  // ---- случайные числа с зерном: тропа N всегда одна и та же ----
  function rng(seed) {
    let a = seed * 9301 + 49297;
    return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
  }

  // ---- тропа: линии земли, блоки, шипы, монеты ----
  function genTrail(n) {
    const r = rng(n * 7 + 3);
    const lv = { n, edges: [], blocks: [], spikes: [], coins: [], finish: 0, biome: Math.floor((n - 1) / 5) % 3 };
    let x = -12, y = 0;
    const line = (x2, y2, ice) => { lv.edges.push([x, y, x2, y2, !!ice]); x = x2; y = y2; };
    line(5, 0);
    const pieces = Math.min(5 + Math.floor(n * 0.8), 22);
    const diff = Math.min(1, (n - 1) / 25);
    const kinds = ['flat', 'hill', 'gap', 'block', 'stumps', 'step', 'ice'];
    const avail = n === 1 ? ['flat', 'hill', 'block'] : n === 2 ? ['flat', 'hill', 'block', 'gap', 'step'] : kinds;
    let last = '';
    for (let i = 0; i < pieces; i++) {
      let k = avail[Math.floor(r() * avail.length)];
      if (k === last && k !== 'flat') k = 'flat';
      last = k;
      if (i % 2 === 0) lv.coins.push([x + 1.5, y + 3.4]);
      if (k === 'flat') line(x + 2 + r() * 3, y);
      else if (k === 'hill') {
        const len = 3 + r() * 3, dy = (r() < 0.5 ? -1 : 1) * (0.4 + r() * (0.6 + diff * 0.8));
        line(x + len / 2, y + dy * 0.6); line(x + len / 2, y + dy * 0.4 * (r() < 0.5 ? 1 : 0));
      } else if (k === 'gap') {
        const w = 1.0 + r() * (0.5 + diff * 1.1);
        line(x + 1.5, y); const x0 = x, y0 = y;
        line(x, y - 3); line(x + w, y - 3); line(x, y0);
        lv.spikes.push([x0, y0 - 3, x0 + w]);
        line(x + 1.5, y);
      } else if (k === 'block') {
        line(x + 1.5, y);
        const w = 1 + r() * 1.2, h = 0.3 + r() * (0.25 + diff * 0.45);
        lv.blocks.push([x + w / 2, y + h / 2, w, h, false]);
        lv.coins.push([x + w / 2, y + h + 3.2]);
        line(x + w + 1.5, y);
      } else if (k === 'stumps') {
        line(x + 1.5, y);
        const cnt = 2 + Math.floor(r() * 2);
        for (let j = 0; j < cnt; j++) { lv.blocks.push([x + 0.2, y + 0.3, 0.35, 0.6 + r() * 0.3 * diff, true]); line(x + 1.4, y); }
        line(x + 1, y);
      } else if (k === 'step') {
        const dy = (r() < 0.55 ? 1 : -1) * (0.35 + r() * (0.3 + diff * 0.4));
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

  // ---- персонаж ----
  const GROUP = -1; // части персонажа друг с другом не сталкиваются

  function createGame(n, opts = {}) {
    const lv = genTrail(n);
    const world = new World({ gravity: Vec2(0, -CFG.gravity) });
    const g = { lv, world, t: 0, state: 'ready', holding: false, active: 0, coinsGot: 0, coinsTaken: new Set(), events: [], deadT: 0, spinDone: 0 };

    const ground = world.createBody();
    for (const [x1, y1, x2, y2, ice] of lv.edges) {
      ground.createFixture({ shape: Edge(Vec2(x1, y1), Vec2(x2, y2)), friction: ice ? 0.03 : 1.0, userData: 'ground' });
    }
    for (const [cx, cy, w, h] of lv.blocks) {
      ground.createFixture({ shape: Box(w / 2, h / 2, Vec2(cx, cy), 0), friction: 1.0, userData: 'ground' });
    }
    for (const [x0, y0, x1] of lv.spikes) {
      ground.createFixture({ shape: Box((x1 - x0) / 2, 0.35, Vec2((x0 + x1) / 2, y0 + 0.3), 0), isSensor: true, userData: 'spikes' });
    }
    lv.coins.forEach(([cx, cy], i) => {
      ground.createFixture({ shape: Circle(Vec2(cx, cy), 0.35), isSensor: true, userData: 'coin:' + i });
    });

    // тело: туловище + голова одним куском
    const L = CFG.stiltLen;
    const hip = Vec2(0, L * Math.cos(0.32));
    const torso = world.createDynamicBody({ position: hip, angularDamping: 0.5 });
    torso.createFixture({ shape: Box(0.26, 0.42, Vec2(0, 0.42), 0), density: 2.2, friction: 0.6, filterGroupIndex: GROUP, userData: 'body' });
    torso.createFixture({ shape: Circle(Vec2(0.05, 1.12), 0.32), density: 1.2, friction: 0.6, filterGroupIndex: GROUP, userData: 'head' });

    // ходули: начало тела — в бедре, ходуля смотрит вниз при угле 0
    const stilts = [];
    const joints = [];
    for (const a0 of [-0.32, 0.32]) {
      const s = world.createDynamicBody({ position: hip, angle: a0, angularDamping: 0.1 });
      s.createFixture({ shape: Box(0.06, L / 2, Vec2(0, -L / 2), 0), density: 0.9, friction: 0.9, filterGroupIndex: GROUP, userData: 'stilt' });
      s.createFixture({ shape: Circle(Vec2(0, -L), 0.08), density: 1.5, friction: 1.2, filterGroupIndex: GROUP, userData: 'foot' });
      const j = world.createJoint(RevoluteJoint({ enableMotor: true, motorSpeed: 0, maxMotorTorque: CFG.holdTorque }, torso, s, hip));
      stilts.push(s); joints.push(j);
    }
    // при старте крутится задняя ходуля
    g.active = 0;
    Object.assign(g, { torso, stilts, joints, L });

    world.on('begin-contact', (c) => {
      const fa = c.getFixtureA(), fb = c.getFixtureB();
      for (const [f, o] of [[fa, fb], [fb, fa]]) {
        const u = f.getUserData(), uo = o.getUserData();
        if (typeof u === 'string' && u.startsWith('coin:') && (uo === 'body' || uo === 'head' || uo === 'stilt' || uo === 'foot')) {
          const i = +u.slice(5);
          if (!g.coinsTaken.has(i)) { g.coinsTaken.add(i); g.coinsGot++; g.events.push('coin'); }
        }
        if ((u === 'head' || u === 'body') && uo === 'ground' && g.state === 'play') die(g, 'Упал!');
        if (u === 'foot' && uo === 'ground') g.events.push('land');
        if (u === 'spikes' && (uo === 'foot' || uo === 'stilt' || uo === 'body' || uo === 'head') && g.state === 'play') die(g, 'На шипы!');
      }
    });
    return g;
  }

  function die(g, why) {
    g.state = 'dead'; g.why = why; g.events.push('fall');
    // руки отпускают ходули — персонаж валится тряпичной куклой
    g.pendingRelease = true;
  }

  function hipPos(g) { return g.torso.getPosition(); }
  function footPos(g, i) { return g.stilts[i].getWorldPoint(Vec2(0, -g.L)); }

  // угол ходули относительно «вниз», от -π до π (плюс — нога впереди)
  function stiltAngle(g, i) {
    let a = g.stilts[i].getAngle();
    a = Math.atan2(Math.sin(a), Math.cos(a));
    return a;
  }

  function step(g, dt, hold) {
    g.events.length = 0;
    if (g.state === 'ready' && hold) g.state = 'play';
    if (g.state === 'play') {
      g.t += dt;
      const a = g.active, b = 1 - a;
      if (hold) {
        g.holding = true;
        g.joints[a].setMaxMotorTorque(CFG.holdTorque);
        g.joints[a].setMotorSpeed(-CFG.spin);
        g.joints[b].setMaxMotorTorque(CFG.pushTorque);
        g.joints[b].setMotorSpeed(-CFG.push);
      } else {
        if (g.holding) { g.holding = false; g.active = b; g.events.push('release'); }
        for (const j of g.joints) { j.setMaxMotorTorque(CFG.holdTorque); j.setMotorSpeed(0); }
      }
      // тело старается держаться прямо (как настоящий ходулист руками)
      const ang = Math.atan2(Math.sin(g.torso.getAngle()), Math.cos(g.torso.getAngle()));
      g.torso.applyTorque(-CFG.uprightK * ang - CFG.uprightD * g.torso.getAngularVelocity());
      const h = hipPos(g);
      if (h.x >= g.lv.finish) { g.state = 'win'; g.events.push('win'); }
      if (h.y < groundY(g.lv, h.x) - 2.5) die(g, 'Упал в яму!');
    }
    if (g.pendingRelease) {
      g.pendingRelease = false;
      for (const j of g.joints) { j.enableMotor(false); }
    }
    if (g.state === 'dead' || g.state === 'win') g.deadT += dt;
    g.world.step(dt, 10, 6);
  }

  // Автопилот для проверки: крутить свободную ходулю через верх и отпускать, когда она впереди-внизу
  function bot(g) {
    if (g.state !== 'play' && g.state !== 'ready') return false;
    const a = g.active;
    if (!g.holding) {
      g._wait = (g._wait || 0) + 1 / 60;
      if (g._wait < 0.25) return false;
      g._wait = 0; g._phase = 0; return true;
    }
    const ang = stiltAngle(g, a);
    // фаза: сначала нога уходит назад-вверх (угол < -1.5), потом через верх выходит вперёд
    if (g._phase === 0 && ang < -1.6) g._phase = 1;
    if (g._phase === 1 && ang > 1.6) g._phase = 2;
    if (g._phase === 2) {
      // не ставить ногу в яму: смотрим, куда она встанет сейчас и чуть позже
      const h = hipPos(g);
      const safe = (an) => groundY(g.lv, h.x + g.L * Math.sin(an)) > h.y - g.L - 0.6;
      if (ang < 0.55 && safe(ang)) return false;
      if (ang < 1.1 && safe(ang) && !safe(ang - 0.12)) return false;
      if (ang < 0.05) return false;
    }
    return true;
  }

  root.Phys = { CFG, genTrail, groundY, createGame, step, hipPos, footPos, stiltAngle, bot };
  if (typeof module !== 'undefined') module.exports = root.Phys;
})(typeof window !== 'undefined' ? window : globalThis);
