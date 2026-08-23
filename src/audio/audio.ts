import { MUSIC, MusicDef } from "../game/songs";

export type KeyProfile = "blue" | "red" | "brown" | "premium" | "retro";

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private keyBus!: GainNode;
  private fxBus!: GainNode;
  private delaySend!: GainNode;
  private noise!: AudioBuffer;

  private vols = { music: 0.8, keys: 0.9, fx: 0.85, muted: false };

  // music scheduler state
  private schedTimer: number | null = null;
  private schedStep = 0;
  private schedNext = 0;
  private schedDef: MusicDef | null = null;
  private schedStepDur = 0;
  private schedStartAt = 0;

  ensure(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      comp.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.connect(comp);

      this.musicBus = this.ctx.createGain();
      this.keyBus = this.ctx.createGain();
      this.fxBus = this.ctx.createGain();

      // ambient feedback delay for music + fx
      const delay = this.ctx.createDelay(1.2);
      delay.delayTime.value = 0.29;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.32;
      const dampen = this.ctx.createBiquadFilter();
      dampen.type = "lowpass";
      dampen.frequency.value = 2600;
      delay.connect(dampen);
      dampen.connect(fb);
      fb.connect(delay);
      const delayOut = this.ctx.createGain();
      delayOut.gain.value = 0.5;
      dampen.connect(delayOut);
      delayOut.connect(this.master);
      this.delaySend = this.ctx.createGain();
      this.delaySend.connect(delay);

      const musicLP = this.ctx.createBiquadFilter();
      musicLP.type = "lowpass";
      musicLP.frequency.value = 12500;
      this.musicBus.connect(musicLP);
      musicLP.connect(this.master);
      this.musicBus.connect(this.delaySend);

      this.keyBus.connect(this.master);
      this.fxBus.connect(this.master);
      this.fxBus.connect(this.delaySend);

      // shared noise buffer
      const len = Math.floor(this.ctx.sampleRate * 0.3);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.applyVols();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  now(): number {
    return this.ensure().currentTime;
  }

  setVolumes(v: Partial<typeof this.vols>) {
    this.vols = { ...this.vols, ...v };
    if (this.ctx) this.applyVols();
  }

  private applyVols() {
    const t = this.ctx!.currentTime;
    const m = this.vols.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(m, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.vols.music * 0.5, t, 0.02);
    this.keyBus.gain.setTargetAtTime(this.vols.keys * 0.9, t, 0.02);
    this.fxBus.gain.setTargetAtTime(this.vols.fx * 0.8, t, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === "running") {
      this.ctx.suspend().catch(() => {});
    }
  }
  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  // ----------------------------------------------------------
  // one-shot helpers
  // ----------------------------------------------------------

  private noiseSrc(filterType: BiquadFilterType, freq: number, q = 1): {
    src: AudioBufferSourceNode;
    filt: BiquadFilterNode;
  } {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = freq;
    filt.Q.value = q;
    src.connect(filt);
    return { src, filt };
  }

  private env(node: GainNode, t: number, peak: number, a: number, dec: number) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  // ----------------------------------------------------------
  // mechanical keyboard synthesis
  // ----------------------------------------------------------

  playKey(char: string, profile: KeyProfile, volume = 1) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const code = char.charCodeAt(0) || 65;
    const jitter = ((code * 7) % 11 - 5) / 100 + (Math.random() - 0.5) * 0.03;
    const g = volume * (0.85 + ((code * 13) % 10) / 33);
    const isSpace = char === " ";

    const out = ctx.createGain();
    out.gain.value = g;
    out.connect(this.keyBus);

    // bottom-out thock (all profiles)
    const thockFreq = { blue: 150, red: 125, brown: 135, premium: 96, retro: 200 }[profile];
    const thock = ctx.createOscillator();
    thock.type = "sine";
    const f0 = (isSpace ? thockFreq * 0.75 : thockFreq) * (1 + jitter);
    thock.frequency.setValueAtTime(f0 * 1.6, t);
    thock.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.045);
    const tg = ctx.createGain();
    this.env(tg, t, isSpace ? 0.85 : 0.6, 0.003, isSpace ? 0.09 : 0.055);
    thock.connect(tg).connect(out);
    thock.start(t);
    thock.stop(t + 0.16);

    // click / tactile component
    const click = () => {
      const { src, filt } = this.noiseSrc("bandpass", 3800, 2.5);
      const cg = ctx.createGain();
      src.connect(filt).connect(cg).connect(out);
      return { src, cg };
    };

    if (profile === "blue") {
      const { src, cg } = click();
      (src as any).playbackRate.value = 1.25 + jitter * 2;
      this.env(cg, t, 0.5, 0.001, 0.016);
      src.start(t); src.stop(t + 0.05);
      const sq = ctx.createOscillator();
      sq.type = "square";
      sq.frequency.value = 2500 * (1 + jitter * 2);
      const sg = ctx.createGain();
      this.env(sg, t, 0.09, 0.001, 0.012);
      sq.connect(sg).connect(out);
      sq.start(t); sq.stop(t + 0.04);
    } else if (profile === "red") {
      const { src, filt } = this.noiseSrc("lowpass", 1700);
      const cg = ctx.createGain();
      src.connect(filt).connect(cg).connect(out);
      this.env(cg, t, 0.3, 0.002, 0.02);
      src.start(t); src.stop(t + 0.06);
    } else if (profile === "brown") {
      const { src, cg } = click();
      this.env(cg, t, 0.32, 0.0015, 0.013);
      src.start(t); src.stop(t + 0.05);
      const { src: s2, cg: cg2 } = click();
      this.env(cg2, t + 0.02, 0.14, 0.0015, 0.012);
      s2.start(t + 0.02); s2.stop(t + 0.07);
    } else if (profile === "premium") {
      const { src, filt } = this.noiseSrc("lowpass", 850);
      const cg = ctx.createGain();
      src.connect(filt).connect(cg).connect(out);
      this.env(cg, t, 0.3, 0.003, 0.03);
      src.start(t); src.stop(t + 0.08);
      const { src: hs, filt: hf } = this.noiseSrc("highpass", 5200);
      const hg = ctx.createGain();
      hs.connect(hf).connect(hg).connect(out);
      this.env(hg, t, 0.1, 0.001, 0.01);
      hs.start(t); hs.stop(t + 0.04);
    } else {
      // retro
      const sq = ctx.createOscillator();
      sq.type = "square";
      sq.frequency.setValueAtTime(880 * (1 + jitter), t);
      sq.frequency.exponentialRampToValueAtTime(240, t + 0.035);
      const sg = ctx.createGain();
      this.env(sg, t, 0.12, 0.001, 0.04);
      sq.connect(sg).connect(out);
      sq.start(t); sq.stop(t + 0.06);
      const { src, filt } = this.noiseSrc("highpass", 6000);
      const cg = ctx.createGain();
      src.connect(filt).connect(cg).connect(out);
      this.env(cg, t, 0.14, 0.001, 0.008);
      src.start(t); src.stop(t + 0.03);
    }
  }

  playError() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(82, t + 0.09);
    const g = ctx.createGain();
    this.env(g, t, 0.16, 0.004, 0.09);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    o.connect(lp).connect(g).connect(this.fxBus);
    o.start(t); o.stop(t + 0.14);
    const { src, filt } = this.noiseSrc("lowpass", 320);
    const ng = ctx.createGain();
    src.connect(filt).connect(ng).connect(this.fxBus);
    this.env(ng, t, 0.1, 0.003, 0.06);
    src.start(t); src.stop(t + 0.1);
  }

  private pluck(freq: number, when: number, peak: number, dec = 0.18, wave: OscillatorType = "triangle") {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, when, peak, 0.004, dec);
    o.connect(g).connect(this.fxBus);
    o.start(when);
    o.stop(when + dec + 0.1);
  }

  // boost = current rhythm streak: perfects rise in pitch as the streak
  // builds, so your ears hear the groove forming (capped, never shrill)
  playJudgment(tier: "perfect" | "great" | "good", boost = 0) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const lift = 1 + Math.min(12, Math.max(0, boost)) * 0.022;
    if (tier === "perfect") {
      this.pluck(1318 * lift, t, 0.12, 0.12);
      this.pluck(1975 * lift, t + 0.03, 0.07, 0.1);
    } else if (tier === "great") {
      this.pluck(988, t, 0.1, 0.1);
    } else {
      this.pluck(659, t, 0.08, 0.08);
    }
  }

  playCombo(tier: number) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const notes = tier >= 4 ? [523, 659, 784, 1046, 1318, 1568] : tier === 3 ? [523, 659, 784, 1046, 1318] : tier === 2 ? [523, 659, 784, 1046] : [659, 880];
    notes.forEach((f, i) => this.pluck(f, t + i * 0.055, 0.12 + tier * 0.02, 0.22, "triangle"));
    if (tier >= 3) {
      const { src, filt } = this.noiseSrc("highpass", 7000);
      const g = ctx.createGain();
      src.connect(filt).connect(g).connect(this.fxBus);
      this.env(g, t + 0.1, 0.08, 0.01, 0.35);
      src.start(t + 0.1); src.stop(t + 0.55);
    }
  }

  playUi() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.pluck(740, t, 0.07, 0.06, "sine");
  }

  playCount(step: number) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.pluck(step === 0 ? 1318 : 880, t, 0.16, step === 0 ? 0.4 : 0.14, "square");
  }

  playCalib(accent: boolean) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.pluck(accent ? 1200 : 1000, t, 0.2, 0.08, "square");
  }

  // ----------------------------------------------------------
  // procedural music scheduler
  // ----------------------------------------------------------

  startMusic(songId: string, startAt: number, speedMult = 1) {
    this.ensure();
    this.stopMusic();
    const def = MUSIC[songId];
    if (!def) return;
    this.schedDef = def;
    this.schedStepDur = 60 / def.bpm / 4 / speedMult;
    this.schedStartAt = startAt;
    this.schedStep = 0;
    this.schedNext = startAt;
    this.schedTimer = window.setInterval(() => this.pump(), 28);
    this.pump();
  }

  stopMusic() {
    if (this.schedTimer !== null) {
      clearInterval(this.schedTimer);
      this.schedTimer = null;
    }
    this.schedDef = null;
  }

  private degMidi(def: MusicDef, deg: number): number {
    const n = def.scale.length;
    return def.scale[((deg % n) + n) % n] + 12 * Math.floor(deg / n);
  }

  private pump() {
    const ctx = this.ctx!;
    const def = this.schedDef;
    if (!def) return;
    while (this.schedNext < ctx.currentTime + 0.14) {
      this.scheduleStep(this.schedStep, this.schedNext);
      this.schedStep++;
      this.schedNext = this.schedStartAt + this.schedStep * this.schedStepDur;
    }
  }

  private scheduleStep(step: number, t: number) {
    const ctx = this.ctx!;
    const def = this.schedDef!;
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const deg = def.progression[bar % def.progression.length];
    const chordRoot = def.root + this.degMidi(def, deg);
    const chord = [
      chordRoot + 12,
      chordRoot + 12 + (this.degMidi(def, deg + 2) - this.degMidi(def, deg)),
      chordRoot + 12 + (this.degMidi(def, deg + 4) - this.degMidi(def, deg)),
    ];
    const vel = 0.9;

    // ---------- drums ----------
    const kick = (when: number, gain = 0.9) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(165, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.11);
      const g = ctx.createGain();
      this.env(g, when, gain, 0.002, 0.14);
      o.connect(g).connect(this.musicBus);
      o.start(when); o.stop(when + 0.2);
    };
    const snare = (when: number, gain = 0.5, rim = false) => {
      const { src, filt } = this.noiseSrc("bandpass", rim ? 3400 : 1700, rim ? 4 : 0.9);
      const g = ctx.createGain();
      src.connect(filt).connect(g).connect(this.musicBus);
      this.env(g, when, gain, 0.002, rim ? 0.05 : 0.12);
      src.start(when); src.stop(when + 0.2);
      if (!rim) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = 196;
        const og = ctx.createGain();
        this.env(og, when, gain * 0.5, 0.002, 0.07);
        o.connect(og).connect(this.musicBus);
        o.start(when); o.stop(when + 0.1);
      }
    };
    const hat = (when: number, gain = 0.16, open = false) => {
      const { src, filt } = this.noiseSrc("highpass", 7600);
      const g = ctx.createGain();
      src.connect(filt).connect(g).connect(this.musicBus);
      this.env(g, when, gain, 0.001, open ? 0.12 : 0.03);
      src.start(when); src.stop(when + 0.2);
    };

    switch (def.drums) {
      case "chill":
        if (s16 === 0) kick(t, 0.7);
        if (s16 === 10) kick(t, 0.45);
        if (s16 === 4 || s16 === 12) snare(t, 0.22, true);
        if (s16 % 4 === 2) hat(t, 0.09);
        break;
      case "four":
        if (s16 % 4 === 0) kick(t, 0.85);
        if (s16 === 4 || s16 === 12) snare(t, 0.42);
        if (s16 % 2 === 0) hat(t, s16 % 4 === 2 ? 0.17 : 0.09);
        if (s16 === 14) hat(t, 0.1, true);
        break;
      case "drive":
        if (s16 % 4 === 0 || s16 === 7) kick(t, 0.9);
        if (s16 === 4 || s16 === 12) snare(t, 0.5);
        hat(t, s16 % 2 === 0 ? 0.14 : 0.07);
        break;
      case "storm":
        if (s16 % 4 === 0 || s16 === 6 || s16 === 10) kick(t, 0.95);
        if (s16 === 4 || s16 === 12) snare(t, 0.55);
        hat(t, s16 % 2 === 0 ? 0.15 : 0.08);
        if (s16 === 0 && bar % 4 === 0) snare(t, 0.2);
        break;
    }

    // ---------- bass ----------
    const bv = def.bass[s16];
    if (bv !== null && bv !== undefined) {
      const f = midiHz(chordRoot - 12 + bv);
      const o = ctx.createOscillator();
      o.type = def.bassWave;
      o.frequency.value = f;
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = f / 2;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(240, t + 0.16);
      lp.Q.value = 4;
      const g = ctx.createGain();
      this.env(g, t, 0.34 * vel, 0.006, 0.2);
      const sg = ctx.createGain();
      this.env(sg, t, 0.22 * vel, 0.006, 0.22);
      o.connect(lp).connect(g).connect(this.musicBus);
      sub.connect(sg).connect(this.musicBus);
      o.start(t); o.stop(t + 0.3);
      sub.start(t); sub.stop(t + 0.32);
    }

    // ---------- arp ----------
    const av = def.arp[s16];
    if (av !== null && av !== undefined) {
      const o = ctx.createOscillator();
      o.type = def.arpWave;
      o.frequency.value = midiHz(chordRoot + 12 + av);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3200;
      const g = ctx.createGain();
      this.env(g, t, 0.085 * vel, 0.004, 0.14);
      o.connect(lp).connect(g).connect(this.musicBus);
      o.start(t); o.stop(t + 0.22);
    }

    // ---------- pad (each bar) ----------
    if (def.pad && s16 === 0) {
      const dur = this.schedStepDur * 16;
      chord.forEach((m) => {
        [-6, 6].forEach((det) => {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = midiHz(m);
          o.detune.value = det;
          const lp = ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 1150;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.028, t + dur * 0.3);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.02);
          o.connect(lp).connect(g).connect(this.musicBus);
          o.start(t); o.stop(t + dur * 1.1);
        });
      });
    }

    // ---------- lead ----------
    if (def.lead) {
      const lv = def.lead[s16];
      if (lv !== null && lv !== undefined) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = midiHz(chordRoot + 24 + lv);
        const g = ctx.createGain();
        this.env(g, t, 0.09 * vel, 0.02, 0.34);
        const send = ctx.createGain();
        send.gain.value = 0.5;
        o.connect(g);
        g.connect(this.musicBus);
        g.connect(send).connect(this.delaySend);
        o.start(t); o.stop(t + 0.5);
      }
    }
  }
}

export const audio = new AudioEngine();
