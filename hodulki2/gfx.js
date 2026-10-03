// «Ходульщик 2» — новая графика: персонаж, ходули, лесной мир, предметы, свет, монеты, флажки, финиш.
// Всё рисуется кодом на Canvas. Сложные объекты один раз рисуются в «спрайты» (картинки в памяти)
// со светом, тенями и обводкой, а потом быстро ставятся на сцену — так детально и не тормозит.
(function (root) {
  'use strict';
  const Art = root.Art, Phys = root.Phys;
  const { surface, objState } = Phys;
  const OUT = 'rgba(38,24,14,0.9)'; // цвет обводки — тёмно-коричневый, мягче чёрного

  // ---------- мелкие помощники ----------
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, v + amt));
    return '#' + ((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0');
  }
  function mix(a, b, k) {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k);
    return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
  }
  function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
  function hash(i, k = 1) { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  // залить и обвести текущий путь
  function fo(ctx, fill, lw, stroke = OUT) { ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); } }
  // толстая «колбаска» с обводкой: руки, ноги
  function limb(ctx, pts, w, col, lw) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (lw) { ctx.strokeStyle = OUT; ctx.lineWidth = w + lw * 2; ctx.stroke(); }
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = w * 0.3; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0] - w * 0.18, p[1] - w * 0.18) : ctx.moveTo(p[0] - w * 0.18, p[1] - w * 0.18))); ctx.stroke();
  }
  // мягкая тень-эллипс (заранее размытая картинка)
  let shadowSprite = null;
  function softShadow(ctx, x, y, w, h, a = 0.35) {
    if (!shadowSprite) {
      shadowSprite = canvas(128, 64); const s = shadowSprite.getContext('2d');
      const g = s.createRadialGradient(64, 32, 2, 64, 32, 62); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      s.save(); s.scale(1, 0.5); s.fillStyle = g; s.beginPath(); s.arc(64, 64, 62, 0, 7); s.fill(); s.restore();
    }
    ctx.globalAlpha = a; ctx.drawImage(shadowSprite, x - w / 2, y - h / 2, w, h); ctx.globalAlpha = 1;
  }

  // =====================================================================
  // ПЕРСОНАЖ
  // =====================================================================
  // u — пикселей в метре. Тело чуть крупнее «реального», чтобы героя было хорошо видно.
  const BODY = 1.22;

  // ходуля: от бедра (hx,hy) под углом a, длина L (м). Возвращает точки хвата и подножки.
  function drawStilt(ctx, hx, hy, a, L, u, sk, front, tapeCol, glow, bend) {
    const dx = Math.sin(a), dy = Math.cos(a), nx = -dy, ny = dx; // направление вниз по ходуле и поперёк
    const top = 0.62 + (bend || 0), w = u * 0.15;
    const p = (k, off = 0) => [hx + dx * k * u + nx * off, hy + dy * k * u + ny * off];
    const [x1, y1] = p(-top), [x2, y2] = p(L);
    ctx.save();
    if (glow) { ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = u * 0.25; }
    // корпус ходули
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = w + u * 0.06; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(...p(0, -w / 2), ...p(0, w / 2));
    const c1 = sk.c1, c2 = sk.c2;
    if (sk.id === 'steel') { g.addColorStop(0, '#f4f7fa'); g.addColorStop(0.35, '#c3ccd6'); g.addColorStop(0.55, '#8d98a6'); g.addColorStop(1, '#5d6673'); }
    else { g.addColorStop(0, shade(c1, 35)); g.addColorStop(0.45, c1); g.addColorStop(1, shade(c2, -10)); }
    ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // материал
    ctx.lineWidth = Math.max(1, u * 0.012);
    if (sk.id === 'wood') { // волокна дерева
      ctx.strokeStyle = 'rgba(110,60,20,.45)';
      for (const off of [-0.25, 0.05, 0.3]) { ctx.beginPath(); for (let k = -top; k <= L; k += 0.25) { const q = p(k, w * off + Math.sin(k * 7 + off * 9) * w * 0.06); k === -top ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); } ctx.stroke(); }
    }
    if (sk.joints) { ctx.strokeStyle = shade(c2, -25); ctx.lineWidth = u * 0.03; for (let k = 0.2; k < L; k += 0.45) { const a1 = p(k, -w * 0.55), a2 = p(k, w * 0.55); ctx.beginPath(); ctx.moveTo(...a1); ctx.lineTo(...a2); ctx.stroke(); } }
    if (sk.stripes) { ctx.strokeStyle = sk.stripes; ctx.lineWidth = w * 0.9; for (let k = -top; k < L; k += 0.32) { const a1 = p(k, -w * 0.45), a2 = p(k + 0.12, w * 0.45); ctx.beginPath(); ctx.moveTo(...a1); ctx.lineTo(...a2); ctx.stroke(); } }
    if (sk.glow) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = w * 0.25; ctx.beginPath(); ctx.moveTo(...p(-top)); ctx.lineTo(...p(L)); ctx.stroke(); }
    // блик
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = w * 0.18; ctx.beginPath(); ctx.moveTo(...p(-top + 0.05, -w * 0.25)); ctx.lineTo(...p(L - 0.15, -w * 0.25)); ctx.stroke();
    // обмотка-рукоять сверху (цвет ноги: левая синяя, правая оранжевая)
    for (let k = -top + 0.06; k < -top + 0.42; k += 0.07) { ctx.strokeStyle = k % 0.14 < 0.07 ? tapeCol : shade(tapeCol, -35); ctx.lineWidth = w + u * 0.035; ctx.beginPath(); ctx.moveTo(...p(k)); ctx.lineTo(...p(k + 0.045)); ctx.stroke(); }
    // металлическая подножка со скобой
    const fk = 0.78;
    ctx.fillStyle = '#9aa4b1'; ctx.strokeStyle = OUT; ctx.lineWidth = u * 0.02;
    ctx.beginPath(); ctx.moveTo(...p(fk, -w * 0.7)); ctx.lineTo(...p(fk, w * 1.6)); ctx.lineTo(...p(fk + 0.07, w * 1.6)); ctx.lineTo(...p(fk + 0.07, -w * 0.7)); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const k of [fk - 0.12, fk + 0.03]) { ctx.fillStyle = '#c9d1db'; ctx.beginPath(); ctx.arc(...p(k + 0.05, 0), u * 0.022, 0, 7); ctx.fill(); }
    // резиновый наконечник
    const [tx, ty] = p(L);
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(-a);
    rr(ctx, -w * 0.75, -u * 0.16, w * 1.5, u * 0.2, u * 0.06); fo(ctx, '#2f3338', u * 0.02);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w * 0.55, -u * 0.14, w * 0.3, u * 0.14);
    ctx.restore();
    ctx.restore();
    return { grip: p(-top + 0.24), foot: p(fk - 0.02, w * 0.5), tip: [tx, ty] };
  }

  // кроссовок, пристёгнутый к подножке
  function drawShoe(ctx, x, y, a, u, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-a + Math.PI / 2 - Math.PI / 2);
    const s = u * BODY;
    ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.12); ctx.quadraticCurveTo(-s * 0.14, s * 0.06, -s * 0.06, s * 0.08); ctx.lineTo(s * 0.22, s * 0.08); ctx.quadraticCurveTo(s * 0.26, -s * 0.02, s * 0.12, -s * 0.06); ctx.lineTo(s * 0.02, -s * 0.12); ctx.closePath();
    fo(ctx, col, u * 0.025);
    ctx.fillStyle = '#f4f4f0'; rr(ctx, -s * 0.1, s * 0.03, s * 0.34, s * 0.05, s * 0.02); ctx.fill();
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = u * 0.02; ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.03); ctx.lineTo(s * 0.12, -s * 0.03); ctx.stroke(); // ремешок
    ctx.restore();
  }

  function eye(ctx, x, y, r, look, mood, t, blink) {
    if (mood === 'dead') { ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.35; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.7, y + r * 0.7); ctx.moveTo(x + r * 0.7, y - r * 0.7); ctx.lineTo(x - r * 0.7, y + r * 0.7); ctx.stroke(); return; }
    if (mood === 'win' || blink) { ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.32; ctx.lineCap = 'round'; ctx.beginPath(); if (mood === 'win') ctx.arc(x, y + r * 0.3, r * 0.75, Math.PI * 1.15, Math.PI * 1.85); else { ctx.moveTo(x - r * 0.8, y); ctx.lineTo(x + r * 0.8, y); } ctx.stroke(); return; }
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.88, r * (mood === 'scared' ? 1.2 : 1.05), 0, 0, 7); fo(ctx, '#ffffff', r * 0.22);
    const px = x + look * r * 0.32, py = y + r * 0.08 + (mood === 'aim' ? r * 0.05 : 0);
    ctx.fillStyle = '#3a6fb0'; ctx.beginPath(); ctx.arc(px, py, r * 0.58, 0, 7); ctx.fill();
    ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(px, py, r * (mood === 'scared' ? 0.26 : 0.36), 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - r * 0.2, py - r * 0.25, r * 0.18, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(px + r * 0.18, py + r * 0.16, r * 0.08, 0, 7); ctx.fill();
  }

  function drawHeadNew(ctx, ch, R, t, mood, look) {
    const lw = R * 0.075;
    const blink = mood !== 'dead' && (t % 3.6) < 0.11;
    if (ch.robot) {
      rr(ctx, -R, -R * 0.95, R * 2, R * 1.85, R * 0.4);
      const g = ctx.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#e6edf3'); g.addColorStop(1, '#8f9cab'); fo(ctx, g, lw);
      rr(ctx, -R * 0.75, -R * 0.5, R * 1.65, R * 0.72, R * 0.3); fo(ctx, '#17202b', lw * 0.6);
      const ec = mood === 'dead' ? '#ff4a4a' : '#5ff7ff';
      ctx.fillStyle = ec; ctx.shadowColor = ec; ctx.shadowBlur = R * 0.4;
      for (const ex of [-0.28, 0.42]) { ctx.beginPath(); if (mood === 'dead') { ctx.font = `900 ${R * 0.5}px sans-serif`; ctx.fillText('x', ex * R - R * 0.12, -R * 0.02); } else ctx.ellipse(ex * R + look * R * 0.1, -R * 0.14, R * 0.15, blink ? R * 0.03 : R * 0.17, 0, 0, 7); ctx.fill(); }
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#4a5566'; ctx.lineWidth = R * 0.12; ctx.beginPath(); ctx.moveTo(0, -R * 0.95); ctx.quadraticCurveTo(R * 0.2 * Math.sin(t * 3), -R * 1.3, 0, -R * 1.45); ctx.stroke();
      ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ff5a5a' : '#ffcf3f'; ctx.beginPath(); ctx.arc(0, -R * 1.5, R * 0.16, 0, 7); fo(ctx, ctx.fillStyle, lw * 0.6);
      ctx.fillStyle = '#5d6e83'; rr(ctx, -R * 0.45, R * 0.4, R * 1.1, R * 0.14, R * 0.07); ctx.fill();
      return;
    }
    if (ch.astro) { ctx.beginPath(); ctx.arc(0, -R * 0.05, R * 1.42, 0, 7); const gg = ctx.createRadialGradient(-R * 0.4, -R * 0.5, R * 0.2, 0, 0, R * 1.5); gg.addColorStop(0, 'rgba(220,240,255,.55)'); gg.addColorStop(1, 'rgba(150,200,255,.25)'); fo(ctx, gg, lw, '#dfe4ec'); }
    // волосы сзади
    if (ch.hair && ch.hat !== 'helmet') { ctx.beginPath(); ctx.ellipse(-R * 0.12, -R * 0.1, R * 1.02, R * 0.98, 0, Math.PI * 0.55, Math.PI * 1.95); fo(ctx, ch.hair, lw); }
    // голова: чуть сплюснутый круг, свет слева сверху
    const hg = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.15, 0, 0, R * 1.15);
    hg.addColorStop(0, shade(ch.skin, 22)); hg.addColorStop(0.7, ch.skin); hg.addColorStop(1, shade(ch.skin, -22));
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.02, R * 0.96, 0, 0, 7); fo(ctx, hg, lw);
    // ухо
    ctx.beginPath(); ctx.ellipse(-R * 0.42, R * 0.08, R * 0.17, R * 0.24, -0.2, 0, 7); fo(ctx, shade(ch.skin, -8), lw * 0.7);
    ctx.fillStyle = shade(ch.skin, -35); ctx.beginPath(); ctx.ellipse(-R * 0.42, R * 0.1, R * 0.07, R * 0.12, -0.2, 0, 7); ctx.fill();
    // румянец
    ctx.fillStyle = 'rgba(255,110,110,.28)'; ctx.beginPath(); ctx.ellipse(R * 0.55, R * 0.3, R * 0.18, R * 0.11, 0, 0, 7); ctx.fill();
    // брови
    const brow = mood === 'scared' ? 0.35 : mood === 'aim' ? -0.25 : mood === 'sad' || mood === 'dead' ? 0.3 : 0;
    ctx.strokeStyle = ch.hair || '#3a2416'; ctx.lineWidth = R * 0.11; ctx.lineCap = 'round';
    for (const [ex, dir] of [[0.22, -1], [0.72, 1]]) { ctx.beginPath(); ctx.moveTo(ex * R - R * 0.16, -R * 0.42 + brow * dir * R * 0.08); ctx.lineTo(ex * R + R * 0.14, -R * 0.44 - brow * dir * R * 0.08); ctx.stroke(); }
    // глаза
    for (const ex of [0.22, 0.72]) {
      if (ch.patch && ex > 0.5) { ctx.beginPath(); ctx.ellipse(ex * R, -R * 0.12, R * 0.22, R * 0.2, 0, 0, 7); fo(ctx, '#1b1b1b', 0); ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = R * 0.07; ctx.beginPath(); ctx.moveTo(-R * 0.85, -R * 0.55); ctx.lineTo(R * 0.98, -R * 0.2); ctx.stroke(); continue; }
      eye(ctx, ex * R, -R * 0.12, R * 0.2, look, mood, t, blink);
    }
    // нос
    ctx.beginPath(); ctx.ellipse(R * 0.93, R * 0.1, R * 0.15, R * 0.12, 0, 0, 7); fo(ctx, shade(ch.skin, -10), lw * 0.7);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(R * 0.9, R * 0.05, R * 0.04, 0, 7); ctx.fill();
    if (ch.mustache) { ctx.beginPath(); ctx.ellipse(R * 0.7, R * 0.3, R * 0.3, R * 0.1, 0.1, 0, 7); fo(ctx, ch.hair, lw * 0.5); }
    // рот по настроению
    ctx.lineCap = 'round'; ctx.lineWidth = R * 0.08; ctx.strokeStyle = OUT;
    if (mood === 'win') { ctx.beginPath(); ctx.moveTo(R * 0.3, R * 0.33); ctx.quadraticCurveTo(R * 0.6, R * 0.82, R * 0.86, R * 0.33); ctx.closePath(); fo(ctx, '#7a2a1a', R * 0.06); ctx.fillStyle = '#ff7f7f'; ctx.beginPath(); ctx.ellipse(R * 0.58, R * 0.55, R * 0.13, R * 0.07, 0, 0, 7); ctx.fill(); }
    else if (mood === 'swing' || mood === 'scared') { ctx.beginPath(); ctx.ellipse(R * 0.6, R * 0.45, R * 0.1, R * 0.14, 0, 0, 7); fo(ctx, '#7a2a1a', R * 0.06); }
    else if (mood === 'aim') { ctx.beginPath(); ctx.moveTo(R * 0.38, R * 0.42); ctx.lineTo(R * 0.78, R * 0.38); ctx.stroke(); ctx.fillStyle = '#ff7f8f'; ctx.beginPath(); ctx.ellipse(R * 0.72, R * 0.46, R * 0.07, R * 0.09, 0.3, 0, 7); ctx.fill(); }
    else if (mood === 'dead' || mood === 'sad') { ctx.beginPath(); ctx.arc(R * 0.6, R * 0.68, R * 0.2, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(R * 0.58, R * 0.2, R * 0.26, 0.35, Math.PI - 0.55); ctx.stroke(); }
    if (mood === 'scared') { ctx.fillStyle = '#8fd6ff'; ctx.beginPath(); ctx.moveTo(-R * 0.1, -R * 0.75); ctx.quadraticCurveTo(-R * 0.3, -R * 0.45, -R * 0.1, -R * 0.4); ctx.quadraticCurveTo(R * 0.1, -R * 0.45, -R * 0.1, -R * 0.75); fo(ctx, '#8fd6ff', R * 0.04, '#3a7fb0'); }
    // головные уборы
    const hc = ch.hatC, hw = lw;
    if (ch.hat === 'cap') { // кепка козырьком назад
      ctx.beginPath(); ctx.arc(0, -R * 0.35, R * 0.98, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); const cg = ctx.createLinearGradient(0, -R * 1.3, 0, -R * 0.3); cg.addColorStop(0, shade(hc, 25)); cg.addColorStop(1, shade(hc, -20)); fo(ctx, cg, hw);
      rr(ctx, -R * 1.55, -R * 0.52, R * 0.75, R * 0.2, R * 0.08); fo(ctx, shade(hc, -25), hw);
      ctx.beginPath(); ctx.arc(R * 0.05, -R * 1.33, R * 0.13, 0, 7); fo(ctx, '#ffffff', hw * 0.6);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = R * 0.08; ctx.beginPath(); ctx.arc(0, -R * 0.35, R * 0.75, Math.PI * 1.2, Math.PI * 1.45); ctx.stroke();
    }
    if (ch.hat === 'pith') { ctx.beginPath(); ctx.ellipse(0, -R * 0.55, R * 1.4, R * 0.26, 0, 0, 7); fo(ctx, shade(hc, -10), hw); ctx.beginPath(); ctx.arc(0, -R * 0.62, R * 0.88, Math.PI, 0); ctx.closePath(); fo(ctx, hc, hw); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-R * 0.86, -R * 0.75, R * 1.72, R * 0.14); }
    if (ch.hat === 'beanie') { ctx.beginPath(); ctx.arc(0, -R * 0.35, R * 1.0, Math.PI, 0); ctx.closePath(); fo(ctx, hc, hw); rr(ctx, -R * 1.02, -R * 0.5, R * 2.04, R * 0.26, R * 0.1); fo(ctx, shade(hc, -30), hw); ctx.beginPath(); ctx.arc(0, -R * 1.38, R * 0.24, 0, 7); fo(ctx, '#ffffff', hw); }
    if (ch.hat === 'helmet') { ctx.beginPath(); ctx.arc(0, -R * 0.1, R * 1.1, Math.PI * 0.92, Math.PI * 2.08); ctx.closePath(); const g = ctx.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#f2f5f8'); g.addColorStop(1, '#8e99a8'); fo(ctx, g, hw); ctx.fillStyle = '#2b3240'; rr(ctx, R * 0.05, -R * 0.32, R * 1.05, R * 0.14, R * 0.05); ctx.fill(); ctx.save(); ctx.translate(-R * 0.4, -R * 1.15); ctx.rotate(-0.7 + Math.sin(t * 5) * 0.12); ctx.beginPath(); ctx.ellipse(-R * 0.3, 0, R * 0.7, R * 0.24, 0, 0, 7); fo(ctx, ch.plume, hw); ctx.restore(); }
    if (ch.hat === 'tricorn') { ctx.beginPath(); ctx.moveTo(-R * 1.35, -R * 0.42); ctx.quadraticCurveTo(0, -R * 1.85, R * 1.35, -R * 0.42); ctx.quadraticCurveTo(0, -R * 0.78, -R * 1.35, -R * 0.42); fo(ctx, hc, hw); ctx.beginPath(); ctx.arc(0, -R * 1.0, R * 0.15, 0, 7); fo(ctx, '#ffcf3f', hw * 0.5); }
    if (ch.hat === 'hardhat') { ctx.beginPath(); ctx.arc(0, -R * 0.35, R * 0.98, Math.PI, 0); ctx.closePath(); const g = ctx.createLinearGradient(0, -R * 1.3, 0, -R * 0.3); g.addColorStop(0, '#fff07a'); g.addColorStop(1, hc); fo(ctx, g, hw); rr(ctx, -R * 1.2, -R * 0.45, R * 2.45, R * 0.2, R * 0.08); fo(ctx, shade(hc, -20), hw); ctx.fillStyle = shade(hc, -30); ctx.fillRect(-R * 0.1, -R * 1.3, R * 0.2, R * 0.85); }
    if (ch.hat === 'dome') { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-R * 0.55, -R * 0.75, R * 0.3, R * 0.12, -0.6, 0, 7); ctx.fill(); }
  }

  // pose: { hx, hy, ta, a:[l,r], L:[l,r], t, mood, legCol, held:[..], speed, anim:{aim, aimDir, swing, swingLeg, landT, wobble} }
  function drawHero(ctx, ch, sk, pose, u) {
    const { hx, ta, t } = pose, an = pose.anim || {}, mood0 = pose.mood || 'idle';
    let hy = pose.hy;
    // подготовка шага: чуть приседает; постановка: сжатие и отскок
    const aim = an.aim || 0, land = an.landT !== undefined ? Math.exp(-an.landT * 9) * Math.cos(an.landT * 22) : 0;
    hy += aim * u * 0.06 + land * u * 0.05;
    const mood = mood0 !== 'idle' ? mood0 : aim > 0.05 ? 'aim' : an.swing > 0 && an.swing < 1 ? 'swing' : an.wobble > 0.5 ? 'scared' : 'idle';
    const lc = pose.legCol || ['#4aa3ff', '#ff8a2a'], held = pose.held || [false, false];
    const a = pose.a, L = pose.L, s = u * BODY;
    // ходули и ноги: левая (0) — дальняя, правая (1) — ближняя
    const legOf = (i) => {
      const st = drawStilt(ctx, hx, hy, a[i], L[i], u, sk, i === 1, lc[i], held[i], an.swing > 0 && an.swingLeg === i ? Math.sin(Math.PI * an.swing) * 0.12 : 0);
      const pants = i === 0 ? shade(ch.pants, -22) : ch.pants;
      const knee = [(hx + st.foot[0]) / 2 + Math.cos(a[i]) * s * 0.08, (hy + st.foot[1]) / 2 - Math.sin(a[i]) * s * 0.08];
      limb(ctx, [[hx, hy - s * 0.04], knee, st.foot], s * 0.2, pants, u * 0.025);
      drawShoe(ctx, st.foot[0], st.foot[1], a[i], u, i === 0 ? '#c43d3d' : '#e5483a');
      return st;
    };
    const back = legOf(0);
    // тело
    const breathe = mood === 'idle' ? Math.sin(t * 2.3) * 0.015 : 0;
    const sq = 1 - land * 0.08 + breathe, sx = 1 + land * 0.06;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-ta); ctx.scale(sx, sq);
    const sway = Math.sin(t * 5) * 0.1 + (pose.speed || 0) * 0.3;
    if (ch.cape) { ctx.save(); ctx.translate(-s * 0.22, -s * 1.02); ctx.rotate(0.18 + sway); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.5, s * 0.5, -s * 0.38 - Math.sin(t * 9) * s * 0.06, s * 1.0); ctx.lineTo(s * 0.25, s * 0.95); ctx.lineTo(s * 0.3, 0); ctx.closePath(); fo(ctx, ch.cape, u * 0.025); ctx.restore(); }
    if (ch.pack) { rr(ctx, -s * 0.6, -s * 1.02, s * 0.36, s * 0.66, s * 0.1); fo(ctx, ch.pack, u * 0.025); ctx.fillStyle = shade(ch.pack, -25); ctx.fillRect(-s * 0.6, -s * 0.74, s * 0.36, s * 0.06); }
    // шорты/штаны
    rr(ctx, -s * 0.3, -s * 0.34, s * 0.6, s * 0.44, s * 0.14); fo(ctx, ch.pants, u * 0.025);
    // куртка-худи: объём градиентом, свет слева
    const bg = ctx.createLinearGradient(-s * 0.32, -s, s * 0.32, -s * 0.2);
    bg.addColorStop(0, shade(ch.shirt, 30)); bg.addColorStop(0.5, ch.shirt); bg.addColorStop(1, ch.shirt2);
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.24); ctx.quadraticCurveTo(-s * 0.36, -s * 0.75, -s * 0.24, -s * 1.08); ctx.quadraticCurveTo(0, -s * 1.16, s * 0.24, -s * 1.08); ctx.quadraticCurveTo(s * 0.37, -s * 0.75, s * 0.31, -s * 0.24); ctx.quadraticCurveTo(0, -s * 0.16, -s * 0.3, -s * 0.24); ctx.closePath();
    fo(ctx, bg, u * 0.028);
    // складки, молния, карман
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = u * 0.015; ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 1.02); ctx.lineTo(s * 0.08, -s * 0.28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.42); ctx.quadraticCurveTo(s * 0.05, -s * 0.36, s * 0.26, -s * 0.44); ctx.stroke();
    if (ch.vest) { ctx.fillStyle = '#d9ff3f'; ctx.fillRect(-s * 0.3, -s * 0.66, s * 0.62, s * 0.07); ctx.fillRect(-s * 0.3, -s * 0.46, s * 0.62, s * 0.07); }
    if (ch.sash) { ctx.fillStyle = ch.sash; ctx.fillRect(-s * 0.31, -s * 0.36, s * 0.62, s * 0.1); ctx.save(); ctx.translate(-s * 0.28, -s * 0.31); ctx.rotate(0.5 + sway); ctx.fillRect(-s * 0.04, 0, s * 0.08, s * 0.32); ctx.restore(); }
    if (ch.star) { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); for (let k = 0; k < 10; k++) { const r2 = k % 2 ? s * 0.05 : s * 0.12, b = (k / 10) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(s * 0.08 + Math.cos(b) * r2, -s * 0.7 + Math.sin(b) * r2); } ctx.closePath(); fo(ctx, '#ffd34d', u * 0.015); }
    if (ch.robot) { ctx.fillStyle = '#5ff7ff'; ctx.shadowColor = '#5ff7ff'; ctx.shadowBlur = s * 0.2; ctx.beginPath(); ctx.arc(s * 0.06, -s * 0.66, s * 0.08, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    if (ch.id === 'knight') { ctx.strokeStyle = 'rgba(60,70,85,.6)'; ctx.lineWidth = u * 0.02; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.28, -s * (0.88 - k * 0.2)); ctx.lineTo(s * 0.29, -s * (0.88 - k * 0.2)); ctx.stroke(); } }
    if (ch.scarf) { rr(ctx, -s * 0.3, -s * 1.12, s * 0.64, s * 0.16, s * 0.07); fo(ctx, ch.scarf, u * 0.02); ctx.save(); ctx.translate(-s * 0.24, -s * 1.04); ctx.rotate(0.6 + Math.sin(t * 8) * 0.25 + sway); rr(ctx, -s * 0.45, -s * 0.05, s * 0.46, s * 0.1, s * 0.04); fo(ctx, ch.scarf, u * 0.02); ctx.restore(); }
    // голова
    ctx.translate(s * 0.06, -s * 1.45);
    const look = an.aimDir ? Math.sign(an.aimDir) : Math.sin(t * 0.7) * 0.4;
    drawHeadNew(ctx, ch, s * 0.4, t, mood, look);
    ctx.restore();
    const front = legOf(1);
    // руки: от плеч к хватам на ходулях; при победе — вверх, при потере равновесия — машут
    const shoulder = (side) => { const sxp = hx - Math.sin(ta) * s * 0.95 * sq, syp = hy - Math.cos(ta) * s * 0.95 * sq; return [sxp + Math.cos(ta) * side * s * 0.25, syp - Math.sin(ta) * side * s * 0.25]; };
    const arm = (sh, hand, col, glove) => {
      const mid = [(sh[0] + hand[0]) / 2 + s * 0.12, (sh[1] + hand[1]) / 2 + s * 0.08];
      limb(ctx, [sh, mid, hand], s * 0.15, col, u * 0.022);
      ctx.beginPath(); ctx.arc(hand[0], hand[1], s * 0.1, 0, 7); fo(ctx, glove, u * 0.022);
    };
    const sleeve = ch.shirt2, glove = ch.robot ? '#8e99a8' : '#f4f4f0';
    if (mood === 'win') { const w = Math.sin(t * 11) * s * 0.15; const sh0 = shoulder(-1), sh1 = shoulder(1); arm(sh0, [sh0[0] - s * 0.45, sh0[1] - s * 0.7 + w], sleeve, glove); arm(sh1, [sh1[0] + s * 0.5, sh1[1] - s * 0.75 - w], sleeve, glove); }
    else if (mood === 'dead' || (an.wobble || 0) > 0.75) { const f = Math.sin(t * 18), sh0 = shoulder(-1), sh1 = shoulder(1); arm(sh0, [sh0[0] - s * 0.65, sh0[1] - s * 0.2 + f * s * 0.3], sleeve, glove); arm(sh1, [sh1[0] + s * 0.65, sh1[1] - s * 0.25 - f * s * 0.3], sleeve, glove); }
    else { arm(shoulder(-1), back.grip, shade(sleeve, -15), glove); arm(shoulder(1), front.grip, sleeve, glove); }
    return { back, front };
  }

  function drawDizzy(ctx, x, y, u, t) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3, px = x + Math.cos(a) * u * 0.6, py = y + Math.sin(a) * u * 0.2;
      ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? u * 0.06 : u * 0.14, b = (k / 10) * Math.PI * 2; ctx.lineTo(px + Math.cos(b) * r, py + Math.sin(b) * r); } ctx.closePath();
      fo(ctx, '#ffd34d', u * 0.02);
    }
  }

  // =====================================================================
  // ЛЕСНОЙ МИР: спрайты деревьев, кустов, камней, цветов, грибов, облаков
  // =====================================================================
  const SPR = {};
  function sprite(key, w, h, draw) { if (!SPR[key]) { const c = canvas(w, h); draw(c.getContext('2d'), w, h); SPR[key] = c; } return SPR[key]; }

  // лиственное дерево: ствол + пышная крона из «шариков» со светом слева-сверху
  function treeSprite(seed, hazeK = 0) {
    return sprite('tree' + seed + '_' + hazeK, 420, 470, (c, W, H) => {
      const r = rng(seed + 11), haze = (col) => mix(col, '#bfe3ee', hazeK);
      const trunkW = 26 + r() * 10, cx = W / 2;
      // ствол с корнями
      c.beginPath(); c.moveTo(cx - trunkW, H); c.quadraticCurveTo(cx - trunkW * 0.55, H - 40, cx - trunkW * 0.45, H - 200); c.lineTo(cx + trunkW * 0.45, H - 200); c.quadraticCurveTo(cx + trunkW * 0.55, H - 40, cx + trunkW, H); c.closePath();
      const tg = c.createLinearGradient(cx - trunkW, 0, cx + trunkW, 0); tg.addColorStop(0, haze('#9a6a3e')); tg.addColorStop(0.45, haze('#7a4f2c')); tg.addColorStop(1, haze('#4e2f17'));
      fo(c, tg, hazeK > 0.3 ? 0 : 3);
      c.strokeStyle = 'rgba(40,20,8,.35)'; c.lineWidth = 2; for (let k = 0; k < 5; k++) { const x = cx - trunkW * 0.3 + k * trunkW * 0.15; c.beginPath(); c.moveTo(x, H - 10); c.quadraticCurveTo(x + (r() - 0.5) * 8, H - 100, x, H - 190); c.stroke(); }
      // ветка
      c.strokeStyle = haze('#6b4424'); c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, H - 170); c.quadraticCurveTo(cx + 40, H - 200, cx + 70, H - 240); c.stroke();
      // крона: тёмные шарики снизу, светлые сверху-слева
      const blobs = []; for (let k = 0; k < 14; k++) blobs.push([cx + (r() - 0.5) * 190, 100 + r() * 170, 44 + r() * 36]);
      blobs.sort((a, b) => b[1] - a[1]);
      const leaf = ['#2f7d3a', '#3d9a45', '#56b84f', '#7fd65c'];
      // общая тень кроны
      c.fillStyle = haze('#1f5a2a'); for (const [x, y, rad] of blobs) { c.beginPath(); c.arc(x + 6, y + 10, rad, 0, 7); c.fill(); }
      if (hazeK < 0.3) { c.strokeStyle = OUT; c.lineWidth = 5; for (const [x, y, rad] of blobs) { c.beginPath(); c.arc(x, y, rad, 0, 7); c.stroke(); } }
      for (const [x, y, rad] of blobs) {
        const gg = c.createRadialGradient(x - rad * 0.4, y - rad * 0.45, rad * 0.1, x, y, rad);
        gg.addColorStop(0, haze(leaf[3])); gg.addColorStop(0.45, haze(leaf[2])); gg.addColorStop(1, haze(leaf[1]));
        c.fillStyle = gg; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
      }
      // листочки-блики
      c.fillStyle = haze('#a6ec7a'); for (let k = 0; k < 26; k++) { const [x, y, rad] = blobs[Math.floor(r() * blobs.length)]; c.beginPath(); c.ellipse(x - rad * 0.3 + r() * rad * 0.4, y - rad * 0.5 + r() * rad * 0.3, 6, 3.5, r() * 3, 0, 7); c.fill(); }
      if (r() < 0.5) { c.fillStyle = '#e8483a'; for (let k = 0; k < 6; k++) { const [x, y, rad] = blobs[Math.floor(r() * blobs.length)]; c.beginPath(); c.arc(x + (r() - 0.5) * rad, y + (r() - 0.3) * rad * 0.6, 6, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(x + (r() - 0.5) * rad - 2, y - 2, 2, 0, 7); c.fill(); c.fillStyle = '#e8483a'; } }
    });
  }
  // ёлка
  function pineSprite(seed, hazeK) {
    return sprite('pine' + seed + '_' + hazeK, 200, 360, (c, W, H) => {
      const r = rng(seed + 5), haze = (col) => mix(col, '#bfe3ee', hazeK), cx = W / 2;
      c.fillStyle = haze('#5a3a20'); c.fillRect(cx - 9, H - 50, 18, 50);
      for (let i = 0; i < 5; i++) {
        const y = H - 40 - i * 58, w = 95 - i * 16 + r() * 8;
        c.beginPath(); c.moveTo(cx - w, y); c.quadraticCurveTo(cx - w * 0.3, y - 30, cx, y - 85); c.quadraticCurveTo(cx + w * 0.3, y - 30, cx + w, y); c.quadraticCurveTo(cx, y + 12, cx - w, y); c.closePath();
        const g = c.createLinearGradient(cx - w, 0, cx + w, 0); g.addColorStop(0, haze('#4fae58')); g.addColorStop(0.5, haze('#2f8540')); g.addColorStop(1, haze('#1e5a2c'));
        fo(c, g, hazeK > 0.3 ? 0 : 3);
      }
    });
  }
  function bushSprite(seed, hazeK = 0) {
    return sprite('bush' + seed + '_' + hazeK, 240, 120, (c, W, H) => {
      const r = rng(seed + 3), haze = (col) => mix(col, '#bfe3ee', hazeK);
      const blobs = []; for (let k = 0; k < 7; k++) blobs.push([60 + r() * 120, 62 + r() * 22, 24 + r() * 20]);
      blobs.sort((a, b) => b[1] - a[1]);
      if (hazeK < 0.3) { c.strokeStyle = OUT; c.lineWidth = 4; for (const [x, y, rad] of blobs) { c.beginPath(); c.arc(x, y, rad, 0, 7); c.stroke(); } }
      for (const [x, y, rad] of blobs) { const g = c.createRadialGradient(x - rad * 0.4, y - rad * 0.5, 2, x, y, rad); g.addColorStop(0, haze('#8ee06a')); g.addColorStop(0.5, haze('#4fb24a')); g.addColorStop(1, haze('#2c7a35')); c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, H - 14, W, 14);
      if (r() < 0.6) for (let k = 0; k < 5; k++) { const x = 70 + r() * 100, y = 48 + r() * 36; c.fillStyle = ['#ffd1e8', '#fff', '#ffe36b'][k % 3]; for (let p = 0; p < 5; p++) { c.beginPath(); c.arc(x + Math.cos(p * 1.26) * 4, y + Math.sin(p * 1.26) * 4, 3.4, 0, 7); c.fill(); } c.fillStyle = '#ffb12a'; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); }
    });
  }
  function rockSprite(seed) {
    return sprite('rock' + seed, 120, 80, (c, W, H) => {
      const r = rng(seed + 9); c.beginPath();
      const n = 9; for (let k = 0; k <= n; k++) { const a = Math.PI + (k / n) * Math.PI, rad = 50 + r() * 10; c.lineTo(60 + Math.cos(a) * rad, 76 + Math.sin(a) * rad * (0.75 + r() * 0.15)); }
      c.closePath(); const g = c.createLinearGradient(20, 10, 90, 76); g.addColorStop(0, '#c9ccd2'); g.addColorStop(0.5, '#98a0aa'); g.addColorStop(1, '#646c78'); fo(c, g, 3.5);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(42, 36, 16, 7, -0.5, 0, 7); c.fill();
      c.fillStyle = '#5aa64a'; c.beginPath(); c.ellipse(64, 24, 22, 8, 0.1, Math.PI, 0); c.fill(); // мох
      c.strokeStyle = 'rgba(40,40,50,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(70, 40); c.lineTo(78, 56); c.lineTo(74, 70); c.stroke();
    });
  }
  function mushroomSprite(seed) {
    return sprite('mush' + seed, 60, 64, (c) => {
      const red = seed % 2 === 0;
      c.beginPath(); c.moveTo(24, 62); c.quadraticCurveTo(22, 40, 26, 30); c.lineTo(36, 30); c.quadraticCurveTo(40, 40, 38, 62); c.closePath(); fo(c, '#fff6e6', 2.5);
      c.beginPath(); c.moveTo(6, 34); c.quadraticCurveTo(10, 6, 31, 6); c.quadraticCurveTo(54, 6, 56, 34); c.quadraticCurveTo(31, 40, 6, 34); c.closePath();
      const g = c.createRadialGradient(22, 14, 2, 31, 24, 30); g.addColorStop(0, red ? '#ff8a7a' : '#ffcf7a'); g.addColorStop(1, red ? '#d8342b' : '#c98a2a'); fo(c, g, 2.5);
      c.fillStyle = '#fff'; for (const [x, y, rr2] of [[20, 18, 4], [36, 14, 3.4], [45, 26, 3], [27, 28, 2.5]]) { c.beginPath(); c.arc(x, y, rr2, 0, 7); c.fill(); }
    });
  }
  function flowerSprite(seed) {
    return sprite('flower' + seed, 40, 60, (c) => {
      const cols = ['#ff6fa8', '#ffd34d', '#ffffff', '#b98cff', '#ff8a3d'], col = cols[seed % cols.length];
      c.strokeStyle = '#3d8f3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 60); c.quadraticCurveTo(16, 40, 20, 20); c.stroke();
      c.fillStyle = '#4fae49'; c.beginPath(); c.ellipse(13, 44, 7, 3.5, 0.6, 0, 7); c.fill();
      for (let p = 0; p < 6; p++) { c.beginPath(); c.ellipse(20 + Math.cos(p * 1.05) * 7, 18 + Math.sin(p * 1.05) * 7, 6, 4, p * 1.05, 0, 7); fo(c, col, 1.5); }
      c.beginPath(); c.arc(20, 18, 4.5, 0, 7); fo(c, '#ffb12a', 1.5);
    });
  }
  function grassTuftSprite(seed) {
    return sprite('tuft' + seed, 60, 40, (c) => {
      const r = rng(seed + 21);
      for (let k = 0; k < 9; k++) { const x = 8 + r() * 44, h = 18 + r() * 20, lean = (r() - 0.5) * 16; c.strokeStyle = k % 3 ? '#4fb24a' : '#7fd65c'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, 40); c.quadraticCurveTo(x + lean * 0.3, 40 - h * 0.6, x + lean, 40 - h); c.stroke(); }
    });
  }
  function cloudSprite(seed) {
    return sprite('cloud' + seed, 330, 170, (c) => {
      const r = rng(seed + 31), blobs = [];
      for (let k = 0; k < 7; k++) blobs.push([70 + r() * 190, 78 + r() * 18, 28 + r() * 22]);
      c.fillStyle = 'rgba(160,190,215,.55)'; for (const [x, y, rad] of blobs) { c.beginPath(); c.arc(x + 4, y + 8, rad, 0, 7); c.fill(); }
      for (const [x, y, rad] of blobs) { const g = c.createRadialGradient(x - rad * 0.3, y - rad * 0.4, 2, x, y, rad); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e3f1fb'); c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill(); }
    });
  }
  // полоса далёких гор (повторяется)
  function mountainStrip(seed, col1, col2, snow, height) {
    return sprite('mount' + seed, 1600, height, (c, W, H) => {
      const r = rng(seed); const peaks = []; for (let x = -200; x <= W + 200; x += 180 + r() * 160) peaks.push([x, H * (0.15 + r() * 0.4)]);
      c.beginPath(); c.moveTo(0, H);
      for (let i = 0; i < peaks.length - 1; i++) { const [x, y] = peaks[i], [x2] = peaks[i + 1]; c.lineTo(x, y); c.lineTo((x + x2) / 2, H * (0.55 + r() * 0.2)); }
      c.lineTo(W, H); c.closePath();
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, col1); g.addColorStop(1, col2); c.fillStyle = g; c.fill();
      if (snow) { c.fillStyle = 'rgba(255,255,255,.85)'; for (const [x, y] of peaks) { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 40, y + 45); c.lineTo(x - 14, y + 36); c.lineTo(x, y + 50); c.lineTo(x + 16, y + 34); c.lineTo(x + 40, y + 45); c.closePath(); c.fill(); } }
      // свет слева: светлые склоны
      c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,.12)';
      for (const [x, y] of peaks) { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 200, H); c.lineTo(x, H); c.closePath(); c.fill(); }
      c.globalCompositeOperation = 'source-over';
    });
  }
  // полоса дальнего леса (силуэты крон)
  function forestStrip(seed, col, height) {
    return sprite('fstrip' + seed, 1600, height, (c, W, H) => {
      const r = rng(seed); c.fillStyle = col;
      c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W + 40; x += 30) c.lineTo(x, H * (0.35 + Math.sin(x * 0.01 + seed) * 0.08) - r() * 30);
      c.lineTo(W, H); c.closePath(); c.fill();
      for (let k = 0; k < 40; k++) { const x = r() * W, y = H * (0.25 + r() * 0.2), rad = 25 + r() * 35; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill(); }
      for (let k = 0; k < 18; k++) { const x = r() * W, y = H * 0.25 + r() * 20, w = 22 + r() * 16; c.beginPath(); c.moveTo(x - w, y + 50); c.lineTo(x, y - 70); c.lineTo(x + w, y + 50); c.fill(); }
      c.fillRect(0, H * 0.5, W, H);
    });
  }
  // текстура земли: комки, камешки, корни
  function dirtTile() {
    return sprite('dirt', 256, 256, (c, W, H) => {
      c.fillStyle = '#7a4d2b'; c.fillRect(0, 0, W, H);
      const r = rng(77);
      for (let k = 0; k < 140; k++) { const x = r() * W, y = r() * H, rad = 3 + r() * 10; c.fillStyle = r() < 0.5 ? 'rgba(60,35,18,.35)' : 'rgba(140,95,60,.3)'; c.beginPath(); c.ellipse(x, y, rad, rad * 0.6, r() * 3, 0, 7); c.fill(); }
      for (let k = 0; k < 16; k++) { const x = r() * W, y = r() * H, rad = 5 + r() * 7; const g = c.createLinearGradient(x - rad, y - rad, x + rad, y + rad); g.addColorStop(0, '#c8c3ba'); g.addColorStop(1, '#7d7870'); c.beginPath(); c.ellipse(x, y, rad, rad * 0.7, r() * 3, 0, 7); fo(c, g, 1.5, 'rgba(40,25,15,.6)'); }
      c.strokeStyle = 'rgba(90,55,28,.8)'; c.lineWidth = 3; c.lineCap = 'round';
      for (let k = 0; k < 5; k++) { let x = r() * W, y = r() * H * 0.5; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (r() - 0.5) * 40; y += 15 + r() * 15; c.lineTo(x, y); } c.stroke(); }
    });
  }
  let dirtPattern = null;

  // =====================================================================
  // ФОН ЛЕСА: небо → облака → горы → дальний лес → средний лес (+ дымка)
  // =====================================================================
  function drawForestBackground(ctx, V, t) {
    const W = V.W, H = V.H, cam = V.cam, P = V.PPM;
    // небо: тёплое у горизонта
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5ec2ff'); sky.addColorStop(0.45, '#a8e2ff'); sky.addColorStop(0.75, '#e9f8f0'); sky.addColorStop(1, '#fff1cf');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // солнце с мягкими лучами
    const sxp = W * 0.82, syp = H * 0.14, sr = Math.min(W, H) * 0.06;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(sxp, syp, sr * 0.2, sxp, syp, sr * 6); halo.addColorStop(0, 'rgba(255,240,190,.55)'); halo.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sxp, syp, sr * 6, 0, 7); ctx.fill();
    ctx.translate(sxp, syp); ctx.rotate(t * 0.03);
    for (let k = 0; k < 10; k++) { ctx.rotate(Math.PI / 5); ctx.fillStyle = 'rgba(255,245,210,.07)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-sr * 0.5, sr * 9); ctx.lineTo(sr * 0.5, sr * 9); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(sxp, syp, sr, 0, 7); ctx.fill();
    // облака (медленно плывут)
    for (let i = 0; i < 6; i++) {
      const spr = cloudSprite(i % 4), sc = (0.5 + hash(i, 4) * 0.5) * Math.min(1.4, H / 700);
      const span = W + 500, x = ((i * 420 - cam.x * P * 0.03 - t * (6 + i * 2)) % span + span) % span - 250, y = H * (0.03 + hash(i, 6) * 0.2);
      ctx.globalAlpha = 0.95; ctx.drawImage(spr, x, y, spr.width * sc, spr.height * sc); ctx.globalAlpha = 1;
    }
    const hz = V.sy(cam.y - 1.5) * 0.35 + H * 0.4; // линия горизонта слегка следует за камерой
    // дальние горы
    const strip = (spr, k, y, h) => { const w = spr.width * (h / spr.height), off = ((cam.x * P * k) % w + w) % w; for (let x = -off; x < W; x += w) ctx.drawImage(spr, x, y - h, w, h); };
    strip(mountainStrip(3, '#9bb8d6', '#c9e0ee', true, 400), 0.04, hz + H * 0.06, H * 0.36);
    strip(mountainStrip(8, '#7fa8b8', '#b5d6d8', false, 320), 0.08, hz + H * 0.1, H * 0.26);
    // дальний лес
    strip(forestStrip(5, '#7fb59a', 300), 0.15, hz + H * 0.2, H * 0.25);
    // дымка
    const hazeG = ctx.createLinearGradient(0, hz - H * 0.1, 0, hz + H * 0.25); hazeG.addColorStop(0, 'rgba(230,248,245,0)'); hazeG.addColorStop(1, 'rgba(230,248,245,.55)');
    ctx.fillStyle = hazeG; ctx.fillRect(0, hz - H * 0.1, W, H * 0.35);
    strip(forestStrip(9, '#5f9c74', 300), 0.25, hz + H * 0.3, H * 0.27);
    // средний лес: отдельные деревья с лёгкой дымкой
    const k3 = 0.45, per = 210, s3 = Math.floor((cam.x * P * k3) / per) - 2;
    for (let i = s3; i < s3 + Math.ceil(W / per) + 4; i++) {
      if (hash(i, 9) < 0.25) continue;
      const pine = hash(i, 3) < 0.35, spr = pine ? pineSprite(i % 3, 0.35) : treeSprite(i % 5, 0.35);
      const sc = (0.75 + hash(i, 5) * 0.4) * Math.min(1.3, H / 760);
      const x = i * per - cam.x * P * k3 + hash(i, 4) * 80, w = spr.width * sc, h = spr.height * sc;
      ctx.drawImage(spr, x - w / 2, hz + H * 0.42 - h, w, h);
    }
    // скалы с водопадами на среднем плане
    const kw = 0.5, perW = 760, sw0 = Math.floor((cam.x * P * kw) / perW) - 1;
    for (let i = sw0; i < sw0 + Math.ceil(W / perW) + 2; i++) {
      if (hash(i, 77) < 0.2) continue;
      const sc = Math.min(1.5, H / 560), x = i * perW - cam.x * P * kw + hash(i, 78) * 200, base = hz + H * 0.33;
      drawWaterfall(ctx, x, base, sc, t, i);
    }
    ctx.fillStyle = 'rgba(225,245,235,.25)'; ctx.fillRect(0, hz, W, H);
  }
  function cliffSprite(seed) {
    return sprite('cliff' + seed, 300, 380, (c, W, H) => {
      const r = rng(seed + 50);
      c.beginPath(); c.moveTo(10, H); c.lineTo(28, 90); c.quadraticCurveTo(60, 40, 110, 50); c.lineTo(190, 46); c.quadraticCurveTo(250, 50, 272, 100); c.lineTo(292, H); c.closePath();
      const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#b9b2a6'); g.addColorStop(0.5, '#958d82'); g.addColorStop(1, '#6f685f'); fo(c, g, 4);
      c.strokeStyle = 'rgba(60,50,40,.35)'; c.lineWidth = 3; for (let k = 0; k < 9; k++) { const x = 40 + r() * 220, y = 90 + r() * 240; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 40, y + 30 + r() * 30); c.stroke(); }
      c.fillStyle = '#5fc04a'; c.beginPath(); c.moveTo(20, 96); c.quadraticCurveTo(60, 30, 110, 44); c.lineTo(190, 40); c.quadraticCurveTo(255, 44, 280, 104); c.quadraticCurveTo(150, 70, 20, 96); c.fill();
      c.fillStyle = '#8ee06a'; c.beginPath(); c.ellipse(140, 52, 90, 10, 0, Math.PI, 0); c.fill();
    });
  }
  function drawWaterfall(ctx, x, base, sc, t, i) {
    const spr = cliffSprite(i % 3), w = spr.width * sc * 0.9, h = spr.height * sc * 0.9, top = base - h;
    ctx.globalAlpha = 0.9; ctx.drawImage(spr, x - w / 2, top, w, h); ctx.globalAlpha = 1;
    // вода падает: полоса с бегущими бликами
    const wx = x - w * 0.08, ww = w * 0.18, wt = top + h * 0.13;
    const wg = ctx.createLinearGradient(wx, 0, wx + ww, 0); wg.addColorStop(0, 'rgba(160,225,255,.85)'); wg.addColorStop(0.5, 'rgba(230,250,255,.95)'); wg.addColorStop(1, 'rgba(120,200,245,.85)');
    ctx.fillStyle = wg; ctx.fillRect(wx, wt, ww, base - wt);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
    // все блики одной линией и вся пена одной заливкой — так быстрее на слабых телефонах
    ctx.beginPath();
    for (let k = 0; k < 5; k++) { const lx = wx + ww * (0.15 + k * 0.17), off = ((t * 140 + k * 37) % 60); for (let y = wt - 60 + off; y < base; y += 60) { ctx.moveTo(lx, Math.max(wt, y)); ctx.lineTo(lx, Math.min(base, y + 26)); } }
    ctx.stroke();
    // пена и брызги внизу
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = t * 3 + k, cx = wx + ww / 2 + Math.cos(a * 1.7 + k) * ww * 0.7, cy = base - 6 - Math.abs(Math.sin(a + k)) * 10, r = 6 + (k % 3) * 3; ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, 7); }
    ctx.fill();
  }

  // деревья у самой тропы (параллакс почти 1, за персонажем)
  function drawNearTrees(ctx, V, t, lv) {
    const P = V.PPM, per = 9.5, i0 = Math.floor((V.cam.x - 16) / per), i1 = i0 + Math.ceil(V.W / P / per) + 4;
    for (let i = i0; i < i1; i++) {
      if (hash(i, 41) < 0.55) continue;
      const wx = i * per + hash(i, 42) * 5, gy = surface(lv, wx, 0, 50).y; if (gy < -50) continue;
      const pine = hash(i, 43) < 0.3, spr = pine ? pineSprite(3 + (i % 2), 0) : treeSprite(10 + (i % 6), 0);
      const sc = P / 60 * (0.95 + hash(i, 44) * 0.3), w = spr.width * sc, h = spr.height * sc;
      const x = V.sx(wx) - w / 2, y = V.sy(gy - 0.5) - h;
      if (x > V.W || x + w < 0) continue;
      ctx.globalAlpha = 0.92; ctx.drawImage(spr, x, y, w, h); ctx.globalAlpha = 1;
    }
  }

  // =====================================================================
  // ЗЕМЛЯ ЛЕСА: дёрн с травой, земля с текстурой, края, корни, декор
  // =====================================================================
  function decoFor(i, x) { const h = hash(Math.floor(x * 3.1) + i * 13, 7); return h; }
  function drawForestGround(ctx, V, g, t) {
    const lv = g.lv, P = V.PPM, sx = V.sx, sy = V.sy;
    if (!dirtPattern) dirtPattern = ctx.createPattern(dirtTile(), 'repeat');
    const k = P / 90; // масштаб текстуры
    if (dirtPattern.setTransform) dirtPattern.setTransform(new DOMMatrix([k, 0, 0, k, sx(0) % (256 * k), sy(0) % (256 * k)]));
    const segs = lv.segs.filter((s) => s[0] !== s[2] && s[4] !== 'wall' && s[4] !== 'water' && s[4] !== 'spikes');
    // ямы: глубина и то, что на дне
    for (const [x1, y1, x2, , mat] of lv.segs) {
      if (mat !== 'water' && mat !== 'spikes') continue;
      const a = sx(x1), b = sx(x2); if (b < -60 || a > V.W + 60) continue;
      const top = sy(y1 + 3.2), bot = V.H;
      const pg = ctx.createLinearGradient(0, top, 0, bot); pg.addColorStop(0, 'rgba(25,40,25,.0)'); pg.addColorStop(0.3, '#2a2016'); pg.addColorStop(1, '#120c07');
      ctx.fillStyle = pg; ctx.fillRect(a, top, b - a, bot - top);
      if (mat === 'water') drawWater(ctx, V, a, b, sy(y1), t);
      else drawStakes(ctx, a, b, sy(y1), P);
    }
    // стенки ям — земляные обрывы с корнями
    for (const [x1, y1, x2, y2, mat] of lv.segs) {
      if (mat !== 'wall') continue;
      const a = sx(x1); if (a < -60 || a > V.W + 60) continue;
      const yt = sy(Math.max(y1, y2)), yb = sy(Math.min(y1, y2));
      const left = surface(lv, x1 - 0.05, 0, Math.max(y1, y2) + 0.1).y >= Math.max(y1, y2) - 0.05; // земля слева → обрыв смотрит вправо
      const dir = left ? 1 : -1;
      ctx.save(); ctx.fillStyle = dirtPattern; ctx.beginPath(); ctx.moveTo(a, yt); ctx.lineTo(a + dir * P * 0.05, yt + (yb - yt) * 0.5); ctx.lineTo(a - dir * P * 0.02, yb); ctx.lineTo(a - dir * P * 0.6, yb); ctx.lineTo(a - dir * P * 0.6, yt); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(2, P * 0.04); ctx.beginPath(); ctx.moveTo(a, yt); ctx.lineTo(a + dir * P * 0.05, yt + (yb - yt) * 0.5); ctx.lineTo(a - dir * P * 0.02, yb); ctx.stroke();
      // корни свисают
      ctx.strokeStyle = '#6b4424'; ctx.lineWidth = Math.max(2, P * 0.05); ctx.lineCap = 'round';
      for (let r2 = 0; r2 < 3; r2++) { const y0 = yt + P * (0.3 + r2 * 0.35); ctx.beginPath(); ctx.moveTo(a, y0); ctx.quadraticCurveTo(a + dir * P * 0.25, y0 + P * 0.2, a + dir * P * (0.15 + r2 * 0.08), y0 + P * 0.55); ctx.stroke(); }
      ctx.restore();
    }
    // тело земли и дёрн
    for (let si = 0; si < segs.length; si++) {
      const [x1, y1, x2, y2, mat] = segs[si];
      const a = sx(x1), b = sx(x2), ya = sy(y1), yb = sy(y2);
      if (Math.max(a, b) < -80 || Math.min(a, b) > V.W + 80) continue;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(a - 1, ya); ctx.lineTo(b + 1, yb); ctx.lineTo(b + 1, V.H + 10); ctx.lineTo(a - 1, V.H + 10); ctx.closePath();
      ctx.fillStyle = mat === 'ice' ? '#7fb8d8' : dirtPattern; ctx.fill();
      // затенение вглубь (ambient occlusion)
      const ao = ctx.createLinearGradient(0, V.sy(Math.max(y1, y2)), 0, V.sy(Math.max(y1, y2)) + P * 2.5); ao.addColorStop(0, 'rgba(0,0,0,.0)'); ao.addColorStop(0.15, 'rgba(30,15,5,.28)'); ao.addColorStop(1, 'rgba(10,5,0,.55)');
      ctx.fillStyle = ao; ctx.fill();
      ctx.restore();
      // дёрн: полоса травы, повторяет наклон
      const len = Math.hypot(b - a, yb - ya), ang = Math.atan2(yb - ya, b - a), th = P * 0.32;
      ctx.save(); ctx.translate(a, ya); ctx.rotate(ang);
      if (mat === 'ice') {
        const ig = ctx.createLinearGradient(0, -th * 0.5, 0, th); ig.addColorStop(0, '#ffffff'); ig.addColorStop(0.4, '#cdeffd'); ig.addColorStop(1, '#8cc8e8');
        rr(ctx, -2, -th * 0.4, len + 4, th * 1.2, th * 0.3); fo(ctx, ig, Math.max(2, P * 0.035));
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; for (let x = 20; x < len - 30; x += 70) { ctx.beginPath(); ctx.moveTo(x, -th * 0.15); ctx.lineTo(x + 28, -th * 0.15); ctx.stroke(); }
      } else if (typeof mat === 'string' && mat.startsWith('conv:')) {
        rr(ctx, -2, -th * 0.4, len + 4, th * 1.1, th * 0.3); fo(ctx, '#3a3f4a', Math.max(2, P * 0.035));
      } else {
        const gg = ctx.createLinearGradient(0, -th * 0.6, 0, th); gg.addColorStop(0, '#9be36a'); gg.addColorStop(0.35, '#5fc04a'); gg.addColorStop(1, '#2f8a34');
        ctx.beginPath(); ctx.moveTo(-2, -th * 0.35);
        for (let x = 0; x <= len + 2; x += Math.max(6, P * 0.12)) ctx.lineTo(x, -th * 0.35 - Math.abs(Math.sin(x * 0.37 + x1)) * th * 0.25);
        ctx.lineTo(len + 2, th * 0.55);
        for (let x = len; x >= 0; x -= Math.max(8, P * 0.18)) ctx.lineTo(x, th * 0.55 + Math.abs(Math.sin(x * 0.21 + y1)) * th * 0.35);
        ctx.closePath(); fo(ctx, gg, Math.max(2, P * 0.035));
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1.5, P * 0.03); ctx.beginPath(); ctx.moveTo(4, -th * 0.22); ctx.lineTo(len - 4, -th * 0.22); ctx.stroke();
        if (mat === 'bounce') { for (let x = P * 0.2; x < len; x += P * 0.5) { const m = mushroomSprite(0), s2 = P / 45; ctx.drawImage(m, x - m.width * s2 / 2, -m.height * s2 + th * 0.2, m.width * s2, m.height * s2); } }
      }
      ctx.restore();
    }
    // декор на земле (за персонажем): трава, цветы, грибы, камни, палки
    drawGroundDeco(ctx, V, g, segs, false);
  }
  function drawGroundDeco(ctx, V, g, segs, front) {
    const P = V.PPM;
    for (let si = 0; si < segs.length; si++) {
      const [x1, y1, x2, y2, mat] = segs[si];
      if (mat !== 'ground') continue;
      if (Math.max(V.sx(x1), V.sx(x2)) < -60 || Math.min(V.sx(x1), V.sx(x2)) > V.W + 60) continue;
      for (let x = Math.ceil(x1 / 0.9) * 0.9; x < x2 - 0.2; x += 0.9) {
        if (x < x1 + 0.2) continue;
        const h = decoFor(si, x), y = y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
        const isFront = hash(Math.floor(x * 7), 3) < 0.22;
        if (isFront !== front) continue;
        let spr, sc = P / 60;
        if (h < 0.45) spr = grassTuftSprite(Math.floor(h * 100) % 5);
        else if (h < 0.62) { spr = flowerSprite(Math.floor(h * 100) % 5); sc *= 0.9; }
        else if (h < 0.72) { spr = mushroomSprite(Math.floor(h * 100) % 3); sc *= 0.8; }
        else if (h < 0.82) { spr = rockSprite(Math.floor(h * 100) % 4); sc *= 0.55; }
        else continue;
        if (front) sc *= 1.25;
        const w = spr.width * sc, hh = spr.height * sc;
        ctx.drawImage(spr, V.sx(x) - w / 2, V.sy(y) - hh + P * (front ? 0.22 : 0.06), w, hh);
      }
    }
  }
  function drawWater(ctx, V, a, b, wy, t) {
    const P = V.PPM, H = V.H;
    const g = ctx.createLinearGradient(0, wy, 0, wy + P * 2.5); g.addColorStop(0, '#6fd2ff'); g.addColorStop(0.25, '#2f9be0'); g.addColorStop(1, '#0d4f8a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a, H);
    for (let x = a; x <= b; x += 6) ctx.lineTo(x, wy + Math.sin(x / 16 + t * 2.6) * 2.5 + Math.sin(x / 7 - t * 3.3) * 1.2);
    ctx.lineTo(b, H); ctx.closePath(); ctx.fill();
    // отражение неба и блики
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(a, wy + 3, b - a, P * 0.18);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const x = a + ((i * 53 + t * 18) % Math.max(1, b - a)), y = wy + P * (0.25 + (i % 3) * 0.22); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(Math.min(b, x + P * 0.4), y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let x = a; x <= b; x += 6) { const y = wy + Math.sin(x / 16 + t * 2.6) * 2.5 + Math.sin(x / 7 - t * 3.3) * 1.2; x === a ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }
  function drawStakes(ctx, a, b, base, P) {
    const n = Math.max(3, Math.round((b - a) / (P * 0.32))), w = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const x = a + i * w + w * 0.5, h = P * (0.55 + hash(i, 2) * 0.2);
      ctx.beginPath(); ctx.moveTo(x - w * 0.32, base); ctx.lineTo(x - w * 0.22, base - h * 0.75); ctx.lineTo(x, base - h); ctx.lineTo(x + w * 0.22, base - h * 0.75); ctx.lineTo(x + w * 0.32, base); ctx.closePath();
      const g = ctx.createLinearGradient(x - w * 0.3, 0, x + w * 0.3, 0); g.addColorStop(0, '#d9a660'); g.addColorStop(1, '#8a5a2a');
      fo(ctx, g, Math.max(1.5, P * 0.03));
      ctx.fillStyle = '#f1e2c4'; ctx.beginPath(); ctx.moveTo(x, base - h); ctx.lineTo(x - w * 0.1, base - h * 0.82); ctx.lineTo(x + w * 0.1, base - h * 0.82); ctx.fill();
    }
  }

  // =====================================================================
  // ПРЕДМЕТЫ: бревно, мостик, столбики, платформы, качели, доска
  // =====================================================================
  function drawObjects(ctx, V, g, t, theme) {
    const P = V.PPM, sx = V.sx, sy = V.sy;
    for (const o of g.lv.objs) {
      if (o.type === 'log') {
        const x = sx(o.cx), y = sy(o.cy), r = o.r * P; if (x < -r * 3 || x > V.W + r * 3) continue;
        softShadow(ctx, x, y + r * 0.1, r * 3, r * 0.6, 0.4);
        // бревно лежит поперёк: видна кора и торец
        ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath();
        const bg = ctx.createLinearGradient(0, y - r, 0, y); bg.addColorStop(0, '#9a6a3e'); bg.addColorStop(0.5, '#7a4f2c'); bg.addColorStop(1, '#4e2f17'); fo(ctx, bg, Math.max(2, P * 0.04));
        ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(40,20,8,.45)'; ctx.lineWidth = Math.max(1.5, P * 0.025);
        for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * r * 0.3, y - r); ctx.quadraticCurveTo(x + k * r * 0.3 + r * 0.1, y - r * 0.5, x + k * r * 0.3 - r * 0.05, y); ctx.stroke(); }
        ctx.fillStyle = '#5aa64a'; ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.95, r * 0.55, r * 0.16, 0, 0, 7); ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(x - r * 0.4, y - r * 0.55, r * 0.11, r * 0.08, 0, 0, 7); fo(ctx, '#3f2412', 0);
        continue;
      }
      if (o.type === 'rock') { // большой камень поперёк тропы
        const x = sx(o.cx), y = sy(o.cy), r = o.r * P; if (x < -r * 3 || x > V.W + r * 3) continue;
        softShadow(ctx, x, sy(o.cy + o.r * 0.15) + 2, r * 2.8, r * 0.5, 0.4);
        const spr = rockSprite(Math.round(o.cx * 7) % 4), w = r * 2.4, h = r * 1.0 * (o.k || 1) * 1.15 + r * 0.25;
        ctx.drawImage(spr, x - w / 2, sy(o.cy + o.r * (o.k || 1)) - r * 0.08, w, h + r * 0.1);
        continue;
      }
      if (o.type === 'bridge') {
        const a = sx(o.x0), b = sx(o.x1); if (b < -60 || a > V.W + 60) continue;
        const n = Math.max(6, Math.round((o.x1 - o.x0) / 0.32)), yAt = (x) => surface(g.lv, x, g.t, o.y0 + 0.1).y;
        for (const side of [1.15, 1.05]) { ctx.strokeStyle = side > 1.1 ? '#8a6a44' : '#a8835a'; ctx.lineWidth = Math.max(2, P * 0.05); ctx.beginPath(); for (let i = 0; i <= n; i++) { const x = o.x0 + (o.x1 - o.x0) * (i / n); i ? ctx.lineTo(sx(x), sy(yAt(x) + side)) : ctx.moveTo(sx(x), sy(yAt(x) + side)); } ctx.stroke(); }
        for (let i = 0; i < n; i++) {
          const x = o.x0 + (o.x1 - o.x0) * ((i + 0.5) / n), y = yAt(x), pw = (P * (o.x1 - o.x0)) / n;
          ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = Math.max(1, P * 0.02); ctx.beginPath(); ctx.moveTo(sx(x), sy(y)); ctx.lineTo(sx(x), sy(y + 1.08)); ctx.stroke();
          rr(ctx, sx(x) - pw / 2 + 1.5, sy(y) - P * 0.04, pw - 3, P * 0.18, P * 0.04); fo(ctx, i % 2 ? '#c48a4c' : '#d39b5a', Math.max(1.5, P * 0.025));
        }
        for (const px of [o.x0, o.x1]) { const y = sy(o.y0); rr(ctx, sx(px) - P * 0.09, y - P * 1.3, P * 0.18, P * 1.4, P * 0.05); fo(ctx, '#8a5a2a', Math.max(2, P * 0.035)); }
        continue;
      }
      if (o.type === 'seesaw') {
        const x = sx(o.px), y = sy(o.py); if (x < -P * 4 || x > V.W + P * 4) continue;
        const rk = rockSprite(2), s2 = P / 70; ctx.drawImage(rk, x - rk.width * s2 / 2, y - rk.height * s2 * 0.6, rk.width * s2, rk.height * s2);
        ctx.save(); ctx.translate(x, y); ctx.rotate(-o.a);
        plank(ctx, -o.hl * P, -P * 0.12, o.hl * 2 * P, P * 0.24, P);
        ctx.beginPath(); ctx.arc(0, 0, P * 0.1, 0, 7); fo(ctx, '#9aa4b1', Math.max(1.5, P * 0.025));
        ctx.restore(); continue;
      }
      if (o.type === 'swing') {
        const st = objState(o, g.t), a = sx(st.x0), b = sx(st.x1), y = sy(st.y), px = sx(o.px), py = sy(o.py);
        if (b < -60 || a > V.W + 60) continue;
        ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = Math.max(2, P * 0.04); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(a + P * 0.15, y); ctx.moveTo(px, py); ctx.lineTo(b - P * 0.15, y); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, P * 0.12, 0, 7); fo(ctx, '#9aa4b1', 2);
        softShadow(ctx, (a + b) / 2, sy(st.y - 3), b - a, P * 0.4, 0.2);
        plank(ctx, a, y - P * 0.04, b - a, P * 0.26, P); continue;
      }
      // платформы
      const st = objState(o, g.t), a = sx(st.x0), b = sx(st.x1), y = sy(st.y); if (b < -60 || a > V.W + 60) continue;
      if (o.look === 'post') { // столбик-пень
        const w = b - a, gr = ctx.createLinearGradient(a, 0, b, 0); gr.addColorStop(0, '#9a6a3e'); gr.addColorStop(0.5, '#7a4f2c'); gr.addColorStop(1, '#4e2f17');
        rr(ctx, a + w * 0.05, y, w * 0.9, V.H - y + 10, w * 0.15); fo(ctx, gr, Math.max(2, P * 0.035));
        ctx.beginPath(); ctx.ellipse((a + b) / 2, y + 2, w * 0.47, P * 0.12, 0, 0, 7); fo(ctx, '#e0b07a', Math.max(2, P * 0.03));
        ctx.strokeStyle = '#b07a42'; ctx.lineWidth = 1.5; for (const k of [0.32, 0.18]) { ctx.beginPath(); ctx.ellipse((a + b) / 2, y + 2, w * k, P * 0.06, 0, 0, 7); ctx.stroke(); }
      } else if (o.look === 'floe') {
        const ig = ctx.createLinearGradient(0, y, 0, y + P * 0.5); ig.addColorStop(0, '#ffffff'); ig.addColorStop(1, '#8cc8e8');
        rr(ctx, a, y - P * 0.05, b - a, P * 0.45, P * 0.12); fo(ctx, ig, Math.max(2, P * 0.035));
      } else if (o.look === 'raft') {
        const n = Math.max(3, Math.round((b - a) / (P * 0.32))), lw2 = (b - a) / n;
        for (let i = 0; i < n; i++) { const lx = a + i * lw2; rr(ctx, lx + 1, y - P * 0.06, lw2 - 2, P * 0.3, P * 0.12); const lg = ctx.createLinearGradient(lx, 0, lx + lw2, 0); lg.addColorStop(0, '#b07a42'); lg.addColorStop(0.5, '#8a5a2a'); lg.addColorStop(1, '#5e3a17'); fo(ctx, lg, Math.max(1.5, P * 0.025)); ctx.beginPath(); ctx.ellipse(lx + lw2 / 2, y - P * 0.04, lw2 * 0.42, P * 0.05, 0, 0, 7); ctx.fillStyle = '#e0b07a'; ctx.fill(); }
        ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = Math.max(2, P * 0.04); for (const k of [0.2, 0.8]) { ctx.beginPath(); ctx.moveTo(a + (b - a) * k, y - P * 0.06); ctx.lineTo(a + (b - a) * k, y + P * 0.24); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a - P * 0.2, y + P * 0.3); ctx.quadraticCurveTo((a + b) / 2, y + P * 0.38, b + P * 0.2, y + P * 0.3); ctx.stroke();
      } else if (o.look === 'lift') {
        ctx.strokeStyle = '#5b6170'; ctx.lineWidth = Math.max(2, P * 0.03); for (const x of [a + P * 0.15, b - P * 0.15]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, -10); ctx.stroke(); }
        plank(ctx, a, y - P * 0.04, b - a, P * 0.3, P, '#ffcf3f');
      } else { // деревянная платформа на тросах/опорах
        softShadow(ctx, (a + b) / 2, y + P * 0.6, b - a, P * 0.3, 0.25);
        plank(ctx, a, y - P * 0.04, b - a, P * 0.34, P);
      }
    }
  }
  // доска/платформа из досок: верхняя грань, боковина, гвозди
  function plank(ctx, x, y, w, h, P, col = '#c98d4a') {
    const lw = Math.max(1.5, P * 0.03);
    rr(ctx, x, y, w, h, h * 0.3); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(col, 30)); g.addColorStop(0.4, col); g.addColorStop(1, shade(col, -45)); fo(ctx, g, lw);
    ctx.strokeStyle = 'rgba(80,45,15,.45)'; ctx.lineWidth = Math.max(1, P * 0.015);
    const n = Math.max(1, Math.round(w / (P * 0.6)));
    for (let i = 1; i < n; i++) { const xx = x + (w * i) / n; ctx.beginPath(); ctx.moveTo(xx, y + 2); ctx.lineTo(xx, y + h - 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + 4, y + h * 0.55); ctx.lineTo(x + w - 4, y + h * 0.55); ctx.stroke();
    ctx.fillStyle = '#6b707a'; for (let i = 0; i < n; i++) { const xx = x + (w * (i + 0.5)) / n; for (const dx of [-0.25, 0.25]) { ctx.beginPath(); ctx.arc(xx + dx * (w / n), y + h * 0.3, Math.max(1.2, P * 0.025), 0, 7); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x + 4, y + 2, w - 8, Math.max(1.5, h * 0.12));
  }

  // =====================================================================
  // МОНЕТЫ, ФЛАЖКИ, ФИНИШ
  // =====================================================================
  function coinFace(ctx, r, spin, t) {
    const k = Math.cos(spin), w = Math.max(0.12, Math.abs(k));
    ctx.save(); ctx.scale(w, 1);
    // ребро
    ctx.fillStyle = '#b06a08'; ctx.beginPath(); ctx.ellipse(r * 0.12 * Math.sign(k || 1), 0, r, r, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff6b0'); g.addColorStop(0.45, '#ffcf3f'); g.addColorStop(1, '#d48a10');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); fo(ctx, g, r * 0.12, '#8a5206');
    ctx.strokeStyle = 'rgba(160,95,10,.8)'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, 7); ctx.stroke();
    if (w > 0.35) { ctx.fillStyle = '#e7a21c'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? r * 0.2 : r * 0.46, b = (i / 10) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(b) * rr2, Math.sin(b) * rr2); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // блик пробегает
    const sw = ((t * 0.8) % 2) - 0.5;
    if (sw > -0.3 && sw < 1.3) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * w, 0, 7); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.translate((sw - 0.5) * r * 3, 0); ctx.rotate(0.5); ctx.fillRect(-r * 0.15, -r * 2, r * 0.3, r * 4); ctx.restore(); }
  }
  function drawCoins(ctx, V, g, t) {
    const P = V.PPM;
    g.lv.coins.forEach(([cx, cy], i) => {
      if (g.coinsTaken.has(i)) return;
      const x = V.sx(cx), y = V.sy(cy) + Math.sin(t * 2.6 + i) * P * 0.08; if (x < -40 || x > V.W + 40) return;
      const r = P * 0.27;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.2); gl.addColorStop(0, 'rgba(255,220,90,.45)'); gl.addColorStop(1, 'rgba(255,220,90,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(x, y); coinFace(ctx, r, t * 2.4 + i, t + i * 0.3); ctx.restore();
    });
  }
  function drawCheckpoints(ctx, V, g, t, actT) {
    const P = V.PPM;
    g.lv.checkpoints.forEach(([cx, cy], k) => {
      const x = V.sx(cx), y = V.sy(cy); if (x < -80 || x > V.W + 80) return;
      const on = g.checkpoint >= k, since = actT && actT[k] !== undefined ? t - actT[k] : 9;
      softShadow(ctx, x, y + 2, P * 0.8, P * 0.18, 0.35);
      // столб
      rr(ctx, x - P * 0.07, y - P * 2.7, P * 0.14, P * 2.7, P * 0.05); const pg = ctx.createLinearGradient(x - P * 0.07, 0, x + P * 0.07, 0); pg.addColorStop(0, '#b07a42'); pg.addColorStop(1, '#6b4424'); fo(ctx, pg, Math.max(1.5, P * 0.03));
      rr(ctx, x - P * 0.2, y - P * 0.12, P * 0.4, P * 0.14, P * 0.04); fo(ctx, '#7a7f88', Math.max(1.5, P * 0.025));
      // фонарь
      const ly = y - P * 2.8;
      if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createRadialGradient(x, ly, 2, x, ly, P * 1.1); lg.addColorStop(0, 'rgba(255,230,140,.7)'); lg.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, ly, P * 1.1, 0, 7); ctx.fill(); ctx.restore(); }
      rr(ctx, x - P * 0.15, ly - P * 0.2, P * 0.3, P * 0.36, P * 0.06); fo(ctx, on ? '#ffe9a0' : '#8b9099', Math.max(1.5, P * 0.03));
      ctx.fillStyle = '#4a4f58'; ctx.fillRect(x - P * 0.17, ly - P * 0.24, P * 0.34, P * 0.07);
      // флаг: поднимается при активации
      const rise = on ? Math.min(1, since / 0.5) : 0, fy = y - P * (1.0 + 1.25 * rise), wave = Math.sin(t * 6) * P * 0.05;
      ctx.beginPath(); ctx.moveTo(x + P * 0.07, fy - P * 0.5); ctx.quadraticCurveTo(x + P * 0.5, fy - P * 0.45 + wave, x + P * 0.9, fy - P * 0.3 + wave); ctx.lineTo(x + P * 0.07, fy - P * 0.05); ctx.closePath();
      fo(ctx, on ? '#3fd06a' : '#a7aeb8', Math.max(1.5, P * 0.03));
      if (on) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + P * 0.36, fy - P * 0.28 + wave * 0.5, P * 0.08, 0, 7); ctx.fill(); }
      // кольцо-волна при активации
      if (since < 0.8) { ctx.strokeStyle = `rgba(120,255,160,${1 - since / 0.8})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y, P * (0.4 + since * 2.5), P * (0.12 + since * 0.6), 0, 0, 7); ctx.stroke(); }
    });
  }
  function drawFinish(ctx, V, g, t, won) {
    const P = V.PPM, lv = g.lv, x = V.sx(lv.finish), y = V.sy(lv.finishY);
    if (x < -P * 6 || x > V.W + P * 6) return;
    const W2 = P * 3.6, Ht = P * 4.6, l = x - W2 * 0.2, r2 = l + W2;
    softShadow(ctx, (l + r2) / 2, y + 3, W2 * 1.2, P * 0.3, 0.35);
    // столбы арки
    for (const px of [l, r2]) { rr(ctx, px - P * 0.14, y - Ht, P * 0.28, Ht, P * 0.08); const pg = ctx.createLinearGradient(px - P * 0.14, 0, px + P * 0.14, 0); pg.addColorStop(0, '#c48a4c'); pg.addColorStop(1, '#7a4f2c'); fo(ctx, pg, Math.max(2, P * 0.035)); }
    // гирлянда флажков
    const cols = ['#e5483a', '#ffd34d', '#3fae49', '#3a8bff', '#ff6fb5'];
    ctx.strokeStyle = '#6b4424'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l, y - Ht * 0.62); ctx.quadraticCurveTo((l + r2) / 2, y - Ht * 0.48, r2, y - Ht * 0.62); ctx.stroke();
    for (let i = 1; i < 9; i++) { const u2 = i / 9, bx = l + (r2 - l) * u2, by = y - Ht * 0.62 + Math.sin(u2 * Math.PI) * Ht * 0.14 * 0.5 * 2 * 0.5 + Math.sin(u2 * Math.PI) * Ht * 0.07; ctx.beginPath(); ctx.moveTo(bx - P * 0.13, by); ctx.lineTo(bx + P * 0.13, by); ctx.lineTo(bx, by + P * 0.3 + Math.sin(t * 5 + i) * 2); ctx.closePath(); fo(ctx, cols[i % cols.length], 1.5); }
    // баннер «ФИНИШ» с клетками
    const by = y - Ht - P * 0.1, bh = P * 0.8;
    rr(ctx, l - P * 0.3, by, r2 - l + P * 0.6, bh, P * 0.18); fo(ctx, '#ffffff', Math.max(2, P * 0.04));
    const sq = bh / 4;
    ctx.save(); rr(ctx, l - P * 0.3, by, r2 - l + P * 0.6, bh, P * 0.18); ctx.clip();
    for (let rI = 0; rI < 4; rI++) for (let c = 0; c * sq < r2 - l + P * 0.6; c++) if ((rI + c) % 2) { ctx.fillStyle = '#222'; ctx.fillRect(l - P * 0.3 + c * sq, by + rI * sq, sq, sq); }
    ctx.restore();
    rr(ctx, (l + r2) / 2 - P * 1.0, by + bh * 0.15, P * 2.0, bh * 0.7, P * 0.12); fo(ctx, '#ffd34d', 2);
    ctx.fillStyle = '#5a2a00'; ctx.font = `900 ${Math.round(bh * 0.48)}px Rubik,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ФИНИШ', (l + r2) / 2, by + bh * 0.52); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // воздушные шары
    for (const [px, c, k] of [[l, '#e5483a', 0], [l, '#3a8bff', 1], [r2, '#ffd34d', 2], [r2, '#3fae49', 3]]) {
      const bx = px + (k % 2 ? P * 0.35 : -P * 0.35) + Math.sin(t * 1.5 + k) * P * 0.08, byy = by - P * (0.6 + (k % 2) * 0.35) + Math.sin(t * 2 + k) * P * 0.06;
      ctx.strokeStyle = 'rgba(80,60,40,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, by + P * 0.1); ctx.lineTo(bx, byy + P * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx, byy, P * 0.28, P * 0.36, 0, 0, 7); const bg = ctx.createRadialGradient(bx - P * 0.1, byy - P * 0.12, 2, bx, byy, P * 0.36); bg.addColorStop(0, shade(c, 60)); bg.addColorStop(1, c); fo(ctx, bg, 1.5);
    }
    // линия финиша на земле
    for (let c = 0; c < 8; c++) { ctx.fillStyle = c % 2 ? '#222' : '#fff'; ctx.fillRect(l + ((r2 - l) / 8) * c, y - 3, (r2 - l) / 8, 6); }
    if (won) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient((l + r2) / 2, y - Ht / 2, 2, (l + r2) / 2, y - Ht / 2, Ht); gl.addColorStop(0, 'rgba(255,240,170,.35)'); gl.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = gl; ctx.fillRect(l - Ht, y - Ht * 1.5, Ht * 3, Ht * 2); ctx.restore(); }
  }

  // передний план: размытые кусты и трава у нижнего края (параллакс быстрее камеры)
  function drawForeground(ctx, V, t) {
    const P = V.PPM, k = 1.35, per = 420, s0 = Math.floor((V.cam.x * P * k) / per) - 1;
    ctx.save(); ctx.globalAlpha = 0.9;
    for (let i = s0; i < s0 + Math.ceil(V.W / per) + 3; i++) {
      if (hash(i, 61) < 0.45) continue;
      const spr = bushSprite(20 + (i % 4)), sc = P / 34 * (0.9 + hash(i, 62) * 0.4), w = spr.width * sc, h = spr.height * sc;
      const x = i * per - V.cam.x * P * k + hash(i, 63) * 140;
      ctx.drawImage(spr, x, V.H - h * 0.55, w, h);
    }
    ctx.restore();
    // мягкая виньетка
    const vg = ctx.createRadialGradient(V.W / 2, V.H * 0.45, Math.min(V.W, V.H) * 0.35, V.W / 2, V.H * 0.5, Math.max(V.W, V.H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,30,20,.28)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, V.W, V.H);
  }

  // тени персонажа на земле (стопы и тело)
  function drawHeroShadows(ctx, V, g) {
    const P = V.PPM, H = g.H;
    for (const f of g.F) { const s = surface(g.lv, f.x, g.t, f.y + 0.3); if (s.y < -1e8) continue; const hgt = Math.max(0, f.y - s.y); softShadow(ctx, V.sx(f.x), V.sy(s.y) + 2, P * (0.5 + hgt * 0.2), P * 0.14, 0.4 / (1 + hgt)); }
    const s = surface(g.lv, H.x, g.t, H.y); if (s.y > -1e8) softShadow(ctx, V.sx(H.x), V.sy(s.y) + 3, P * 1.3, P * 0.24, 0.22);
  }

  root.Gfx = { drawHero, drawDizzy, drawForestBackground, drawNearTrees, drawForestGround, drawGroundDeco, drawObjects, drawCoins, coinFace, drawCheckpoints, drawFinish, drawForeground, drawHeroShadows, softShadow, treeSprite, bushSprite, shade, _spr: { mountainStrip, forestStrip, cloudSprite, pineSprite, treeSprite } };
  // персонаж везде рисуется по-новому (меню, магазин, все миры)
  Art.drawCharacter = (ctx, ch, sk, pose, u) => drawHero(ctx, ch, sk, pose, u);
  Art.drawDizzy = drawDizzy;
})(window);
