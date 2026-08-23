import {
  ChartNote, Difficulty, SongMeta, hashString, mulberry32,
  wordsFor, COMMON_LETTERS, HOME_LETTERS, EXPERT_TOKENS, SENTENCES,
} from "./content";
import { isTypeableChar, baseKey } from "./keymap";

// ------------------------------------------------------------------
// Music pattern data. All tracks are original, generated procedurally
// by the Web Audio engine from these definitions (no audio files).
// ------------------------------------------------------------------

export interface MusicDef {
  bpm: number;
  root: number; // midi note of key root
  scale: number[]; // interval set
  progression: number[]; // scale degree per bar (0-based), loops
  bass: (number | null)[]; // 16 steps, semitone offsets from chord root
  arp: (number | null)[]; // 16 steps
  pad: boolean;
  lead?: (number | null)[];
  drums: "chill" | "four" | "drive" | "storm";
  bassWave: OscillatorType;
  arpWave: OscillatorType;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

const _ = null;

export const MUSIC: Record<string, MusicDef> = {
  "first-steps": {
    bpm: 80, root: 57, scale: MAJOR, progression: [0, 3, 4, 4],
    bass: [0, _, _, _, _, _, 7, _, _, _, 12, _, _, _, _, _],
    arp: [0, _, _, _, 7, _, _, _, 12, _, _, _, 7, _, _, _],
    pad: true,
    drums: "chill", bassWave: "sine", arpWave: "sine",
  },
  "morning-walk": {
    bpm: 96, root: 55, scale: MAJOR, progression: [0, 4, 5, 3],
    bass: [0, _, _, 0, _, _, 7, _, 0, _, _, 0, _, 7, _, _],
    arp: [0, _, 7, _, 12, _, 7, _, 0, _, 7, _, 12, _, 14, _],
    pad: true,
    drums: "chill", bassWave: "sine", arpWave: "triangle",
  },
  "starlit-path": {
    bpm: 92, root: 57, scale: MAJOR, progression: [0, 4, 5, 3],
    bass: [0, _, _, _, 7, _, _, _, 12, _, _, _, 7, _, 5, _],
    arp: [0, _, 7, _, 12, _, 7, _, 0, _, 7, _, 12, _, 16, _],
    pad: true,
    lead: [12, _, _, _, 16, _, 14, _, 12, _, 9, _, 7, _, _, _],
    drums: "chill", bassWave: "sine", arpWave: "triangle",
  },
  "circuit-bloom": {
    bpm: 104, root: 57, scale: MINOR, progression: [0, 5, 3, 4],
    bass: [0, _, _, 0, _, _, 7, _, 0, _, _, 0, _, 12, _, 7],
    arp: [0, 3, 7, 12, 7, 3, 0, 3, 7, 12, 15, 12, 7, 3, 0, 3],
    pad: true,
    drums: "chill", bassWave: "triangle", arpWave: "triangle",
  },
  "neon-drive": {
    bpm: 128, root: 54, scale: MINOR, progression: [0, 5, 2, 6],
    bass: [0, 0, _, 0, _, 0, 12, _, 0, 0, _, 0, _, 7, _, 10],
    arp: [0, 7, 12, 15, 12, 7, 0, 7, 12, 15, 19, 15, 12, 7, 3, 7],
    pad: true,
    lead: [_, _, 12, _, _, 15, _, 12, _, _, 10, _, 12, _, _, _],
    drums: "four", bassWave: "sawtooth", arpWave: "square",
  },
  "glass-tide": {
    bpm: 120, root: 59, scale: DORIAN, progression: [0, 3, 5, 4],
    bass: [0, _, 7, _, 0, _, 7, _, 12, _, 7, _, 0, _, 5, _],
    arp: [0, _, 3, _, 7, _, 12, _, 10, _, 7, _, 3, _, 7, _],
    pad: true,
    lead: [7, _, _, 10, _, _, 12, _, 10, _, 7, _, 5, _, 3, _],
    drums: "four", bassWave: "sawtooth", arpWave: "triangle",
  },
  velocity: {
    bpm: 150, root: 52, scale: MINOR, progression: [0, 5, 6, 4],
    bass: [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 15, 12],
    arp: [0, 3, 7, 10, 12, 10, 7, 3, 0, 3, 7, 10, 12, 15, 19, 15],
    pad: false,
    lead: [12, _, 15, _, 19, _, 15, 12, 10, _, 12, _, 10, 7, _, _],
    drums: "drive", bassWave: "sawtooth", arpWave: "sawtooth",
  },
  "quantum-storm": {
    bpm: 174, root: 50, scale: MINOR, progression: [0, 6, 5, 3, 0, 6, 4, 5],
    bass: [0, 0, _, 0, 12, _, 0, _, 0, 0, _, 0, 12, _, 15, _],
    arp: [0, 12, 7, 12, 0, 12, 7, 15, 0, 12, 7, 12, 19, 15, 12, 7],
    pad: false,
    lead: [_, 12, _, 15, _, 19, _, 15, _, 12, _, 10, _, 12, _, _],
    drums: "storm", bassWave: "square", arpWave: "sawtooth",
  },
  custom: {
    bpm: 112, root: 57, scale: MAJOR, progression: [0, 4, 5, 3],
    bass: [0, _, _, _, 7, _, _, _, 12, _, _, _, 7, _, 5, _],
    arp: [0, _, 7, _, 12, _, 7, _, 0, _, 7, _, 12, _, 16, _],
    pad: true,
    drums: "chill", bassWave: "triangle", arpWave: "triangle",
  },
};

export const SONGS: SongMeta[] = [
  { id: "first-steps", title: "First Steps", artist: "Keybeat Audio", bpm: 80, difficulty: "beginner", bars: 24, hue: 160, hue2: 200, tagline: "One key at a time. No rush at all.", recSpeed: 0.6, complexity: 1 },
  { id: "morning-walk", title: "Morning Walk", artist: "Keybeat Audio", bpm: 96, difficulty: "novice", bars: 26, hue: 140, hue2: 90, tagline: "A gentle stroll across the home row.", recSpeed: 0.7, complexity: 2 },
  { id: "starlit-path", title: "Starlit Path", artist: "Keybeat Audio", bpm: 92, difficulty: "easy", bars: 28, hue: 150, hue2: 200, tagline: "A gentle warm-up under quiet stars.", recSpeed: 0.8, complexity: 2 },
  { id: "circuit-bloom", title: "Circuit Bloom", artist: "Keybeat Audio", bpm: 104, difficulty: "easy", bars: 30, hue: 190, hue2: 130, tagline: "Soft pulses through a garden of wires.", recSpeed: 0.8, complexity: 2 },
  { id: "neon-drive", title: "Neon Drive", artist: "Keybeat Audio", bpm: 128, difficulty: "normal", bars: 32, hue: 187, hue2: 320, tagline: "Cruise the glowing grid at midnight.", recSpeed: 1.0, complexity: 3 },
  { id: "glass-tide", title: "Glass Tide", artist: "Keybeat Audio", bpm: 120, difficulty: "normal", bars: 32, hue: 210, hue2: 170, tagline: "Waves of light on a mirrored sea.", recSpeed: 1.0, complexity: 3 },
  { id: "velocity", title: "Velocity", artist: "Keybeat Audio", bpm: 150, difficulty: "hard", bars: 34, hue: 40, hue2: 10, tagline: "No brakes on the photon highway.", recSpeed: 1.2, complexity: 4 },
  { id: "quantum-storm", title: "Quantum Storm", artist: "Keybeat Audio", bpm: 174, difficulty: "expert", bars: 36, hue: 320, hue2: 260, tagline: "Type inside the eye of the storm.", recSpeed: 1.4, complexity: 5 },
];

export function getSong(id: string): SongMeta {
  return SONGS.find((s) => s.id === id) ?? SONGS[0];
}

// ------------------------------------------------------------------
// Chart generation — notes are quantized to the song's beat grid so
// typing events land exactly on the music.
// ------------------------------------------------------------------

interface DiffParams {
  unitDiv: number; // notes per beat denominator (1 = beats, 2 = 8ths, 4 = 16ths)
  density: number;
  wordProb: number;
  burstProb: number;
  restProb: number;
  minGap: number;
  grace: number; // word deadline factor
  capitalProb: number;
  numberProb: number;
  sentenceProb: number;
  letterPool: string[];
  wordLen: [number, number];
}

const DIFF_PARAMS: Record<Difficulty, DiffParams> = {
  // one note at a time, huge gaps, home-row only — speed is capped by the lesson/song
  beginner: { unitDiv: 1, density: 0.85, wordProb: 0.1, burstProb: 0, restProb: 0.22, minGap: 0.58, grace: 2.2, capitalProb: 0, numberProb: 0, sentenceProb: 0, letterPool: "asdfjkl;".split(""), wordLen: [3, 4] },
  novice: { unitDiv: 1, density: 0.82, wordProb: 0.18, burstProb: 0, restProb: 0.16, minGap: 0.48, grace: 1.8, capitalProb: 0, numberProb: 0, sentenceProb: 0, letterPool: "qwertyuiopasdfghjkl;".split(""), wordLen: [3, 5] },
  easy: { unitDiv: 1, density: 0.82, wordProb: 0.16, burstProb: 0, restProb: 0.16, minGap: 0.42, grace: 1.6, capitalProb: 0, numberProb: 0, sentenceProb: 0, letterPool: [...HOME_LETTERS, ...COMMON_LETTERS.slice(0, 12)], wordLen: [3, 4] },
  normal: { unitDiv: 2, density: 0.6, wordProb: 0.24, burstProb: 0.06, restProb: 0.1, minGap: 0.3, grace: 1.25, capitalProb: 0, numberProb: 0.03, sentenceProb: 0.05, letterPool: COMMON_LETTERS, wordLen: [4, 6] },
  hard: { unitDiv: 2, density: 0.72, wordProb: 0.3, burstProb: 0.12, restProb: 0.06, minGap: 0.24, grace: 1.05, capitalProb: 0.06, numberProb: 0.08, sentenceProb: 0.1, letterPool: COMMON_LETTERS, wordLen: [5, 8] },
  expert: { unitDiv: 4, density: 0.62, wordProb: 0.3, burstProb: 0.16, restProb: 0.05, minGap: 0.17, grace: 0.9, capitalProb: 0.16, numberProb: 0.18, sentenceProb: 0.08, letterPool: "abcdefghijklmnopqrstuvwxyz0123456789;,.!?".split(""), wordLen: [4, 9] },
};

export interface Chart {
  notes: ChartNote[];
  duration: number; // seconds
  beat: number; // seconds per beat
  introTime: number; // time of first possible note
}

export function generateChart(
  songId: string,
  difficulty: Difficulty,
  barsOverride?: number,
  restrict?: string[],
): Chart {
  const meta = getSong(songId);
  const music = MUSIC[songId] ?? MUSIC["neon-drive"];
  const p = { ...DIFF_PARAMS[difficulty] };
  if (restrict && restrict.length) p.letterPool = restrict;
  const rng = mulberry32(hashString(songId + ":" + difficulty));

  // ONE authoritative content gate for this chart: every character of every
  // token (letter, word, sentence chunk, symbol, capital) must map through
  // baseKey/SHIFTED onto an allowed physical key. Words that fail are
  // rejected and regenerated — invalid content never reaches the engine.
  const allowedSet =
    restrict && restrict.length
      ? new Set(restrict.map((k) => baseKey(k).toLowerCase()))
      : null;
  const ok = (token: string) =>
    token.length > 0 &&
    [...token].every((ch) => isTypeableChar(ch) && (!allowedSet || allowedSet.has(baseKey(ch))));
  const beat = 60 / music.bpm;
  const unit = beat / p.unitDiv;
  const bars = barsOverride ?? meta.bars;
  const introTime = 4 * beat; // one bar of music before notes
  const end = bars * 4 * beat - 2 * beat;

  const notes: ChartNote[] = [];
  let id = 0;
  let t = introTime;
  let lastWordEnd = 0;
  let sentenceQueue: string[] = [];
  let sentenceIdx = 0;

  const pushLetter = (time: number) => {
    let ch: string;
    const r = rng();
    if (r < p.numberProb) ch = String(Math.floor(rng() * 10));
    else if (r < p.numberProb + p.capitalProb) {
      const src = p.letterPool[Math.floor(rng() * p.letterPool.length)] ?? "a";
      ch = src.toUpperCase();
    } else ch = p.letterPool[Math.floor(rng() * p.letterPool.length)] ?? "a";
    if (!ok(ch)) return; // belt & braces — the pool is pre-restricted anyway
    notes.push({
      id: id++, kind: "letter", text: ch, key: ch,
      time, deadline: time + 0.35,
    });
  };

  const pushWord = (time: number, word: string) => {
    const grace = (0.3 + 0.13 * word.length) * p.grace;
    notes.push({ id: id++, kind: "word", text: word, key: word, time, deadline: time + grace });
    lastWordEnd = time + grace;
  };

  while (t < end) {
    // ensure spacing after words
    if (t < lastWordEnd + 0.14) t = lastWordEnd + 0.14;
    if (t >= end) break;

    if (rng() < p.restProb && notes.length > 0 && sentenceQueue.length === 0) {
      t += unit * 2;
      continue;
    }

    // sentence chunks (word sequences)
    if (sentenceQueue.length > 0) {
      const w = sentenceQueue.shift()!;
      pushWord(t, w);
      t += Math.max(p.minGap * 1.6, 0.16 * w.length + 0.18);
      if (sentenceQueue.length === 0) t += unit * 2;
      continue;
    }

    const r = rng();
    if (r < p.sentenceProb) {
      const s = SENTENCES[Math.floor(rng() * SENTENCES.length)];
      sentenceQueue = s.split(" ").slice(0, 4 + Math.floor(rng() * 3)).filter(ok);
      sentenceIdx++;
      if (sentenceQueue.length === 0) t += unit; // every chunk rejected — skip the beat
      continue;
    }

    if (r < p.sentenceProb + p.wordProb) {
      let word: string;
      if (rng() < p.numberProb && difficulty === "expert")
        word = EXPERT_TOKENS[Math.floor(rng() * EXPERT_TOKENS.length)];
      else
        word = wordsFor(difficulty, rng, p.wordLen[0] + Math.floor(rng() * (p.wordLen[1] - p.wordLen[0] + 1)));
      if (!ok(word)) {
        // reject and regenerate: spend the beat as a rest, next iteration proposes again
        t += unit;
        continue;
      }
      pushWord(t, word);
      const perChar = Math.max(p.minGap * 0.85, unit * 0.8);
      t += Math.max(word.length * perChar, p.minGap * 2);
      continue;
    }

    if (r < p.sentenceProb + p.wordProb + p.burstProb) {
      const n = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < n && t < end; i++) {
        pushLetter(t);
        t += Math.max(unit, p.minGap);
      }
      t += unit;
      continue;
    }

    // single letters on the grid
    if (rng() < p.density) pushLetter(t);
    t += unit * (rng() < 0.3 ? 2 : 1);
  }

  // authoritative final gate — no invalid token leaves this function
  return { notes: notes.filter((n) => ok(n.text)), duration: bars * 4 * beat + 1.5, beat, introTime };
}

// Endless / time-attack stream generator
export interface StreamGen {
  next(fromTime: number, untilTime: number): ChartNote[];
  beat: number;
}

export function createStream(bpm: number, difficulty: Difficulty, seed: number): StreamGen {
  const p = { ...DIFF_PARAMS[difficulty] };
  const rng = mulberry32(seed);
  const beat = 60 / bpm;
  let unit = beat / p.unitDiv;
  let cursor = 4 * beat;
  let id = 0;
  let lastWordEnd = 0;
  let elapsed = 0;
  // streams run on the full keyboard — still, nothing untypeable may enter
  const ok = (token: string) => token.length > 0 && [...token].every(isTypeableChar);

  return {
    beat,
    next(_fromTime: number, untilTime: number): ChartNote[] {
      const out: ChartNote[] = [];
      // gradual ramp: density up, gap down
      while (cursor < untilTime) {
        elapsed += unit;
        const ramp = Math.min(1, elapsed / 120);
        const minGap = p.minGap * (1 - 0.35 * ramp);
        unit = (beat / p.unitDiv) * (1 - 0.25 * ramp);
        if (cursor < lastWordEnd + 0.14) cursor = lastWordEnd + 0.14;

        const r = rng();
        if (r < p.wordProb * (0.6 + ramp)) {
          const word = wordsFor(difficulty, rng, p.wordLen[0] + Math.floor(rng() * (p.wordLen[1] - p.wordLen[0] + 1)));
          if (!ok(word)) {
            cursor += unit; // reject, spend the beat, regenerate next pass
            continue;
          }
          const grace = (0.3 + 0.13 * word.length) * p.grace;
          out.push({ id: id++, kind: "word", text: word, key: word, time: cursor, deadline: cursor + grace });
          lastWordEnd = cursor + grace;
          cursor += Math.max(word.length * Math.max(minGap * 0.85, unit * 0.8), minGap * 2);
        } else if (r < p.wordProb + 0.08) {
          cursor += unit * 2;
        } else {
          let ch = p.letterPool[Math.floor(rng() * p.letterPool.length)];
          if (difficulty === "expert" && rng() < 0.15) ch = String(Math.floor(rng() * 10));
          out.push({ id: id++, kind: "letter", text: ch, key: ch, time: cursor, deadline: cursor + 0.35 });
          cursor += unit * (rng() < 0.35 ? 2 : 1);
        }
      }
      return out;
    },
  };
}

// Custom text → chart. Input is untrusted: every character is filtered
// against the keyboard map so only physically typeable keys reach the chart.
export function chartFromText(text: string, bpm = 112): Chart {
  const beat = 60 / bpm;
  const tokens = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 160);
  const notes: ChartNote[] = [];
  let t = 4 * beat;
  let id = 0;
  for (const raw of tokens) {
    const cleaned = [...raw].filter(isTypeableChar).join("");
    if (!cleaned) continue;
    const token = cleaned.length > 12 ? cleaned.slice(0, 12) : cleaned;
    if (token.length === 1) {
      notes.push({ id: id++, kind: "letter", text: token, key: token, time: t, deadline: t + 0.35 });
      t += beat * 0.5;
    } else {
      const grace = 0.3 + 0.13 * token.length;
      notes.push({ id: id++, kind: "word", text: token, key: token, time: t, deadline: t + grace });
      t += Math.max(0.16 * token.length + 0.22, beat * 0.5);
    }
  }
  return { notes, duration: t + 3, beat, introTime: 4 * beat };
}
