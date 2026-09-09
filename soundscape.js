/* Sample-clock playback. Crossfades are baked into the PCM buffer, so looping
 * never depends on media-element seeking, UI timers, or visibility callbacks. */
class AmbientPlayer {
  constructor(media, Context = window.AudioContext || window.webkitAudioContext, device = typeof navigator === 'undefined' ? {} : navigator) {
    this.media = media;
    // iPadOS can identify itself as a Mac. Native media playback avoids the
    // Web Audio interruption/silent-session path on Apple's touch devices.
    this.nativeMedia = /iPhone|iPad|iPod/.test(device.userAgent || '') ||
      (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
    this.Context = this.nativeMedia ? null : Context;
    this.device = device;
    this.mediaPending = null;
    this.onPlaybackChange = null;
    if (media.addEventListener) {
      for (const event of ['playing', 'pause', 'ended', 'error']) {
        media.addEventListener(event, () => {
          if (!this.Context) this.report(event === 'playing' ? 'running' : event === 'error' ? 'waiting' : 'paused');
        });
      }
    }
    this.context = null;
    this.source = null;
    this.gain = null;
    this.loading = null;
    this.wanted = false;
    this.muteTimer = 0;
    this.ramp = { from: 0, to: 0, start: 0, end: 0 };
  }
  get isPlaying() {
    if (!this.wanted) return false;
    if (!this.Context) return !this.media.paused && !this.media.ended;
    return !!this.source && this.context.state === 'running' && this.ramp.to > 0;
  }
  report(state) {
    this.media.dataset.playback = state;
    if (this.onPlaybackChange) this.onPlaybackChange();
  }
  levelAt(time) {
    const r = this.ramp;
    const u = r.end > r.start ? Math.max(0, Math.min(1, (time-r.start)/(r.end-r.start))) : 1;
    return r.from + (r.to-r.from)*u;
  }
  fade(to, seconds) {
    const now = this.context.currentTime;
    const from = this.levelAt(now);
    // Holding the interpolated value prevents rapid mute/unmute from jumping.
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(from, now);
    this.gain.gain.linearRampToValueAtTime(to, now+seconds);
    this.ramp = { from, to, start: now, end: now+seconds };
  }
  async start() {
    this.wanted = true;
    clearTimeout(this.muteTimer);
    // Request a media-playback session where supported; older Safari uses
    // the native audio element directly. Never require this optional API.
    try { if (this.device.audioSession) this.device.audioSession.type = 'playback'; } catch (_) {}
    if (!this.Context) {
      this.media.dataset.engine = 'native-media';
      this.media.volume = .5;
      this.media.muted = false;
      this.media.loop = true;
      if (this.mediaPending) return this.mediaPending;
      try {
        // Invoke play synchronously within the tap, before any asynchronous work.
        const play = this.media.play();
        this.mediaPending = Promise.resolve(play);
        await this.mediaPending;
        if (!this.wanted) this.media.pause();
        this.report(this.isPlaying ? 'running' : 'paused');
      } catch (_) { this.report('waiting'); }
      finally { this.mediaPending = null; }
      return;
    }
    try {
      if (!this.context) {
        this.context = new this.Context();
        this.gain = this.context.createGain();
        this.gain.gain.value = 0;
        this.gain.connect(this.context.destination);
        this.media.dataset.engine = 'audio-buffer';
        this.context.addEventListener('statechange', () => {
          this.report(this.context.state);
        });
      }
      const ctx = this.context;
      // Resume immediately inside the user gesture, before fetch/decode awaits.
      const resumed = ctx.resume();
      if (!this.loading) {
        this.loading = (async () => {
          const response = await fetch(this.media.querySelector('source').getAttribute('src'));
          if (!response.ok) throw new Error('Ambient audio unavailable');
          return ctx.decodeAudioData(await response.arrayBuffer());
        })().catch(error => { this.loading = null; throw error; });
      }
      const [,buffer] = await Promise.all([resumed, this.loading]);
      if (!this.wanted) return;
      if (!this.source) {
        this.source = ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;
        this.source.connect(this.gain);
        this.source.start();
      }
      // Ordinary clicks do not keep restarting the fade or the loop.
      if (this.ramp.to !== .5) this.fade(.5, .35);
      this.report(ctx.state);
    } catch (_) {
      this.report('waiting');
      // Failed unlock/download can be retried by another gesture.
    }
  }
  stop() {
    this.wanted = false;
    clearTimeout(this.muteTimer);
    if (!this.context) { this.media.pause(); this.report('paused'); return; }
    this.fade(0, .12);
    // This timer only saves power after muting. It never schedules audio loops.
    this.muteTimer = setTimeout(() => {
      if (!this.wanted) this.context.suspend().catch(() => {});
    }, 150);
  }
}
if (typeof module !== 'undefined') module.exports = AmbientPlayer;
