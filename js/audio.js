// Prozedurales Audio über die Web Audio API – keine externen Sounddateien nötig.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engine = null;     // {osc, gain, sub}
    this.siren = null;      // {osc, gain, lfo}
    this.music = null;      // Scheduler-State
    this._noise = null;
  }

  // Muss nach einer Nutzer-Geste laufen (z. B. Play-Klick)
  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this._buildNoise();
    this._startMusic();
  }

  _buildNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
  }

  toggleMute() {
    if (!this.ctx) return this.muted;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.now ? this.ctx.now() : this.ctx.currentTime, 0.05);
    return this.muted;
  }

  // ---------------------------------------------- Schüsse
  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.2);

    // tiefer "Punch"
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    og.gain.setValueAtTime(0.4, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.13);
  }

  // ---------------------------------------------- Treffer
  hit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.1);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.12);
  }

  // ---------------------------------------------- Erfolg / Belohnung
  success() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this._blip(f, this.ctx.currentTime + i * 0.11, 0.18, 'triangle', 0.3));
  }

  // ---------------------------------------------- UI-Klick
  click() { if (this.ctx) this._blip(660, this.ctx.currentTime, 0.06, 'square', 0.15); }

  _blip(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  // ---------------------------------------------- Motor (im Auto)
  setEngine(active, intensity = 0) {
    if (!this.ctx) return;
    if (active && !this.engine) {
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth'; sub.type = 'sine';
      gain.gain.value = 0.0;
      osc.connect(gain); sub.connect(gain); gain.connect(this.master);
      osc.start(); sub.start();
      this.engine = { osc, sub, gain };
    }
    if (!active && this.engine) {
      const e = this.engine; this.engine = null;
      e.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      setTimeout(() => { try { e.osc.stop(); e.sub.stop(); } catch (_) {} }, 200);
    }
    if (this.engine) {
      const base = 55 + intensity * 130;
      this.engine.osc.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.08);
      this.engine.sub.frequency.setTargetAtTime(base * 0.5, this.ctx.currentTime, 0.08);
      this.engine.gain.gain.setTargetAtTime(0.05 + intensity * 0.08, this.ctx.currentTime, 0.1);
    }
  }

  // ---------------------------------------------- Polizeisirene
  setSiren(active) {
    if (!this.ctx) return;
    if (active && !this.siren) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 700;
      lfo.type = 'square'; lfo.frequency.value = 1.6; lfoGain.gain.value = 220;
      lfo.connect(lfoGain).connect(osc.frequency);
      gain.gain.value = 0.0;
      osc.connect(gain).connect(this.master);
      osc.start(); lfo.start();
      gain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.2);
      this.siren = { osc, gain, lfo };
    }
    if (!active && this.siren) {
      const s = this.siren; this.siren = null;
      s.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      setTimeout(() => { try { s.osc.stop(); s.lfo.stop(); } catch (_) {} }, 400);
    }
  }

  // ---------------------------------------------- Hintergrundmusik (chillig, leise)
  _startMusic() {
    // Akkord-Pattern (pentatonisch, entspannt)
    const scale = [220, 261.63, 293.66, 329.63, 392.0, 440];
    const bass = [110, 146.83, 98, 130.81];
    this.music = { next: this.ctx.currentTime + 0.1, step: 0 };
    const busGain = this.ctx.createGain();
    busGain.gain.value = 0.18;
    busGain.connect(this.master);

    const scheduleNote = (freq, time, dur, vol, type) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(vol, time + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
      o.connect(g).connect(busGain);
      o.start(time); o.stop(time + dur + 0.05);
    };

    const tick = () => {
      if (!this.ctx) return;
      const ahead = this.ctx.currentTime + 0.4;
      while (this.music.next < ahead) {
        const s = this.music.step;
        const t = this.music.next;
        // Bass alle 4 Schritte
        if (s % 4 === 0) scheduleNote(bass[(s / 4) % bass.length], t, 0.9, 0.22, 'triangle');
        // Melodie-Pluck
        if (s % 2 === 0) {
          const f = scale[(s * 3) % scale.length] * (Math.random() > 0.7 ? 2 : 1);
          scheduleNote(f, t, 0.5, 0.10, 'sine');
        }
        this.music.step = (s + 1) % 32;
        this.music.next += 0.32;   // Tempo
      }
      this._musicTimer = setTimeout(tick, 120);
    };
    tick();
  }
}
