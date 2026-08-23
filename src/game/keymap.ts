// THE keyboard learning map — single source of truth.
// Every key knows its row, finger, hand, home key, movement direction
// and difficulty. Lessons, highlights, finger animation, error analysis
// and adaptive practice all derive from this table.

export type Hand = "left" | "right";
export type FingerName = "pinky" | "ring" | "middle" | "index" | "thumb";
export type FingerId =
  | "left-pinky" | "left-ring" | "left-middle" | "left-index"
  | "right-index" | "right-middle" | "right-ring" | "right-pinky";

export type RowId = "number" | "top" | "home" | "bottom";
export type Movement = "home" | "up" | "down" | "up2";

export interface KeyDef {
  key: string;
  row: RowId;
  finger: FingerId | "thumb";
  hand: Hand;
  homeKey: string; // the home-row anchor this key returns to
  movement: Movement;
  difficulty: 1 | 2 | 3 | 4;
}

const k = (
  key: string, row: RowId, finger: FingerId | "thumb", hand: Hand,
  homeKey: string, movement: Movement, difficulty: 1 | 2 | 3 | 4,
): [string, KeyDef] => [key, { key, row, finger, hand, homeKey, movement, difficulty }];

export const KEY_MAP: Record<string, KeyDef> = Object.fromEntries([
  // number row (reached upward from home)
  k("1", "number", "left-pinky", "left", "a", "up2", 4),
  k("2", "number", "left-ring", "left", "s", "up2", 4),
  k("3", "number", "left-middle", "left", "d", "up2", 3),
  k("4", "number", "left-index", "left", "f", "up2", 3),
  k("5", "number", "left-index", "left", "f", "up2", 3),
  k("6", "number", "right-index", "right", "j", "up2", 3),
  k("7", "number", "right-index", "right", "j", "up2", 3),
  k("8", "number", "right-middle", "right", "k", "up2", 3),
  k("9", "number", "right-ring", "right", "l", "up2", 4),
  k("0", "number", "right-pinky", "right", ";", "up2", 4),
  k("-", "number", "right-pinky", "right", ";", "up2", 4),
  k("=", "number", "right-pinky", "right", ";", "up2", 4),
  // top row
  k("q", "top", "left-pinky", "left", "a", "up", 2),
  k("w", "top", "left-ring", "left", "s", "up", 2),
  k("e", "top", "left-middle", "left", "d", "up", 2),
  k("r", "top", "left-index", "left", "f", "up", 2),
  k("t", "top", "left-index", "left", "f", "up", 2),
  k("y", "top", "right-index", "right", "j", "up", 2),
  k("u", "top", "right-index", "right", "j", "up", 2),
  k("i", "top", "right-middle", "right", "k", "up", 2),
  k("o", "top", "right-ring", "right", "l", "up", 2),
  k("p", "top", "right-pinky", "right", ";", "up", 2),
  k("[", "top", "right-pinky", "right", ";", "up", 4),
  k("]", "top", "right-pinky", "right", ";", "up", 4),
  // home row
  k("a", "home", "left-pinky", "left", "a", "home", 1),
  k("s", "home", "left-ring", "left", "s", "home", 1),
  k("d", "home", "left-middle", "left", "d", "home", 1),
  k("f", "home", "left-index", "left", "f", "home", 1),
  k("g", "home", "left-index", "left", "f", "home", 2),
  k("h", "home", "right-index", "right", "j", "home", 2),
  k("j", "home", "right-index", "right", "j", "home", 1),
  k("k", "home", "right-middle", "right", "k", "home", 1),
  k("l", "home", "right-ring", "right", "l", "home", 1),
  k(";", "home", "right-pinky", "right", ";", "home", 1),
  k("'", "home", "right-pinky", "right", ";", "home", 3),
  // bottom row
  k("z", "bottom", "left-pinky", "left", "a", "down", 3),
  k("x", "bottom", "left-ring", "left", "s", "down", 3),
  k("c", "bottom", "left-middle", "left", "d", "down", 3),
  k("v", "bottom", "left-index", "left", "f", "down", 2),
  k("b", "bottom", "left-index", "left", "f", "down", 3),
  k("n", "bottom", "right-index", "right", "j", "down", 2),
  k("m", "bottom", "right-index", "right", "j", "down", 2),
  k(",", "bottom", "right-middle", "right", "k", "down", 3),
  k(".", "bottom", "right-ring", "right", "l", "down", 3),
  k("/", "bottom", "right-pinky", "right", ";", "down", 3),
  // space — thumbs
  k(" ", "bottom", "thumb", "right", " ", "home", 1),
]);

export const FINGER_IDS: FingerId[] = [
  "left-pinky", "left-ring", "left-middle", "left-index",
  "right-index", "right-middle", "right-ring", "right-pinky",
];

export interface FingerZone {
  id: FingerId;
  label: string; // "LEFT RING"
  home: string;
  keys: string[]; // full territory in teach order: home, top, bottom, number
  color: string;
}

export const FINGER_ZONES: Record<FingerId, FingerZone> = {
  "left-pinky": { id: "left-pinky", label: "LEFT PINKY", home: "a", keys: ["a", "q", "z", "1"], color: "#ff4d6d" },
  "left-ring": { id: "left-ring", label: "LEFT RING", home: "s", keys: ["s", "w", "x", "2"], color: "#ff8a3d" },
  "left-middle": { id: "left-middle", label: "LEFT MIDDLE", home: "d", keys: ["d", "e", "c", "3"], color: "#ffd23e" },
  "left-index": { id: "left-index", label: "LEFT INDEX", home: "f", keys: ["f", "r", "t", "g", "v", "b", "4", "5"], color: "#a8ff3e" },
  "right-index": { id: "right-index", label: "RIGHT INDEX", home: "j", keys: ["j", "y", "u", "h", "n", "m", "6", "7"], color: "#00e5ff" },
  "right-middle": { id: "right-middle", label: "RIGHT MIDDLE", home: "k", keys: ["k", "i", ",", "8"], color: "#45b8ff" },
  "right-ring": { id: "right-ring", label: "RIGHT RING", home: "l", keys: ["l", "o", ".", "9"], color: "#9d8cff" },
  "right-pinky": { id: "right-pinky", label: "RIGHT PINKY", home: ";", keys: [";", "p", "/", "0", "-", "=", "'", "[", "]"], color: "#ff5dc8" },
};

export function movementArrow(def: KeyDef): string {
  return def.movement === "up" || def.movement === "up2" ? "↑" : def.movement === "down" ? "↓" : "·";
}

// move-out-and-return pattern for teaching a reach: s,w,s,w,s,sw,ws,sws,wsw…
export function movementTokens(home: string, reach: string): string[] {
  return [
    home, reach, home,
    reach, home, reach,
    home, reach, reach, home,
    home + reach, reach + home,
    home + reach + home, reach + home + reach,
  ];
}

// keys that share a finger or sit beside the key — used for "why did I miss" hints
export function relatedKeys(key: string): string[] {
  const def = KEY_MAP[key.toLowerCase()];
  if (!def || def.finger === "thumb") return [];
  const zone = FINGER_ZONES[def.finger as FingerId];
  return zone ? zone.keys.filter((x) => x !== key && x.length === 1) : [];
}

export const ROW_LABEL: Record<RowId, string> = {
  number: "NUMBER ROW",
  top: "TOP ROW",
  home: "HOME ROW",
  bottom: "BOTTOM ROW",
};

// ------------------------------------------------------------------
// shifted characters — resolved to their physical base key so that
// capitals and symbols validate/highlight against the same map
// ------------------------------------------------------------------

export const SHIFTED: Record<string, string> = {
  "!": "1", "@": "2", "#": "3", $: "4", "%": "5",
  "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  _: "-", "+": "=", "{": "[", "}": "]", "|": "\\",
  ":": ";", '"': "'", "<": ",", ">": ".", "?": "/", "~": "`",
};

export function baseKey(ch: string): string {
  const lower = ch.toLowerCase();
  return SHIFTED[lower] ?? lower;
}

export function isTypeableChar(ch: string): boolean {
  return KEY_MAP[baseKey(ch)] !== undefined;
}

// per-hand finger colors, derived from the zone table (single source of truth)
export const FINGER_COLORS: Record<Hand, Record<FingerName, string>> = {
  left: {
    pinky: FINGER_ZONES["left-pinky"].color,
    ring: FINGER_ZONES["left-ring"].color,
    middle: FINGER_ZONES["left-middle"].color,
    index: FINGER_ZONES["left-index"].color,
    thumb: "#8fa3d9",
  },
  right: {
    index: FINGER_ZONES["right-index"].color,
    middle: FINGER_ZONES["right-middle"].color,
    ring: FINGER_ZONES["right-ring"].color,
    pinky: FINGER_ZONES["right-pinky"].color,
    thumb: "#8fa3d9",
  },
};
