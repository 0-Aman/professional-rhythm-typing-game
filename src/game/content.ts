// ---------- typing content pools ----------

export const HOME_LETTERS = "asdfjkl;".split("");
export const COMMON_LETTERS = "etaoinshrdlucmfwygpb".split("");

export const WORDS_EASY = [
  "and", "the", "sun", "key", "run", "sky", "beat", "play", "fast", "glow",
  "note", "time", "song", "wave", "type", "code", "star", "moon", "fire", "wind",
  "echo", "drum", "bass", "tone", "line", "pace", "rush", "neon", "loop", "core",
];

export const WORDS_NORMAL = [
  "rhythm", "music", "speed", "night", "pulse", "light", "storm", "drive",
  "laser", "metro", "pixel", "synth", "bass", "chord", "tempo", "vigor",
  "candy", "orbit", "magic", "power", "rapid", "sonic", "turbo", "ultra",
  "vivid", "xenon", "youth", "zebra", "flash", "groove", "melody", "signal",
  "vector", "energy", "motion", "spirit", "wonder", "cipher", "bridge", "rocket",
];

export const WORDS_HARD = [
  "keyboard", "symphony", "velocity", "momentum", "cadence", "electron",
  "midnight", "paradigm", "quantum", "spectrum", "frequency", "harmonic",
  "protocol", "terminal", "voltage", "wildfire", "backbone", "crescendo",
  "dynasty", "equinox", "feedback", "gridlock", "hypnosis", "junction",
  "kinetic", "labyrinth", "magnetic", "nocturne", "overdrive", "phantom",
  "resonance", "sequencer", "turbine", "universe", "waveform", "xylophone",
];

export const WORDS_EXPERT = [
  "rhythm", "sphinx", "quartz", "judgment", "glyphs", "vortex", "zephyr",
  "awkward", "bayou", "cryptic", "dwarves", "fuchsia", "gazebo", "haiku",
  "ivory", "jinxed", "kazoo", "lymph", "mystify", "onyx", "pajama",
  "quiver", "razzmatazz", "spritz", "twelfth", "unzip", "voodoo", "wheezy",
  "yachts", "zigzag", "blitz", "fjord", "kvetch", "wraith",
];

export const SENTENCES = [
  "the quick brown fox jumps over the lazy dog",
  "pack my box with five dozen liquor jugs",
  "how vexingly quick daft zebras jump",
  "bright vixens jump dozy fowl quacking",
  "sphinx of black quartz judge my vow",
  "typing in rhythm feels like music",
  "every key is a note in the song",
  "speed and accuracy grow together",
  "the neon grid pulses with the beat",
  "practice until your fingers dance",
];

export const EXPERT_TOKENS = [
  "2026", "404", "lvl99", "gg!", "c#", "f++", "3.14", "100%", "#1", "ok?",
  "sync;", "beat:", "8-bit", "x2", "p1", "go!", "7th", "b4", "Rhythm",
  "Neon", "Turbo", "Ultra", "Vivid", "Omega",
];

export function wordsFor(difficulty: Difficulty, rng: () => number, len?: number): string {
  const pool =
    difficulty === "easy" ? WORDS_EASY :
    difficulty === "normal" ? [...WORDS_EASY, ...WORDS_NORMAL] :
    difficulty === "hard" ? [...WORDS_NORMAL, ...WORDS_HARD] :
    [...WORDS_HARD, ...WORDS_EXPERT];
  if (len) {
    const filtered = pool.filter((w) => Math.abs(w.length - len) <= 1);
    if (filtered.length) return filtered[Math.floor(rng() * filtered.length)];
  }
  return pool[Math.floor(rng() * pool.length)];
}

// ---------- seeded RNG ----------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- types ----------

export type Difficulty = "beginner" | "novice" | "easy" | "normal" | "hard" | "expert";

export type NoteKind = "letter" | "word";

export interface ChartNote {
  id: number;
  kind: NoteKind;
  text: string; // display text (uppercase hint for shift on capitals)
  key: string; // for letters: the character to press (case-sensitive)
  time: number; // hit time in song-seconds
  deadline: number; // latest completion time (words) or miss time (letters)
  color?: string; // finger color override (lessons)
}

export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  difficulty: Difficulty;
  bars: number;
  hue: number; // cover accent hue
  hue2: number;
  tagline: string;
  recSpeed: number; // recommended gameplay note speed (independent of BPM)
  complexity: number; // typing complexity 1..5
}

// ---------- progression ----------

export const LEVEL_TITLES: [number, string][] = [
  [1, "Beginner"],
  [5, "Keyboard Rookie"],
  [10, "Fast Fingers"],
  [15, "Beat Chaser"],
  [20, "Rhythm Typist"],
  [30, "Combo Artist"],
  [40, "Key Virtuoso"],
  [50, "Typing Master"],
  [75, "Grandmaster"],
];

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 90)) + 1);
}
export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 90;
}
export function levelTitle(level: number): string {
  let title = LEVEL_TITLES[0][1];
  for (const [lv, t] of LEVEL_TITLES) if (level >= lv) title = t;
  return title;
}

// ---------- achievements ----------

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string; // svg path id
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-song", name: "First Song", desc: "Complete your first track", icon: "note" },
  { id: "wpm-50", name: "Warming Up", desc: "Reach 50 WPM in a session", icon: "bolt" },
  { id: "wpm-75", name: "Fast Fingers", desc: "Reach 75 WPM in a session", icon: "bolt" },
  { id: "wpm-100", name: "Centurion", desc: "Reach 100 WPM in a session", icon: "bolt" },
  { id: "wpm-120", name: "Lightspeed", desc: "Reach 120 WPM in a session", icon: "bolt" },
  { id: "acc-95", name: "Sharpshooter", desc: "Finish with 95% accuracy", icon: "target" },
  { id: "acc-99", name: "Deadeye", desc: "Finish with 99% accuracy", icon: "target" },
  { id: "combo-50", name: "On Fire", desc: "Hit a 50 combo", icon: "flame" },
  { id: "combo-100", name: "Unstoppable", desc: "Hit a 100 combo", icon: "flame" },
  { id: "perfect-song", name: "Flawless", desc: "Finish a song with zero misses", icon: "gem" },
  { id: "songs-10", name: "Jukebox", desc: "Complete 10 songs", icon: "note" },
  { id: "hour-1", name: "Devoted", desc: "Practice for 1 hour total", icon: "clock" },
  { id: "no-miss-hard", name: "Iron Will", desc: "Clear a Hard+ song with no misses", icon: "gem" },
  { id: "daily-1", name: "Ritual", desc: "Complete a daily challenge", icon: "star" },
  { id: "endless-5k", name: "Marathon", desc: "Score 5,000 in Endless mode", icon: "star" },
];

export const COMBO_MILESTONES: Record<number, string> = {
  5: "NICE!",
  10: "10 COMBO",
  20: "ON FIRE!",
  30: "FLOW STATE",
  50: "UNSTOPPABLE!",
  100: "MASTER!",
};

export function comboMultiplier(combo: number): number {
  if (combo >= 100) return 5;
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 1;
}

export const DIFF_LABEL: Record<Difficulty, string> = {
  beginner: "BEGINNER",
  novice: "NOVICE",
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  expert: "EXPERT",
};

export const DIFF_COLOR: Record<Difficulty, string> = {
  beginner: "#4de8b0",
  novice: "#d0ff45",
  easy: "#a8ff3e",
  normal: "#00e5ff",
  hard: "#ffc94d",
  expert: "#ff3d7e",
};

export const DIFF_MULT: Record<Difficulty, number> = {
  beginner: 0.8,
  novice: 0.9,
  easy: 1,
  normal: 1.25,
  hard: 1.5,
  expert: 2,
};

// recommended starting note speed per difficulty — a starting point, never a hard limit
export const DIFF_RECOMMENDED_SPEED: Record<Difficulty, number> = {
  beginner: 0.6,
  novice: 0.7,
  easy: 0.8,
  normal: 1.0,
  hard: 1.2,
  expert: 1.4,
};
