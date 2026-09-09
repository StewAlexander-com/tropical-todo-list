/* Quiet — ambient cinematic beach (always-on video) + gentle wave sound.
 *
 * Video: ALWAYS plays. Dual crossfading <video>s (rain-view pattern) hide the
 * loop seam. If video can't load/decode/play, we gracefully fall back to a single
 * still background image (the poster) — the beach is never missing.
 *
 * Sound: a simple ON/OFF toggle, ON by default. Browsers forbid true autoplay of
 * audio, so we arm it to start on the user's first interaction anywhere (the
 * gesture unlock, retried on touchend/click/keydown). The toggle
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

  /* One decoded, crossfaded soundscape runs on the audio clock. */
  let soundOn = true, preferenceTouched = false, preferenceReady = false;
  const player = waves ? new AmbientPlayer(waves) : null;
  function applySoundUI() {
    if (!btn) return;
    btn.dataset.sound = soundOn ? 'on' : 'off';
    btn.setAttribute('aria-pressed', String(soundOn));
    const needsStart = soundOn && player && !player.isPlaying;
    btn.setAttribute('aria-label', needsStart ? 'Start ambient sound' : 'Ambient sound: ' + (soundOn ? 'on' : 'off'));
    btn.title = needsStart ? 'Tap to start ambient sound' : soundOn ? 'Ambient sound: on (tap to mute)' : 'Ambient sound: off (tap to unmute)';
  }
  if (player) player.onPlaybackChange = applySoundUI;
  function startAudio() {
    if (preferenceReady && soundOn && player) player.start();
  }
  if (btn) btn.addEventListener('click', () => {
    preferenceTouched = true;
    preferenceReady = true;
    // An enabled-but-silent player needs a retry, not a toggle to off.
    soundOn = !(soundOn && player && player.isPlaying);
    applySoundUI();
    STORE.setMeta('sound', soundOn ? 'on' : 'off').catch(() => {});
    if (soundOn) startAudio();
    else if (player) player.stop();
  });
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(event => {
    document.addEventListener(event, e => {
      if (!e.target.closest?.('#btnAmbient')) startAudio();
    }, { passive: true });
  });
  // Never stop sound just because the page is hidden. Recover if the browser
  // or OS interrupted it; a subsequent gesture remains a fallback.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startAudio();
  });
  window.addEventListener('pageshow', startAudio);
  if (waves) waves.addEventListener('ended', startAudio);

  (async () => {
    let saved = null;
    try { saved = await STORE.getMeta('sound'); } catch (_) {}
    if (!preferenceTouched) soundOn = saved !== 'off';
    preferenceReady = true;
    if (!soundOn && player) player.stop();
    applySoundUI();
    startVideo();
  })();
})();
