import {
  ACHIEVEMENTS, Difficulty, levelFromXp, xpForLevel,
} from "./game/content";
import { GameResult } from "./game/engine";
import { KeyProfile } from "./audio/audio";
import { SONGS } from "./game/songs";
import { FINGER_IDS, FINGER_ZONES, KEY_MAP } from "./game/keymap";
import { wordsOnly } from "./game/lessons";

export type GuidanceLevel = "A" | "B" | "C" | "D" | "E";

export interface Settings {
  musicVol: number;
  keyVol: number;
  fxVol: number;
  muted: boolean;
  noteSpeed: number; // 0.5 – 2.0, fully independent of BPM
  timingOffset: number; // ms
  keyProfile: KeyProfile;
  showKeyboard: boolean;
  showWpm: boolean;
  showAcc: boolean;
  particles: boolean;
  quality: "low" | "high";
  screenShake: boolean;
  bgEffects: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  colorBlind: boolean;
  adaptive: boolean;
  // guided typing (beginners default to full guidance)
  showFingerGuide: boolean;
  showHandPosition: boolean;
  highlightRequiredKey: boolean;
  showNextKey: boolean;
  guidanceLevel: GuidanceLevel;
}

export interface SongBest {
  score: number;
  wpm: number;
  accuracy: number;
  maxCombo: number;
  completion: number;
  rank: string;
  plays: number;
}

export interface Profile {
  xp: number;
  totalPlaySec: number;
  songsCompleted: number;
  bestWpm: number;
  bestCombo: number;
  bestScore: number;
  bestAccuracy: number;
  totalKeysTyped: number;
  gamesPlayed: number;
}

export interface LessonProg {
  done: boolean;
  mastered: boolean;
  bestAcc: number;
  plays: number;
}

export interface StoreShape {
  settings: Settings;
  profile: Profile;
  songBests: Record<string, SongBest>;
  achievements: Record<string, number>;
  mistyped: Record<string, number>;
  wpmHistory: number[];
  daily: { date: string; completed: boolean; wpm: number; accuracy: number };
  skillBias: number;
  // learning journey
  onboarded: boolean;
  lessons: Record<string, LessonProg>;
  keyAttempts: Record<string, number>;
  speedStats: Record<string, { runs: number; wpm: number; acc: number }>;
  recentRuns: { acc: number; wpm: number; speed: number }[];
  suggestion: { dir: "up" | "down"; speed: number } | null;
  dailyLog: { date: string; done: string[]; claimed: boolean };
  challengeBests: Record<string, number>; // sprint hits, memory keys, movement acc, perfect-run attempts
}

const KEY = "keybeat-save-v1";

export const DEFAULT_SETTINGS: Settings = {
  musicVol: 0.8,
  keyVol: 0.9,
  fxVol: 0.85,
  muted: false,
  noteSpeed: 0.9, // comfortable default — beginners are routed to lessons anyway
  timingOffset: 0,
  keyProfile: "blue",
  showKeyboard: true,
  showWpm: true,
  showAcc: true,
  particles: true,
  quality: "high",
  screenShake: true,
  bgEffects: true,
  highContrast: false,
  reducedMotion: false,
  colorBlind: false,
  adaptive: true,
  showFingerGuide: true,
  showHandPosition: true,
  highlightRequiredKey: true,
  showNextKey: true,
  guidanceLevel: "A",
};

// speed presets
export const SPEED_PRESETS: { id: string; label: string; speed: number }[] = [
  { id: "learning", label: "LEARNING", speed: 0.5 },
  { id: "beginner", label: "BEGINNER", speed: 0.65 },
  { id: "comfortable", label: "COMFORTABLE", speed: 0.8 },
  { id: "normal", label: "NORMAL", speed: 1.0 },
  { id: "fast", label: "FAST", speed: 1.25 },
  { id: "expert", label: "EXPERT", speed: 1.5 },
];

function defaultStore(): StoreShape {
  return {
    settings: { ...DEFAULT_SETTINGS },
    profile: {
      xp: 0, totalPlaySec: 0, songsCompleted: 0,
      bestWpm: 0, bestCombo: 0, bestScore: 0, bestAccuracy: 0,
      totalKeysTyped: 0, gamesPlayed: 0,
    },
    songBests: {},
    achievements: {},
    mistyped: {},
    wpmHistory: [],
    daily: { date: "", completed: false, wpm: 0, accuracy: 0 },
    skillBias: 0,
    onboarded: false,
    lessons: {},
    keyAttempts: {},
    speedStats: {},
    recentRuns: [],
    suggestion: null,
    dailyLog: { date: "", done: [], claimed: false },
    challengeBests: {},
  };
}

let cache: StoreShape | null = null;

// ------------------------------------------------------------------
// localStorage is UNTRUSTED INPUT. Every field is validated and clamped;
// a corrupted section resets only itself — the app never crashes and a
// refresh never destroys unrelated valid progress.
// ------------------------------------------------------------------

const num = (v: unknown, min: number, max: number, dflt: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : dflt;
  return Math.min(max, Math.max(min, n));
};
const int = (v: unknown, min: number, max: number, dflt: number): number =>
  Math.round(num(v, min, max, dflt));
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === "boolean" ? v : dflt);
const str = (v: unknown, dflt: string): string => (typeof v === "string" ? v.slice(0, 200) : dflt);
const oneOf = <T extends string>(v: unknown, list: readonly T[], dflt: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : dflt;
const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const KEY_PROFILES = ["blue", "red", "brown", "premium", "retro"] as const;
const RANKS = ["S", "A", "B", "C", "D"] as const;

function sanitizeCounters(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  let guard = 0;
  for (const [k, raw] of Object.entries(obj(v))) {
    if (++guard > 400) break;
    if (typeof k !== "string" || k.length === 0 || k.length > 4) continue;
    const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : NaN;
    if (Number.isFinite(n) && n >= 0) out[k] = Math.min(n, 1_000_000);
  }
  return out;
}

function sanitizeSettings(p: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  try {
    const o = obj(p);
    return {
      musicVol: num(o.musicVol, 0, 1, d.musicVol),
      keyVol: num(o.keyVol, 0, 1, d.keyVol),
      fxVol: num(o.fxVol, 0, 1, d.fxVol),
      muted: bool(o.muted, d.muted),
      noteSpeed: num(o.noteSpeed, 0.5, 2, d.noteSpeed),
      timingOffset: int(o.timingOffset, -300, 300, d.timingOffset),
      keyProfile: oneOf(o.keyProfile, KEY_PROFILES, d.keyProfile),
      showKeyboard: bool(o.showKeyboard, d.showKeyboard),
      showWpm: bool(o.showWpm, d.showWpm),
      showAcc: bool(o.showAcc, d.showAcc),
      particles: bool(o.particles, d.particles),
      quality: oneOf(o.quality, ["low", "high"] as const, d.quality),
      screenShake: bool(o.screenShake, d.screenShake),
      bgEffects: bool(o.bgEffects, d.bgEffects),
      highContrast: bool(o.highContrast, d.highContrast),
      reducedMotion: bool(o.reducedMotion, d.reducedMotion),
      colorBlind: bool(o.colorBlind, d.colorBlind),
      adaptive: bool(o.adaptive, d.adaptive),
      showFingerGuide: bool(o.showFingerGuide, d.showFingerGuide),
      showHandPosition: bool(o.showHandPosition, d.showHandPosition),
      highlightRequiredKey: bool(o.highlightRequiredKey, d.highlightRequiredKey),
      showNextKey: bool(o.showNextKey, d.showNextKey),
      guidanceLevel: oneOf(o.guidanceLevel, ["A", "B", "C", "D", "E"] as const, d.guidanceLevel),
    };
  } catch {
    return { ...d };
  }
}

function sanitizeProfile(p: unknown): Profile {
  const d = defaultStore().profile;
  try {
    const o = obj(p);
    return {
      xp: num(o.xp, 0, 1e9, d.xp),
      totalPlaySec: int(o.totalPlaySec, 0, 1e8, d.totalPlaySec),
      songsCompleted: int(o.songsCompleted, 0, 1e6, d.songsCompleted),
      bestWpm: int(o.bestWpm, 0, 300, d.bestWpm),
      bestCombo: int(o.bestCombo, 0, 1e6, d.bestCombo),
      bestScore: int(o.bestScore, 0, 1e9, d.bestScore),
      bestAccuracy: num(o.bestAccuracy, 0, 100, d.bestAccuracy),
      totalKeysTyped: int(o.totalKeysTyped, 0, 1e9, d.totalKeysTyped),
      gamesPlayed: int(o.gamesPlayed, 0, 1e6, d.gamesPlayed),
    };
  } catch {
    return d;
  }
}

function sanitizeLessons(p: unknown): Record<string, LessonProg> {
  const out: Record<string, LessonProg> = {};
  try {
    let guard = 0;
    for (const [k, v] of Object.entries(obj(p))) {
      if (++guard > 200) break;
      const o = obj(v);
      out[str(k, "")] = {
        done: bool(o.done, false),
        mastered: bool(o.mastered, false),
        bestAcc: num(o.bestAcc, 0, 100, 0),
        plays: int(o.plays, 0, 1e6, 0),
      };
    }
    delete out[""];
  } catch { /* keep what we have */ }
  return out;
}

function sanitizeSongBests(p: unknown): Record<string, SongBest> {
  const out: Record<string, SongBest> = {};
  try {
    let guard = 0;
    for (const [k, v] of Object.entries(obj(p))) {
      if (++guard > 100) break;
      const o = obj(v);
      const id = str(k, "");
      if (!id) continue;
      out[id] = {
        score: int(o.score, 0, 1e9, 0),
        wpm: int(o.wpm, 0, 300, 0),
        accuracy: num(o.accuracy, 0, 100, 0),
        maxCombo: int(o.maxCombo, 0, 1e6, 0),
        completion: num(o.completion, 0, 1, 0),
        rank: oneOf(o.rank, RANKS, "D"),
        plays: int(o.plays, 0, 1e6, 0),
      };
    }
  } catch { /* keep what we have */ }
  return out;
}

function sanitizeStore(parsed: unknown): StoreShape {
  const o = obj(parsed);
  let wpmHistory: number[] = [];
  try {
    wpmHistory = Array.isArray(o.wpmHistory)
      ? (o.wpmHistory as unknown[]).filter((x): x is number => typeof x === "number" && Number.isFinite(x)).map((x) => Math.min(300, Math.max(0, x))).slice(-40)
      : [];
  } catch { wpmHistory = []; }

  let recentRuns: StoreShape["recentRuns"] = [];
  try {
    recentRuns = Array.isArray(o.recentRuns)
      ? (o.recentRuns as unknown[]).map((r) => {
          const rr = obj(r);
          return { acc: num(rr.acc, 0, 100, 0), wpm: int(rr.wpm, 0, 300, 0), speed: num(rr.speed, 0.5, 2, 1) };
        }).slice(-10)
      : [];
  } catch { recentRuns = []; }

  let speedStats: StoreShape["speedStats"] = {};
  try {
    for (const [k, v] of Object.entries(obj(o.speedStats))) {
      const sp = parseFloat(k);
      if (!Number.isFinite(sp) || sp < 0.5 || sp > 2) continue;
      const sv = obj(v);
      speedStats[sp.toFixed(2)] = {
        runs: int(sv.runs, 0, 1e6, 0),
        wpm: num(sv.wpm, 0, 300, 0),
        acc: num(sv.acc, 0, 100, 0),
      };
    }
  } catch { speedStats = {}; }

  let suggestion: StoreShape["suggestion"] = null;
  try {
    const sg = obj(o.suggestion);
    const dir = sg.dir;
    if (dir === "up" || dir === "down") {
      suggestion = { dir, speed: num(sg.speed, 0.5, 2, 1) };
    }
  } catch { suggestion = null; }

  const dailyRaw = obj(o.daily);
  const logRaw = obj(o.dailyLog);

  return {
    settings: sanitizeSettings(o.settings),
    profile: sanitizeProfile(o.profile),
    songBests: sanitizeSongBests(o.songBests),
    achievements: sanitizeCounters(o.achievements),
    mistyped: sanitizeCounters(o.mistyped),
    wpmHistory,
    daily: {
      date: str(dailyRaw.date, ""),
      completed: bool(dailyRaw.completed, false),
      wpm: int(dailyRaw.wpm, 0, 300, 0),
      accuracy: num(dailyRaw.accuracy, 0, 100, 0),
    },
    skillBias: num(o.skillBias, -0.25, 0.25, 0),
    onboarded: bool(o.onboarded, false),
    lessons: sanitizeLessons(o.lessons),
    keyAttempts: sanitizeCounters(o.keyAttempts),
    speedStats,
    recentRuns,
    suggestion,
    dailyLog: {
      date: str(logRaw.date, ""),
      done: Array.isArray(logRaw.done)
        ? (logRaw.done as unknown[]).filter((x): x is string => x === "weak" || x === "acc" || x === "rhythm")
        : [],
      claimed: bool(logRaw.claimed, false),
    },
    challengeBests: sanitizeCounters(o.challengeBests),
  };
}

export function loadStore(): StoreShape {
  if (cache) return cache;
  let result = defaultStore();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      result = sanitizeStore(JSON.parse(raw));
    } else if (typeof window !== "undefined" && window.matchMedia) {
      // fresh install: respect the OS motion preference
      result.settings.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  } catch {
    /* corrupted JSON — start from defaults; nothing crashes */
  }
  cache = result;
  return result;
}

// emergency recovery for the error boundary — wipes the save, keeps the app alive
export function resetSave() {
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch { /* already gone */ }
}

export function saveStore() {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full / unavailable */
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const s = loadStore();
  s.settings = { ...s.settings, ...patch };
  saveStore();
  return s.settings;
}

// ------------------------------------------------------------------
// daily challenge — deterministic per calendar day
// ------------------------------------------------------------------

export interface DailyChallenge {
  date: string;
  songId: string;
  difficulty: Difficulty;
  goalWpm: number;
  goalAcc: number;
  rewardXp: number;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDaily(): DailyChallenge {
  const date = todayStr();
  let seed = 0;
  for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const song = SONGS[seed % SONGS.length];
  const difficulty: Difficulty = (["normal", "normal", "hard", "expert"] as Difficulty[])[Math.floor(seed / 7) % 4];
  const goalWpm = 40 + (Math.floor(seed / 13) % 6) * 10;
  const goalAcc = 90 + (Math.floor(seed / 29) % 4) * 2;
  return { date, songId: song.id, difficulty, goalWpm, goalAcc, rewardXp: 500 };
}

// ------------------------------------------------------------------
// post-game processing: XP, bests, achievements, adaptive skill
// ------------------------------------------------------------------

export function rankFor(accuracy: number, completion: number): string {
  if (completion < 0.6) return "D";
  if (accuracy >= 97 && completion >= 0.98) return "S";
  if (accuracy >= 92) return "A";
  if (accuracy >= 85) return "B";
  if (accuracy >= 70) return "C";
  return "D";
}

export interface GameOutcome {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  unlocked: string[]; // achievement ids
  newBest: { score: boolean; wpm: boolean; accuracy: boolean };
  dailyPassed: boolean;
  rank: string;
}

export function processGame(
  r: GameResult,
  mistakeLog: Record<string, number>,
  attemptLog: Record<string, number> = {},
  noteSpeedUsed = 1,
): GameOutcome {
  const s = loadStore();
  const levelBefore = levelFromXp(s.profile.xp);
  const unlocked: string[] = [];
  const unlock = (id: string) => {
    if (!s.achievements[id]) {
      s.achievements[id] = Date.now();
      unlocked.push(id);
    }
  };

  const finishedSong = r.mode === "song" || r.mode === "practice" || r.mode === "custom";
  const completed = r.completion >= 0.8 && !r.died;

  // ---- XP ----
  let xp = Math.round(r.score / 60);
  if (completed) xp += 120;
  if (r.accuracy >= 95) xp += 80;
  if (r.accuracy >= 99) xp += 80;
  if (r.maxCombo >= 50) xp += 60;
  if (r.maxCombo >= 100) xp += 100;
  const isWpmRecord = r.wpm > s.profile.bestWpm && r.wpm >= 30;
  if (isWpmRecord) xp += 90;

  // ---- daily ----
  const daily = getDaily();
  const prevDaily = s.daily.date === daily.date ? s.daily : { date: daily.date, completed: false, wpm: 0, accuracy: 0 };
  const dailyPassed =
    !prevDaily.completed &&
    r.songId === daily.songId &&
    r.difficulty === daily.difficulty &&
    r.wpm >= daily.goalWpm &&
    r.accuracy >= daily.goalAcc;
  if (dailyPassed) {
    xp += daily.rewardXp;
    unlock("daily-1");
  }
  s.daily = {
    date: daily.date,
    completed: prevDaily.completed || dailyPassed,
    wpm: Math.max(prevDaily.wpm, r.songId === daily.songId ? r.wpm : 0),
    accuracy: Math.max(prevDaily.accuracy, r.songId === daily.songId ? r.accuracy : 0),
  };

  s.profile.xp += xp;
  s.profile.totalPlaySec += Math.round(r.timePlayed);
  s.profile.gamesPlayed++;
  s.profile.totalKeysTyped += r.correctChars;
  s.profile.bestAccuracy = Math.max(s.profile.bestAccuracy, r.accuracy);
  if (completed && finishedSong) s.profile.songsCompleted++;
  s.profile.bestCombo = Math.max(s.profile.bestCombo, r.maxCombo);
  s.profile.bestScore = Math.max(s.profile.bestScore, r.score);
  const newBestWpm = r.wpm > s.profile.bestWpm;
  if (newBestWpm) s.profile.bestWpm = r.wpm;
  s.wpmHistory.push(r.wpm);
  if (s.wpmHistory.length > 40) s.wpmHistory.shift();

  // ---- song bests ----
  const newBest = { score: false, wpm: false, accuracy: false };
  if (finishedSong && r.songId !== "custom") {
    const prev = s.songBests[r.songId];
    const best: SongBest = {
      score: Math.max(prev?.score ?? 0, r.score),
      wpm: Math.max(prev?.wpm ?? 0, r.wpm),
      accuracy: Math.max(prev?.accuracy ?? 0, r.accuracy),
      maxCombo: Math.max(prev?.maxCombo ?? 0, r.maxCombo),
      completion: Math.max(prev?.completion ?? 0, r.completion),
      rank: rankFor(r.accuracy, r.completion),
      plays: (prev?.plays ?? 0) + 1,
    };
    if (prev) {
      if (r.score > prev.score) { newBest.score = true; best.rank = rankFor(Math.max(prev.accuracy, r.accuracy), best.completion); }
      if (r.wpm > prev.wpm) newBest.wpm = true;
      if (r.accuracy > prev.accuracy) newBest.accuracy = true;
      best.rank = rankFor(best.accuracy, best.completion);
    } else {
      newBest.score = newBest.wpm = newBest.accuracy = true;
    }
    s.songBests[r.songId] = best;
  }

  // ---- mistyped keys + per-key attempts ----
  for (const [k, v] of Object.entries(mistakeLog)) {
    s.mistyped[k] = (s.mistyped[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(attemptLog)) {
    s.keyAttempts[k] = (s.keyAttempts[k] ?? 0) + v;
  }

  // ---- comfort-speed tracking ----
  const sk = noteSpeedUsed.toFixed(2);
  const ss = s.speedStats[sk] ?? { runs: 0, wpm: 0, acc: 0 };
  s.speedStats[sk] = {
    runs: ss.runs + 1,
    wpm: (ss.wpm * ss.runs + r.wpm) / (ss.runs + 1),
    acc: (ss.acc * ss.runs + r.accuracy) / (ss.runs + 1),
  };
  s.recentRuns.push({ acc: r.accuracy, wpm: r.wpm, speed: noteSpeedUsed });
  if (s.recentRuns.length > 10) s.recentRuns.shift();

  // ---- smart speed suggestion (player always decides) ----
  if (s.settings.adaptive) {
    const last3 = s.recentRuns.slice(-3);
    const tierTarget = Math.min(100, 30 + skillTierIndex(s) * 8);
    if (last3.length >= 3 && last3.every((x) => x.acc > 97 && x.wpm >= tierTarget) && s.settings.noteSpeed < 2) {
      s.suggestion = { dir: "up", speed: Math.min(2, Math.round((s.settings.noteSpeed + 0.1) * 100) / 100) };
    } else {
      const last2 = s.recentRuns.slice(-2);
      if (last2.length >= 2 && last2.every((x) => x.acc < 85) && s.settings.noteSpeed > 0.5) {
        s.suggestion = { dir: "down", speed: Math.max(0.5, Math.round((s.settings.noteSpeed - 0.1) * 100) / 100) };
      } else {
        s.suggestion = null;
      }
    }
  }

  // ---- adaptive difficulty ----
  if (s.settings.adaptive) {
    if (r.accuracy >= 98 && r.wpm >= Math.max(40, s.profile.bestWpm * 0.85)) {
      s.skillBias = Math.min(0.25, s.skillBias + 0.05);
    } else if (r.accuracy < 85 && r.accuracy > 0) {
      s.skillBias = Math.max(-0.25, s.skillBias - 0.06);
    } else if (r.accuracy >= 90 && r.accuracy < 95) {
      s.skillBias = s.skillBias * 0.9;
    }
  }

  // ---- achievements ----
  if (completed && finishedSong) unlock("first-song");
  if (s.profile.songsCompleted >= 10) unlock("songs-10");
  if (r.wpm >= 50) unlock("wpm-50");
  if (r.wpm >= 75) unlock("wpm-75");
  if (r.wpm >= 100) unlock("wpm-100");
  if (r.wpm >= 120) unlock("wpm-120");
  if (r.accuracy >= 95 && r.totalKeystrokes > 20) unlock("acc-95");
  if (r.accuracy >= 99 && r.totalKeystrokes > 20) unlock("acc-99");
  if (r.maxCombo >= 50) unlock("combo-50");
  if (r.maxCombo >= 100) unlock("combo-100");
  if (completed && r.judgments.miss === 0 && r.totalKeystrokes > 20) unlock("perfect-song");
  if (completed && r.judgments.miss === 0 && (r.difficulty === "hard" || r.difficulty === "expert")) unlock("no-miss-hard");
  if (s.profile.totalPlaySec >= 3600) unlock("hour-1");
  if (r.mode === "endless" && r.score >= 5000) unlock("endless-5k");
  void ACHIEVEMENTS;

  saveStore();
  const levelAfter = levelFromXp(s.profile.xp);
  return {
    xpGained: xp,
    levelBefore,
    levelAfter,
    unlocked,
    newBest,
    dailyPassed,
    rank: rankFor(r.accuracy, r.completion),
  };
}

export function levelProgress(xp: number): { level: number; into: number; span: number; pct: number } {
  const level = levelFromXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - cur, span: next - cur, pct: Math.min(100, ((xp - cur) / (next - cur)) * 100) };
}

// ------------------------------------------------------------------
// key mastery — accuracy weighted by repetitions
// ------------------------------------------------------------------

export function keyMastery(s: StoreShape, key: string): { mastery: number; attempts: number } {
  const attempts = s.keyAttempts[key] ?? 0;
  if (attempts === 0) return { mastery: 0, attempts: 0 };
  const misses = s.mistyped[key] ?? 0;
  const acc = Math.max(0, (attempts - misses) / attempts);
  const reps = Math.min(1, attempts / 20); // 20 clean reps = full confidence
  return { mastery: Math.round(acc * reps * 100), attempts };
}

export function masteredKeys(s: StoreShape): string[] {
  const out: string[] = [];
  for (const k of Object.keys(s.keyAttempts)) {
    if (keyMastery(s, k).mastery >= 75) out.push(k);
  }
  return out;
}

export function fingerStrength(s: StoreShape): { label: string; strength: number; color: string }[] {
  return FINGER_IDS.map((id) => {
    const zone = FINGER_ZONES[id];
    const vals = zone.keys.filter((k) => k.length === 1).map((k) => keyMastery(s, k).mastery).filter((m) => m > 0);
    return {
      label: zone.label,
      strength: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
      color: zone.color,
    };
  });
}

// ------------------------------------------------------------------
// daily training plan — weak keys · accuracy · rhythm
// ------------------------------------------------------------------

export interface DailyPlanItem {
  id: string;
  label: string;
  target: string; // lesson/drill id that credits this item
  minutes: number;
}

export function dailyPlan(s: StoreShape): { date: string; items: DailyPlanItem[] } {
  const date = todayStr();
  const firstOpen = ["home-left", "home-right", "left-pinky", "left-ring", "left-middle", "left-index", "right-index", "both-words", "sentences"]
    .find((id) => !(s.lessons[id]?.mastered ?? false)) ?? "both-words";
  return {
    date,
    items: [
      { id: "weak", label: "Weak keys drill", target: "drill", minutes: 5 },
      { id: "acc", label: "Accuracy run", target: firstOpen, minutes: 3 },
      { id: "rhythm", label: "Rhythm run", target: "rhythm-slow", minutes: 2 },
    ],
  };
}

export function creditDaily(targetId: string) {
  const s = loadStore();
  const plan = dailyPlan(s);
  const item = plan.items.find((i) => i.target === targetId);
  if (!item) return;
  if (s.dailyLog.date !== plan.date) s.dailyLog = { date: plan.date, done: [], claimed: false };
  if (!s.dailyLog.done.includes(item.id)) s.dailyLog.done.push(item.id);
  if (s.dailyLog.done.length >= plan.items.length && !s.dailyLog.claimed) {
    s.dailyLog.claimed = true;
    s.profile.xp += 300;
  }
  saveStore();
}

// ------------------------------------------------------------------
// skill-based player tier (earned with accuracy + wpm + lessons,
// not just time played)
// ------------------------------------------------------------------

export const SKILL_TIERS = [
  "Keyboard Explorer",
  "Home Row Beginner",
  "Finger Learner",
  "Novice Typist",
  "Comfortable Typist",
  "Touch Typist",
  "Fast Typist",
  "Advanced Typist",
  "Expert Rhythm Typist",
  "Typing Master",
];

export function skillTierIndex(s: StoreShape): number {
  const mastered = Object.values(s.lessons).filter((l) => l.mastered).length;
  const done = Object.values(s.lessons).filter((l) => l.done).length;
  const wpm = s.profile.bestWpm;
  const recent = s.recentRuns.slice(-5);
  const accAvg = recent.length ? recent.reduce((a, b) => a + b.acc, 0) / recent.length : 0;
  let t = 0;
  if (done >= 1 || s.profile.gamesPlayed > 0) t = 1;
  if (mastered >= 2) t = 2;
  if (mastered >= 4 || wpm >= 25) t = 3;
  if ((wpm >= 35 && accAvg >= 92) || mastered >= 6) t = 4;
  if (wpm >= 45 && (mastered >= 8 || done >= 10)) t = 5;
  if (wpm >= 60) t = 6;
  if (wpm >= 75 && accAvg >= 95) t = 7;
  if (wpm >= 90) t = 8;
  if (wpm >= 110 && mastered >= 12) t = 9;
  return t;
}

export function skillTier(s: StoreShape): { index: number; name: string } {
  const i = skillTierIndex(s);
  return { index: i, name: SKILL_TIERS[i] };
}

// the speed where the player's accuracy-weighted performance peaks
export function comfortSpeed(s: StoreShape): { speed: number; wpm: number; acc: number } | null {
  let best: { speed: number; wpm: number; acc: number; score: number } | null = null;
  for (const [k, v] of Object.entries(s.speedStats)) {
    if (v.runs < 1) continue;
    const score = v.acc * 0.7 + Math.min(v.wpm, 120) * 0.3; // accuracy first for beginners
    if (!best || score > best.score) {
      best = { speed: parseFloat(k), wpm: Math.round(v.wpm), acc: v.acc, score };
    }
  }
  return best ? { speed: best.speed, wpm: best.wpm, acc: best.acc } : null;
}

export function keyAccuracyList(s: StoreShape): { key: string; acc: number; misses: number }[] {
  const out: { key: string; acc: number; misses: number }[] = [];
  for (const [k, attempts] of Object.entries(s.keyAttempts)) {
    if (attempts < 3) continue;
    const misses = s.mistyped[k] ?? 0;
    out.push({ key: k, acc: Math.max(0, ((attempts - misses) / attempts) * 100), misses });
  }
  return out.sort((a, b) => a.acc - b.acc);
}

// weak keys → movement-aware personalized drill:
// the key alone, then move-and-return patterns, then real words containing it
export function weakKeyDrill(s: StoreShape): string[] {
  const weak = keyAccuracyList(s).filter((k) => k.acc < 90).slice(0, 3).map((k) => k.key);
  if (weak.length === 0) return [];
  const allowed = [...new Set([...masteredKeys(s), ..."asdfjkl;".split("")])];
  const tokens: string[] = [];
  for (const k of weak) {
    const def = KEY_MAP[k];
    tokens.push(k, k);
    if (def && def.movement !== "home") {
      tokens.push(def.homeKey + k, k + def.homeKey, def.homeKey + k + def.homeKey);
    }
  }
  const words = wordsOnly(allowed, [3, 5], 24, 7).filter((w) => weak.some((k) => w.includes(k))).slice(0, 6);
  return [...tokens, ...words];
}

// ------------------------------------------------------------------
// lesson completion
// ------------------------------------------------------------------

export function processLesson(
  lessonId: string,
  xpBase: number,
  res: {
    acc: number;
    misses: number;
    passed: boolean;
    keysTyped: number;
    attempts: Record<string, number>;
    mistakes: Record<string, number>;
  },
): { xpGained: number; firstMaster: boolean } {
  const s = loadStore();
  const prev = s.lessons[lessonId];
  const firstMaster = res.passed && !(prev?.mastered ?? false);
  s.lessons[lessonId] = {
    done: true,
    mastered: (prev?.mastered ?? false) || res.passed,
    bestAcc: Math.max(prev?.bestAcc ?? 0, res.acc),
    plays: (prev?.plays ?? 0) + 1,
  };
  for (const [k, v] of Object.entries(res.attempts)) s.keyAttempts[k] = (s.keyAttempts[k] ?? 0) + v;
  for (const [k, v] of Object.entries(res.mistakes)) s.mistyped[k] = (s.mistyped[k] ?? 0) + v;
  s.profile.totalKeysTyped += res.keysTyped;
  s.profile.bestAccuracy = Math.max(s.profile.bestAccuracy, res.acc);

  let xp = Math.round(xpBase * (res.passed ? 1 : 0.5) + res.acc * 0.5);
  if (firstMaster) xp += 100;
  s.profile.xp += xp;
  if (res.acc >= 95 && s.lessons[lessonId].plays === 1) unlockAch(s, "acc-95");
  creditDaily(lessonId); // credits weak-key drill, accuracy run or rhythm run when matched
  saveStore();
  return { xpGained: xp, firstMaster };
}

function unlockAch(s: StoreShape, id: string) {
  if (!s.achievements[id]) s.achievements[id] = Date.now();
}

export function gainXp(n: number) {
  const s = loadStore();
  s.profile.xp += Math.max(0, Math.round(n));
  saveStore();
}

// challenge records — 'max' keeps the highest value, 'min' the lowest (e.g. fewest attempts)
export function recordChallengeBest(id: string, value: number, mode: "max" | "min"): boolean {
  const s = loadStore();
  const prev = s.challengeBests[id];
  const isNew =
    prev === undefined ||
    (mode === "max" ? value > prev : value < prev);
  if (isNew) {
    s.challengeBests[id] = Math.round(value);
    saveStore();
  }
  return isNew;
}

export function completeOnboarding() {
  const s = loadStore();
  s.onboarded = true;
  saveStore();
}

export function applySuggestion(dir: "up" | "down"): number {
  const s = loadStore();
  const fallback = Math.max(0.5, Math.min(2, s.settings.noteSpeed + (dir === "up" ? 0.1 : -0.1)));
  const speed = s.suggestion?.speed ?? fallback;
  s.settings.noteSpeed = speed;
  s.suggestion = null;
  saveStore();
  return speed;
}

export function dismissSuggestion() {
  const s = loadStore();
  s.suggestion = null;
  saveStore();
}
