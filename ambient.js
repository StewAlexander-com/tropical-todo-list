/* Quiet — ambient cinematic beach (always-on video) + gentle wave sound.
 *
 * Video: ALWAYS plays. Dual crossfading <video>s (rain-view pattern) hide the
 * loop seam. If video can't load/decode/play, we gracefully fall back to a single
 * still background image (the poster) — the beach is never missing.
 *
 * Sound: a simple ON/OFF toggle, ON by default. Browsers forbid true autoplay of
 * audio, so we arm it to start on the user's first interaction anywhere (the
 * rain-view unlock: silent-MP3 + retry on touchend/click/keydown). The toggle
 * just flips whether sound is enabled; the choice persists.
 *
 * Depends on STORE (app.js). Loads after app.js. */
(function () {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('btnAmbient');
  const sceneEl = document.getElementById('scene');
  const waves = document.getElementById('waves');
  const vidA = document.getElementById('vidA');
  const vidB = document.getElementById('vidB');
  if (!sceneEl) return;

  // Scene content always shows (drives the lava-rock panel + readable text).
  document.body.classList.add('scene-on');

  /* ---- Source selection (theme + size aware) ---- */
  const isMobile = matchMedia('(max-width: 560px)').matches;
  function isDark() { return matchMedia('(prefers-color-scheme: dark)').matches; }
  function srcFor() { const size = isMobile ? 'mobile' : 'desktop'; return isDark() ? `assets/beach-${size}-dusk.mp4` : `assets/beach-${size}.mp4`; }
  function posterFor() { return isDark() ? 'assets/beach-poster-dusk.jpg' : 'assets/beach-poster.jpg'; }

  /* ---- Graceful fallback to a still image ---- */
  let usingFallback = false;
  function fallbackToImage() {
    if (usingFallback) return; usingFallback = true;
    // The CSS already paints assets/beach-poster*.jpg as the .scene background,
    // so we just hide the (broken) videos and reveal the scene.
    [vidA, vidB].forEach(v => { try { v.style.display = 'none'; } catch (e) {} });
    sceneEl.classList.add('ready', 'fallback');
  }

  /* ---- Dual-video crossfade loop (rain-view pattern) ---- */
  let active = vidA, idle = vidB, xfTimer = 0, videoStarted = false;
  const XF = 1.1;
  function scheduleCrossfade() {
    clearTimeout(xfTimer);
    if (!active || !active.duration || !isFinite(active.duration)) return;
    const remaining = (active.duration - active.currentTime - XF) * 1000;
    xfTimer = setTimeout(crossfade, Math.max(50, remaining));
  }
  function crossfade() {
    if (usingFallback) return;
    try { idle.currentTime = 0; } catch (e) {}
    playVid(idle);
    idle.classList.add('visible');
    active.classList.remove('visible');
    const old = active;
    [active, idle] = [idle, active];
    setTimeout(() => { try { old.pause(); old.currentTime = 0; } catch (e) {} }, XF * 1000 + 50);
    scheduleCrossfade();
  }

  let gestureArmedForVideo = false;
  function armVideoGesture() {
    if (gestureArmedForVideo) return; gestureArmedForVideo = true;
    const go = () => { [vidA, vidB].forEach(v => { v.muted = true; }); playVid(active); };
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev => document.addEventListener(ev, go, { once: true, passive: true }));
  }
  function playVid(v) {
    if (!v) return;
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => armVideoGesture());
  }

  function startVideo() {
    if (!vidA || !vidB) { fallbackToImage(); return; }
    const src = srcFor();
    [vidA, vidB].forEach(v => { if (v.getAttribute('src') !== src) { v.setAttribute('src', src); v.setAttribute('poster', posterFor()); } });
    vidA.classList.add('visible'); vidB.classList.remove('visible');
    active = vidA; idle = vidB;

    let failed = false;
    const onError = () => { if (!failed) { failed = true; fallbackToImage(); } };
    vidA.addEventListener('error', onError, { once: true });

    const begin = () => {
      if (videoStarted || usingFallback) return; videoStarted = true;
      sceneEl.classList.add('ready');
      if (reduceMotion) { try { active.pause(); active.currentTime = Math.min(2, active.duration || 2); } catch (e) {} return; }
      playVid(active);
      scheduleCrossfade();
    };
    if (active.readyState >= 2) begin();
    else { active.addEventListener('loadeddata', begin, { once: true }); try { active.load(); } catch (e) {} }
    // Fallbacks: if nothing loads in time, show the still image so it's never blank.
    setTimeout(() => { if (!videoStarted && !usingFallback) {
      if (active.readyState >= 2) begin(); else fallbackToImage();
    } }, 4000);
  }
  function stopVideo() { clearTimeout(xfTimer); [vidA, vidB].forEach(v => { try { v.pause(); } catch (e) {} }); }

  // Re-pick source on theme change.
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (usingFallback) { sceneEl.classList.toggle('fallback', true); return; }
    videoStarted = false; stopVideo(); startVideo();
  });
  // Pause/resume video with tab visibility (save battery), but it stays "on".
  document.addEventListener('visibilitychange', () => {
    if (usingFallback) return;
    if (document.hidden) stopVideo();
    else { playVid(active); scheduleCrossfade(); }
  });

  /* ---- Audio: ON by default, armed on first gesture (rain-view unlock) ---- */
  let soundOn = true;             // default ON
  let audioArmed = false, audioStarted = false;
  const silent = new Audio('data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP////////////////////////////////////////8AAAAATGFtZTMuMTAwA8MAAAAAAAAAABRgJAZAQgAAYAAAAnGMHkkIAAAAAAD/+xDEAAPH3Yz0AAR8I+rJf/AABImb9n+f4/8MACgYvgIAGJDv+xLCC1h7IHvQfeBh+IgDhQBWCAeUdUMABOJpz/9Y4V8mL/V///pvw4DUEgUv0ALAAAAWrCDKFQFIFgAUKWDZKEUqgD6iAAAhCQkBhERgMAEgAg0CFAwh');
  silent.playsInline = true; silent.volume = 0.01;

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
  function reallyStartAudio() {
    if (audioStarted) return;
    try { silent.currentTime = 0; silent.play().catch(() => {}); } catch (e) {}
    if (!waves) return;
    waves.volume = 0;
    const p = waves.play();
    if (p && p.catch) p.catch(() => {});
    audioStarted = true;
    fadeAudio(0.5, 1400);
  }
  // Arm: the first interaction anywhere starts sound if it's enabled.
  function armAudio() {
    if (audioArmed) return; audioArmed = true;
    const go = () => { if (soundOn && !audioStarted) reallyStartAudio(); };
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev => document.addEventListener(ev, go, { once: true, passive: true }));
  }

  function applySoundUI() {
    if (!btn) return;
    btn.dataset.sound = soundOn ? 'on' : 'off';
    btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    btn.setAttribute('aria-label', 'Ambient sound: ' + (soundOn ? 'on' : 'off'));
    btn.title = soundOn ? 'Ambient sound: on (tap to mute)' : 'Ambient sound: off (tap to unmute)';
  }

  if (btn) btn.addEventListener('click', () => {
    soundOn = !soundOn;
    applySoundUI();
    try { STORE.setMeta('sound', soundOn ? 'on' : 'off'); } catch (e) {}
    if (soundOn) { if (!audioStarted) reallyStartAudio(); else { const p = waves.play(); if (p && p.catch) p.catch(() => {}); fadeAudio(0.5, 600); } }
    else fadeAudio(0, 500);
  });

  // Resume audio after backgrounding if it should be on.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && soundOn && audioStarted) { const p = waves.play(); if (p && p.catch) p.catch(() => {}); }
  });

  /* ---- Boot ---- */
  (async () => {
    // Restore sound preference (default on if never set).
    let saved = null;
    try { saved = await STORE.getMeta('sound'); } catch (e) {}
    soundOn = (saved === 'off') ? false : true;
    applySoundUI();
    startVideo();         // always
    armAudio();           // sound begins on first interaction if enabled
  })();
})();
