// «Ходульщик 2» — физика ходьбы на ходулях и генератор уровней.
// Модель: опорная ходуля — перевёрнутый маятник (тело качается вокруг стопы), вторая ходуля — отдельная
// нога со своим углом. Вынесенная вперёд нога смещает центр масс и тянет тело. Нога встаёт, когда коснётся
// поверхности. Поверхности бывают неподвижные, движущиеся, качающиеся; есть лёд, конвейеры, вода, шипы и
// опасности (лопасти, камни, прессы). Работает в браузере (window.Phys) и в Node (для автотестов).
(function (root) {
  'use strict';

  // ================= НАСТРОЙКИ ФИЗИКИ (можно менять) =================
  const CFG = {
    gravity: 10,         // сила тяжести (падение, камни), м/с²
    legLength: 2.6,      // длина ходули, м
    maxSpread: 3.3,      // если стопы дальше друг от друга — ноги разъезжаются, м
    maxStep: 3.8,        // самый длинный шаг, который можно «намахать» свайпом, м
    swingTime: 0.32,     // время шага, с
    swingPerMeter: 0.09, // на каждый метр шага — ещё столько секунд
    stepLift: 0.4,       // насколько поднимается стопа в середине шага, м
    edgeSlip: 0.12,      // ближе к краю — стопа соскальзывает, м
    maxRise: 1.1,        // выше этого на опору не шагнуть, м
    maxDrop: 1.5,        // ниже этого ходуля не дотянется, м
    bodyLag: 0.12,       // насколько тело отстаёт от ноги при переносе веса (0..0.4)
    sway: 1.0,           // сила раскачивания тела после шага
    wobbleMargin: 0.3,   // за maxSpread ещё можно устоять — в этом запасе начинается пошатывание, м
    wobbleTime: 1.0,     // сколько секунд даётся на то, чтобы свести ноги обратно, иначе упадёт, с
    jumpForce: 3.2,       // вертикальная скорость при слабом прыжке (подскок), м/с
    jumpForceMax: 5.4,    // вертикальная скорость при самом сильном прыжке, м/с
    jumpGravity: 13,      // гравитация во время прыжка — отдельно от обычной, для упругого ощущения, м/с²
    jumpMaxDrift: 2.4,    // сколько горизонтальной скорости можно унести в прыжок, м/с
    jumpMaxDrop: 3.2,     // на сколько ниже точки взлёта можно приземлиться, не разбившись, м
    jumpFailSpeed: 10,    // скорость падения при ударе о землю, после которой — провал приземления, м/с
    jumpWobbleSpeed: 6.2, // скорость падения, после которой приземление становится неровным (пошатывание), м/с
  };


  // ================= МИРЫ =================
  const WORLDS = [
    { id: 'forest', name: 'Зелёная долина', pieces: { flat: 3, slope: 2, steps: 2, pit: 2, log: 2, bridge: 2 }, pit: 'spikes' },
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
    if (world === 0) return buildGV(idx);
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

  // ================= «ЗЕЛЁНАЯ ДОЛИНА»: 20 уровней, придуманных вручную =================
  // Уровень — список кусков трассы. Каждый кусок задаёт форму земли, препятствие и монеты.
  //   ['flat', длина, монет]            ровная земля
  //   ['hill', длина, высота]           плавный холм (высота < 0 — впадина)
  //   ['slope', длина, перепад]         подъём или спуск
  //   ['step', высота]                  уступ вверх (+) или вниз (−)
  //   ['log', радиус] / ['rock', размер] бревно или камень поперёк тропы
  //   ['pit', ширина, 'spikes'|'water'] яма с кольями или водой
  //   ['bridge', ширина]                мостик над ямой
  //   ['posts', сколько, промежуток, высоты?] пни-столбики над ямой
  //   ['raft', ширина ямы, период]      плот над водой, плавает туда-сюда
  //   ['lift', высота, период]          подъёмник на уступ
  //   ['swing', ширина]                 подвесная доска на верёвках
  //   ['seesaw', полудлина]             качели-доска на камне
  //   ['cp']                            контрольная точка
  const GV = [
    { name: 'Первые шаги', pieces: [['flat', 5, 2], ['hill', 6, 0.3], ['flat', 3, 1], ['cp'], ['flat', 4, 2], ['log', 0.22], ['flat', 4, 1], ['cp'], ['hill', 6, 0.35], ['flat', 4, 2]] },
    { name: 'Холмики', pieces: [['flat', 4, 1], ['hill', 6, 0.5], ['hill', 6, -0.4], ['cp'], ['flat', 3, 1], ['hill', 7, 0.7], ['flat', 3, 2], ['cp'], ['hill', 6, -0.5], ['hill', 5, 0.4], ['flat', 3, 1]] },
    { name: 'Ступеньки', pieces: [['flat', 4, 1], ['step', 0.25], ['flat', 3, 1], ['step', 0.3], ['flat', 3, 1], ['cp'], ['step', -0.3], ['flat', 3, 1], ['step', -0.25], ['flat', 3, 1], ['hill', 6, 0.5], ['cp'], ['log', 0.25], ['flat', 4, 2]] },
    { name: 'Брёвнышки', pieces: [['flat', 4, 1], ['log', 0.25], ['flat', 3, 1], ['log', 0.3], ['hill', 6, 0.4], ['cp'], ['rock', 0.35], ['flat', 3, 1], ['log', 0.35], ['flat', 3, 1], ['cp'], ['rock', 0.4], ['hill', 5, -0.3], ['log', 0.3], ['flat', 4, 2]] },
    { name: 'Первая ямка', pieces: [['flat', 4, 1], ['pit', 0.8, 'spikes'], ['flat', 4, 1], ['hill', 6, 0.4], ['cp'], ['log', 0.3], ['flat', 3, 1], ['pit', 1.0, 'spikes'], ['flat', 3, 1], ['cp'], ['step', 0.3], ['flat', 3, 1], ['pit', 1.1, 'spikes'], ['flat', 4, 2]] },
    { name: 'Овраг', pieces: [['flat', 4, 1], ['hill', 8, -1.0], ['flat', 2, 1], ['slope', 4, 0.6], ['cp'], ['pit', 1.2, 'spikes'], ['flat', 3, 1], ['log', 0.4], ['slope', 5, -0.7], ['cp'], ['hill', 7, 0.9], ['pit', 1.3, 'spikes'], ['flat', 4, 2]] },
    { name: 'Мостик', pieces: [['flat', 4, 1], ['bridge', 3.2], ['flat', 3, 1], ['rock', 0.4], ['flat', 3, 1], ['cp'], ['pit', 1.2, 'spikes'], ['flat', 3, 1], ['bridge', 4.2], ['cp'], ['hill', 6, 0.5], ['rock', 0.45], ['flat', 4, 2]] },
    { name: 'Каменная тропа', pieces: [['flat', 4, 1], ['rock', 0.45], ['flat', 2.5, 1], ['step', 0.5], ['flat', 3, 1], ['rock', 0.5], ['cp'], ['step', -0.6], ['flat', 3, 1], ['log', 0.4], ['rock', 0.55], ['cp'], ['slope', 5, 0.6], ['pit', 1.3, 'spikes'], ['flat', 4, 2]] },
    { name: 'Ручей', pieces: [['flat', 4, 1], ['pit', 1.0, 'water'], ['flat', 3, 1], ['log', 0.35], ['flat', 2, 1], ['cp'], ['pit', 1.3, 'water'], ['hill', 6, 0.5], ['cp'], ['seesaw', 1.8], ['flat', 3, 1], ['pit', 1.4, 'water'], ['flat', 4, 2]] },
    { name: 'Пни', pieces: [['flat', 4, 1], ['posts', 3, 0.9], ['flat', 3, 1], ['cp'], ['pit', 1.3, 'spikes'], ['flat', 2.5, 1], ['log', 0.4], ['flat', 2, 1], ['cp'], ['bridge', 4], ['raft', 3.0, 5.0], ['flat', 4, 2]] },
    { name: 'Плот', pieces: [['flat', 4, 1], ['raft', 3.2, 5.0], ['flat', 3, 1], ['rock', 0.45], ['cp'], ['bridge', 4.5], ['flat', 2, 1], ['raft', 3.6, 4.6], ['cp'], ['hill', 6, 0.6], ['pit', 1.4, 'water'], ['flat', 4, 2]] },
    { name: 'Обрывы', pieces: [['flat', 4, 1], ['step', 0.6], ['flat', 2.5, 1], ['step', 0.7], ['flat', 3, 1], ['cp'], ['step', -0.8], ['flat', 2.5, 1], ['pit', 1.5, 'spikes'], ['flat', 2.5, 1], ['cp'], ['step', 0.6], ['rock', 0.5], ['step', -0.9], ['flat', 4, 2]] },
    { name: 'Качели', pieces: [['flat', 4, 1], ['swing', 3.4], ['flat', 3, 1], ['seesaw', 2.0], ['cp'], ['flat', 2, 1], ['pit', 1.4, 'water'], ['flat', 2.5, 1], ['swing', 3.8], ['cp'], ['log', 0.45], ['seesaw', 2.2], ['flat', 4, 2]] },
    { name: 'Узкая тропа', pieces: [['flat', 4, 1], ['posts', 4, 1.0], ['flat', 3, 1], ['rock', 0.45], ['cp'], ['posts', 5, 1.05, [0, 0.3, 0.5, 0.2, 0]], ['flat', 3, 1], ['cp'], ['log', 0.45], ['posts', 4, 1.1], ['flat', 4, 2]] },
    { name: 'Подъёмник', pieces: [['flat', 4, 1], ['lift', 0.9, 4.6], ['flat', 3, 1], ['step', -0.5], ['cp'], ['pit', 1.4, 'water'], ['flat', 2, 1], ['raft', 3.4, 4.2], ['cp'], ['lift', 1.1, 4.2], ['flat', 2, 1], ['step', -1.0], ['flat', 4, 2]] },
    { name: 'Всё вместе', pieces: [['flat', 4, 1], ['hill', 6, 0.7], ['log', 0.45], ['pit', 1.5, 'spikes'], ['flat', 2, 1], ['cp'], ['bridge', 4.5], ['rock', 0.5], ['pit', 1.4, 'water'], ['cp'], ['posts', 4, 1.1], ['swing', 3.6], ['flat', 4, 2]] },
    { name: 'Быстрый плот', pieces: [['flat', 4, 1], ['raft', 3.6, 3.6], ['flat', 2.5, 1], ['posts', 4, 1.1, [0, 0.3, 0.3, 0]], ['cp'], ['flat', 2, 1], ['raft', 4.0, 3.4], ['cp'], ['swing', 3.8], ['log', 0.5], ['pit', 1.6, 'spikes'], ['flat', 4, 2]] },
    { name: 'Болото', pieces: [['flat', 4, 1], ['pit', 1.5, 'water'], ['posts', 3, 1.1], ['raft', 3.6, 4.0], ['cp'], ['flat', 2, 1], ['pit', 1.6, 'water'], ['seesaw', 2.2], ['cp'], ['pit', 1.5, 'water'], ['raft', 4.0, 3.8], ['flat', 4, 2]] },
    { name: 'Высокие пни', pieces: [['flat', 4, 1], ['posts', 5, 1.15, [0.2, 0.5, 0.8, 0.5, 0.2]], ['flat', 2.5, 1], ['lift', 1.1, 3.8], ['cp'], ['flat', 2, 1], ['pit', 1.8, 'spikes'], ['step', -1.1], ['cp'], ['posts', 5, 1.2, [0, 0.4, 0.7, 0.4, 0]], ['flat', 4, 2]] },
    { name: 'Финал долины', pieces: [['flat', 4, 1], ['hill', 7, 0.9], ['pit', 1.7, 'spikes'], ['bridge', 5], ['flat', 2, 1], ['raft', 3.8, 3.6], ['cp'], ['posts', 5, 1.15, [0, 0.4, 0.8, 0.4, 0]], ['swing', 3.8], ['seesaw', 2.2], ['cp'], ['lift', 1.1, 3.8], ['pit', 1.8, 'water'], ['log', 0.5], ['rock', 0.55], ['flat', 5, 2]] },
  ];
  const levelCount = (w) => (w === 0 ? GV.length : LEVELS_PER_WORLD);

  function buildGV(idx) {
    const spec = GV[idx];
    const lv = { world: 0, idx, name: spec.name, segs: [], objs: [], haz: [], zones: [], coins: [], checkpoints: [], finish: 0, finishY: 0, theme: 'forest', pieces: [], hard: 0 };
    let x = -14, y = 0;
    const seg = (x2, y2, mat = 'ground') => { lv.segs.push([x, y, x2, y2, mat]); x = x2; y = y2; };
    const coin = (cx, cy) => lv.coins.push([cx, cy]);
    const coinArc = (x0, x1, base, n, h = 1.2) => { for (let i = 0; i < n; i++) { const u = (i + 1) / (n + 1); coin(x0 + (x1 - x0) * u, base + 3.0 + Math.sin(Math.PI * u) * h); } };
    const pitWalls = (x0, w, kind) => {
      if (kind === 'water') lv.segs.push([x0, y - 1.2, x0 + w, y - 1.2, 'water']);
      else lv.segs.push([x0, y - 3, x0 + w, y - 3, 'spikes']);
      lv.segs.push([x0, y, x0, y - 4, 'wall'], [x0 + w, y - 4, x0 + w, y, 'wall']);
    };
    seg(5, 0);
    for (const p of spec.pieces) {
      const k = p[0], x0 = x;
      switch (k) {
        case 'flat': { const n = p[2] || 0; for (let i = 0; i < n; i++) coin(x + (p[1] * (i + 0.5)) / n, y + 3.3); seg(x + p[1], y); break; }
        case 'hill': { // плавный холм из 6 отрезков по синусоиде
          const L = p[1], h = p[2], y0 = y;
          for (let i = 1; i <= 6; i++) seg(x0 + (L * i) / 6, y0 + h * Math.sin((Math.PI * i) / 6));
          coin(x0 + L / 2, y0 + h + 3.4); lv.hard += Math.abs(h) * 0.5; break;
        }
        case 'slope': { const L = p[1], dy = p[2], y0 = y; for (let i = 1; i <= 4; i++) seg(x0 + (L * i) / 4, y0 + dy * (1 - Math.cos((Math.PI * i) / 4)) / 2); lv.hard += Math.abs(dy) * 0.4; break; }
        case 'step': { seg(x + 0.0001, y); lv.segs.push([x, y, x, y + p[1], 'wall']); y += p[1]; seg(x + 1.8, y); coin(x - 0.9, y + 3.3); lv.hard += Math.abs(p[1]); break; }
        case 'log': case 'rock': {
          const r = p[1]; seg(x + 1.2, y);
          lv.objs.push(k === 'log' ? { type: 'log', cx: x + r + 0.2, cy: y, r } : { type: 'rock', cx: x + r + 0.2, cy: y - r * 0.15, r, k: 0.85 });
          coinArc(x, x + 2 * r + 0.4, y + r, 1); seg(x + 2 * r + 0.4 + 1.4, y); lv.hard += r; break;
        }
        case 'pit': { seg(x + 1.4, y); const w = p[1]; pitWalls(x, w, p[2]); coinArc(x - 0.3, x + w + 0.3, y, 2); x += w; seg(x + 1.6, y); lv.hard += w; break; }
        case 'bridge': { seg(x + 1.3, y); const w = p[1]; lv.objs.push({ type: 'bridge', x0: x, x1: x + w, y0: y, sag: 0.14, load: 0 }); pitWalls(x, w, 'spikes'); coinArc(x, x + w, y, 3, 0.4); x += w; seg(x + 1.4, y); lv.hard += w * 0.4; break; }
        case 'posts': {
          seg(x + 1.3, y); const n = p[1], gap = p[2], hs = p[3] || [], w0 = x, pw = 0.7;
          for (let i = 0; i < n; i++) { const px = w0 + gap * (i + 0.5) + i * pw, ph = hs[i] || 0; lv.objs.push({ type: 'plat', x0: px, w: pw, y0: y + ph, ax: 0, ay: 0, per: 1, ph: 0, look: 'post' }); coin(px + pw / 2, y + ph + 3.3); }
          const w = gap * (n + 0.5) + n * pw; pitWalls(w0, w, 'spikes'); x = w0 + w; seg(x + 1.4, y); lv.hard += n * 1.2; break;
        }
        case 'raft': {
          seg(x + 1.3, y); const w = p[1], pw = 2.5, amp = (w - pw) / 2 - 0.05;
          lv.objs.push({ type: 'plat', x0: x + w / 2 - pw / 2, w: pw, y0: y, ax: amp, ay: 0, per: p[2], ph: idx * 1.7, look: 'raft' });
          pitWalls(x, w, 'water'); coinArc(x, x + w, y, 2, 0.3); x += w; seg(x + 1.4, y); lv.hard += 3; break;
        }
        case 'lift': {
          seg(x + 1.3, y); const h = p[1], w = 2.9, xx = x;
          lv.objs.push({ type: 'plat', x0: xx + 0.1, w: 2.7, y0: y + h / 2, ax: 0, ay: h / 2, per: p[2], ph: idx, look: 'lift' });
          pitWalls(xx, w, 'spikes'); x = xx + w; y += h; seg(x, y); seg(x + 1.8, y);
          lv.segs.push([xx + w, y - h, xx + w, y, 'wall']); coin(xx + w / 2, y + 3.3); lv.hard += 3; break;
        }
        case 'swing': { seg(x + 1.3, y); const w = p[1], xx = x; lv.objs.push({ type: 'swing', px: xx + w / 2, py: y + 4.2, R: 4.2, amp: 0.11, per: 4.2, ph: idx, w: 2.8 }); pitWalls(xx, w, 'spikes'); coinArc(xx, xx + w, y, 2, 0.4); x = xx + w; seg(x + 1.4, y); lv.hard += 3; break; }
        case 'seesaw': { seg(x + 1.2, y); const hl = p[1], xx = x; lv.objs.push({ type: 'seesaw', px: xx + hl, py: y + 0.15, hl, a: 0.22, av: 0 }); pitWalls(xx, hl * 2, 'spikes'); coin(xx + hl, y + 3.5); x = xx + 2 * hl; seg(x + 1.4, y); lv.hard += 2.5; break; }
        case 'cp': { seg(x + 1.2, y); lv.checkpoints.push([x - 0.6, y]); seg(x + 1.2, y); break; }
      }
      lv.pieces.push({ k, x0, x1: x });
    }
    seg(x + 3, y);
    lv.finish = x; lv.finishY = y;
    seg(x + 16, y);
    lv.length = lv.finish;
    // время на 3 звезды: путь шагами ~1.7 м за 0.9 с + запас на сложные места
    lv.par = Math.round(lv.finish / 1.45 + lv.hard * 1.2 + 6);
    return lv;
  }
  // ================= ПОВЕРХНОСТИ И ОПАСНОСТИ =================
  function objState(o, t) {
    if (o.type === 'plat') {
      let s = Math.sin((2 * Math.PI * t) / o.per + o.ph), c = Math.cos((2 * Math.PI * t) / o.per + o.ph);
      const k = (2 * Math.PI) / o.per;
      if (o.look === 'lift' || o.look === 'plat' || o.look === 'floe' || o.look === 'raft') { const s2 = Math.max(-1, Math.min(1, s * 1.35)); c = Math.abs(s * 1.35) >= 1 ? 0 : c * 1.35; s = s2; } // платформа задерживается у краёв
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
      if (o.type === 'log' || o.type === 'rock') { const dx = x - o.cx; if (Math.abs(dx) < o.r) take(o.cy + Math.sqrt(o.r * o.r - dx * dx) * (o.type === 'rock' ? o.k || 1 : 1), o, o.type); }
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
  // Две стопы F[0] (левая) и F[1] (правая). Обе стоят — тело жёстко держится «домиком» на ходулях.
  // Свайп запускает шаг активной ноги: она поднимается и по дуге летит к выбранной точке,
  // тело переносит вес на опорную ногу и наклоняется. Стопа встаёт — активной становится другая нога.
  const TIPS = {
    'Ноги разъехались': 'Шаг был слишком длинным. Делай свайп короче.',
    'Нога соскользнула с края': 'Ставь ногу дальше от края — метка должна стоять на поверхности, а не на кромке.',
    'Нога ушла в пропасть': 'Перешагивай яму длиннее или подойди ближе к краю перед шагом.',
    'Не дотянулся до опоры': 'Слишком высоко или слишком низко. Подойди ближе и шагни ещё раз.',
    'Нога ударилась о препятствие': 'Веди палец чуть вверх — нога поднимется выше и перешагнёт.',
    'Платформа развела ноги': 'На движущуюся платформу вставай обеими ногами или сразу шагай дальше.',
    'Не удержал равновесие': 'Ноги были расставлены слишком широко. Как только почувствуешь шатание — быстро делай следующий шаг, сводя ноги ближе.',
    'Приземлился слишком жёстко': 'Прыгнул с слишком большой высоты или скорости. Приземляйся на поверхность примерно на уровне взлёта.',
    'Ходуля ушла под воду!': 'Ставь ногу на берег или льдину, а не в воду.',
    'Наступил на шипы!': 'Перешагни шипы длинным шагом.',
    'Сбило лопастью!': 'Подожди, пока лопасть пройдёт, и шагай сразу за ней.',
    'Попал под камень!': 'Смотри на тень на земле: темнеет — значит камень летит.',
    'Раздавило прессом!': 'Проходи, когда пресс только поднялся.',
  };

  function createGame(world, idx, fromCheckpoint = -1) {
    const lv = genLevel(world, idx);
    const L = CFG.legLength;
    let sx = 0;
    if (fromCheckpoint >= 0 && lv.checkpoints[fromCheckpoint]) sx = lv.checkpoints[fromCheckpoint][0];
    const fx0 = sx + 0.55, fx1 = sx - 0.55; // левая впереди, правая сзади — первой шагает правая
    const g = {
      lv, L, t: 0, time: 0, state: 'ready', why: '', tip: '',
      F: [{ x: fx0, y: surface(lv, fx0, 0).y, att: null }, { x: fx1, y: surface(lv, fx1, 0).y, att: null }],
      active: 1, swing: null, queue: null, H: { x: sx, y: 0 }, hv: { x: 0, y: 0 },
      s: 0, legs: [{}, {}], ta: 0, tw: 0, lean: 0,
      checkpoint: fromCheckpoint, coinsTaken: new Set(), coinsGot: 0, events: [], deadT: 0, winT: 0,
      wobbling: false, wobbleT: 0, jump: null,
      // падение: маятник вокруг стопы
      P: null, th: 0, w: 0, Ls: L, fallV: 0, splash: false,
    };
    g.F.forEach((f) => attachFoot(g, f, surface(lv, f.x, 0)));
    g.H = standHip(g) || { x: sx, y: L };
    return g;
  }

  // где окажется бедро, если стоять на двух стопах (пересечение окружностей радиуса L)
  function hipBetween(a, b, L) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 2 * L - 0.02 || d < 1e-6) return d < 1e-6 ? { x: a.x, y: a.y + L } : null;
    const m = d / 2, h = Math.sqrt(L * L - m * m), mx = a.x + dx / 2, my = a.y + dy / 2;
    const ux = -dy / d, uy = dx / d; // перпендикуляр
    const p1 = { x: mx + ux * h, y: my + uy * h }, p2 = { x: mx - ux * h, y: my - uy * h };
    return p1.y > p2.y ? p1 : p2;
  }
  function standHip(g) { return hipBetween(g.F[0], g.F[1], g.L); }

  function attachFoot(g, f, surf) {
    const o = surf.obj;
    f.att = null; f.mat = surf.mat;
    if (o && (o.type === 'plat' || o.type === 'swing')) { const st = objState(o, g.t); f.att = { o, dx: f.x - st.x0 }; }
    else if (o && o.type === 'seesaw') f.att = { o, s: (f.x - o.px) / Math.cos(o.a) };
    else if (o && o.type === 'bridge') f.att = { o };
  }
  function followFoot(g, f, dt) {
    const a = f.att;
    if (a) {
      if (a.o.type === 'plat' || a.o.type === 'swing') { const st = objState(a.o, g.t); f.x = st.x0 + a.dx; f.y = st.y; f.off = a.dx < -0.15 || a.dx > st.x1 - st.x0 + 0.15; }
      else if (a.o.type === 'seesaw') { f.x = a.o.px + a.s * Math.cos(a.o.a); f.y = a.o.py + a.s * Math.sin(a.o.a); }
      else if (a.o.type === 'bridge') { const s = surface(g.lv, f.x, g.t, f.y + 0.5); if (s.obj === a.o) f.y = s.y; }
    }
    if (typeof f.mat === 'string' && f.mat.startsWith('conv:')) f.x += parseFloat(f.mat.slice(5)) * dt;
    if (f.slide) { const k = Math.min(1, dt * 5); f.x += f.slide * k; f.slide *= 1 - k; if (Math.abs(f.slide) < 0.01) f.slide = 0; }
  }

  // стопа у края? смотрим, есть ли поверхность чуть левее и правее
  function nearEdge(g, x, y, t = g.t) {
    const e = CFG.edgeSlip;
    const l = surface(g.lv, x - e, t, y + 0.3), r = surface(g.lv, x + e, t, y + 0.3);
    return Math.abs(l.y - y) > 0.25 || Math.abs(r.y - y) > 0.25;
  }

  // ---------- шаг ----------
  // dist — расстояние от опорной стопы до цели (плюс — вперёд), up — 0..1, насколько выше поднять ногу
  function planStep(g, dist, up = 0) {
    const a = g.active, st = g.F[1 - a];
    const d = Math.max(-CFG.maxStep, Math.min(CFG.maxStep, dist));
    const tx = st.x + d;
    const surf = surface(g.lv, tx, g.t + swingDur(d, up), Math.max(st.y, g.F[a].y) + CFG.maxRise + 0.3);
    return { a, tx, ty: surf.y > -1e8 ? surf.y : st.y - 4, surf, d, up };
  }
  function swingDur(d, up) { return CFG.swingTime + CFG.swingPerMeter * Math.abs(d) + up * 0.12; }

  function command(g, dist, up = 0) {
    if (g.state === 'ready') g.state = 'play';
    if (g.state !== 'play') return false;
    if (g.jump) return false; // в полёте обычный шаг не выполняется
    if (g.swing) { g.queue = { dist, up }; return true; }
    if (Math.abs(dist) < 0.15 && up < 0.15) return false; // случайное касание
    const plan = planStep(g, dist, up);
    const a = plan.a, from = { x: g.F[a].x, y: g.F[a].y };
    g.swing = { a, from, plan, t: 0, T: swingDur(plan.d, up), H0: { ...g.H }, lift: CFG.stepLift + up * 0.9, hit: null };
    g.F[a].att = null; g.F[a].lifted = true;
    g.events.push('lift');
    return true;
  }

  // точки дуги, по которой полетит стопа (для подсказки при свайпе)
  function preview(g, dist, up = 0) {
    const plan = planStep(g, dist, up), a = plan.a, from = g.F[a], pts = [];
    const lift = CFG.stepLift + up * 0.9;
    for (let i = 0; i <= 16; i++) { const s = i / 16; pts.push({ x: from.x + (plan.tx - from.x) * s, y: from.y + (plan.ty - from.y) * s + lift * Math.sin(Math.PI * s) * (1 + Math.abs(plan.d) * 0.15) }); }
    return { pts, tx: plan.tx, ty: plan.ty, ok: plan.surf.y > -1e8, mat: plan.surf.mat };
  }

  // ---------- прыжок ----------
  // Отдельная от обычного шага механика: обе ходули одновременно отрываются от земли,
  // бедро летит по настоящей вертикальной физике (gravity тянет вниз, старт — толчок вверх).
  // power — 0..1 (сила свайпа вверх: слабый подскок → сильный прыжок), drift — горизонтальная
  // скорость, унесённая в прыжок (из горизонтальной составляющей того же свайпа).
  function startJump(g, power = 0, drift = 0) {
    if (g.state === 'ready') g.state = 'play';
    if (g.state !== 'play' || g.swing || g.jump) return false;
    const vy = CFG.jumpForce + (CFG.jumpForceMax - CFG.jumpForce) * Math.max(0, Math.min(1, power));
    g.jump = { t: 0, vy, vx: Math.max(-CFG.jumpMaxDrift, Math.min(CFG.jumpMaxDrift, drift)), fromY: g.H.y, power };
    g.F[0].att = null; g.F[1].att = null; g.F[0].lifted = true; g.F[1].lifted = true;
    g.events.push('jumpstart');
    return true;
  }

  // приземление после прыжка: отдельно проверяем обе стопы (при обычном шаге всегда одна)
  function landJump(g) {
    const j = g.jump, vyImpact = j.vy;
    g.jump = null;
    for (const i of [0, 1]) {
      const f = g.F[i];
      const surf = surface(g.lv, f.x, g.t, g.H.y + 0.5);
      f.lifted = false;
      if (surf.y < -1e8) return die(g, 'Нога ушла в пропасть');
      f.y = surf.y;
      if (surf.mat === 'water') { g.splash = true; return die(g, 'Ходуля ушла под воду!'); }
      if (surf.mat === 'spikes') return die(g, 'Наступил на шипы!');
    }
    const spreadNow = Math.abs(g.F[0].x - g.F[1].x);
    if (spreadNow > CFG.maxSpread + CFG.wobbleMargin) return die(g, 'Ноги разъехались');
    if (j.fromY - Math.min(g.F[0].y, g.F[1].y) > CFG.jumpMaxDrop) return die(g, 'Приземлился слишком жёстко');
    if (Math.abs(vyImpact) > CFG.jumpFailSpeed) return die(g, 'Приземлился слишком жёстко');
    const H = standHip(g);
    if (!H) return die(g, 'Ноги разъехались');
    g.H = H;
    attachFoot(g, g.F[0], surface(g.lv, g.F[0].x, g.t)); attachFoot(g, g.F[1], surface(g.lv, g.F[1].x, g.t));
    g.events.push('jumpland');
    if (spreadNow > CFG.maxSpread || Math.abs(vyImpact) > CFG.jumpWobbleSpeed) { if (!g.wobbling) g.events.push('wobble'); g.wobbling = true; }
    else { g.wobbling = false; g.wobbleT = 0; }
  }

  function die(g, why, tip) {
    if (g.state !== 'play') return;
    g.state = 'dead'; g.why = why; g.tip = tip || TIPS[why] || ''; g.events.push('fall');
    // падение — маятник вокруг стопы, в сторону, куда клонится тело
    const H = g.H, cands = g.F.filter((f, i) => !(g.swing && g.swing.a === i));
    const piv = cands.length ? cands.reduce((b, f) => (Math.abs(f.x - H.x) < Math.abs(b.x - H.x) ? f : b)) : g.F[0];
    g.P = { x: piv.x, y: piv.y }; g.Ls = Math.max(0.8, Math.hypot(H.x - piv.x, H.y - piv.y));
    g.th = Math.atan2(H.x - piv.x, H.y - piv.y); g.w = (g.hv.x || 0) / g.Ls + (g.th >= 0 ? 0.6 : -0.6) * (Math.abs(g.th) < 0.2 ? 1 : 0.3);
    g.swing = null;
  }

  function land(g, sw, x, y, surf) {
    const a = sw.a, f = g.F[a], other = g.F[1 - a];
    f.lifted = false;
    if (surf.y < -1e8 || y < other.y - CFG.maxDrop - 0.5) { f.x = x; f.y = Math.min(y, other.y - 3); return die(g, 'Нога ушла в пропасть'); }
    f.x = x; f.y = surf.y;
    if (surf.mat === 'water') { g.splash = true; return die(g, 'Ходуля ушла под воду!'); }
    if (surf.mat === 'spikes') return die(g, 'Наступил на шипы!');
    if (surf.y - other.y > CFG.maxRise || other.y - surf.y > CFG.maxDrop) return die(g, 'Не дотянулся до опоры');
    const spreadNow = Math.abs(f.x - other.x);
    if (spreadNow > CFG.maxSpread + CFG.wobbleMargin) return die(g, 'Ноги разъехались');
    if (nearEdge(g, f.x, f.y)) { f.slide = Math.sign((surface(g.lv, f.x - CFG.edgeSlip, g.t, f.y + 0.3).y < f.y - 0.25 ? -1 : 1)) * 0.6; g.events.push('slip'); return die(g, 'Нога соскользнула с края'); }
    attachFoot(g, f, surf);
    if (surf.mat === 'ice') f.slide = (f.x - sw.from.x) * 0.18; // на льду стопа проезжает дальше
    if (surf.mat === 'bounce') { g.events.push('bounce'); f.bounce = true; }
    g.events.push('land');
    if (spreadNow > CFG.maxSpread) { if (!g.wobbling) g.events.push('wobble'); g.wobbling = true; }
    else { g.wobbling = false; g.wobbleT = 0; }
    g.active = 1 - a;           // после постановки активной становится другая нога
    g.lastStep = { len: spreadNow, t: g.t };
    g.swing = null;
  }

  // hold-совместимость: третьим параметром можно передать { dist, up } — команду шага (для тестов)
  function step(g, dt, cmd = null) {
    g.events.length = 0;
    g.t += dt;
    for (const o of g.lv.objs) {
      if (o.type === 'seesaw') {
        let torque = -o.a * 6 - o.av * 2.5;
        for (const f of g.F) if (f.att && f.att.o === o && !f.lifted) torque += -(f.x - o.px) * 1.4 * Math.cos(o.a);
        o.av += torque * dt; o.a = Math.max(-0.26, Math.min(0.26, o.a + o.av * dt));
      }
      if (o.type === 'bridge') { const on = g.F.some((f) => f.att && f.att.o === o && !f.lifted); o.load = on ? Math.min(1, o.load + dt * 3) : Math.max(0, o.load - dt * 2); }
    }
    if (cmd && (cmd.dist !== undefined)) command(g, cmd.dist, cmd.up || 0);
    if (g.state === 'ready') { g.F.forEach((f) => followFoot(g, f, dt)); g.H = standHip(g) || g.H; updateTorso(g, dt, 0); return; }
    const playing = g.state === 'play';
    if (playing) g.time += dt;

    if (g.state === 'play') {
      const prevH = { ...g.H };
      for (const f of g.F) if (!f.lifted) followFoot(g, f, dt);
      const sw = g.swing;
      if (g.jump) {
        // прыжок: бедро летит по свободной вертикальной физике, обе ходули жёстко висят под ним
        const j = g.jump;
        j.t += dt; j.vy -= CFG.jumpGravity * dt;
        g.H = { x: g.H.x + j.vx * dt, y: g.H.y + j.vy * dt };
        g.F[0].x = g.H.x - 0.5; g.F[0].y = g.H.y - g.L;
        g.F[1].x = g.H.x + 0.5; g.F[1].y = g.H.y - g.L;
        if (j.vy <= 0) {
          const u0 = surface(g.lv, g.F[0].x, g.t, g.H.y + 0.5), u1 = surface(g.lv, g.F[1].x, g.t, g.H.y + 0.5);
          if ((u0.y > -1e8 && g.F[0].y <= u0.y) || (u1.y > -1e8 && g.F[1].y <= u1.y)) landJump(g);
        }
      } else if (sw) {
        const zone = g.lv.zones.find((z) => z.type === 'lowg' && g.H.x > z.x0 && g.H.x < z.x1);
        sw.t += dt / (zone ? 1.4 : 1);
        const s = Math.min(1, sw.t / sw.T), e = s * s * (3 - 2 * s); // плавный разгон и торможение
        const st = g.F[1 - sw.a], p = sw.plan;
        // стопа летит по дуге
        const fx = sw.from.x + (p.tx - sw.from.x) * e;
        const base = sw.from.y + (p.ty - sw.from.y) * e;
        const fy = base + sw.lift * Math.sin(Math.PI * s) * (1 + Math.abs(p.d) * 0.15);
        g.F[sw.a].x = fx; g.F[sw.a].y = fy;
        // столкновение дуги с препятствием (не в самом начале и не у цели)
        if (s > 0.12 && s < 0.88) {
          const under = surface(g.lv, fx, g.t, fy + 0.6);
          if (under.y > -1e8 && fy < under.y - 0.04 && under.mat !== 'water' && under.mat !== 'spikes') { g.events.push('bump'); return die(g, 'Нога ударилась о препятствие'); }
        }
        // тело: переносит вес — вращается вокруг опорной стопы к будущему положению (с небольшим запаздыванием)
        const Hend = hipBetween(st, { x: p.tx, y: p.ty }, g.L) || hipBetween(st, { x: st.x + Math.sign(p.d || 1) * (2 * g.L - 0.1), y: st.y }, g.L);
        const a0 = Math.atan2(sw.H0.x - st.x, sw.H0.y - st.y), a1 = Math.atan2(Hend.x - st.x, Hend.y - st.y);
        const sb = Math.max(0, Math.min(1, (s - CFG.bodyLag) / (1 - CFG.bodyLag))), eb = sb * sb * (3 - 2 * sb);
        const ang = a0 + (a1 - a0) * eb;
        g.H = { x: st.x + g.L * Math.sin(ang), y: st.y + g.L * Math.cos(ang) };
        if (s >= 1) {
          const surf = surface(g.lv, p.tx, g.t, p.ty + 0.3);
          land(g, sw, p.tx, p.ty, surf);
        }
      } else {
        // обе ноги стоят: тело жёстко между ними
        if (g.F.some((f) => f.off)) return die(g, 'Платформа развела ноги', 'Платформа уехала из-под ноги. Переходи на неё обеими ногами или шагай сразу дальше.');
        if (Math.abs(g.F[0].x - g.F[1].x) > CFG.maxSpread + CFG.wobbleMargin) return die(g, g.F.some((f) => f.att) ? 'Платформа развела ноги' : 'Ноги разъехались');
        const H = standHip(g);
        if (!H) return die(g, 'Ноги разъехались');
        g.H = H;
        // пошатывание: ноги расставлены шире нормы — есть немного времени, чтобы свести их обратно
        if (g.wobbling) {
          g.wobbleT += dt;
          if (g.wobbleT > CFG.wobbleTime) return die(g, 'Не удержал равновесие');
        }
        if (g.queue) { const q = g.queue; g.queue = null; command(g, q.dist, q.up); }
      }
      // скорость бедра — для раскачивания тела
      const vx = (g.H.x - prevH.x) / dt, vy = (g.H.y - prevH.y) / dt;
      const ax = (vx - g.hv.x) / dt; g.hv = { x: vx, y: vy };
      updateTorso(g, dt, ax);
      // стопы, стоящие на опоре, проверяем: вода, шипы, ушла ли опора
      for (const f of g.F) {
        if (f.lifted || g.state !== 'play') continue;
        const u = surface(g.lv, f.x, g.t, f.y + 0.3);
        if (u.mat === 'water' && f.y <= u.y + 0.05) { g.splash = true; return die(g, 'Ходуля ушла под воду!'); }
        if (!f.att && u.y < f.y - 0.3) return die(g, 'Нога соскользнула с края', 'Стопу утянуло с опоры. Не стой у самого края.');
      }
      // опасности: голова и тело
      const head = headPos(g), Hh = g.H;
      const hit = hazardsHit(g.lv, g.t, [{ x: head.x, y: head.y, r: 0.42 }, { x: Hh.x - Math.sin(g.ta) * 0.6, y: Hh.y + Math.cos(g.ta) * 0.6, r: 0.38 }]);
      if (hit) { g.hv.x += hit.h.type === 'rotor' ? -Math.sign(hit.h.w) * 2 : 1; return die(g, hit.why); }
      if (Hh.y < -6) return die(g, 'Нога ушла в пропасть');
      g.lv.checkpoints.forEach(([cx], k) => { if (Hh.x > cx && g.checkpoint < k) { g.checkpoint = k; g.events.push('checkpoint'); } });
      if (Hh.x >= g.lv.finish) { g.state = 'win'; g.events.push('win'); g.swing = null; }
      const sf = g.swing ? g.F[g.swing.a] : null;
      g.lv.coins.forEach(([cx, cy], k) => {
        if (g.coinsTaken.has(k)) return;
        const near = (p, rr) => p && Math.hypot(p.x - cx, p.y - cy) < rr;
        if (near(head, 0.75) || near(Hh, 0.8) || near(sf, 0.55)) { g.coinsTaken.add(k); g.coinsGot++; g.events.push('coin'); }
      });
    } else if (g.state === 'dead') {
      g.deadT += dt;
      if (Math.abs(g.th) < 1.45) { g.w += (CFG.gravity / g.Ls) * Math.sin(g.th) * dt; g.th += g.w * dt; } else { g.th = Math.sign(g.th) * 1.45; g.w = 0; }
      const under = surface(g.lv, g.P.x, g.t, g.P.y + 0.3);
      if (g.splash || under.y < g.P.y - 0.5) { g.fallV += CFG.gravity * dt; g.P.y -= g.fallV * dt * (g.splash ? 0.35 : 1); }
      g.H = { x: g.P.x + g.Ls * Math.sin(g.th), y: g.P.y + g.Ls * Math.cos(g.th) };
      updateTorso(g, dt, 0);
    } else if (g.state === 'win') { g.winT += dt; for (const f of g.F) followFoot(g, f, dt); const H = standHip(g); if (H) g.H = H; updateTorso(g, dt, 0); }
  }

  // туловище: наклоняется по ходу шага и пружинит (видно перенос веса и инерцию)
  function updateTorso(g, dt, ax) {
    let target;
    if (g.state === 'dead') target = Math.sign(g.th || 1) * -1.3;
    else {
      const sw = g.swing, st = sw ? g.F[1 - sw.a] : null;
      const leanOver = st ? Math.atan2(g.H.x - st.x, g.H.y - st.y) * 0.45 : 0;
      target = -(leanOver + g.hv.x * 0.06 * CFG.sway);
    }
    g.tw += ((target - g.ta) * 60 - g.tw * 8 - ax * 0.02 * CFG.sway) * dt;
    g.ta += g.tw * dt;
    g.ta = Math.max(-1.4, Math.min(1.4, g.ta));
  }

  function hipPos(g) { return g.H; }
  function footPos(g, i) { return g.F[i]; }
  function legAngle(g, i) { const f = g.F[i]; return Math.atan2(f.x - g.H.x, g.H.y - f.y); }
  function headPos(g) { return { x: g.H.x - Math.sin(g.ta) * 1.55, y: g.H.y + Math.cos(g.ta) * 1.55 }; }

  // ================= АВТОПИЛОТ (для заставки и проверки) =================
  // Шагает на «удобное» расстояние, ставит стопу подальше от края, перешагивает ямы и ждёт опасности.
  function danger(g, x0, x1, tAhead) {
    for (let dtk = 0; dtk <= tAhead; dtk += 0.1) for (let x = x0; x <= x1; x += 0.3) {
      const s = surface(g.lv, x, g.t + dtk).y; const y = (s > -1e8 ? s : g.H.y - g.L) + g.L;
      if (hazardsHit(g.lv, g.t + dtk, [{ x, y: y + 1.2, r: 0.6 }, { x, y: y + 0.4, r: 0.55 }])) return true;
    }
    return false;
  }
  function safeLanding(g, dist, up = 0) {
    const p = planStep(g, dist, up), st = g.F[1 - p.a];
    if (p.surf.y < -1e8 || p.surf.mat === 'water' || p.surf.mat === 'spikes') return false;
    if (p.surf.y - st.y > CFG.maxRise - 0.1 || st.y - p.surf.y > CFG.maxDrop - 0.1) return false;
    if (Math.abs(p.tx - st.x) > CFG.maxSpread - 0.2) return false;
    const tl = g.t + swingDur(p.d, up);
    if (nearEdge(g, p.tx, p.surf.y, tl) || nearEdge(g, p.tx - 0.12, p.surf.y, tl) || nearEdge(g, p.tx + 0.12, p.surf.y, tl)) return false;
    // на движущейся платформе вторая стопа не должна остаться слишком далеко: ширина после 1 секунды стояния
    const o = p.surf.obj;
    if (o && (o.type === 'plat' || o.type === 'swing')) { const a = objState(o, tl), b = objState(o, tl + 0.6); const nx = p.tx + (b.x0 - a.x0); if (Math.abs(nx - st.x) > CFG.maxSpread - 0.3) return false; if (p.tx + (b.x0 - a.x0) < b.x0 + 0.2 || p.tx + (b.x0 - a.x0) > b.x1 - 0.2) return false; }
    const pv = preview(g, dist, up); // дуга не задевает препятствия
    for (let i = 2; i < pv.pts.length - 2; i++) { const q = pv.pts[i], u = surface(g.lv, q.x, g.t, q.y + 0.6); if (u.y > -1e8 && q.y < u.y + 0.05 && u.mat !== 'water' && u.mat !== 'spikes') return false; }
    return true;
  }
  function bot(g) {
    if ((g.state !== 'play' && g.state !== 'ready') || g.swing) return null;
    g._wait = (g._wait || 0) + 1 / 60;
    if (g._wait < 0.25) return null;
    const H = g.H;
    if (danger(g, H.x - 0.5, H.x + 2.8, 1.3) && g._wait < 8) return null;
    const st = g.F[1 - g.active], other = g.F[g.active];
    // хотим, чтобы активная нога встала впереди опорной на 1.2–2.6 м
    const tries = [];
    for (let d = 2.0; d >= 0.6; d -= 0.1) tries.push(d);
    for (let d = 2.1; d <= CFG.maxSpread - 0.25; d += 0.1) tries.push(d);
    for (const up of [0, 0.4, 0.8]) for (const d of tries) {
      if (safeLanding(g, d, up)) { g._wait = 0; return { dist: d, up }; }
    }
    if (g._wait > 6) { g._wait = 0; return { dist: 1.4, up: 0.3 }; }
    void other;
    return null;
  }
  root.Phys = { CFG, WORLDS, LEVELS_PER_WORLD, GV, levelCount, genLevel, surface, objState, rockY, pistonY, createGame, step, command, jump: startJump, preview, planStep, hipPos, footPos, legAngle, headPos, bot, safeLanding };
  if (typeof module !== 'undefined') module.exports = root.Phys;
})(typeof window !== 'undefined' ? window : globalThis);
