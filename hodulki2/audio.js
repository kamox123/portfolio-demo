// Звук «Ходульщика 2»: эффекты и фоновая музыка синтезируются на лету (Web Audio), без файлов.
(function (root) {
  'use strict';
  let ac = null, sfxGain = null, musGain = null, musicTimer = null, musicWorld = -1, step = 0, nextTime = 0;
  const vol = { sfx: 0.8, music: 0.5 };

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); sfxGain = ac.createGain(); musGain = ac.createGain();
      sfxGain.connect(ac.destination); musGain.connect(ac.destination);
      sfxGain.gain.value = vol.sfx; musGain.gain.value = vol.music * 0.35;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, d, type = 'sine', v = 0.2, slide = 0, delay = 0, out) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out || sfxGain); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v = 0.3, freq = 800, type = 'lowpass') {
    const a = ctx(); if (!a) return;
    const len = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, len, a.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = type; f.frequency.value = freq; g.gain.value = v;
    s.buffer = buf; s.connect(f).connect(g).connect(sfxGain); s.start();
  }
  const sfx = {
    step: () => { noise(0.08, 0.4, 450); tone(85 + Math.random() * 20, 0.08, 'sine', 0.25); },
    lift: () => noise(0.12, 0.08, 2500, 'highpass'),
    coin: () => { tone(1046, 0.08, 'square', 0.06); tone(1568, 0.15, 'square', 0.06, 0, 0.07); },
    bump: () => { tone(160, 0.15, 'triangle', 0.2, -60); noise(0.1, 0.2, 700); },
    scrape: () => noise(0.18, 0.18, 1200, 'bandpass'),
    touch: () => { noise(0.05, 0.25, 600); tone(110, 0.05, 'sine', 0.12); },
    fall: () => { tone(420, 0.6, 'sawtooth', 0.07, -340); noise(0.35, 0.35, 300); setTimeout(() => noise(0.2, 0.4, 200), 300); },
    splash: () => { noise(0.5, 0.4, 1500, 'bandpass'); tone(300, 0.3, 'sine', 0.1, -200); },
    bounce: () => tone(220, 0.3, 'sine', 0.25, 500),
    checkpoint: () => [659, 784, 988].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, 0, i * 0.08)),
    win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, 0, i * 0.09)),
    unlock: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.06, 0, i * 0.06)); tone(1568, 0.5, 'sine', 0.1, 0, 0.35); },
    click: () => tone(700, 0.05, 'triangle', 0.1),
  };

  // ---------- музыка: у каждого мира свой лад и темп ----------
  const SONGS = [
    { bpm: 112, root: 60, scale: [0, 2, 4, 7, 9], lead: 'triangle', bass: 'sine' },     // лес
    { bpm: 96, root: 57, scale: [0, 2, 3, 7, 8], lead: 'triangle', bass: 'triangle' },  // горы
    { bpm: 124, root: 55, scale: [0, 3, 5, 7, 10], lead: 'square', bass: 'square' },    // стройка
    { bpm: 90, root: 64, scale: [0, 2, 4, 7, 11], lead: 'sine', bass: 'sine' },         // лёд
    { bpm: 132, root: 52, scale: [0, 1, 5, 7, 8], lead: 'square', bass: 'sawtooth' },   // фабрика
    { bpm: 104, root: 62, scale: [0, 4, 6, 7, 11], lead: 'sine', bass: 'triangle' },    // страна чудес
  ];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let pattern = [];
  function makePattern(w) {
    // простая мелодия: 32 шага, ноты из лада, со «случайной», но постоянной для мира раскладкой
    let s = w * 97 + 13; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const sc = SONGS[w].scale; pattern = [];
    for (let i = 0; i < 32; i++) pattern.push(rnd() < (i % 4 === 0 ? 0.95 : 0.55) ? sc[Math.floor(rnd() * sc.length)] + (rnd() < 0.25 ? 12 : 0) : null);
  }
  function tick() {
    const a = ac; if (!a || musicWorld < 0) return;
    const song = SONGS[musicWorld], dur = 60 / song.bpm / 2;
    while (nextTime < a.currentTime + 0.25) {
      const i = step % 32, n = pattern[i], dt = nextTime - a.currentTime;
      if (n !== null) tone(midi(song.root + 12 + n), dur * 0.9, song.lead, 0.12, 0, Math.max(0, dt), musGain);
      if (i % 4 === 0) tone(midi(song.root - 12 + song.scale[(Math.floor(step / 8)) % 3 === 2 ? 3 : 0]), dur * 3.5, song.bass, 0.18, 0, Math.max(0, dt), musGain);
      if (i % 8 === 4) { const ns = a.createBufferSource(); const len = a.sampleRate * 0.05, b = a.createBuffer(1, len, a.sampleRate), c = b.getChannelData(0); for (let k = 0; k < len; k++) c[k] = (Math.random() * 2 - 1) * (1 - k / len); ns.buffer = b; const g = a.createGain(); g.gain.value = 0.08; ns.connect(g).connect(musGain); ns.start(a.currentTime + Math.max(0, dt)); }
      nextTime += dur; step++;
    }
  }
  function music(world) {
    if (!ctx()) return;
    if (world === musicWorld) return;
    musicWorld = world; step = 0; nextTime = ac.currentTime + 0.1;
    if (world >= 0) makePattern(world);
    if (!musicTimer) musicTimer = setInterval(tick, 100);
  }
  function setVolume(kind, v) {
    vol[kind] = v;
    if (sfxGain) sfxGain.gain.value = vol.sfx;
    if (musGain) musGain.gain.value = vol.music * 0.35;
  }

  root.Snd = { sfx, music, setVolume, unlock: ctx };
})(window);
