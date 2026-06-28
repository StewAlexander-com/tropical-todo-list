/* Quiet — ambient cinematic beach (dual crossfading video) + gentle wave sound.
 * Off/on cycles: off → scene → sound (waves audio). First run defaults to 'scene'.
 * Video pattern follows rain-view: two stacked <video>s; we fade B in shortly
 * before A reaches its loop seam, so the loop is invisible (raw clips don't loop
 * cleanly). Source is theme-aware (day / dusk) and resolution-aware (mobile/desktop).
 * Audio never autoplays — starts only on a user gesture (Pocket Card unlock pattern).
 * Depends on STORE (from app.js). Loads after app.js. */
(function () {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('btnAmbient');
  const sceneEl = document.getElementById('scene');
  const waves = document.getElementById('waves');
  const vidA = document.getElementById('vidA');
  const vidB = document.getElementById('vidB');
  if (!btn || !sceneEl || !vidA || !vidB) return;

  const STATES = ['off', 'scene', 'sound'];
  const LABELS = { off: 'off', scene: 'scene only', sound: 'scene + waves' };
  let state = 'off';
  let videoReady = false;

  /* ---- Source selection (theme + size aware) ---- */
  const isMobile = matchMedia('(max-width: 560px)').matches;
  function srcFor(dark) {
    const base = dark ? 'assets/beach-' : 'assets/beach-';
    const size = isMobile ? 'mobile' : 'desktop';
    return dark ? `assets/beach-${size}-dusk.mp4` : `assets/beach-${size}.mp4`;
  }
  function posterFor(dark) { return dark ? 'assets/beach-poster-dusk.jpg' : 'assets/beach-poster.jpg'; }
  function isDark() { return matchMedia('(prefers-color-scheme: dark)').matches; }

  function setSources() {
    const src = srcFor(isDark());
    const poster = posterFor(isDark());
    [vidA, vidB].forEach(v => {
      if (v.getAttribute('src') !== src) { v.setAttribute('src', src); v.setAttribute('poster', poster); v.load(); }
    });
  }

  /* ---- Seamless dual-video crossfade loop (rain-view pattern) ---- */
  let active = vidA, idle = vidB;
  let xfTimer = 0;
  const XF = 1.1;            // crossfade seconds
  function scheduleCrossfade() {
    clearTimeout(xfTimer);
    if (!active.duration || !isFinite(active.duration)) return;
    const remaining = (active.duration - active.currentTime - XF) * 1000;
    xfTimer = setTimeout(crossfade, Math.max(50, remaining));
  }
  function crossfade() {
    if (state === 'off') return;
    // bring the idle video to the start, play, fade it in; swap roles
    try { idle.currentTime = 0; } catch (e) {}
    tryPlay(idle);
    idle.classList.add('visible');
    active.classList.remove('visible');
    const wasActive = active;
    [active, idle] = [idle, active];
    // after the fade, reset the now-idle (old active) so it's ready next cycle
    setTimeout(() => { try { wasActive.pause(); wasActive.currentTime = 0; } catch (e) {} }, XF * 1000 + 50);
    scheduleCrossfade();
  }

  // If the browser blocks muted autoplay (some Safari/Low-Power configs), retry
  // the play on the very first user interaction so the video never stays frozen.
  let gestureArmed = false;
  function armGestureRetry() {
    if (gestureArmed) return; gestureArmed = true;
    const go = () => {
      [vidA, vidB].forEach(v => { v.muted = true; });
      const p = active.play(); if (p && p.catch) p.catch(() => {});
    };
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev =>
      document.addEventListener(ev, go, { once: true, passive: true }));
  }

  function tryPlay(v) {
    v.muted = true; v.defaultMuted = true; v.playsInline = true; // belt + suspenders for autoplay
    const p = v.play();
    if (p && p.catch) p.catch(() => { armGestureRetry(); });
  }

  function startVideo() {
    setSources();
    // make A the visible base
    vidA.classList.add('visible'); vidB.classList.remove('visible');
    active = vidA; idle = vidB;
    const begin = () => {
      videoReady = true;
      if (reduceMotion) { try { active.pause(); active.currentTime = Math.min(2, active.duration || 2); } catch (e) {} return; }
      tryPlay(active);
      scheduleCrossfade();
    };
    if (active.readyState >= 2) begin();
    else { active.addEventListener('loadeddata', begin, { once: true }); active.load(); }
    // safety: if loadeddata never fires (some mobile), try after a beat
    setTimeout(() => { if (!videoReady && state !== 'off') begin(); }, 2500);
    active.addEventListener('loadedmetadata', scheduleCrossfade, { once: true });
  }
  function stopVideo() {
    clearTimeout(xfTimer);
    [vidA, vidB].forEach(v => { try { v.pause(); } catch (e) {} v.classList.remove('visible'); });
  }

  /* ---- Audio: Pocket Card iOS unlock pattern ---- */
  let unlocked = false;
  const silent = new Audio('data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP////////////////////////////////////////8AAAAATGFtZTMuMTAwA8MAAAAAAAAAABRgJAZAQgAAYAAAAnGMHkkIAAAAAAD/+xDEAAPH3Yz0AAR8I+rJf/AABImb9n+f4/8MACgYvgIAGJDv+xLCC1h7IHvQfeBh+IgDhQBWCAeUdUMABOJpz/9Y4V8mL/V///pvw4DUEgUv0ALAAAAWrCDKFQFIFgAUKWDZKEUqgD6iAAAhCQkBhERgMAEgAg0CFAwh');
  silent.playsInline = true; silent.volume = 0.01;
  function unlockAudio() { if (unlocked) return; unlocked = true; try { silent.currentTime = 0; silent.play().catch(() => {}); } catch (e) {} }
  let fadeId = 0;
  function fadeAudio(target, ms) {
    const myId = ++fadeId, start = waves.volume, t = performance.now();
    const clamp = v => Math.max(0, Math.min(1, v));
    (function step(now) {
      if (myId !== fadeId) return;
      const k = Math.min(1, (now - t) / ms);
      waves.volume = clamp(start + (target - start) * k);
      if (k < 1) requestAnimationFrame(step);
      else if (target === 0) { try { waves.pause(); } catch (e) {} }
    })(t);
  }
  function startAudio() { unlockAudio(); waves.volume = 0; const p = waves.play(); if (p && p.catch) p.catch(() => {}); fadeAudio(0.5, 1200); }
  function stopAudio() { fadeAudio(0, 600); }

  /* ---- State machine ---- */
  function apply(next, { fromUser } = {}) {
    state = next;
    btn.dataset.state = state;
    btn.setAttribute('aria-label', 'Ambient beach: ' + LABELS[state]);
    btn.setAttribute('aria-pressed', state === 'off' ? 'false' : 'true');
    btn.title = 'Ambient: ' + LABELS[state] + ' (tap to change)';
    const on = state !== 'off';
    document.body.classList.toggle('scene-on', on);
    if (on && !document.hidden) startVideo(); else stopVideo();
    if (state === 'sound' && fromUser) startAudio();
    else if (state !== 'sound') stopAudio();
    try { STORE.setMeta('ambient', state); } catch (e) {}
  }

  btn.addEventListener('click', () => {
    const i = STATES.indexOf(state);
    apply(STATES[(i + 1) % STATES.length], { fromUser: true });
  });

  // Re-pick source when the theme flips while the scene is on.
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (state !== 'off') { stopVideo(); startVideo(); }
  });

  // Pause/resume with tab visibility.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopVideo(); if (state === 'sound') { try { waves.pause(); } catch (e) {} } }
    else if (state !== 'off') { startVideo(); if (state === 'sound') { const p = waves.play(); if (p && p.catch) p.catch(() => {}); } }
  });

  /* ---- Restore saved state (first run defaults to 'scene') ---- */
  (async () => {
    let saved = null;
    try { saved = await STORE.getMeta('ambient'); } catch (e) {}
    const initial = (saved === undefined || saved === null) ? 'scene' : saved;
    if (initial === 'sound') {
      apply('sound');                              // visuals + remembered intent
      const arm = () => { if (state === 'sound') startAudio(); };
      ['pointerdown', 'keydown', 'touchend'].forEach(e => document.addEventListener(e, arm, { once: true, passive: true }));
    } else if (initial === 'scene') {
      apply('scene');
    }
    // 'off' → nothing
  })();
})();
