// Рисование «Ходульщика 2»: шесть миров (фон в несколько слоёв), земля и препятствия в стиле 2.5D,
// семь персонажей с анимациями, раскраски ходуль. Всё рисуется кодом, без картинок — быстро грузится.
(function (root) {
  'use strict';
  const { surface, objState, rockY, pistonY } = root.Phys;

  // ================= ТЕМЫ МИРОВ =================
  const THEMES = {
    forest: { sky: ['#8fdcff', '#d8f6e0'], far: '#8cc9a6', mid: '#4e9a63', near: '#2f6e45', top: '#79d14f', top2: '#4ea93a', face: '#7b4f2c', face2: '#5d3a1f', deep: '#24170d', water: '#3ba3d9', sun: '#fff7c2' },
    mountains: { sky: ['#a7c8ff', '#f2e9ff'], far: '#a7a3d6', mid: '#7b7bb8', near: '#55558f', top: '#e9eef8', top2: '#bcc6dd', face: '#76727f', face2: '#5a5664', deep: '#221f2a', water: '#5b8fd9', sun: '#ffffff' },
    construction: { sky: ['#ffcf8a', '#fff1d6'], far: '#e0b07a', mid: '#b98858', near: '#8a6040', top: '#ffd34d', top2: '#e0a91e', face: '#8a8f99', face2: '#6b707a', deep: '#2a2420', water: '#4b8ad1', sun: '#fff3cf' },
    ice: { sky: ['#1d2b5a', '#5d7fc4'], far: '#4865a8', mid: '#7fa6dd', near: '#b8d8f5', top: '#f4fbff', top2: '#c9e4f7', face: '#7fb2d8', face2: '#5d8fba', deep: '#0e1a33', water: '#1f6fb5', sun: '#e8f4ff', aurora: true },
    factory: { sky: ['#3a3f4f', '#7d7461'], far: '#545866', mid: '#424653', near: '#2f323c', top: '#b9c0cc', top2: '#8a93a3', face: '#5b6170', face2: '#454a57', deep: '#15161b', water: '#4e7f6a', sun: '#ffd28a', smoke: true },
    fantasy: { sky: ['#3b1d6e', '#ff9ad5'], far: '#7a3fb0', mid: '#a855c9', near: '#5e2a8e', top: '#7cf5c6', top2: '#3fc79a', face: '#8a4fd1', face2: '#6a37aa', deep: '#1a0b33', water: '#6a6bff', sun: '#fff0ff', stars: true },
  };

  // ================= ПЕРСОНАЖИ =================
  const CHARS = [
    { id: 'novice', name: 'Новичок Сёма', price: 0, info: 'Первый раз на ходулях. Кепка задом наперёд — для удачи.', skin: '#f2c8a0', shirt: '#3fa7ff', shirt2: '#1f7fd6', pants: '#3a3f52', hat: 'cap', hatC: '#e5483a', hair: '#5a3a1a', star: true },
    { id: 'explorer', name: 'Исследователь Тим', price: 150, info: 'Прошёл джунгли пешком. Теперь пробует на ходулях.', skin: '#f2c8a0', shirt: '#c9a86a', shirt2: '#a9884a', pants: '#6b5a3a', hat: 'pith', hatC: '#e8dcb5', hair: '#6b3e1e' },
    { id: 'traveler', name: 'Путешественница Мия', price: 200, info: 'С рюкзаком и шарфом — хоть на край света.', skin: '#e9b48c', shirt: '#e85a71', shirt2: '#c43d55', pants: '#2f4f7a', hat: 'beanie', hatC: '#ffcf3f', hair: '#3a2416', pack: '#4f8a5b', scarf: '#ffcf3f' },
    { id: 'robot', name: 'Робот Болт', price: 300, info: 'Ходули ему не нужны, но он хочет как все.', skin: '#b9c6d3', shirt: '#7d8ea3', shirt2: '#5d6e83', pants: '#4a5566', hat: 'antenna', hatC: '#ff5a5a', robot: true },
    { id: 'knight', name: 'Рыцарь Гром', price: 400, info: 'Доспехи тяжёлые, зато шлем защищает от шишек.', skin: '#f0c49c', shirt: '#b8c2cf', shirt2: '#8e99a8', pants: '#5a6474', hat: 'helmet', hatC: '#c8d0da', plume: '#e5483a', cape: '#b3262f' },
    { id: 'pirate', name: 'Пиратка Рина', price: 500, info: 'Палуба качается сильнее. Её не напугать.', skin: '#d9a07a', shirt: '#f4efe6', shirt2: '#d8d0c2', pants: '#3a2f4f', hat: 'tricorn', hatC: '#2a2233', hair: '#7a2d1a', patch: true, sash: '#c0392b' },
    { id: 'builder', name: 'Строитель Петрович', price: 650, info: 'Ходули сам сколотил. Каска на месте.', skin: '#f0b98f', shirt: '#ff8a1e', shirt2: '#e06a00', pants: '#3b5b8a', hat: 'hardhat', hatC: '#ffd21f', hair: '#4a3020', vest: true, mustache: true },
    { id: 'astronaut', name: 'Космонавт Лея', price: 850, info: 'Тренирует походку для Луны.', skin: '#f2c8a0', shirt: '#f2f4f8', shirt2: '#cfd5e0', pants: '#dfe4ec', hat: 'dome', hatC: '#9fd8ff', hair: '#2a1a12', astro: true },
  ];
  const STILTS = [
    { id: 'wood', name: 'Деревянные', price: 0, c1: '#d9a24a', c2: '#a8731f', tape: '#b5482f' },
    { id: 'bamboo', name: 'Бамбук', price: 120, c1: '#9fd36a', c2: '#5f9a34', tape: '#3f6b1f', joints: true },
    { id: 'steel', name: 'Сталь', price: 250, c1: '#d6dde6', c2: '#8e99a8', tape: '#3a4250' },
    { id: 'candy', name: 'Леденец', price: 380, c1: '#ffffff', c2: '#f2c4d4', tape: '#e5483a', stripes: '#e5483a' },
    { id: 'neon', name: 'Неон', price: 550, c1: '#5ff7ff', c2: '#2a8fff', tape: '#ff4fd8', glow: true },
  ];

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, v + amt));
    return '#' + ((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0');
  }
  function hash(i, k = 1) { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

  // ================= ФОН =================
  function drawSky(ctx, V, th, t) {
    const g = ctx.createLinearGradient(0, 0, 0, V.H);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.W, V.H);
    if (th.stars || th.aurora) {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 60; i++) { const x = hash(i, 3) * V.W, y = hash(i, 4) * V.H * 0.5, s = 1 + hash(i, 5) * 1.6; ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i)); ctx.fillRect(x, y, s, s); }
      ctx.globalAlpha = 1;
    }
    if (th.aurora) {
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(${120 + k * 40},255,${200 - k * 30},.16)`; ctx.lineWidth = 26 - k * 6;
        ctx.beginPath();
        for (let x = 0; x <= V.W; x += 20) { const y = V.H * (0.16 + k * 0.05) + Math.sin(x / 140 + t * 0.4 + k) * 22; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
    }
    // солнце / луна
    const r = Math.min(V.W, V.H) * 0.07;
    const sg = ctx.createRadialGradient(V.W * 0.8, V.H * 0.15, r * 0.3, V.W * 0.8, V.H * 0.15, r * 2.4);
    sg.addColorStop(0, th.sun); sg.addColorStop(0.35, th.sun + 'aa'); sg.addColorStop(1, th.sun + '00');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(V.W * 0.8, V.H * 0.15, r * 2.4, 0, 7); ctx.fill();
  }

  function ridge(ctx, V, k, baseY, amp, col, per, seed) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, V.H);
    const off = V.cam.x * V.PPM * k;
    for (let px = -20; px <= V.W + 20; px += 16) {
      const wx = (px + off) / per;
      ctx.lineTo(px, baseY - (Math.sin(wx + seed) * 0.5 + Math.sin(wx * 2.3 + 1 + seed) * 0.25 + Math.sin(wx * 0.37 + 2) * 0.55) * amp);
    }
    ctx.lineTo(V.W, V.H); ctx.fill();
  }

  function drawBackground(ctx, V, theme, t) {
    const th = THEMES[theme];
    drawSky(ctx, V, th, t);
    const hz = V.H * 0.52 - (V.cam.y - 2) * V.PPM * 0.08;
    if (theme === 'mountains') {
      ridge(ctx, V, 0.05, hz - V.H * 0.12, V.H * 0.2, th.far, 120, 1);
      // снежные шапки
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ridge(ctx, V, 0.05, hz - V.H * 0.2, V.H * 0.1, 'rgba(255,255,255,.35)', 120, 1);
      ridge(ctx, V, 0.12, hz, V.H * 0.12, th.mid, 90, 3);
    } else ridge(ctx, V, 0.06, hz - V.H * 0.04, V.H * 0.09, th.far, 150, 0);
    const k2 = 0.22, per = 80, s0 = Math.floor((V.cam.x * V.PPM * k2) / per) - 1;
    for (let i = s0; i < s0 + Math.ceil(V.W / per) + 3; i++) {
      const x = i * per - V.cam.x * V.PPM * k2 + hash(i) * 30, h = V.H * (0.18 + hash(i, 2) * 0.14), base = hz + V.H * 0.08;
      if (theme === 'forest' || theme === 'mountains') pine(ctx, x, base, h * 0.5, h, th.mid, theme === 'mountains');
      else if (theme === 'construction') { ctx.fillStyle = th.mid; ctx.fillRect(x - 22, base - h * 1.2, 44 + hash(i, 3) * 30, h * 2); ctx.fillStyle = 'rgba(255,240,200,.35)'; for (let w = 0; w < 6; w++) ctx.fillRect(x - 14 + (w % 2) * 18, base - h * 1.1 + Math.floor(w / 2) * 22, 9, 12); }
      else if (theme === 'ice') { ctx.fillStyle = th.mid; ctx.beginPath(); ctx.moveTo(x - 40, base); ctx.lineTo(x - 10, base - h); ctx.lineTo(x + 18, base - h * 0.7); ctx.lineTo(x + 46, base); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(x - 10, base - h); ctx.lineTo(x + 2, base - h * 0.4); ctx.lineTo(x - 22, base - h * 0.5); ctx.fill(); }
      else if (theme === 'factory') { ctx.fillStyle = th.mid; ctx.fillRect(x - 30, base - h, 60, h * 2); if (hash(i, 6) > 0.5) { ctx.fillRect(x + 8, base - h * 1.6, 14, h); } }
      else { ctx.fillStyle = th.mid; ctx.beginPath(); ctx.ellipse(x, base - h * 0.9, 40 + hash(i, 7) * 20, 16, 0, 0, 7); ctx.fill(); ctx.fillRect(x - 5, base - h * 0.9, 10, h); ctx.fillStyle = 'rgba(255,255,255,.25)'; for (let d = 0; d < 3; d++) { ctx.beginPath(); ctx.arc(x - 18 + d * 16, base - h * 0.95, 4, 0, 7); ctx.fill(); } }
    }
    ctx.fillStyle = th.mid; ctx.fillRect(0, hz + V.H * 0.08 - 1, V.W, V.H);
    // ближний слой
    const k3 = 0.5, per3 = 260, s3 = Math.floor((V.cam.x * V.PPM * k3) / per3) - 1;
    for (let i = s3; i < s3 + Math.ceil(V.W / per3) + 3; i++) {
      if (hash(i, 9) < 0.4) continue;
      const x = i * per3 - V.cam.x * V.PPM * k3 + hash(i, 4) * 90, w = 30 + hash(i, 5) * 30;
      if (theme === 'forest') {
        const gr = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, '#5b3a24'); gr.addColorStop(0.5, '#7a5134'); gr.addColorStop(1, '#4a2e1c');
        ctx.fillStyle = gr; ctx.fillRect(x - w / 2, -10, w, V.H); ctx.fillStyle = th.near; ctx.beginPath(); ctx.ellipse(x, 0, w * 2.4, V.H * 0.13, 0, 0, 7); ctx.fill();
      } else if (theme === 'construction') { // кран
        ctx.strokeStyle = '#e0a91e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, V.H); ctx.lineTo(x, V.H * 0.12); ctx.lineTo(x + 200, V.H * 0.12); ctx.moveTo(x - 60, V.H * 0.12); ctx.lineTo(x, V.H * 0.12); ctx.stroke();
        ctx.lineWidth = 2; for (let y = V.H * 0.14; y < V.H; y += 26) { ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y + 13); ctx.stroke(); }
        ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(x + 150, V.H * 0.12); ctx.lineTo(x + 150, V.H * 0.3 + Math.sin(t + i) * 10); ctx.stroke();
      } else if (theme === 'factory') { // трубы и шестерни
        ctx.fillStyle = th.near; ctx.fillRect(x - 18, V.H * 0.1, 36, V.H); ctx.fillStyle = '#6d5a3a'; ctx.fillRect(x - 22, V.H * 0.1, 44, 10);
        gear(ctx, x + 80, V.H * 0.35, 34, t * (i % 2 ? 0.6 : -0.6), '#3a3d47');
        if (th.smoke) { ctx.fillStyle = 'rgba(200,200,200,.18)'; for (let p = 0; p < 4; p++) { const u = (t * 0.3 + p / 4 + i * 0.1) % 1; ctx.beginPath(); ctx.arc(x + Math.sin(u * 6) * 10, V.H * 0.1 - u * 120, 10 + u * 26, 0, 7); ctx.fill(); } }
      } else if (theme === 'fantasy') { // летающие острова
        const y = V.H * (0.22 + hash(i, 8) * 0.15) + Math.sin(t * 0.8 + i) * 8;
        ctx.fillStyle = th.near; ctx.beginPath(); ctx.ellipse(x, y, 70, 18, 0, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 60, y); ctx.lineTo(x, y + 60); ctx.lineTo(x + 60, y); ctx.fill();
        ctx.fillStyle = th.top; ctx.beginPath(); ctx.ellipse(x, y, 70, 10, 0, Math.PI, 0); ctx.fill();
      } else if (theme === 'ice') { ctx.fillStyle = 'rgba(220,240,255,.5)'; ctx.beginPath(); ctx.moveTo(x - 60, V.H); ctx.lineTo(x - 20, V.H * 0.45); ctx.lineTo(x + 30, V.H * 0.55); ctx.lineTo(x + 70, V.H); ctx.fill(); }
      else if (theme === 'mountains') { ctx.fillStyle = th.near; ctx.beginPath(); ctx.moveTo(x - 120, V.H); ctx.lineTo(x, V.H * 0.48); ctx.lineTo(x + 120, V.H); ctx.fill(); }
    }
  }
  function pine(ctx, x, y, w, h, col, snowy) {
    ctx.fillStyle = col; ctx.fillRect(x - w * 0.05, y - h * 0.25, w * 0.1, h * 0.25);
    for (let i = 0; i < 4; i++) {
      const ty = y - h * (0.25 + i * 0.2), tw = w * (1 - i * 0.2);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - tw / 2, ty + h * 0.22); ctx.lineTo(x, ty - h * 0.18); ctx.lineTo(x + tw / 2, ty + h * 0.22); ctx.fill();
      if (snowy) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(x - tw * 0.2, ty); ctx.lineTo(x, ty - h * 0.18); ctx.lineTo(x + tw * 0.2, ty); ctx.fill(); }
    }
  }
  function gear(ctx, x, y, r, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col;
    for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.fillRect(-r * 0.14, -r * 1.2, r * 0.28, r * 0.4); }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ================= ЗЕМЛЯ И ПРЕДМЕТЫ =================
  const DEPTH = 0.32; // «толщина» верхней грани для эффекта объёма, м
  function drawLevel(ctx, V, g, theme, t) {
    const th = THEMES[theme], lv = g.lv, P = V.PPM, sx = V.sx, sy = V.sy;
    const visible = (a, b) => Math.max(a, b) > -60 && Math.min(a, b) < V.W + 60;
    // вода и шипы на дне ям
    for (const [x1, y1, x2, y2, mat] of lv.segs) {
      if (mat !== 'water' && mat !== 'spikes') continue;
      const a = sx(x1), b = sx(x2); if (!visible(a, b)) continue;
      ctx.fillStyle = th.deep; ctx.fillRect(a, sy(y1 + 4), b - a, V.H);
      if (mat === 'water') {
        const wy = sy(y1);
        const wg = ctx.createLinearGradient(0, wy, 0, wy + P * 2); wg.addColorStop(0, th.water); wg.addColorStop(1, shade(th.water, -60));
        ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(a, V.H);
        for (let x = a; x <= b; x += 8) ctx.lineTo(x, wy + Math.sin(x / 14 + t * 3) * 3);
        ctx.lineTo(b, V.H); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let x = a; x <= b; x += 8) { const yy = wy + Math.sin(x / 14 + t * 3) * 3; x === a ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
        ctx.stroke();
      } else {
        const n = Math.max(3, Math.round((x2 - x1) / 0.28)), w = (b - a) / n, base = sy(y1);
        for (let i = 0; i < n; i++) { const xx = a + i * w; ctx.fillStyle = '#d9dee6'; ctx.beginPath(); ctx.moveTo(xx, base); ctx.lineTo(xx + w / 2, base - P * 0.55); ctx.lineTo(xx + w, base); ctx.fill(); ctx.fillStyle = '#8a929e'; ctx.beginPath(); ctx.moveTo(xx + w / 2, base - P * 0.55); ctx.lineTo(xx + w, base); ctx.lineTo(xx + w * 0.62, base); ctx.fill(); }
      }
    }
    // стенки ям и уступов
    for (const [x1, y1, x2, y2, mat] of lv.segs) {
      if (mat !== 'wall') continue;
      const a = sx(x1); if (a < -40 || a > V.W + 40) continue;
      ctx.fillStyle = th.face2; ctx.fillRect(a - 3, sy(Math.max(y1, y2)), 6, Math.abs(y2 - y1) * P);
    }
    // земля: передняя грань + верхняя грань с толщиной
    for (const [x1, y1, x2, y2, mat] of lv.segs) {
      if (x1 === x2 || mat === 'wall' || mat === 'water' || mat === 'spikes') continue;
      const a = sx(x1), b = sx(x2), ya = sy(y1), yb = sy(y2); if (!visible(a, b)) continue;
      ctx.fillStyle = th.face;
      ctx.beginPath(); ctx.moveTo(a, ya); ctx.lineTo(b, yb); ctx.lineTo(b, V.H + 10); ctx.lineTo(a, V.H + 10); ctx.fill();
      ctx.strokeStyle = th.face2; ctx.lineWidth = 3;
      for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(a, ya + k * P * 0.6); ctx.lineTo(b, yb + k * P * 0.6); ctx.stroke(); }
      let top = th.top, top2 = th.top2;
      if (mat === 'ice') { top = '#e8fbff'; top2 = '#9fdcf5'; }
      if (mat === 'bounce') { top = '#ff6fb5'; top2 = '#d63f8a'; }
      const isConv = typeof mat === 'string' && mat.startsWith('conv:');
      if (isConv) { top = '#3a3f4a'; top2 = '#22252c'; }
      const d = DEPTH * P;
      ctx.fillStyle = top2; ctx.beginPath(); ctx.moveTo(a, ya); ctx.lineTo(b, yb); ctx.lineTo(b, yb + d * 0.45); ctx.lineTo(a, ya + d * 0.45); ctx.fill();
      ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(a, ya - d * 0.55); ctx.lineTo(b, yb - d * 0.55); ctx.lineTo(b, yb); ctx.lineTo(a, ya); ctx.fill();
      if (isConv) {
        const sp = parseFloat(mat.slice(5)), step = P * 0.5, off = ((t * sp * P) % step + step) % step;
        ctx.strokeStyle = '#ffcf3f'; ctx.lineWidth = 3;
        for (let x = a + off - step; x < b; x += step) { if (x < a) continue; ctx.beginPath(); const m = sp > 0 ? 1 : -1; ctx.moveTo(x, ya - d * 0.42); ctx.lineTo(x + m * 8, ya - d * 0.22); ctx.lineTo(x, ya - d * 0.02); ctx.stroke(); }
      }
      if (mat === 'bounce') { for (let x = a + 10; x < b; x += 24) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, ya - d * 0.3, 4, 0, 7); ctx.fill(); } }
      if (mat === 'ice') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; for (let x = a + 14; x < b - 30; x += 70) { ctx.beginPath(); ctx.moveTo(x, ya - d * 0.3); ctx.lineTo(x + 24, ya - d * 0.3); ctx.stroke(); } }
      if (theme === 'forest' && mat === 'ground') { ctx.fillStyle = th.top2; for (let x = a; x < b; x += 14) { const h = 4 + hash(Math.floor((x - a + V.cam.x * P) / 14), 2) * 6; ctx.fillRect(x, ya - d * 0.55 - h, 2, h); } }
    }
    // предметы
    for (const o of lv.objs) drawObj(ctx, V, o, g, th, theme, t);
    // зоны низкой гравитации
    for (const z of lv.zones) {
      const a = sx(z.x0), b = sx(z.x1); if (!visible(a, b)) continue;
      const zg = ctx.createLinearGradient(0, 0, 0, V.H); zg.addColorStop(0, 'rgba(160,120,255,0)'); zg.addColorStop(1, 'rgba(160,120,255,.22)');
      ctx.fillStyle = zg; ctx.fillRect(a, 0, b - a, V.H);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 14; i++) { const x = a + hash(i, 11) * (b - a), y = V.H - ((t * 40 + hash(i, 12) * V.H) % V.H); ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
    }
  }

  function drawObj(ctx, V, o, g, th, theme, t) {
    const P = V.PPM, sx = V.sx, sy = V.sy;
    if (o.type === 'log') {
      const x = sx(o.cx), y = sy(o.cy), r = o.r * P;
      if (x < -r * 2 || x > V.W + r * 2) return;
      ctx.fillStyle = '#7a4a26'; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#e0b07a'; ctx.beginPath(); ctx.ellipse(x - r * 0.15, y - r * 0.05, r * 0.85, r * 0.85, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#a8743f'; ctx.lineWidth = 2; for (const k of [0.6, 0.35]) { ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.05, r * k, Math.PI, 0); ctx.stroke(); }
      return;
    }
    if (o.type === 'bridge') {
      const a = sx(o.x0), b = sx(o.x1); if (b < -40 || a > V.W + 40) return;
      const n = Math.max(6, Math.round((o.x1 - o.x0) / 0.35));
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const x = o.x0 + (o.x1 - o.x0) * (i / n), y = surface(g.lv, x, g.t, o.y0 + 0.1).y; i ? ctx.lineTo(sx(x), sy(y + 1.1)) : ctx.moveTo(sx(x), sy(y + 1.1)); }
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const x = o.x0 + (o.x1 - o.x0) * ((i + 0.5) / n), y = surface(g.lv, x, g.t, o.y0 + 0.1).y;
        ctx.fillStyle = i % 2 ? '#b07a42' : '#c48a4c'; rr(ctx, sx(x) - (P * (o.x1 - o.x0)) / n / 2 + 1, sy(y), (P * (o.x1 - o.x0)) / n - 2, P * 0.16, 2); ctx.fill();
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx(x), sy(y)); ctx.lineTo(sx(x), sy(y + 1.1)); ctx.stroke();
      }
      return;
    }
    if (o.type === 'seesaw') {
      const x = sx(o.px), y = sy(o.py); if (x < -P * 3 || x > V.W + P * 3) return;
      ctx.fillStyle = '#6b707a'; ctx.beginPath(); ctx.moveTo(x - P * 0.4, sy(o.py - 4)); ctx.lineTo(x, y); ctx.lineTo(x + P * 0.4, sy(o.py - 4)); ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(-o.a);
      ctx.fillStyle = theme === 'fantasy' ? '#ffd166' : '#c9873f'; rr(ctx, -o.hl * P, -P * 0.12, o.hl * 2 * P, P * 0.22, 6); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-o.hl * P, P * 0.04, o.hl * 2 * P, P * 0.06);
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, P * 0.12, 0, 7); ctx.fill();
      ctx.restore(); return;
    }
    if (o.type === 'swing') {
      const st = objState(o, g.t), a = sx(st.x0), b = sx(st.x1), y = sy(st.y), px = sx(o.px), py = sy(o.py);
      if (b < -40 || a > V.W + 40) return;
      ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(a + 6, y); ctx.moveTo(px, py); ctx.lineTo(b - 6, y); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill();
      box(ctx, a, y, b - a, P * 0.28, '#c48a4c', '#9a6430', P); return;
    }
    // платформы
    const st = objState(o, g.t), a = sx(st.x0), b = sx(st.x1), y = sy(st.y); if (b < -40 || a > V.W + 40) return;
    if (o.look === 'post') {
      ctx.fillStyle = th.face2; ctx.fillRect(a + 4, y, b - a - 8, V.H);
      box(ctx, a, y, b - a, P * 0.3, th.top, th.face, P);
    } else if (o.look === 'floe') {
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse((a + b) / 2, y + P * 0.35, (b - a) / 2, P * 0.1, 0, 0, 7); ctx.fill();
      box(ctx, a, y, b - a, P * 0.35, '#f4fbff', '#9fd0ee', P);
    } else if (o.look === 'lift') {
      ctx.strokeStyle = '#2a2d35'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a + 8, y); ctx.lineTo(a + 8, -10); ctx.moveTo(b - 8, y); ctx.lineTo(b - 8, -10); ctx.stroke();
      box(ctx, a, y, b - a, P * 0.3, '#ffcf3f', '#b88a12', P);
      ctx.fillStyle = '#222'; for (let x = a + 6; x < b - 10; x += 18) { ctx.beginPath(); ctx.moveTo(x, y + P * 0.3); ctx.lineTo(x + 9, y); ctx.lineTo(x + 15, y); ctx.lineTo(x + 6, y + P * 0.3); ctx.fill(); }
    } else {
      const c1 = theme === 'construction' ? '#c98d4a' : theme === 'fantasy' ? '#7cf5c6' : '#9aa3b2', c2 = theme === 'construction' ? '#8a5a2a' : theme === 'fantasy' ? '#3fc79a' : '#6b7383';
      box(ctx, a, y, b - a, P * 0.32, c1, c2, P);
      if (theme === 'fantasy') { ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(a + (b - a) * (0.25 + i * 0.25), y + P * 0.5 + Math.sin(t * 4 + i) * 4, 3, 0, 7); ctx.fill(); } }
    }
  }
  function box(ctx, x, y, w, h, top, face, P) {
    const d = DEPTH * P * 0.55;
    ctx.fillStyle = face; rr(ctx, x, y, w, h, 4); ctx.fill();
    ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 4, y - d); ctx.lineTo(x + 4, y - d); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 3, y + 2, w - 6, 3);
  }

  function drawHazards(ctx, V, g, t) {
    const P = V.PPM, sx = V.sx, sy = V.sy;
    for (const h of g.lv.haz) {
      if (h.type === 'rotor') {
        const x = sx(h.cx), y = sy(h.cy); if (x < -P * 3 || x > V.W + P * 3) continue;
        ctx.strokeStyle = '#2a2d35'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, -10); ctx.stroke();
        const a = h.w * g.t;
        for (const k of [0, Math.PI]) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(-(a + k));
          ctx.fillStyle = 'rgba(255,80,80,.18)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, h.len * P, -0.35 * Math.sign(h.w), 0, h.w < 0); ctx.fill();
          ctx.fillStyle = '#d9dee6'; rr(ctx, 0, -P * 0.1, h.len * P, P * 0.2, 6); ctx.fill();
          ctx.fillStyle = '#e5483a'; ctx.fillRect(h.len * P * 0.7, -P * 0.1, h.len * P * 0.3, P * 0.2);
          ctx.restore();
        }
        ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(x, y, P * 0.18, 0, 7); ctx.fill();
      } else if (h.type === 'rock') {
        const x = sx(h.x); if (x < -60 || x > V.W + 60) continue;
        const ry = rockY(h, g.t);
        // тень-предупреждение на земле
        const u = ((g.t + h.ph) % h.per) / h.per;
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.35 * (ry !== null ? Math.max(0, 1 - (ry - h.ground) / 9) : 0)})`;
        ctx.beginPath(); ctx.ellipse(x, sy(h.ground), P * (0.2 + 0.3 * u), P * 0.08, 0, 0, 7); ctx.fill();
        if (ry !== null) {
          ctx.save(); ctx.translate(x, sy(ry)); ctx.rotate(g.t * 3);
          ctx.fillStyle = '#8a7a6a'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = h.r * P * (0.85 + hash(i, 5) * 0.3); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(-h.r * P * 0.3, -h.r * P * 0.3, h.r * P * 0.3, 0, 7); ctx.fill();
          ctx.restore();
        }
      } else if (h.type === 'piston') {
        const a = sx(h.x0), b = sx(h.x0 + h.w); if (b < -40 || a > V.W + 40) continue;
        const by = sy(pistonY(h, g.t));
        ctx.fillStyle = '#5b6170'; ctx.fillRect((a + b) / 2 - P * 0.15, -10, P * 0.3, by + 10);
        ctx.fillStyle = '#3a3d47'; rr(ctx, a, by - P * 0.9, b - a, P * 0.9, 6); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.rect(a, by - P * 0.25, b - a, P * 0.25); ctx.clip();
        for (let x = a - 20; x < b; x += 16) { ctx.fillStyle = (Math.floor((x - a) / 16) % 2) ? '#ffcf3f' : '#222'; ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + 8, by - P * 0.25); ctx.lineTo(x + 16, by - P * 0.25); ctx.lineTo(x + 8, by); ctx.fill(); }
        ctx.restore();
      }
    }
  }

  function drawFlags(ctx, V, g, t) {
    const P = V.PPM, sx = V.sx, sy = V.sy, lv = g.lv;
    lv.checkpoints.forEach(([cx, cy], k) => {
      const x = sx(cx), y = sy(cy); if (x < -60 || x > V.W + 60) return;
      ctx.fillStyle = '#ddd'; ctx.fillRect(x - 2, y - P * 2.4, 4, P * 2.4);
      ctx.fillStyle = g.checkpoint >= k ? '#3fbf5a' : '#9aa3b2';
      ctx.beginPath(); ctx.moveTo(x + 2, y - P * 2.4); ctx.quadraticCurveTo(x + P * 0.5, y - P * 2.2 + Math.sin(t * 5) * 4, x + P * 0.9, y - P * 2.1); ctx.lineTo(x + 2, y - P * 1.8); ctx.fill();
    });
    const fx = sx(lv.finish), fy = sy(lv.finishY);
    if (fx > -200 && fx < V.W + 300) {
      ctx.fillStyle = '#e8e2d0'; ctx.fillRect(fx - P * 0.1, fy - P * 4.4, P * 0.2, P * 4.4); ctx.fillRect(fx + P * 2.9, fy - P * 4.4, P * 0.2, P * 4.4);
      const sq = P * 0.3;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) { ctx.fillStyle = (r + c) % 2 ? '#222' : '#fff'; ctx.fillRect(fx + c * sq, fy - P * 4.4 + r * sq + Math.sin(t * 4 + c * 0.6) * 2, sq + 0.5, sq + 0.5); }
      for (let c = 0; c < 10; c++) { ctx.fillStyle = c % 2 ? '#222' : '#ffcf3f'; ctx.fillRect(fx + c * sq, fy - 3, sq, 6); }
    }
  }

  function drawCoins(ctx, V, g, t) {
    const P = V.PPM;
    g.lv.coins.forEach(([cx, cy], i) => {
      if (g.coinsTaken.has(i)) return;
      const x = V.sx(cx), y = V.sy(cy) + Math.sin(t * 3 + i) * 4; if (x < -30 || x > V.W + 30) return;
      const r = P * 0.26, k = Math.abs(Math.cos(t * 2.5 + i));
      ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.12, k), 1);
      ctx.fillStyle = '#c47a0a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.22, 0, 7); ctx.fill();
      ctx.restore();
    });
  }

  // ================= ПЕРСОНАЖ =================
  // pose: { hx, hy (экран), ta (наклон туловища, физ. угол), a: [угол левой, правой], L: [длины], mood, t, walk }
  function drawStilt(ctx, hx, hy, a, L, u, sk, front, highlight) {
    const dx = Math.sin(a), dy = Math.cos(a);
    const top = 0.6, x1 = hx - dx * top * u, y1 = hy - dy * top * u, x2 = hx + dx * L * u, y2 = hy + dy * L * u, w = u * 0.12;
    ctx.lineCap = 'round';
    if (sk.glow) { ctx.shadowColor = sk.c1; ctx.shadowBlur = 14; }
    ctx.strokeStyle = shade(sk.c2, -30); ctx.lineWidth = w + 4; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = front ? sk.c1 : shade(sk.c1, -25); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0;
    if (sk.stripes) { ctx.strokeStyle = sk.stripes; ctx.lineWidth = w; for (let k = 0.05; k < 1; k += 0.12) { const px = hx + dx * L * k * u, py = hy + dy * L * k * u; ctx.beginPath(); ctx.moveTo(px - dx * 3, py - dy * 3); ctx.lineTo(px + dx * 3, py + dy * 3); ctx.stroke(); } }
    if (sk.joints) { ctx.strokeStyle = sk.c2; ctx.lineWidth = w + 3; for (let k = 0.2; k < 1; k += 0.25) { const px = hx + dx * L * k * u, py = hy + dy * L * k * u; ctx.beginPath(); ctx.moveTo(px - dx * 1.5, py - dy * 1.5); ctx.lineTo(px + dx * 1.5, py + dy * 1.5); ctx.stroke(); } }
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = w * 0.25; ctx.beginPath(); ctx.moveTo(x1 - w * 0.2, y1); ctx.lineTo(x2 - w * 0.2, y2); ctx.stroke();
    ctx.strokeStyle = highlight || sk.tape; ctx.lineWidth = w + 3;
    for (const k of [0.45, 0.8]) { const px = hx + dx * L * k * u, py = hy + dy * L * k * u; ctx.beginPath(); ctx.moveTo(px - dx * 5, py - dy * 5); ctx.lineTo(px + dx * 5, py + dy * 5); ctx.stroke(); }
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(x2, y2, w * 0.95, w * 0.55, -a, 0, 7); ctx.fill();
    return { gx: hx - dx * 0.4 * u, gy: hy - dy * 0.4 * u, fx: x2, fy: y2 };
  }

  function drawHead(ctx, ch, r, t, mood) {
    const blink = (t % 3.4) < 0.12 && mood !== 'dead';
    if (ch.robot) {
      ctx.fillStyle = ch.skin; rr(ctx, -r, -r * 0.9, r * 2, r * 1.8, r * 0.35); ctx.fill();
      ctx.fillStyle = '#1b2430'; rr(ctx, -r * 0.7, -r * 0.45, r * 1.6, r * 0.6, r * 0.25); ctx.fill();
      ctx.fillStyle = mood === 'dead' ? '#ff4a4a' : '#5ff7ff';
      if (mood === 'dead') { ctx.font = `900 ${r * 0.55}px Rubik,sans-serif`; ctx.fillText('x  x', -r * 0.55, -r * 0.02); }
      else for (const ex of [-0.25, 0.4]) { ctx.beginPath(); ctx.arc(ex * r, -r * 0.15, r * (blink ? 0.04 : 0.14), 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#555'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, -r * 1.35); ctx.stroke();
      ctx.fillStyle = Math.sin(t * 7) > 0 ? ch.hatC : '#ffcf3f'; ctx.beginPath(); ctx.arc(0, -r * 1.42, r * 0.15, 0, 7); ctx.fill();
      ctx.fillStyle = '#5d6e83'; ctx.fillRect(-r * 0.5, r * 0.35, r * 1.2, r * 0.12);
      return;
    }
    if (ch.astro) { ctx.fillStyle = 'rgba(159,216,255,.35)'; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.35, 0, 7); ctx.fill(); ctx.strokeStyle = '#dfe4ec'; ctx.lineWidth = r * 0.16; ctx.stroke(); }
    // волосы сзади
    if (ch.hair && ch.hat !== 'helmet') { ctx.fillStyle = ch.hair; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.1, r * 1.02, Math.PI * 0.6, Math.PI * 1.9); ctx.fill(); }
    // лицо
    const hg = ctx.createRadialGradient(r * 0.2, -r * 0.3, r * 0.2, 0, 0, r * 1.1); hg.addColorStop(0, shade(ch.skin, 18)); hg.addColorStop(1, ch.skin);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    // ухо
    ctx.fillStyle = shade(ch.skin, -15); ctx.beginPath(); ctx.ellipse(-r * 0.25, r * 0.05, r * 0.16, r * 0.22, 0, 0, 7); ctx.fill();
    // глаза
    for (const ex of [0.28, 0.72]) {
      const x = ex * r, y = -r * 0.12;
      if (ch.patch && ex > 0.5) { ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, 7); ctx.fill(); ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.5); ctx.lineTo(r * 0.95, -r * 0.2); ctx.stroke(); continue; }
      if (mood === 'dead') { ctx.strokeStyle = '#222'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(x - r * 0.1, y - r * 0.1); ctx.lineTo(x + r * 0.1, y + r * 0.1); ctx.moveTo(x + r * 0.1, y - r * 0.1); ctx.lineTo(x - r * 0.1, y + r * 0.1); ctx.stroke(); continue; }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.15, blink ? r * 0.02 : r * 0.18, 0, 0, 7); ctx.fill();
      if (!blink) { ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(x + r * 0.04, y + (mood === 'win' ? -r * 0.04 : 0), r * 0.09, 0, 7); ctx.fill(); }
    }
    // брови при страхе
    if (mood === 'scared') { ctx.strokeStyle = '#3a2416'; ctx.lineWidth = r * 0.07; for (const ex of [0.28, 0.72]) { ctx.beginPath(); ctx.moveTo(ex * r - r * 0.13, -r * 0.42); ctx.lineTo(ex * r + r * 0.12, -r * 0.36); ctx.stroke(); } }
    // нос и рот
    ctx.fillStyle = shade(ch.skin, -25); ctx.beginPath(); ctx.ellipse(r * 0.85, r * 0.12, r * 0.13, r * 0.1, 0, 0, 7); ctx.fill();
    if (ch.mustache) { ctx.fillStyle = ch.hair; ctx.beginPath(); ctx.ellipse(r * 0.62, r * 0.32, r * 0.3, r * 0.1, 0.1, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#6b2a1a'; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round'; ctx.beginPath();
    if (mood === 'win') { ctx.fillStyle = '#6b2a1a'; ctx.arc(r * 0.5, r * 0.4, r * 0.22, 0, Math.PI); ctx.fill(); }
    else if (mood === 'dead' || mood === 'sad') ctx.arc(r * 0.5, r * 0.62, r * 0.18, Math.PI * 1.15, Math.PI * 1.85);
    else if (mood === 'scared') ctx.ellipse(r * 0.5, r * 0.45, r * 0.09, r * 0.13, 0, 0, 7);
    else ctx.arc(r * 0.5, r * 0.32, r * 0.2, 0.3, Math.PI - 0.5);
    ctx.stroke();
    if (mood === 'sad') { ctx.fillStyle = '#7fd3ff'; ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.15 + ((t * 30) % 10), r * 0.06, r * 0.1, 0, 0, 7); ctx.fill(); }
    // головные уборы
    const hc = ch.hatC;
    if (ch.hat === 'pith') { ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 1.35, r * 0.25, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, -r * 0.6, r * 0.85, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-r * 0.85, -r * 0.72, r * 1.7, r * 0.14); }
    if (ch.hat === 'cap') { ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.95, Math.PI, 0); ctx.fill(); ctx.fillRect(-r * 1.45, -r * 0.5, r * 0.75, r * 0.16); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -r * 0.9, r * 0.16, 0, 7); ctx.fill(); }
    if (ch.hat === 'beanie') { ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.98, Math.PI, 0); ctx.fill(); ctx.fillStyle = shade(hc, -30); ctx.fillRect(-r, -r * 0.45, r * 2, r * 0.22); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -r * 1.35, r * 0.22, 0, 7); ctx.fill(); }
    if (ch.hat === 'helmet') { ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 1.08, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); ctx.fillStyle = shade(hc, -35); ctx.fillRect(r * 0.05, -r * 0.3, r * 1.05, r * 0.12); ctx.fillStyle = ch.plume; ctx.beginPath(); ctx.ellipse(-r * 0.5, -r * 1.25, r * 0.6, r * 0.22, -0.6 + Math.sin(t * 6) * 0.1, 0, 7); ctx.fill(); }
    if (ch.hat === 'tricorn') { ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(-r * 1.3, -r * 0.45); ctx.quadraticCurveTo(0, -r * 1.8, r * 1.3, -r * 0.45); ctx.quadraticCurveTo(0, -r * 0.75, -r * 1.3, -r * 0.45); ctx.fill(); ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); ctx.arc(0, -r * 1.0, r * 0.14, 0, 7); ctx.fill(); }
    if (ch.hat === 'hardhat') { ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.95, Math.PI, 0); ctx.fill(); ctx.fillRect(-r * 1.15, -r * 0.42, r * 2.4, r * 0.18); ctx.fillStyle = shade(hc, -25); ctx.fillRect(-r * 0.1, -r * 1.25, r * 0.2, r * 0.9); }
    if (ch.hat === 'dome') { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(r * 0.4, -r * 0.7, r * 0.25, r * 0.12, -0.5, 0, 7); ctx.fill(); }
  }

  function drawCharacter(ctx, ch, sk, pose, u) {
    const { hx, hy, ta, t } = pose, mood = pose.mood || 'idle';
    const a0 = pose.a[0], a1 = pose.a[1], L0 = pose.L[0], L1 = pose.L[1];
    // ноги персонажа пристёгнуты к ходулям
    const leg = (a, c) => {
      ctx.strokeStyle = c; ctx.lineWidth = u * 0.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.sin(a) * u * 0.72, hy + Math.cos(a) * u * 0.72); ctx.stroke();
      ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(hx + Math.sin(a) * u * 0.78, hy + Math.cos(a) * u * 0.78, u * 0.12, 0, 7); ctx.fill();
    };
    const lc = pose.legCol || [null, null], hd = pose.held || [false, false];
    const back = drawStilt(ctx, hx, hy, a0, L0, u, sk, false, lc[0] ? (hd[0] ? '#9fd0ff' : lc[0]) : null);
    leg(a0, shade(ch.pants, -20));
    // тело
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-ta);
    const bob = mood === 'idle' ? Math.sin(t * 2.2) * u * 0.02 : 0;
    ctx.translate(0, bob);
    const sway = Math.sin(t * 6) * 0.12 + (pose.speed || 0) * 0.35;
    if (ch.cape) { ctx.save(); ctx.translate(-u * 0.2, -u * 1.0); ctx.rotate(0.15 + sway); ctx.fillStyle = ch.cape; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-u * 0.5, u * 0.5, -u * 0.35 - Math.sin(t * 9) * u * 0.06, u * 1.0); ctx.lineTo(u * 0.25, u * 0.95); ctx.lineTo(u * 0.3, 0); ctx.fill(); ctx.restore(); }
    if (ch.pack) { ctx.fillStyle = ch.pack; rr(ctx, -u * 0.55, -u * 1.0, u * 0.32, u * 0.62, u * 0.1); ctx.fill(); ctx.fillStyle = shade(ch.pack, -25); ctx.fillRect(-u * 0.55, -u * 0.72, u * 0.32, u * 0.06); }
    ctx.fillStyle = ch.pants; rr(ctx, -u * 0.28, -u * 0.3, u * 0.56, u * 0.42, u * 0.12); ctx.fill();
    const bg = ctx.createLinearGradient(-u * 0.3, 0, u * 0.3, 0); bg.addColorStop(0, ch.shirt2); bg.addColorStop(0.55, ch.shirt); bg.addColorStop(1, ch.shirt2);
    ctx.fillStyle = bg; rr(ctx, -u * 0.3, -u * 1.05, u * 0.6, u * 0.82, u * 0.22); ctx.fill();
    if (ch.vest) { ctx.fillStyle = '#d9ff3f'; ctx.fillRect(-u * 0.3, -u * 0.62, u * 0.6, u * 0.08); ctx.fillRect(-u * 0.3, -u * 0.42, u * 0.6, u * 0.08); }
    if (ch.sash) { ctx.fillStyle = ch.sash; ctx.fillRect(-u * 0.3, -u * 0.35, u * 0.6, u * 0.1); ctx.save(); ctx.translate(-u * 0.28, -u * 0.3); ctx.rotate(0.5 + sway); ctx.fillRect(-u * 0.04, 0, u * 0.08, u * 0.32); ctx.restore(); }
    if (ch.star) { ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr2 = k % 2 ? u * 0.05 : u * 0.12, b = (k / 10) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(u * 0.05 + Math.cos(b) * rr2, -u * 0.68 + Math.sin(b) * rr2); } ctx.fill(); }
    if (ch.robot) { ctx.fillStyle = '#5ff7ff'; ctx.beginPath(); ctx.arc(u * 0.05, -u * 0.65, u * 0.08, 0, 7); ctx.fill(); ctx.strokeStyle = '#4a5566'; ctx.lineWidth = 2; ctx.strokeRect(-u * 0.18, -u * 0.85, u * 0.46, u * 0.4); }
    if (ch.id === 'knight') { ctx.strokeStyle = '#6b7383'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-u * 0.28, -u * (0.85 - k * 0.2)); ctx.lineTo(u * 0.28, -u * (0.85 - k * 0.2)); ctx.stroke(); } }
    if (ch.astro) { ctx.fillStyle = '#e5483a'; ctx.fillRect(-u * 0.1, -u * 0.85, u * 0.2, u * 0.12); ctx.fillStyle = '#3a6fb5'; ctx.fillRect(u * 0.1, -u * 0.85, u * 0.12, u * 0.12); }
    if (ch.scarf) { ctx.fillStyle = ch.scarf; rr(ctx, -u * 0.3, -u * 1.08, u * 0.62, u * 0.14, u * 0.06); ctx.fill(); ctx.save(); ctx.translate(-u * 0.25, -u * 1.0); ctx.rotate(0.6 + Math.sin(t * 8) * 0.25); ctx.fillRect(-u * 0.4, -u * 0.05, u * 0.42, u * 0.1); ctx.restore(); }
    ctx.translate(u * 0.05, -u * 1.42);
    drawHead(ctx, ch, u * 0.37, t, mood);
    ctx.restore();
    leg(a1, ch.pants);
    const front = drawStilt(ctx, hx, hy, a1, L1, u, sk, true, lc[1] ? (hd[1] ? '#ffc08a' : lc[1]) : null);
    // руки
    const sx0 = hx - Math.sin(ta) * u * 0.95, sy0 = hy - Math.cos(ta) * u * 0.95;
    const shoulder = (side) => ({ x: sx0 + Math.cos(ta) * side * u * 0.26, y: sy0 - Math.sin(ta) * side * u * 0.26 });
    const arm = (s, gx, gy) => {
      ctx.strokeStyle = ch.shirt2; ctx.lineWidth = u * 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo((s.x + gx) / 2 + u * 0.1, (s.y + gy) / 2 + u * 0.12, gx, gy); ctx.stroke();
      ctx.fillStyle = ch.robot ? '#8e99a8' : ch.skin; ctx.beginPath(); ctx.arc(gx, gy, u * 0.1, 0, 7); ctx.fill();
    };
    if (mood === 'win') { const w = Math.sin(t * 10) * u * 0.15; arm(shoulder(-1), sx0 - u * 0.5, sy0 - u * 0.75 + w); arm(shoulder(1), sx0 + u * 0.55, sy0 - u * 0.8 - w); }
    else if (mood === 'dead') { arm(shoulder(-1), sx0 - u * 0.7, sy0 + Math.sin(t * 20) * u * 0.2); arm(shoulder(1), sx0 + u * 0.7, sy0 - Math.sin(t * 20) * u * 0.2); }
    else { arm(shoulder(-1), back.gx, back.gy); arm(shoulder(1), front.gx, front.gy); }
    return { back, front };
  }

  // кружащиеся звёздочки над головой упавшего
  function drawDizzy(ctx, x, y, u, t) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3, px = x + Math.cos(a) * u * 0.6, py = y + Math.sin(a) * u * 0.2;
      ctx.fillStyle = '#ffcf3f'; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? u * 0.06 : u * 0.14, b = (k / 10) * Math.PI * 2; ctx.lineTo(px + Math.cos(b) * r, py + Math.sin(b) * r); }
      ctx.fill();
    }
  }

  root.Art = { THEMES, CHARS, STILTS, drawBackground, drawLevel, drawHazards, drawFlags, drawCoins, drawCharacter, drawDizzy, shade, hash };
})(window);
