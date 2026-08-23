import { Chart } from "./songs";
import { ChartNote, Difficulty } from "./content";
import { movementTokens, FINGER_ZONES, FingerId, KEY_MAP, baseKey, isTypeableChar } from "./keymap";
import { fingerColor } from "./fingers";

// ------------------------------------------------------------------
// Curriculum model
// ------------------------------------------------------------------

export type SegmentType = "engine" | "find" | "finger";

export interface StageDef {
  type: SegmentType;
  tokens?: string[];
  highlight?: boolean; // false → memory segment (no key highlighting)
  movement?: { home: string; reach: string };
  count?: number; // quiz round count for find/finger
  label?: string;
}

export type SectionId = "foundation" | "muscle" | "rhythm";

export interface LessonDef {
  id: string;
  num: number;
  section: SectionId;
  title: string;
  desc: string;
  allowedKeys: string[]; // everything taught so far — content may ONLY use these
  newKeys: string[]; // keys this lesson introduces
  focusFinger?: FingerId;
  stages: StageDef[];
  maxSpeed: number;
  kind: "learning" | "rhythm";
  music?: string;
  difficulty?: Difficulty;
  goalAcc: number;
  goalMaxMiss: number;
  xp: number;
  checkpoint?: string;
  requires: string[];
}

// ------------------------------------------------------------------
// word bank + validators — an exercise is NEVER shown unless every one
// of its keys has been taught. Generation proposes, validation disposes.
// ------------------------------------------------------------------

const WORD_BANK = [
  "sad", "ask", "lad", "dad", "add", "all", "fall", "salad", "flask", "alas",
  "ace", "cad", "deed", "face", "fade", "cage", "glad", "flag", "glass", "grass",
  "was", "red", "cat", "fat", "sat", "star", "great", "extra", "raft", "vast",
  "grab", "craft", "trace", "dwarf", "sweat", "bag", "tag", "rag", "dart", "cart",
  "brave", "grave", "crab", "stab", "beard", "bread", "zebra", "cabbage",
  "ill", "inn", "oil", "pin", "lip", "ink", "milk", "kiln", "loom", "moon",
  "noon", "union", "pool", "loop", "polo", "cool", "hum", "mum", "nun", "hymn",
  "jump", "punk", "hulk", "minimum", "pop", "pup", "poop", "stop", "shop", "post",
  "spin", "hint", "thin", "ship", "whip", "chip", "grin", "king", "like", "line",
  "mine", "nine", "fine", "wine", "dine", "shine", "phone", "lemon", "melon",
  "we", "saw", "sew", "was", "swe", "use", "ear", "oar", "owe", "one", "won",
  "write", "power", "quiet", "route", "type", "rope", "wire", "poetry", "tower",
  "your", "you", "row", "owe", "tier", "riot", "pour", "wore", "tire", "pier",
  "mix", "van", "numb", "crab", "maze", "vine", "comma", "cabin", "brave", "ban",
  "the", "and", "that", "have", "with", "this", "will", "from", "they", "your",
  "there", "when", "what", "them", "then", "than", "into", "time", "just", "know",
  "people", "water", "first", "right", "night", "light", "music", "quick", "world",
  "dog", "fox", "lazy", "jumps", "over", "brown", "pack", "box", "dozen", "jugs",
];

// THE authoritative exercise validator — every generated token (keys,
// movements, patterns, words, phrases) passes through here. A token is
// legal only if every character is physically typeable AND its base key
// has been taught. Capitals/shifted symbols are legal when their base
// key is allowed.
export function validateTokens(tokens: string[], allowed: string[]): string[] {
  const set = new Set(allowed.map((k) => k.toLowerCase()));
  return tokens.filter(
    (t) =>
      t.length > 0 &&
      [...t].every((ch) => isTypeableChar(ch) && set.has(baseKey(ch))),
  );
}

// Authoritative per-lesson constraints, derived from the key map.
export interface ExerciseConstraints {
  keys: string[];
  fingers: string[];
  hands: string[];
  rows: string[];
}

export function exerciseConstraints(allowedKeys: string[]): ExerciseConstraints {
  const keys: string[] = [];
  const fingers = new Set<string>();
  const hands = new Set<string>();
  const rows = new Set<string>();
  for (const k of allowedKeys) {
    const def = KEY_MAP[k.toLowerCase()];
    if (!def) continue;
    keys.push(k);
    fingers.add(def.finger);
    hands.add(def.hand);
    rows.add(def.row);
  }
  return { keys, fingers: [...fingers], hands: [...hands], rows: [...rows] };
}

export function wordsOnly(allowed: string[], lens: [number, number], max: number, seedOffset = 0): string[] {
  const set = new Set(allowed);
  const pool = WORD_BANK.filter(
    (w) => w.length >= lens[0] && w.length <= lens[1] && [...w].every((ch) => set.has(ch)),
  );
  const out: string[] = [];
  for (let i = 0; i < pool.length && out.length < max; i++) {
    const w = pool[(i + seedOffset) % pool.length];
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

const T = (...tokens: string[]) => tokens;
const mv = movementTokens;

// ------------------------------------------------------------------
// The curriculum — Foundation → Muscle Memory → Rhythm Training.
// allowedKeys accumulates: nothing later ever uses an untaught key.
// ------------------------------------------------------------------

const seen = new Set<string>();
const teach = (...keys: string[]) => {
  keys.forEach((x) => seen.add(x));
  return [...seen];
};

let n = 0;
const L = (
  id: string, section: SectionId, title: string, desc: string,
  newKeys: string[], focusFinger: FingerId | undefined,
  stages: StageDef[], opts: Partial<LessonDef> & { requires: string[] },
): LessonDef => {
  const allowedKeys = teach(...newKeys);
  // content contract: NO exercise may ever contain an untaught key.
  // Generation proposes, validation disposes — always.
  const safeStages = stages.map((s) =>
    s.type === "engine" && s.tokens ? { ...s, tokens: validateTokens(s.tokens, allowedKeys) } : s,
  );
  return {
    id, num: ++n, section, title, desc,
    allowedKeys,
    newKeys, focusFinger, stages: safeStages,
    maxSpeed: 0.65, kind: "learning",
    goalAcc: 90, goalMaxMiss: 6, xp: 80,
    ...opts,
  };
};

export const LESSONS: LessonDef[] = [
  // ============ FOUNDATION ============
  L("orientation", "foundation", "Find Your Guides",
    "F and J have tiny bumps — your fingers find home by touch, not by sight.",
    ["f", "j"], undefined,
    [
      { type: "find", tokens: ["f", "j"], count: 8, label: "FIND F AND J" },
      { type: "finger", tokens: ["f", "j"], count: 4, label: "WHICH FINGER?" },
      { type: "engine", tokens: T("f", "f", "f", "j", "j", "j", "f", "j", "f", "j", "f", "f", "j", "j") },
    ],
    { maxSpeed: 0.6, goalAcc: 80, goalMaxMiss: 6, xp: 60, requires: [] }),

  L("home-left", "foundation", "Home Row · Left",
    "Pinky on A, ring on S, middle on D, index on F. This is home base.",
    ["a", "s", "d"], undefined,
    [
      { type: "engine", tokens: T("a", "a", "s", "s", "d", "d", "f", "f", "a", "s", "d", "f") },
      { type: "engine", tokens: T("a", "s", "d", "f", "f", "d", "s", "a", "a", "s", "d", "f", "f", "d", "s", "a") },
      { type: "engine", tokens: T("as", "sd", "df", "fa", "asd", "dsa", "sad", "das") },
      { type: "engine", tokens: T("asdf", "fdsa", "asdf", "fdsa", "sad", "ask", "lad", "dad", "add", "all") },
    ],
    { maxSpeed: 0.6, goalAcc: 88, requires: ["orientation"] }),

  L("home-right", "foundation", "Home Row · Right",
    "Index on J, middle on K, ring on L, pinky on ;. Mirror the left hand.",
    ["k", "l", ";"], undefined,
    [
      { type: "engine", tokens: T("j", "j", "k", "k", "l", "l", ";", ";", "j", "k", "l", ";") },
      { type: "engine", tokens: T("j", "k", "l", ";", ";", "l", "k", "j", "j", "k", "l", ";", ";", "l", "k", "j") },
      { type: "engine", tokens: T("jk", "kl", "l;", ";l", "jkl", ";lk", "jkl;", ";lkj") },
      { type: "engine", tokens: T("sad", "ask", "lad", "dad", "all", "fall", "salad", "flask", "alas", "sad", "dad", "fall") },
    ],
    { maxSpeed: 0.6, goalAcc: 88, requires: ["home-left"], checkpoint: "HOME ROW" }),

  L("left-pinky", "foundation", "Left Pinky Territory",
    "Your pinky owns the A column. Move out to Q and Z — then return home.",
    ["q", "z", "1"], "left-pinky",
    [
      { type: "find", tokens: ["q", "z"], count: 8, label: "FIND Q AND Z" },
      { type: "finger", tokens: ["q", "z"], count: 4 },
      { type: "engine", tokens: mv("a", "q"), movement: { home: "a", reach: "q" }, label: "A → Q → A" },
      { type: "engine", tokens: mv("a", "z"), movement: { home: "a", reach: "z" }, label: "A → Z → A" },
      { type: "engine", tokens: T("1", "q", "a", "z", "qa", "az", "aq", "za", "1q", "q1"), label: "THE FULL COLUMN" },
      { type: "engine", tokens: T("q", "z", "a", "q", "z", "a", "qa", "az", "za", "aq"), highlight: false, label: "MEMORY — NO HIGHLIGHTS" },
    ],
    { maxSpeed: 0.6, requires: ["home-right"] }),

  L("left-ring", "foundation", "Left Ring Territory",
    "Ring finger rolls from S up to W and down to X. Home between every press.",
    ["w", "x", "2"], "left-ring",
    [
      { type: "find", tokens: ["w", "x"], count: 8, label: "FIND W AND X" },
      { type: "finger", tokens: ["w", "x"], count: 4 },
      { type: "engine", tokens: mv("s", "w"), movement: { home: "s", reach: "w" }, label: "S → W → S" },
      { type: "engine", tokens: mv("s", "x"), movement: { home: "s", reach: "x" }, label: "S → X → S" },
      { type: "engine", tokens: T("2", "w", "s", "x", "sw", "ws", "sx", "xs", "sws", "wsx", "2w", "w2"), label: "THE FULL COLUMN" },
      { type: "engine", tokens: T("w", "x", "s", "w", "x", "s", "sw", "xs", "ws", "sx"), highlight: false, label: "MEMORY — NO HIGHLIGHTS" },
    ],
    { maxSpeed: 0.6, requires: ["left-pinky"] }),

  L("left-middle", "foundation", "Left Middle Territory",
    "Middle finger reaches E above and C below D. The strongest finger — use it.",
    ["e", "c", "3"], "left-middle",
    [
      { type: "find", tokens: ["e", "c"], count: 8, label: "FIND E AND C" },
      { type: "finger", tokens: ["e", "c"], count: 4 },
      { type: "engine", tokens: mv("d", "e"), movement: { home: "d", reach: "e" }, label: "D → E → D" },
      { type: "engine", tokens: mv("d", "c"), movement: { home: "d", reach: "c" }, label: "D → C → D" },
      { type: "engine", tokens: T("3", "e", "d", "c", "ed", "de", "dc", "cd", "edc", "cde", "3e", "e3"), label: "THE FULL COLUMN" },
      { type: "engine", tokens: wordsOnly(teach("e", "c", "3"), [3, 4], 8, 2), label: "WORDS FROM YOUR KEYS" },
    ],
    { maxSpeed: 0.65, requires: ["left-ring"] }),

  L("left-index", "foundation", "Left Index Territory",
    "The index covers two columns: R T above, G to the side, V B below. One reach at a time.",
    ["r", "t", "g", "v", "b", "4", "5"], "left-index",
    [
      { type: "find", tokens: ["r", "t", "g", "v", "b"], count: 10, label: "FIND THE REACHES" },
      { type: "engine", tokens: mv("f", "r"), movement: { home: "f", reach: "r" }, label: "F → R → F" },
      { type: "engine", tokens: mv("f", "t"), movement: { home: "f", reach: "t" }, label: "F → T → F" },
      { type: "engine", tokens: mv("f", "g"), movement: { home: "f", reach: "g" }, label: "F → G → F" },
      { type: "engine", tokens: mv("f", "v"), movement: { home: "f", reach: "v" }, label: "F → V → F" },
      { type: "engine", tokens: mv("f", "b"), movement: { home: "f", reach: "b" }, label: "F → B → F" },
      { type: "engine", tokens: T("rt", "tr", "fg", "gf", "vb", "bv", "tv", "rg", "ft", "gb", "4r", "5t", "45", "54"), label: "COMBINE THE REACHES" },
      { type: "engine", tokens: wordsOnly(teach("r", "t", "g", "v", "b", "4", "5"), [3, 5], 10, 5), label: "LEFT-HAND WORDS" },
      { type: "engine", tokens: T("r", "t", "g", "v", "b", "rt", "vb", "tg"), highlight: false, label: "MEMORY — NO HIGHLIGHTS" },
    ],
    { maxSpeed: 0.7, goalMaxMiss: 8, xp: 120, requires: ["left-middle"], checkpoint: "LEFT HAND" }),

  L("right-index", "foundation", "Right Index Territory",
    "Mirror image: Y U above, H beside, N M below. The busiest finger on the board.",
    ["y", "u", "h", "n", "m", "6", "7"], "right-index",
    [
      { type: "find", tokens: ["y", "u", "h", "n", "m"], count: 10, label: "FIND THE REACHES" },
      { type: "engine", tokens: mv("j", "y"), movement: { home: "j", reach: "y" }, label: "J → Y → J" },
      { type: "engine", tokens: mv("j", "u"), movement: { home: "j", reach: "u" }, label: "J → U → J" },
      { type: "engine", tokens: mv("j", "h"), movement: { home: "j", reach: "h" }, label: "J → H → J" },
      { type: "engine", tokens: mv("j", "n"), movement: { home: "j", reach: "n" }, label: "J → N → J" },
      { type: "engine", tokens: mv("j", "m"), movement: { home: "j", reach: "m" }, label: "J → M → J" },
      { type: "engine", tokens: T("yu", "uy", "jh", "hj", "nm", "mn", "yn", "um", "6y", "7u", "67", "76"), label: "COMBINE THE REACHES" },
      { type: "engine", tokens: wordsOnly(teach("y", "u", "h", "n", "m", "6", "7"), [3, 5], 10, 11), label: "WORDS FROM YOUR KEYS" },
    ],
    { maxSpeed: 0.7, goalMaxMiss: 8, xp: 120, requires: ["left-index"] }),

  L("right-middle", "foundation", "Right Middle Territory",
    "K is home. I floats above, the comma dips below.",
    ["i", ",", "8"], "right-middle",
    [
      { type: "find", tokens: ["i", ","], count: 8, label: "FIND I AND ," },
      { type: "engine", tokens: mv("k", "i"), movement: { home: "k", reach: "i" }, label: "K → I → K" },
      { type: "engine", tokens: mv("k", ","), movement: { home: "k", reach: "," }, label: "K → , → K" },
      { type: "engine", tokens: T("8", "i", "k", ",", "ik", "ki", "i,", ",i", "iki", "k,k", "8i", "i8"), label: "THE FULL COLUMN" },
      { type: "engine", tokens: wordsOnly(teach("i", ",", "8"), [3, 4], 8, 17), label: "WORDS FROM YOUR KEYS" },
    ],
    { maxSpeed: 0.65, requires: ["right-index"] }),

  L("right-ring", "foundation", "Right Ring Territory",
    "L is home. O above, the period below. Smooth rolls, no stabbing.",
    ["o", ".", "9"], "right-ring",
    [
      { type: "find", tokens: ["o", "."], count: 8, label: "FIND O AND ." },
      { type: "engine", tokens: mv("l", "o"), movement: { home: "l", reach: "o" }, label: "L → O → L" },
      { type: "engine", tokens: mv("l", "."), movement: { home: "l", reach: "." }, label: "L → . → L" },
      { type: "engine", tokens: T("9", "o", "l", ".", "lo", "ol", "o.", ".o", "lol", "l.l", "9o", "o9"), label: "THE FULL COLUMN" },
      { type: "engine", tokens: wordsOnly(teach("o", ".", "9"), [3, 4], 8, 23), label: "WORDS FROM YOUR KEYS" },
    ],
    { maxSpeed: 0.65, requires: ["right-middle"] }),

  L("right-pinky", "foundation", "Right Pinky Territory",
    "The pinky stretches furthest: P above, / below, and the symbol keys beyond.",
    ["p", "/", "0", "-", "="], "right-pinky",
    [
      { type: "find", tokens: ["p", "/"], count: 8, label: "FIND P AND /" },
      { type: "engine", tokens: mv(";", "p"), movement: { home: ";", reach: "p" }, label: "; → P → ;" },
      { type: "engine", tokens: mv(";", "/"), movement: { home: ";", reach: "/" }, label: "; → / → ;" },
      { type: "engine", tokens: T("0", "p", ";", "/", "p;", ";p", "p/", "/p", "0p", "p0", "-", "=", "-=", "=-"), label: "THE FULL COLUMN" },
      { type: "engine", tokens: wordsOnly(teach("p", "/", "0", "-", "="), [3, 4], 8, 31), label: "WORDS FROM YOUR KEYS" },
    ],
    { maxSpeed: 0.7, requires: ["right-ring"], checkpoint: "ZONES" }),

  L("numbers", "foundation", "Numbers Row",
    "1–5 with the left hand, 6–0 with the right. Reach up and snap back.",
    [], undefined,
    [
      { type: "find", tokens: T("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"), count: 10, label: "FIND THE NUMBERS" },
      { type: "engine", tokens: T("1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "1", "0", "2", "9", "3", "8") },
      { type: "engine", tokens: T("12", "34", "56", "78", "90", "10", "20", "30", "55", "77", "99") },
      { type: "engine", tokens: T("2026", "100", "365", "247", "404", "1000", "808", "313") },
    ],
    { maxSpeed: 0.65, requires: ["right-pinky"] }),

  // ============ MUSCLE MEMORY ============
  L("top-connect", "muscle", "Top Row Connections",
    "Flow across the top row — the row that makes English words move.",
    [], undefined,
    [
      { type: "engine", tokens: T("qu", "we", "er", "rt", "ty", "yu", "ui", "io", "op", "qw", "ui", "op") },
      { type: "engine", tokens: T("qwe", "wer", "ert", "rty", "tyu", "yui", "uio", "iop", "opq") },
      { type: "engine", tokens: wordsOnly(teach(), [3, 6], 12, 37), label: "TOP-ROW WORDS" },
    ],
    { maxSpeed: 0.8, requires: ["numbers"] }),

  L("bottom-connect", "muscle", "Bottom Row Connections",
    "The awkward row. Slow hands now — accuracy buys speed later.",
    [], undefined,
    [
      { type: "engine", tokens: T("zx", "xc", "cv", "vb", "bn", "nm", "m,", ",.", "zxc", "cvb", "bnm") },
      { type: "engine", tokens: wordsOnly(teach(), [3, 5], 12, 43).filter((w) => /[zxcvbnm]/.test(w)), label: "BOTTOM-ROW WORDS" },
    ],
    { maxSpeed: 0.75, goalAcc: 88, requires: ["top-connect"] }),

  L("left-words", "muscle", "Left-Hand Words",
    "Whole words typed with the left hand only. Feel the hand dance alone.",
    [], undefined,
    [
      { type: "engine", tokens: T("was", "red", "cat", "fat", "sat", "bag", "tag", "rag") },
      { type: "engine", tokens: T("star", "dart", "cart", "raft", "vast", "grab", "fade", "face") },
      { type: "engine", tokens: T("great", "extra", "trace", "craft", "dwarf", "brave", "grave", "sweat", "cabbage") },
    ],
    { maxSpeed: 0.8, requires: ["bottom-connect"] }),

  L("right-words", "muscle", "Right-Hand Words",
    "Now the right hand solos. Keep the left hand resting on home.",
    [], undefined,
    [
      { type: "engine", tokens: T("ill", "inn", "oil", "pin", "lip", "ink", "hum", "mum") },
      { type: "engine", tokens: T("milk", "kiln", "loom", "moon", "noon", "pool", "loop", "polo", "cool", "hymn") },
      { type: "engine", tokens: T("union", "minimum", "jump", "punk", "hulk", "monk", "plump", "mummy") },
    ],
    { maxSpeed: 0.8, requires: ["left-words"] }),

  L("both-words", "muscle", "Alternating Hands",
    "Real typing: hands trading blows. Watch the handoff, not the keys.",
    [], undefined,
    [
      { type: "engine", tokens: T("th", "he", "in", "er", "an", "re", "on", "at", "en", "nd", "es", "ou") },
      { type: "engine", tokens: T("the", "and", "that", "have", "with", "this", "will", "from") },
      { type: "engine", tokens: T("they", "your", "there", "when", "what", "them", "then", "than") },
      { type: "engine", tokens: T("into", "time", "just", "know", "people", "water", "first", "right") },
    ],
    { maxSpeed: 0.85, requires: ["right-words"] }),

  L("sentences", "muscle", "Sentences",
    "Words chain into sentences. Breathe at the gaps — rhythm is coming.",
    [], undefined,
    [
      { type: "engine", tokens: T("the", "quick", "brown", "fox", "jumps") },
      { type: "engine", tokens: T("over", "the", "lazy", "dog", "pack", "my", "box") },
      { type: "engine", tokens: T("typing", "in", "rhythm", "feels", "like", "music") },
      { type: "engine", tokens: T("every", "key", "is", "a", "note", "in", "the", "song") },
    ],
    { maxSpeed: 0.9, goalMaxMiss: 10, xp: 160, requires: ["both-words"], checkpoint: "WORDS" }),

  L("adaptive", "muscle", "Adaptive Practice",
    "The lesson watches you. Clean runs make it faster; shaky runs slow it down. Chase 95%+ and feel the ramp.",
    [], undefined,
    [
      { type: "engine", tokens: wordsOnly(teach(), [3, 4], 10, 50), label: "WARM-UP · SHORT WORDS" },
      { type: "engine", tokens: wordsOnly(teach(), [3, 5], 12, 56), label: "BUILDING · LONGER WORDS" },
      { type: "engine", tokens: wordsOnly(teach(), [4, 6], 12, 62), label: "STRETCH · FULL VOCABULARY" },
      { type: "engine", tokens: T("the", "and", "that", "with", "from", "they", "time", "know", "water", "first", "right", "night", "music", "quick", "world"), label: "FLOW · COMMON WORDS" },
    ],
    { maxSpeed: 1.2, goalAcc: 90, goalMaxMiss: 10, xp: 200, requires: ["sentences"] }),

  L("punctuation", "muscle", "Punctuation in Context",
    "Commas, periods and apostrophes — the right pinky earns its keep.",
    ["'"], undefined,
    [
      { type: "engine", tokens: T("a,", "b.", "c,", "d.", "ok,", "no.", "yes,", "go.") },
      { type: "engine", tokens: T("don't", "it's", "can't", "won't", "i'm", "you're") },
      { type: "engine", tokens: T("well,", "done.", "nice,", "work.", "hey;", "ok/") },
    ],
    { maxSpeed: 0.8, requires: ["adaptive"] }),

  L("shift", "muscle", "Shift & Capitals",
    "Hold Shift with the opposite pinky, strike the letter, release. Capitals are a two-key move — don't rush the release.",
    [], undefined,
    [
      { type: "engine", tokens: T("A", "S", "D", "F", "J", "K", "L", "A", "F", "J", "D", "S"), label: "HOME ROW CAPITALS" },
      { type: "engine", tokens: T("R", "T", "G", "V", "Y", "U", "H", "N", "M", "R", "Y", "T", "U"), label: "THE REACHES, CAPITALIZED" },
      { type: "engine", tokens: T("Ann", "Ben", "Cat", "Dan", "Ella", "Fred", "Gus", "Hal", "Ida", "Joe", "Kim", "Lee"), label: "NAMES — CAPITAL FIRST LETTER" },
      { type: "engine", tokens: T("The", "Quick", "Brown", "Fox", "Jumps", "Over", "the", "Lazy", "Dog"), label: "SENTENCE CASE" },
      { type: "engine", tokens: T("the", "Cat", "and", "Dog", "run", "Fast", "in", "the", "Sun", "all", "Day"), label: "MIXED CASE" },
      { type: "engine", tokens: T("A", "R", "T", "Y", "M", "Cat", "Dog", "The", "Sun", "Fast"), highlight: false, label: "MEMORY — NO HIGHLIGHTS" },
    ],
    { maxSpeed: 0.85, goalMaxMiss: 8, xp: 160, requires: ["punctuation"], checkpoint: "FULL BOARD" }),

  // ============ RHYTHM TRAINING ============
  L("rhythm-slow", "rhythm", "Slow Rhythm",
    "Your first track. Notes fall to a slow beat — press each one as it lands on the line.",
    [], undefined, [],
    { maxSpeed: 0.8, kind: "rhythm", music: "first-steps", difficulty: "beginner", goalAcc: 85, goalMaxMiss: 14, xp: 200, requires: ["shift"] }),

  L("rhythm-normal", "rhythm", "Normal Rhythm",
    "A real groove now. Let the beat carry your fingers.",
    [], undefined, [],
    { maxSpeed: 1.1, kind: "rhythm", music: "glass-tide", difficulty: "normal", goalAcc: 88, goalMaxMiss: 14, xp: 240, requires: ["rhythm-slow"] }),

  L("speed-training", "rhythm", "Speed Training",
    "Complex words at full tilt. Accuracy first — speed follows relaxed hands.",
    [], undefined, [],
    { maxSpeed: 1.4, kind: "rhythm", music: "velocity", difficulty: "hard", goalAcc: 90, goalMaxMiss: 16, xp: 300, requires: ["rhythm-normal"], checkpoint: "RHYTHM" }),
];

export const SECTIONS: { id: SectionId; label: string; blurb: string }[] = [
  { id: "foundation", label: "FOUNDATION", blurb: "where keys live · which finger · move & return" },
  { id: "muscle", label: "MUSCLE MEMORY", blurb: "combinations · words · sentences" },
  { id: "rhythm", label: "RHYTHM TRAINING", blurb: "music · timing · speed" },
];

export function getLesson(id: string): LessonDef | null {
  return LESSONS.find((l) => l.id === id) ?? null;
}

export function nextLessonId(id: string): string | null {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i >= 0 && i < LESSONS.length - 1 ? LESSONS[i + 1].id : null;
}

export function isUnlocked(lesson: LessonDef, done: Record<string, { done: boolean }>): boolean {
  return lesson.requires.every((r) => done[r]?.done);
}

export function lockReason(lesson: LessonDef): string | null {
  if (!lesson.requires.length) return null;
  const req = lesson.requires.map((r) => getLesson(r)?.title ?? r).join(" + ");
  return `Complete ${req}`;
}

export function focusFingerInfo(lesson: LessonDef) {
  return lesson.focusFinger ? FINGER_ZONES[lesson.focusFinger] : null;
}

// ------------------------------------------------------------------
// chart building — tokens → patient, finger-colored notes
// ------------------------------------------------------------------

export function buildChartFromTokens(tokens: string[]): Chart {
  const notes: ChartNote[] = [];
  let t = 2.4;
  let id = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (token.length <= 1) {
      notes.push({
        id: id++, kind: "letter", text: token, key: token,
        time: t, deadline: t + 30,
        color: fingerColor(token) ?? undefined,
      });
      t += 1.25;
    } else {
      const grace = 0.5 + 0.25 * token.length;
      notes.push({
        id: id++, kind: "word", text: token, key: token,
        time: t, deadline: t + grace + 30,
        color: fingerColor(token[0]) ?? undefined,
      });
      t += 1.0 + token.length * 0.22;
    }
  }
  return { notes, duration: t + 2, beat: 0.6, introTime: 2.4 };
}
