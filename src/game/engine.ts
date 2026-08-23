import { audio, KeyProfile } from "../audio/audio";
import {
  ChartNote, Difficulty, DIFF_MULT, COMBO_MILESTONES, comboMultiplier,
} from "./content";
import { Chart, StreamGen } from "./songs";
import { fingerLabel } from "./fingers";
import { KEY_MAP, FINGER_ZONES, FingerId } from "./keymap";

export type Mode = "song" | "practice" | "endless" | "time" | "custom";

export interface EngineSettings {
  noteSpeed: number; // 0.7 - 1.5
  timingOffset: number; // ms, added to press time
  keyProfile: KeyProfile;
  particles: boolean;
  quality: "low" | "high";
  screenShake: boolean;
  bgEffects: boolean;
  reducedMotion: boolean;
  colorBlind: boolean;
  skillBias: number; // adaptive -0.25..0.25
  // learning support
  noPressure?: boolean; // notes wait at the hit line; nothing ever expires
  learnMode?: boolean; // educational errors: no combo break, finger-aware feedback
  highlightKeys?: boolean; // when false, the keyboard never highlights (guidance level D/E)
  showNextKey?: boolean; // when false, the "next key" hint is hidden
}

export interface Judgments {
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

export interface GameResult {
  mode: Mode;
  songId: string;
  difficulty: Difficulty;
  score: number;
  maxCombo: number;
  wpm: number;
  accuracy: number;
  judgments: Judgments;
  completion: number;
  timePlayed: number;
  correctChars: number;
  totalKeystrokes: number;
  died: boolean;
}

export interface HudRefs {
  score: HTMLElement | null;
  wpm: HTMLElement | null;
  acc: HTMLElement | null;
  combo: HTMLElement | null;
  mult: HTMLElement | null;
  progress: HTMLElement | null;
  time: HTMLElement | null;
  health: HTMLElement | null;
}

export interface Bridge {
  glow?: (ch: string | null) => void;
  key?: (ch: string, kind: "down" | "up" | "correct" | "error") => void;
  combo?: (combo: number, mult: number) => void;
  milestone?: (text: string, tier: number) => void;
  note?: (text: string | null, typed: number, kind: "letter" | "word") => void;
  flow?: (on: boolean) => void;
  coach?: (msg: string) => void; // quiet teaching nudge — no fanfare
}

interface RtNote extends ChartNote {
  typed: number;
  judged: boolean;
  judgment?: keyof Judgments;
  doneAt?: number;
  x: number; // lane offset for letters (-1..1)
  w: number; // cached pixel width
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

interface Popup {
  text: string; color: string; t0: number; size: number; y0: number; kind: "judge" | "score" | "big";
  sub?: string;
  sub2?: string;
}

const WINDOWS: Record<Difficulty, { p: number; g: number; good: number }> = {
  beginner: { p: 150, g: 300, good: 520 },
  novice: { p: 105, g: 210, good: 380 },
  easy: { p: 80, g: 160, good: 280 },
  normal: { p: 50, g: 100, good: 180 },
  hard: { p: 45, g: 90, good: 160 },
  expert: { p: 40, g: 80, good: 140 },
};

// Visual travel speed multiplier. Deliberately independent of BPM:
// BPM sets *when* notes arrive, this sets *how fast they look* while falling.
const DIFF_SPEED: Record<Difficulty, number> = {
  beginner: 0.72, novice: 0.82, easy: 0.85, normal: 1, hard: 1.12, expert: 1.26,
};

const JUDGE_COLOR: Record<keyof Judgments, string> = {
  perfect: "#a8ff3e", great: "#00e5ff", good: "#ffc94d", miss: "#ff4d5e",
};

export class RhythmEngine {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private cfg: {
    mode: Mode;
    songId: string;
    difficulty: Difficulty;
    speedMult: number;
    timeLimit: number;
    chart: Chart | null;
    stream: StreamGen | null;
    music: string | null; // null = silent (learning lessons)
  };
  private s: EngineSettings;
  private hud: HudRefs;
  private bridge: Bridge;
  onEnd: (r: GameResult) => void;
  onPauseChange: (paused: boolean) => void;

  private notes: RtNote[] = [];
  private nextIdx = 0;
  private particles: Particle[] = [];
  private popups: Popup[] = [];

  private startAt = 0;
  private beat: number;
  private duration: number;
  private countIn: number;
  private raf = 0;
  private destroyed = false;
  paused = false;
  private finished = false;
  private lastCount = 99;

  private score = 0;
  private dispScore = 0;
  private combo = 0;
  private maxCombo = 0;
  private j: Judgments = { perfect: 0, great: 0, good: 0, miss: 0 };
  private correctChars = 0;
  private totalKeystrokes = 0;
  private health = 100;
  private charTimes: number[] = [];

  private win: { p: number; g: number; good: number };
  private pxPerSec: number;
  private shake = 0;
  private flash = 0;
  private flashColor = "#a8ff3e";
  private streamUntil = 0;

  // flow state + rhythm streak
  private hitWindow: boolean[] = [];
  private flowOn = false;
  private perfectStreak = 0;
  private coachedKeys = new Set<string>();

  // feedback intensity follows difficulty: beginners stay calm and readable,
  // expert play earns the fuller light show
  private intensity: number;

  private keyDownHandler: (e: KeyboardEvent) => void;
  private keyUpHandler: (e: KeyboardEvent) => void;
  private blurHandler: () => void;
  private visHandler: () => void;
  private ro: ResizeObserver | null = null;
  private needsResize = true;

  constructor(
    canvas: HTMLCanvasElement,
    cfg: {
      mode: Mode; songId: string; difficulty: Difficulty; speedMult: number;
      timeLimit: number; chart: Chart | null; stream: StreamGen | null;
      music: string | null;
    },
    settings: EngineSettings,
    hud: HudRefs,
    bridge: Bridge,
    onEnd: (r: GameResult) => void,
    onPauseChange: (p: boolean) => void,
  ) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext("2d")!;
    this.cfg = cfg;
    this.s = settings;
    this.hud = hud;
    this.bridge = bridge;
    this.onEnd = onEnd;
    this.onPauseChange = onPauseChange;

    const bias = settings.skillBias;
    const w = WINDOWS[cfg.difficulty];
    const wScale = Math.max(0.7, 1 - bias * 0.18);
    this.win = { p: (w.p / 1000) * wScale, g: (w.g / 1000) * wScale, good: (w.good / 1000) * wScale };
    this.pxPerSec = 340 * settings.noteSpeed * DIFF_SPEED[cfg.difficulty] * (1 + bias * 0.3);
    // reduced motion: keep every learning cue (glow, hints, finger guide)
    // but drop decorative bursts and screen flashes
    if (settings.reducedMotion) this.s.particles = false;

    this.beat = (cfg.chart?.beat ?? (cfg.stream?.beat ?? 0.5)) / cfg.speedMult;
    this.intensity = { beginner: 0, novice: 0.25, easy: 0.5, normal: 0.7, hard: 0.85, expert: 1 }[cfg.difficulty];
    this.countIn = 4 * this.beat;
    this.duration = cfg.mode === "time" ? cfg.timeLimit : cfg.chart ? cfg.chart.duration / cfg.speedMult : 9999;

    if (cfg.chart) {
      for (const n of cfg.chart.notes) {
        this.notes.push({ ...n, time: n.time / cfg.speedMult, deadline: n.deadline / cfg.speedMult, typed: 0, judged: false, x: 0, w: 0 });
      }
    }

    this.keyDownHandler = (e) => this.onKeyDown(e);
    this.keyUpHandler = (e) => this.onKeyUp(e);
    const autoPause = () => {
      if (!this.paused && !this.finished) this.setPaused(true);
    };
    this.blurHandler = autoPause;
    this.visHandler = () => {
      if (document.hidden) autoPause();
    };
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    window.addEventListener("blur", this.blurHandler);
    document.addEventListener("visibilitychange", this.visHandler);

    // resize via observer — never measures layout inside the frame loop
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => {
        this.needsResize = true;
      });
      this.ro.observe(canvas);
    }
  }

  start() {
    // give a full 4-beat count-in before the music (and chart) begins
    this.startAt = audio.now() + this.countIn + (this.cfg.music ? 0.35 : 0.15);
    if (this.cfg.music) {
      audio.startMusic(this.cfg.music, this.startAt, this.cfg.speedMult);
    }
    if (document.fonts) {
      document.fonts.load("26px 'Audiowide'");
      document.fonts.load("700 19px 'JetBrains Mono'");
    }
    this.raf = requestAnimationFrame(() => this.loop());
  }

  // idempotent: calling destroy() any number of times is safe.
  // Quitting stops the music and never force-resumes audio — resume only
  // ever happens from an explicit user action (start / unpause).
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    window.removeEventListener("blur", this.blurHandler);
    document.removeEventListener("visibilitychange", this.visHandler);
    this.ro?.disconnect();
    this.ro = null;
    audio.stopMusic();
  }

  setPaused(p: boolean) {
    if (this.finished || this.paused === p) return;
    this.paused = p;
    if (p) audio.suspend();
    else audio.resume();
    this.onPauseChange(p);
  }

  // live note-speed control (player-owned speed, independent of BPM)
  setNoteSpeed(mult: number) {
    this.s.noteSpeed = mult;
    this.pxPerSec = 340 * mult * DIFF_SPEED[this.cfg.difficulty] * (1 + this.s.skillBias * 0.3);
  }

  private songTime(): number {
    return audio.now() - this.startAt;
  }

  // ----------------------------------------------------------
  // input
  // ----------------------------------------------------------

  private isTypingKey(e: KeyboardEvent): string | null {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (/^F\d+$/.test(e.key)) return null;
    const k = e.key;
    if (k === " ") return " ";
    if (k.length === 1) return k;
    return null;
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.setPaused(!this.paused);
      return;
    }
    if (this.paused || this.finished) return;
    const ch = this.isTypingKey(e);
    if (ch === null) return;
    e.preventDefault();
    if (e.repeat) return;
    this.bridge.key?.(ch, "down");
    this.handlePress(ch);
  }

  private attemptsLog: Record<string, number> = {};
  private trackAttempt(key: string) {
    if (key && key.length === 1) this.attemptsLog[key.toLowerCase()] = (this.attemptsLog[key.toLowerCase()] ?? 0) + 1;
  }
  getStats(): { attempts: Record<string, number>; mistakes: Record<string, number> } {
    return { attempts: this.attemptsLog, mistakes: this.mistakeLog };
  }

  private onKeyUp(e: KeyboardEvent) {
    const ch = this.isTypingKey(e);
    if (ch !== null) this.bridge.key?.(ch, "up");
  }

  private activeNote(): RtNote | null {
    const t = this.songTime();
    // first unjudged note whose window has opened (or is about to)
    for (let i = this.nextIdx; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.judged) continue;
      if (n.time - t < this.win.good * 2.2) return n;
      break;
    }
    return null;
  }

  private handlePress(ch: string) {
    const t = this.songTime() - this.s.timingOffset / 1000;
    const n = this.activeNote();

    if (!n) {
      // stray press — soft feedback, no punishment, doesn't count against accuracy
      audio.playKey(ch, this.s.keyProfile, 0.5);
      return;
    }

    this.totalKeystrokes++;
    this.trackAttempt(n.kind === "letter" ? n.key : n.text[n.typed]);

    if (n.kind === "letter") {
      if (ch === n.key) {
        const dt = Math.abs(t - n.time);
        if (this.s.noPressure) {
          // learners set the pace: on-time press = PERFECT, any late press still succeeds
          this.judge(n, dt <= this.win.p ? dt : this.win.g + 0.001);
          audio.playKey(ch, this.s.keyProfile);
          this.bridge.key?.(ch, "correct");
        } else if (dt <= this.win.good) {
          this.judge(n, dt);
          audio.playKey(ch, this.s.keyProfile);
          this.bridge.key?.(ch, "correct");
        } else {
          // correct key, but way off-beat — nudge the player without a miss
          this.combo = 0;
          this.bridge.combo?.(0, 1);
          this.bridge.key?.(ch, "error");
          audio.playError();
          this.popups.push({ text: "EARLY", color: "#ffc94d", t0: this.songTime(), size: 18, y0: 0, kind: "judge" });
        }
      } else {
        this.wrongKey(ch, n);
      }
    } else {
      const expected = n.text[n.typed];
      if (ch === expected) {
        n.typed++;
        this.correctChars++;
        this.charTimes.push(t);
        audio.playKey(ch, this.s.keyProfile);
        this.bridge.key?.(ch, "correct");
        this.bridge.glow?.(n.typed < n.text.length ? n.text[n.typed] : null);
        this.spawnParticles(this.laneX(n), this.hitY(), 3, "#00e5ff", 0.5);
        if (n.typed === n.text.length) {
          const dt = Math.abs(t - n.time);
          this.judge(n, Math.min(dt, Math.abs(n.deadline - n.time)));
        }
      } else {
        this.wrongKey(ch, n);
      }
    }
  }

  private wrongKey(ch: string, n: RtNote) {
    const expected = n.kind === "letter" ? n.key : n.text[n.typed];

    if (this.s.learnMode) {
      // educational feedback — identify, explain, correct. Combo stays, play continues.
      this.bridge.key?.(ch, "error");
      audio.playError();
      const finger = fingerLabel(expected);
      const def = KEY_MAP[expected.toLowerCase()];
      let hint: string | undefined;
      if (def && def.movement !== "home") {
        hint = `TRY ${def.homeKey.toUpperCase()} → ${expected.toUpperCase()} → ${def.homeKey.toUpperCase()}`;
      }
      const repeats = this.mistakeLog[expected] ?? 0;
      let sub2: string | undefined;
      if (repeats >= 2 && def && def.finger !== "thumb") {
        const zone = FINGER_ZONES[def.finger as FingerId];
        if (zone) sub2 = `${zone.label} OWNS ${zone.keys.slice(0, 4).join(" ").toUpperCase()}`;
      }
      this.popups.push({
        text: `NOT QUITE — NEED ${expected === " " ? "␣" : expected.toUpperCase()}`,
        sub: [finger, hint].filter(Boolean).join(" · ") || undefined,
        sub2,
        color: "#ffc94d",
        t0: this.songTime(),
        size: 15,
        y0: 0,
        kind: "judge",
      });
      if (this.s.screenShake && !this.s.reducedMotion) this.shake = Math.max(this.shake, 2);
      this.trackMistake(ch, expected);
      this.recordHit(false);
      return;
    }

    this.combo = 0;
    this.perfectStreak = 0;
    this.bridge.combo?.(0, 1);
    this.bridge.key?.(ch, "error");
    this.bridge.glow?.(expected);
    audio.playError();
    this.flash = 0.25;
    this.flashColor = "#ff4d5e";
    if (this.s.screenShake && !this.s.reducedMotion) this.shake = Math.max(this.shake, 4);
    this.trackMistake(ch, expected);
    this.recordHit(false);
    // a key missing three times in one run deserves a lesson, not just a buzz
    if ((this.mistakeLog[expected] ?? 0) >= 3 && !this.coachedKeys.has(expected)) {
      this.coachedKeys.add(expected);
      this.bridge.coach?.(`${expected === " " ? "SPACE" : expected.toUpperCase()} IS SLIPPING — DRILL IT IN LEARN`);
    }
  }

  private mistakeLog: Record<string, number> = {};
  private trackMistake(pressed: string, expected: string) {
    this.mistakeLog[expected] = (this.mistakeLog[expected] ?? 0) + 1;
    void pressed;
  }
  getMistakeLog() {
    return this.mistakeLog;
  }

  private judge(n: RtNote, dt: number) {
    let tier: keyof Judgments;
    if (dt <= this.win.p) tier = "perfect";
    else if (dt <= this.win.g) tier = "great";
    else tier = "good";
    n.judged = true;
    n.judgment = tier;
    n.doneAt = this.songTime();
    this.j[tier]++;
    if (n.kind === "letter") {
      this.correctChars++;
      this.charTimes.push(this.songTime());
    }
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = comboMultiplier(this.combo);

    // layered scoring: tier value × combo × difficulty × flow
    const base = n.kind === "letter"
      ? (tier === "perfect" ? 100 : tier === "great" ? 75 : 50)
      : 60 + 35 * n.text.length;
    const jMult = n.kind === "word" ? (tier === "perfect" ? 1.5 : tier === "great" ? 1.2 : 1) : 1;
    const gained = Math.round(base * jMult * mult * DIFF_MULT[this.cfg.difficulty] * (this.flowOn ? 2 : 1));
    this.score += gained;

    const now = this.songTime();
    const tierColor = JUDGE_COLOR[tier];
    const cbMark = this.s.colorBlind ? (tier === "perfect" ? " ◆" : tier === "great" ? " ●" : " ▲") : "";
    this.popups.push({ text: tier.toUpperCase() + cbMark, color: tierColor, t0: now, size: tier === "perfect" ? 30 : 24, y0: 0, kind: "judge" });
    this.popups.push({ text: `+${gained}`, color: "#eaf2ff", t0: now, size: 15, y0: 26, kind: "score" });

    // phrase rewards — sequences feel like progress, not endless keystrokes
    if (n.kind === "word") {
      const bonus = Math.round((tier === "perfect" ? 750 : 500) * (this.flowOn ? 2 : 1));
      this.score += bonus;
      this.popups.push({
        text: tier === "perfect" ? "PERFECT PHRASE" : "WORD COMPLETE",
        sub: `+${bonus}`,
        color: tier === "perfect" ? "#ffc94d" : "#00e5ff",
        t0: now + 0.06, size: 17, y0: 52, kind: "judge",
      });
    }

    // rhythm streak — reward chains of perfect timing
    this.perfectStreak = tier === "perfect" ? this.perfectStreak + 1 : 0;
    audio.playJudgment(tier, this.perfectStreak);
    if (this.perfectStreak > 0 && this.perfectStreak % 4 === 0) {
      const rBonus = 25 * (this.perfectStreak / 4) * mult;
      this.score += rBonus;
      this.popups.push({ text: `RHYTHM ×${this.perfectStreak}`, sub: `+${rBonus}`, color: "#ff8a3d", t0: now + 0.1, size: 20, y0: 84, kind: "judge" });
      audio.playCombo(1);
    }

    this.recordHit(true);
    this.bridge.combo?.(this.combo, mult);
    this.bridge.glow?.(this.nextGlowChar());

    const px = this.laneX(n);
    const py = this.hitY();
    // feedback volume follows difficulty — calm for beginners, alive for experts
    const pCount = Math.round(
      (tier === "perfect" ? 18 : tier === "great" ? 12 : 7) *
      (0.65 + 0.55 * this.intensity) * (this.flowOn ? 1.25 : 1),
    );
    this.spawnParticles(px, py, pCount, tierColor, tier === "perfect" ? 1 : 0.7);
    if (tier === "perfect") {
      this.flash = Math.max(this.flash, (0.08 + 0.1 * this.intensity) * (this.flowOn ? 1.4 : 1));
      this.flashColor = "#a8ff3e";
      // precision ring only once a groove exists — so it reads as earned
      if ((this.flowOn || this.perfectStreak >= 4) && this.intensity >= 0.4) {
        this.spawnRing(px, py, tierColor);
      }
    }

    const ms = COMBO_MILESTONES[this.combo];
    if (ms) {
      const tierNum = this.combo >= 100 ? 4 : this.combo >= 50 ? 3 : this.combo >= 30 ? 2 : 1;
      audio.playCombo(tierNum);
      this.bridge.milestone?.(ms, tierNum);
      this.spawnRing(px, py, tierColor);
      if (this.s.screenShake && !this.s.reducedMotion) this.shake = Math.max(this.shake, 5 + tierNum * 2);
    }

    if (this.cfg.mode === "endless") {
      this.health = Math.min(100, this.health + (tier === "perfect" ? 3 : tier === "great" ? 2 : 1));
    }

    while (this.nextIdx < this.notes.length && this.notes[this.nextIdx].judged) this.nextIdx++;
  }

  // ----------------------------------------------------------
  // flow state — entered on sustained accuracy, lost when it slips
  // ----------------------------------------------------------

  private recordHit(ok: boolean) {
    this.hitWindow.push(ok);
    if (this.hitWindow.length > 20) this.hitWindow.shift();
    if (this.hitWindow.length < 12) return;
    const rate = this.hitWindow.filter(Boolean).length / this.hitWindow.length;
    if (!this.flowOn && rate >= 0.95 && this.combo >= 8) {
      this.flowOn = true;
      this.bridge.flow?.(true);
      this.popups.push({ text: "FLOW ×2", sub: "keep it clean", color: "#ffc94d", t0: this.songTime(), size: 34, y0: 0, kind: "big" });
      audio.playCombo(2);
      if (this.s.screenShake && !this.s.reducedMotion) this.shake = Math.max(this.shake, 6);
    } else if (this.flowOn && rate < 0.85) {
      this.flowOn = false;
      this.bridge.flow?.(false);
      this.popups.push({ text: "FLOW LOST", color: "#5d6c99", t0: this.songTime(), size: 26, y0: 0, kind: "big" });
    }
  }

  get flowActive() {
    return this.flowOn;
  }

  private missNote(n: RtNote) {
    n.judged = true;
    n.judgment = "miss";
    n.doneAt = this.songTime();
    this.j.miss++;
    this.combo = 0;
    this.perfectStreak = 0;
    this.recordHit(false);
    this.bridge.combo?.(0, 1);
    this.bridge.glow?.(this.nextGlowChar());
    this.popups.push({ text: "MISS" + (this.s.colorBlind ? " ✕" : ""), color: JUDGE_COLOR.miss, t0: this.songTime(), size: 24, y0: 0, kind: "judge" });
    this.flash = 0.3;
    this.flashColor = "#ff4d5e";
    if (this.s.screenShake && !this.s.reducedMotion) this.shake = Math.max(this.shake, 6);
    if (this.cfg.mode === "endless") {
      this.health = Math.max(0, this.health - 14);
      if (this.health <= 0) this.finish(true);
    }
    while (this.nextIdx < this.notes.length && this.notes[this.nextIdx].judged) this.nextIdx++;
  }

  private nextGlowChar(): string | null {
    const n = this.activeNote();
    if (!n) return null;
    return n.kind === "letter" ? n.key : n.text[n.typed];
  }

  // ----------------------------------------------------------
  // loop
  // ----------------------------------------------------------

  private loop() {
    if (this.destroyed) return;
    if (!this.paused) {
      this.update();
      this.draw();
    }
    this.raf = requestAnimationFrame(() => this.loop());
  }

  private update() {
    const t = this.songTime();

    // long-session hygiene: judged notes below the cursor are never touched
    // again (every loop starts at nextIdx), so drop them to bound memory
    if (this.nextIdx > 300) {
      this.notes.splice(0, this.nextIdx);
      this.nextIdx = 0;
    }

    // count-in beeps (4..1, then GO)
    if (t < 0) {
      const c = Math.ceil(-t / this.beat);
      if (c !== this.lastCount && c <= 4 && c >= 1) {
        this.lastCount = c;
        audio.playCount(c);
      }
    } else if (this.lastCount !== 0) {
      this.lastCount = 0;
      audio.playCount(0);
    }

    // stream more notes (endless / time)
    if (this.cfg.stream && t + 8 > this.streamUntil) {
      const more = this.cfg.stream.next(this.streamUntil, t + 10);
      for (const n of more) this.notes.push({ ...n, typed: 0, judged: false, x: 0, w: 0 });
      this.streamUntil = t + 10;
    }

    // misses (never in no-pressure learning mode — notes simply wait)
    if (!this.s.noPressure) {
      for (let i = this.nextIdx; i < this.notes.length; i++) {
        const n = this.notes[i];
        if (n.judged) continue;
        const limit = n.kind === "letter" ? n.time + this.win.good : n.deadline;
        if (t > limit) this.missNote(n);
        else break;
      }
    }

    // glow follow (gated by guidance level)
    const g = this.s.highlightKeys === false ? null : this.nextGlowChar();
    if (g !== this.lastGlow) {
      this.lastGlow = g;
      this.bridge.glow?.(g);
    }

    // active note hint for the visual keyboard (gated by guidance level)
    const an = this.activeNote();
    const nk = an && !an.judged ? `${an.id}:${an.typed}` : "none";
    if (nk !== this.lastNoteKey) {
      this.lastNoteKey = nk;
      if (this.s.showNextKey !== false) {
        this.bridge.note?.(an && !an.judged ? an.text : null, an?.typed ?? 0, an?.kind ?? "letter");
      }
    }

    // decay fx
    this.shake *= 0.86;
    this.flash *= 0.9;

    // particles
    const dtF = 1 / 60;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dtF;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.vx *= 0.985;
    }

    // popups cleanup
    this.popups = this.popups.filter((p) => t - p.t0 < 0.9);

    this.updateHud(t);

    // finish conditions
    if (!this.finished) {
      if (this.s.noPressure) {
        // learners set the pace: finish when every note is done, whenever that is
        if (this.notes.length > 0 && this.nextIdx >= this.notes.length) this.finish(false);
      } else if (this.cfg.mode === "time") {
        if (t >= this.duration) this.finish(false);
      } else if (this.cfg.chart) {
        if (t > this.duration && this.nextIdx >= this.notes.length) this.finish(false);
        else if (t > this.duration + 2) this.finish(false);
      }
    }
  }

  private lastGlow: string | null = null;
  private lastNoteKey = "";

  private updateHud(t: number) {
    this.dispScore += (this.score - this.dispScore) * 0.18;
    if (this.hud.score) this.hud.score.textContent = Math.round(this.dispScore).toLocaleString();

    const now = t;
    this.charTimes = this.charTimes.filter((c) => now - c < 6);
    const rolling = this.charTimes.length >= 8 ? Math.round((this.charTimes.length / 5) * (60 / 6)) : -1;
    const session = Math.round(this.correctChars / 5 / (Math.max(10, t) / 60));
    if (this.hud.wpm) this.hud.wpm.textContent = String(Math.min(300, rolling >= 0 ? rolling : session));
    const acc = this.totalKeystrokes > 0 ? (this.correctChars / this.totalKeystrokes) * 100 : 100;
    if (this.hud.acc) this.hud.acc.textContent = acc.toFixed(1) + "%";
    if (this.hud.mult) this.hud.mult.textContent = comboMultiplier(this.combo) + "x";

    const prog = Math.max(0, Math.min(1, (t) / this.duration));
    if (this.hud.progress) (this.hud.progress as HTMLElement).style.width = (prog * 100).toFixed(2) + "%";
    if (this.hud.time) {
      if (this.cfg.mode === "time") {
        const remain = Math.max(0, this.duration - t);
        this.hud.time.textContent = Math.ceil(remain) + "s";
      } else {
        const cur = Math.max(0, Math.floor(t));
        this.hud.time.textContent = `${Math.floor(cur / 60)}:${String(cur % 60).padStart(2, "0")}`;
      }
    }
    if (this.hud.health) this.hud.health.style.width = this.health + "%";
  }

  // ----------------------------------------------------------
  // drawing
  // ----------------------------------------------------------

  private W = 0;
  private H = 0;

  private resize() {
    if (this.ro && !this.needsResize) return;
    this.needsResize = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return; // detached / hidden canvas
    if (Math.abs(r.width - this.W) > 1 || Math.abs(r.height - this.H) > 1 || this.W === 0) {
      this.W = r.width;
      this.H = r.height;
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
      this.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  private laneW() {
    return Math.max(300, Math.min(480, this.W * 0.36));
  }
  private hitY() {
    return this.H * 0.76;
  }
  private laneX(n: RtNote) {
    return this.W / 2 + n.x * this.laneW() * 0.18;
  }

  private noteWidth(n: RtNote): number {
    if (n.w) return n.w;
    const c = this.ctx2d;
    c.font = n.kind === "letter" ? "26px 'Audiowide'" : "700 19px 'JetBrains Mono'";
    const w = c.measureText(n.text).width;
    n.w = n.kind === "letter" ? 66 : Math.max(70, w + 34);
    return n.w;
  }

  private tierColor(): string {
    if (this.combo >= 100) return "#ffc94d";
    if (this.combo >= 50) return "#ff3d7e";
    if (this.combo >= 25) return "#ff8a3d";
    if (this.combo >= 10) return "#00e5ff";
    return "#3d5a9e";
  }

  private draw() {
    this.resize();
    const c = this.ctx2d;
    const { W, H } = this;
    const t = this.songTime();
    const laneW = this.laneW();
    const hitY = this.hitY();
    const cx = W / 2;

    c.save();
    if (this.shake > 0.5) {
      c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    // ---------- background ----------
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#070b17");
    bg.addColorStop(0.6, "#04060e");
    bg.addColorStop(1, "#02030a");
    c.fillStyle = bg;
    c.fillRect(-20, -20, W + 40, H + 40);

    const beatPhase = ((t % this.beat) + this.beat) % this.beat / this.beat;
    const beatPulse = Math.pow(1 - beatPhase, 3);

    if (this.s.bgEffects) {
      // combo aura radial glow
      const aura = c.createRadialGradient(cx, hitY, 40, cx, hitY, Math.max(W, H) * 0.75);
      const ac = this.tierColor();
      const auraA = (0.05 + Math.min(0.16, this.combo * 0.0012)) * (0.7 + beatPulse * 0.5);
      aura.addColorStop(0, ac + "00");
      aura.addColorStop(0.35, this.hexA(ac, auraA * 0.5));
      aura.addColorStop(1, ac + "00");
      c.fillStyle = aura;
      c.fillRect(0, 0, W, H);

      // perspective floor grid
      c.strokeStyle = this.hexA(ac, 0.1 + beatPulse * 0.06);
      c.lineWidth = 1;
      const horizon = hitY;
      const rows = 14;
      for (let i = 0; i < rows; i++) {
        const pp = (i + ((t * 0.9) % 1)) / rows;
        const y = horizon + Math.pow(pp, 2.2) * (H - horizon) * 1.15;
        if (y > H + 10) continue;
        c.globalAlpha = Math.min(1, pp * 2) * 0.5;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
      c.globalAlpha = 1;
      const cols = 12;
      for (let i = 0; i <= cols; i++) {
        const xTop = cx + ((i / cols) - 0.5) * laneW * 1.6;
        const xBot = cx + ((i / cols) - 0.5) * W * 1.6;
        c.strokeStyle = this.hexA(ac, 0.05);
        c.beginPath();
        c.moveTo(xTop, horizon);
        c.lineTo(xBot, H);
        c.stroke();
      }

      // beat ring at hit zone
      if (t > -this.countIn) {
        c.strokeStyle = this.hexA(ac, 0.25 * (1 - beatPhase));
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, hitY, 30 + beatPhase * 90, 0, Math.PI * 2);
        c.stroke();
      }
    }

    // ---------- lane ----------
    const laneGrad = c.createLinearGradient(0, 0, 0, H);
    laneGrad.addColorStop(0, "rgba(12,18,38,0)");
    laneGrad.addColorStop(0.5, "rgba(12,18,38,0.55)");
    laneGrad.addColorStop(1, "rgba(12,18,38,0.8)");
    c.fillStyle = laneGrad;
    c.fillRect(cx - laneW / 2, 0, laneW, H);

    c.strokeStyle = this.hexA(this.tierColor(), 0.5);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - laneW / 2, 0); c.lineTo(cx - laneW / 2, H);
    c.moveTo(cx + laneW / 2, 0); c.lineTo(cx + laneW / 2, H);
    c.stroke();

    // hit line
    const hl = c.createLinearGradient(cx - laneW / 2, 0, cx + laneW / 2, 0);
    const hc = this.tierColor();
    hl.addColorStop(0, hc + "00");
    hl.addColorStop(0.5, this.hexA(hc, 0.85 + beatPulse * 0.15));
    hl.addColorStop(1, hc + "00");
    c.fillStyle = hl;
    c.fillRect(cx - laneW / 2, hitY - 2, laneW, 4);
    c.fillStyle = this.hexA(hc, 0.14);
    c.fillRect(cx - laneW / 2, hitY - 26, laneW, 52);

    // ---------- notes ----------
    c.textAlign = "center";
    c.textBaseline = "middle";
    const active = this.activeNote();
    for (let i = this.nextIdx; i < this.notes.length; i++) {
      const n = this.notes[i];
      let y = hitY - (n.time - t) * this.pxPerSec;
      // no-pressure mode: notes glide to the line and patiently wait
      if (this.s.noPressure && !n.judged && y > hitY) {
        y = hitY + Math.sin(t * 2.2 + n.id) * 2.5;
      }
      if (y < -80) break;
      if (y > H + 40) continue;
      this.drawNote(n, y, n === active, t);
    }

    // ---------- particles ----------
    if (this.s.particles) {
      c.globalCompositeOperation = "lighter";
      for (const p of this.particles) {
        const a = Math.max(0, p.life / p.maxLife);
        c.globalAlpha = a;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }

    // ---------- popups ----------
    for (const p of this.popups) {
      const age = t - p.t0;
      const a = 1 - age / 0.85;
      if (a <= 0) continue;
      const y = hitY - 70 - p.y0 - age * 46;
      c.globalAlpha = Math.min(1, a * 1.6);
      if (p.kind === "judge") {
        const scale = age < 0.12 ? 1 + (0.12 - age) * 3 : 1;
        c.font = `${Math.round(p.size * scale)}px 'Audiowide'`;
        c.fillStyle = p.color;
        c.shadowColor = p.color;
        c.shadowBlur = 18;
        c.fillText(p.text, cx, y);
        c.shadowBlur = 0;
        if (p.sub) {
          c.font = "700 12px 'JetBrains Mono'";
          c.fillStyle = "#eaf2ff";
          c.fillText(p.sub, cx, y + 22);
        }
        if (p.sub2) {
          c.font = "700 11px 'JetBrains Mono'";
          c.fillStyle = "#93a1c7";
          c.fillText(p.sub2, cx, y + 39);
        }
      } else if (p.kind === "big") {
        c.font = `${p.size}px 'Audiowide'`;
        c.fillStyle = p.color;
        c.shadowColor = p.color;
        c.shadowBlur = 26;
        c.fillText(p.text, cx, this.H * 0.34 - age * 18);
        c.shadowBlur = 0;
        if (p.sub) {
          c.font = "700 13px 'JetBrains Mono'";
          c.fillStyle = "#eaf2ff";
          c.fillText(p.sub, cx, this.H * 0.34 + 26 - age * 18);
        }
      } else {
        c.font = `700 ${p.size}px 'JetBrains Mono'`;
        c.fillStyle = p.color;
        c.fillText(p.text, cx, y);
      }
      c.globalAlpha = 1;
    }

    // ---------- count-in ----------
    const cNum = t < 0 ? Math.ceil(-t / this.beat) : 0;
    if (t < 0.6 && cNum <= 4) {
      const num = cNum;
      const label = num === 0 ? "GO!" : String(num);
      const phase = t < 0 ? 1 - ((-t % this.beat) / this.beat) : 1 - t / 0.6;
      c.globalAlpha = Math.max(0, Math.min(1, phase * 1.5));
      c.font = `${Math.round(90 + (1 - phase) * 20)}px 'Audiowide'`;
      c.fillStyle = num === 0 ? "#a8ff3e" : "#00e5ff";
      c.shadowColor = c.fillStyle as string;
      c.shadowBlur = 34;
      c.fillText(label, cx, H * 0.4);
      c.shadowBlur = 0;
      c.globalAlpha = 1;
    }

    // ---------- vignette + flash ----------
    const vg = c.createRadialGradient(cx, H * 0.45, H * 0.25, cx, H * 0.5, H * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);

    if (this.flash > 0.01 && !this.s.reducedMotion) {
      c.fillStyle = this.hexA(this.flashColor, this.flash * 0.35);
      c.fillRect(0, 0, W, H);
    }

    c.restore();
  }

  private hexA(hex: string, a: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  private drawNote(n: RtNote, y: number, isActive: boolean, t: number) {
    const c = this.ctx2d;
    const cx = this.laneX(n);
    const w = this.noteWidth(n);
    const h = n.kind === "letter" ? 54 : 46;
    const judgedFade = n.judged ? Math.max(0, 1 - ((t - (n.doneAt ?? t)) / 0.3)) : 1;
    if (judgedFade <= 0) return;

    const dist = Math.abs(y - this.hitY());
    const prox = Math.max(0, 1 - dist / 420);
    const missed = n.judgment === "miss";
    const baseColor = missed ? "#ff4d5e"
      : n.color ?? (n.kind === "letter"
        ? (/[A-Z]/.test(n.text) ? "#ffc94d" : /\d/.test(n.text) ? "#a8ff3e" : "#00e5ff")
        : "#00e5ff");

    c.save();
    c.globalAlpha = judgedFade * (n.judged && !missed ? 0.25 : 1);
    const scale = isActive && !n.judged ? 1 + Math.sin(t * 10) * 0.02 + prox * 0.04 : 1;
    c.translate(cx, y);
    c.scale(scale, scale);

    // body
    const r = h / 2;
    c.beginPath();
    c.roundRect(-w / 2, -h / 2, w, h, r);
    c.fillStyle = missed ? "rgba(70,10,20,0.85)" : `rgba(10,16,34,${0.72 + prox * 0.25})`;
    c.fill();
    c.lineWidth = isActive ? 2.5 : 1.5;
    c.strokeStyle = this.hexA(baseColor, (isActive ? 1 : 0.55) + prox * 0.3);
    c.shadowColor = baseColor;
    c.shadowBlur = isActive ? 22 : 10 * prox;
    c.stroke();
    c.shadowBlur = 0;

    // top highlight
    c.beginPath();
    c.roundRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.28, r);
    c.fillStyle = "rgba(234,242,255,0.07)";
    c.fill();

    // text
    if (n.kind === "letter") {
      c.font = "26px 'Audiowide'";
      c.fillStyle = missed ? "#ff9aa5" : baseColor;
      c.shadowColor = baseColor;
      c.shadowBlur = isActive ? 16 : 6;
      c.fillText(n.text, 0, 2);
      c.shadowBlur = 0;
    } else {
      c.font = "700 19px 'JetBrains Mono'";
      const chars = n.text.split("");
      const totalW = c.measureText(n.text).width;
      let x = -totalW / 2;
      for (let i = 0; i < chars.length; i++) {
        const cw = c.measureText(chars[i]).width;
        if (i < n.typed) {
          c.fillStyle = "#a8ff3e";
          c.shadowColor = "#a8ff3e";
          c.shadowBlur = 8;
        } else if (i === n.typed && isActive && !n.judged) {
          c.fillStyle = "#ffffff";
          c.shadowColor = "#00e5ff";
          c.shadowBlur = 12;
        } else {
          c.fillStyle = missed ? "rgba(255,154,165,0.5)" : "rgba(147,161,199,0.85)";
          c.shadowBlur = 0;
        }
        c.fillText(chars[i], x + cw / 2, 1);
        x += cw;
      }
      c.shadowBlur = 0;
      // progress underline
      if (n.typed > 0 && !n.judged) {
        c.fillStyle = "#a8ff3e";
        c.fillRect(-totalW / 2, h / 2 - 8, totalW * (n.typed / n.text.length), 2.5);
      }
    }
    c.restore();
  }

  private spawnParticles(x: number, y: number, count: number, color: string, power = 1) {
    if (!this.s.particles) return;
    const n = this.s.quality === "low" ? Math.ceil(count / 2) : count;
    if (this.particles.length > 240) this.particles.splice(0, n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1.5 + Math.random() * 4.5) * power;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2.2,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 2 + Math.random() * 3.2,
        color,
      });
    }
  }

  private spawnRing(x: number, y: number, color: string) {
    const n = this.s.quality === "low" ? 14 : 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * 6,
        vy: Math.sin(a) * 2.4,
        life: 0.6,
        maxLife: 0.6,
        size: 3,
        color,
      });
    }
  }

  // ----------------------------------------------------------
  // finish
  // ----------------------------------------------------------

  private finish(died: boolean) {
    if (this.finished) return;
    this.finished = true;
    // count leftovers as misses
    for (let i = this.nextIdx; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (!n.judged && n.time < this.songTime()) {
        n.judged = true;
        n.judgment = "miss";
        this.j.miss++;
      }
    }
    audio.stopMusic();

    const t = Math.max(1, this.songTime());
    const minutes = Math.max(0.1, (Math.min(t, this.duration) - 0) / 60);
    const wpm = Math.round(this.correctChars / 5 / minutes);
    const acc = this.totalKeystrokes > 0 ? (this.correctChars / this.totalKeystrokes) * 100 : 0;
    const totalNotes = this.j.perfect + this.j.great + this.j.good + this.j.miss;
    const completion = totalNotes > 0 ? (this.j.perfect + this.j.great + this.j.good) / totalNotes : 0;

    const result: GameResult = {
      mode: this.cfg.mode,
      songId: this.cfg.songId,
      difficulty: this.cfg.difficulty,
      score: this.score,
      maxCombo: this.maxCombo,
      wpm: Math.min(300, wpm),
      accuracy: acc,
      judgments: { ...this.j },
      completion,
      timePlayed: t,
      correctChars: this.correctChars,
      totalKeystrokes: this.totalKeystrokes,
      died,
    };
    setTimeout(() => {
      if (!this.destroyed) this.onEnd(result);
    }, died ? 600 : 1100);
  }
}
