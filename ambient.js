/* Quiet — ambient beach scene + gentle wave sound.
 * Off by default. Three states cycle on tap:
 *   off    → clean Quiet, no scene, no sound
 *   scene  → stylized beach visuals only
 *   sound  → beach visuals + looping wave audio (waves.mp3)
 * State persists in Store.meta('ambient'). Audio never autoplays — it starts
 * only after a user gesture (the toggle tap), reusing the Pocket Card iOS unlock
 * pattern. The canvas foam wash breathes on the same slow swell as the audio LFO,
 * so sight and sound rise and fall together. RAF is gated on visible + enabled +
 * not-reduced-motion, so it idles at ~0% CPU when not needed.
 *
 * Depends on STORE (from app.js) being defined globally. Loads after app.js. */
(function () {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('btnAmbient');
  const sceneEl = document.getElementById('scene');
  const waves = document.getElementById('waves');
  const canvas = document.getElementById('foam');
  if (!btn || !sceneEl || !canvas) return;

  const STATES = ['off', 'scene', 'sound'];
  const LABELS = { off: 'off', scene: 'scene only', sound: 'scene + waves' };
  let state = 'off';

  /* ---- Build palm-frond leaflets along each stem (so we don't hand-author 60 lines) ---- */
  function buildFronds() {
    const specs = [
      { sel: '.frond-l .leaflets', from: [-10, 8], to: [205, 175], side: 1 },
      { sel: '.frond-r .leaflets', from: [310, 8], to: [95, 175], side: -1 },
    ];
    specs.forEach(({ sel, from, to, side }) => {
      const g = document.querySelector(sel);
      if (!g) return;
      const n = 26;
      for (let i = 1; i < n; i++) {
        const f = i / n;
        // point along a quadratic-ish curve from `from` toward `to`
        const cx = from[0] + (to[0] - from[0]) * f;
        const cy = from[1] + (to[1] - from[1]) * (f * f * 0.7 + f * 0.3);
        // leaflet length tapers toward the tip
        const len = 46 * (1 - f * 0.8) + 8;
        // angle: fan outward, drooping more toward the tip
        const baseAng = side > 0 ? 200 : 340;
        const spread = 38 * Math.sin(f * Math.PI);
        [-1, 1].forEach(dir => {
          const ang = (baseAng + dir * (30 + spread)) * Math.PI / 180;
          const x2 = cx + Math.cos(ang) * len;
          const y2 = cy + Math.sin(ang) * len;
          const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          ln.setAttribute('x1', cx.toFixed(1)); ln.setAttribute('y1', cy.toFixed(1));
          ln.setAttribute('x2', x2.toFixed(1)); ln.setAttribute('y2', y2.toFixed(1));
          g.appendChild(ln);
        });
      }
    });
  }
  buildFronds();

  /* ---- Canvas foam wash, synced to a slow swell LFO ---- */
  let raf = 0, running = false, t0 = 0;
  const SWELL_PERIOD = 8; // seconds per wave; matches the audio's gentle cadence
  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
  }
  function foamColor() {
    return getComputedStyle(sceneEl).getPropertyValue('--foam-col').trim() || '#fff';
  }
  function drawFoam(now) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const tt = (now - t0) / 1000;
    // global swell 0..1 (the same breath the audio rides)
    const swell = 0.5 + 0.5 * Math.sin((tt / SWELL_PERIOD) * Math.PI * 2 - Math.PI / 2);
    const col = foamColor();
    // The foam line: a soft wavy band whose vertical position advances with the swell.
    const baseY = h * (0.55 - 0.32 * swell); // wash advances up the beach as the wave comes in
    ctx.save();
    // soft foam fill below the line
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += Math.max(6, w / 80)) {
      const ripple = Math.sin(x / w * Math.PI * 6 + tt * 1.1) * (h * 0.025)
                   + Math.sin(x / w * Math.PI * 13 - tt * 0.7) * (h * 0.012);
      ctx.lineTo(x, baseY + ripple);
    }
    ctx.lineTo(w, h); ctx.closePath();
    const grad = ctx.createLinearGradient(0, baseY - h * 0.1, 0, h);
    grad.addColorStop(0, hexA(col, 0));
    grad.addColorStop(0.25, hexA(col, 0.55 * (0.5 + swell * 0.5)));
    grad.addColorStop(1, hexA(col, 0.0));
    ctx.fillStyle = grad; ctx.fill();
    // bright crest line on the leading edge
    ctx.beginPath();
    for (let x = 0; x <= w; x += Math.max(5, w / 110)) {
      const ripple = Math.sin(x / w * Math.PI * 6 + tt * 1.1) * (h * 0.025)
                   + Math.sin(x / w * Math.PI * 13 - tt * 0.7) * (h * 0.012);
      const y = baseY + ripple;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = hexA(col, 0.5 + 0.4 * swell);
    ctx.lineWidth = Math.max(1.5, h * 0.012);
    ctx.stroke();
    ctx.restore();
  }
  function hexA(hex, a) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
  }
  function loop(now) {
    if (!running) return;
    drawFoam(now);
    raf = requestAnimationFrame(loop);
  }
  function startAnim() {
    if (running) return;
    if (reduceMotion) { sizeCanvas(); // draw a single static frame
      t0 = performance.now(); drawFoam(t0 + SWELL_PERIOD * 250); return; }
    sizeCanvas(); running = true; t0 = performance.now(); raf = requestAnimationFrame(loop);
  }
  function stopAnim() { running = false; cancelAnimationFrame(raf); }

  /* ---- Audio: Pocket Card iOS unlock pattern ---- */
  let unlocked = false;
  const silent = new Audio('data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP////////////////////////////////////////8AAAAATGFtZTMuMTAwA8MAAAAAAAAAABRgJAZAQgAAYAAAAnGMHkkIAAAAAAD/+xDEAAPH3Yz0AAR8I+rJf/AABImb9n+f4/8MACgYvgIAGJDv+xLCC1h7IHvQfeBh+IgDhQBWCAeUdUMABOJpz/9Y4V8mL/V///pvw4DUEgUv0ALAAAAWrCDKFQFIFgAUKWDZKEUqgD6iAAAhCQkBhERgMAEgAg0CFAwh');
  silent.playsInline = true; silent.volume = 0.01;
  function unlockAudio() {
    if (unlocked) return; unlocked = true;
    try { silent.currentTime = 0; silent.play().catch(() => {}); } catch (e) {}
  }
  let fadeId = 0;
  function fadeAudio(target, ms) {
    const myId = ++fadeId;              // cancel any in-flight fade so they don't stack
    const start = waves.volume, t = performance.now();
    const clamp = v => Math.max(0, Math.min(1, v));
    (function step(now) {
      if (myId !== fadeId) return;       // superseded by a newer fade
      const k = Math.min(1, (now - t) / ms);
      waves.volume = clamp(start + (target - start) * k);
      if (k < 1) requestAnimationFrame(step);
      else if (target === 0) { try { waves.pause(); } catch (e) {} }
    })(t);
  }
  function startAudio() {
    unlockAudio();
    waves.volume = 0;
    const p = waves.play();
    if (p && p.catch) p.catch(() => {});
    fadeAudio(0.5, 1200);
  }
  function stopAudio() { fadeAudio(0, 600); }

  /* ---- State application ---- */
  function apply(next, { fromUser } = {}) {
    state = next;
    btn.dataset.state = state;
    btn.setAttribute('aria-label', 'Ambient beach: ' + LABELS[state]);
    btn.setAttribute('aria-pressed', state === 'off' ? 'false' : 'true');
    btn.title = 'Ambient: ' + LABELS[state] + ' (tap to change)';
    const sceneVisible = state !== 'off';
    document.body.classList.toggle('scene-on', sceneVisible);
    if (sceneVisible && !document.hidden) startAnim(); else stopAnim();
    if (state === 'sound' && fromUser) startAudio();
    else if (state !== 'sound') stopAudio();
    // persist (fire-and-forget)
    try { STORE.setMeta('ambient', state); } catch (e) {}
  }

  btn.addEventListener('click', () => {
    const i = STATES.indexOf(state);
    apply(STATES[(i + 1) % STATES.length], { fromUser: true });
  });

  // Pause/resume with tab visibility (don't burn CPU or audio in the background).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopAnim(); if (state === 'sound') { try { waves.pause(); } catch (e) {} } }
    else if (state !== 'off') { startAnim(); if (state === 'sound') { const p = waves.play(); if (p && p.catch) p.catch(() => {}); } }
  });

  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (running || reduceMotion) { sizeCanvas(); if (reduceMotion) drawFoam(performance.now()); } }, 150); });

  /* ---- Restore saved state ----
   * Visuals can restore immediately. Audio cannot autoplay without a user gesture,
   * so if the saved state was 'sound' we show the button as 'sound' (honoring the
   * user's remembered choice and visuals), then start the actual audio on the first
   * interaction. This avoids a button that lies about being on while silent. */
  (async () => {
    let saved = 'off';
    try { saved = (await STORE.getMeta('ambient')) || 'off'; } catch (e) {}
    if (saved === 'sound') {
      apply('sound');                  // shows scene + 'sound' icon; audio armed below
      const arm = () => { if (state === 'sound') startAudio(); };
      const onceOpts = { once: true, passive: true };
      ['pointerdown', 'keydown', 'touchend'].forEach(e => document.addEventListener(e, arm, onceOpts));
    } else if (saved === 'scene') {
      apply('scene');
    }
  })();
})();
