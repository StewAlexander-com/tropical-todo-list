/* Sample-clock playback. Crossfades are baked into the PCM buffer, so looping
 * never depends on media-element seeking, UI timers, or visibility callbacks. */
class AmbientPlayer {
  constructor(media, Context = window.AudioContext || window.webkitAudioContext) {
    this.media = media;
    this.Context = Context;
    this.context = null;
    this.source = null;
    this.gain = null;
    this.loading = null;
    this.wanted = false;
    this.muteTimer = 0;
    this.ramp = { from: 0, to: 0, start: 0, end: 0 };
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
    if (!this.Context) {
      this.media.volume = .5;
      this.media.loop = true;
      try {
        await this.media.play();
        if (!this.wanted) this.media.pause();
      } catch (_) { /* next gesture retries */ }
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
          this.media.dataset.playback = this.context.state;
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
      this.media.dataset.playback = ctx.state;
    } catch (_) {
      this.media.dataset.playback = 'waiting';
      // Failed unlock/download can be retried by another gesture.
    }
  }
  stop() {
    this.wanted = false;
    clearTimeout(this.muteTimer);
    if (!this.context) { this.media.pause(); return; }
    this.fade(0, .12);
    // This timer only saves power after muting. It never schedules audio loops.
    this.muteTimer = setTimeout(() => {
      if (!this.wanted) this.context.suspend().catch(() => {});
    }, 150);
  }
}
if (typeof module !== 'undefined') module.exports = AmbientPlayer;
