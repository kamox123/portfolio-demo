// Нарисованные значки интерфейса (SVG) — вместо эмодзи
(function (root) {
  'use strict';
  const S = (inner, vb = '0 0 24 24') => `<svg class="ico" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
  const ICON = {
    play: S('<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="rgba(0,0,0,.25)" stroke-width="1"/>'),
    pause: S('<rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/>'),
    back: S('<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    next: S('<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    hero: S('<circle cx="12" cy="6.5" r="3.6" fill="#ffd2a8" stroke="#3a2416" stroke-width="1.4"/><path d="M8.5 5.6a3.7 3.4 0 0 1 7 0z" fill="#e5483a" stroke="#3a2416" stroke-width="1.2"/><path d="M7.5 11.5h9l.8 5.5h-10.6z" fill="#3fa7ff" stroke="#3a2416" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.5 17l-1.5 5.5M14.5 17l1.5 5.5" stroke="#c98d4a" stroke-width="2.2" stroke-linecap="round"/>'),
    map: S('<path d="M3 6.5l5.5-2.5 7 2.5 5.5-2.5v13.5l-5.5 2.5-7-2.5L3 20z" fill="#7fd65c" stroke="#2a5a20" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" stroke="#2a5a20" stroke-width="1.2" opacity=".6"/><path d="M5.5 15c2-1 3-3.5 5-3.2s2.5 2.6 5 1.8 2.5-3 3.5-4.3" fill="none" stroke="#e5483a" stroke-width="1.8" stroke-dasharray="2 2"/>'),
    gear: S('<path d="M12 2.8l1.6 2.2 2.7-.5.6 2.7 2.5 1.2-1 2.6 1 2.6-2.5 1.2-.6 2.7-2.7-.5L12 21.2l-1.6-2.2-2.7.5-.6-2.7-2.5-1.2 1-2.6-1-2.6 2.5-1.2.6-2.7 2.7.5z" fill="#c9d1db" stroke="#3a4250" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.3" fill="#6b7383" stroke="#3a4250" stroke-width="1.4"/>'),
    lock: S('<path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" fill="none" stroke="#5d6673" stroke-width="2.6"/><rect x="5" y="10.5" width="14" height="10.5" rx="2.6" fill="#ffcf3f" stroke="#7a5200" stroke-width="1.5"/><circle cx="12" cy="15" r="1.6" fill="#7a5200"/><path d="M12 15.5v2.6" stroke="#7a5200" stroke-width="1.6" stroke-linecap="round"/>'),
    star: S('<path d="M12 2.6l2.9 6 6.5.9-4.7 4.5 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z" fill="#ffd34d" stroke="#a86a00" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 5.5l1.7 3.6" stroke="#fff6c2" stroke-width="1.3" stroke-linecap="round"/>'),
    starOff: S('<path d="M12 2.6l2.9 6 6.5.9-4.7 4.5 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)" stroke-width="1.4" stroke-linejoin="round"/>'),
    bulb: S('<path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.5 1 1.2 1 2V17h5.6v-.7c0-.8.4-1.5 1-2A6.5 6.5 0 0 0 12 2.5z" fill="#ffe36b" stroke="#a86a00" stroke-width="1.4"/><rect x="9.2" y="17.6" width="5.6" height="3.4" rx="1.2" fill="#c9d1db" stroke="#5d6673" stroke-width="1.2"/>'),
    bonk: S('<path d="M12 2l2.2 5.2 5.3-1.7-2.6 4.9 4.6 3.1-5.5 1 .6 5.6-4.6-3.3-4.6 3.3.6-5.6-5.5-1 4.6-3.1L4.5 5.5l5.3 1.7z" fill="#ff7a4a" stroke="#8a2a00" stroke-width="1.3" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="#ffe36b"/>'),
    coin: S('<circle cx="12" cy="12" r="9.5" fill="#d48a10"/><circle cx="12" cy="11.4" r="9" fill="url(#cg)" stroke="#8a5206" stroke-width="1.3"/><circle cx="12" cy="11.4" r="6.4" fill="none" stroke="#b06a08" stroke-width="1.2"/><path d="M12 6.8l1.4 2.8 3 .4-2.2 2.1.5 3L12 13.7l-2.7 1.4.5-3-2.2-2.1 3-.4z" fill="#e7a21c"/><defs><radialGradient id="cg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffcf3f"/><stop offset="1" stop-color="#d48a10"/></radialGradient></defs>'),
    flag: S('<path d="M5 3v18" stroke="#5a3a20" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z" fill="#fff" stroke="#222" stroke-width="1.2"/><path d="M6 4h3v4H6zM12 4h3v4h-3zM9 8h3v4H9zM15 8h3l-1.5 2z" fill="#222"/>'),
    shirt: S('<path d="M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z" fill="#3fa7ff" stroke="#1f4f8a" stroke-width="1.4" stroke-linejoin="round"/>'),
    stilt: S('<path d="M8 2l3 20M16 2l-3 20" stroke="#c98d4a" stroke-width="2.8" stroke-linecap="round"/><path d="M8.3 4l.6 4M15.7 4l-.6 4" stroke="#4aa3ff" stroke-width="3.4" stroke-linecap="round"/>'),
  };
  // вставляет значок в начало каждого элемента с data-icon="имя"
  function applyIcons(rootEl = document) {
    rootEl.querySelectorAll('[data-icon]').forEach((el) => { if (el.dataset.iconDone) return; el.insertAdjacentHTML('afterbegin', ICON[el.dataset.icon] || ''); el.dataset.iconDone = '1'; });
  }
  root.ICON = ICON; root.applyIcons = applyIcons;
})(window);
