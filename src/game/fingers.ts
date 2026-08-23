// Finger helpers — a thin API over the authoritative keyboard map in
// keymap.ts. There is exactly ONE key→finger table (KEY_MAP); everything
// here derives from it so the maps can never disagree.

import {
  KEY_MAP, FINGER_COLORS as ZONE_COLORS, FingerId, baseKey,
} from "./keymap";

export type Hand = "left" | "right";
export type FingerName = "pinky" | "ring" | "middle" | "index" | "thumb";

export interface FingerInfo {
  hand: Hand;
  finger: FingerName;
}

export const FINGER_COLORS: Record<Hand, Record<FingerName, string>> = ZONE_COLORS;

function split(finger: FingerId | "thumb"): FingerInfo {
  if (finger === "thumb") return { hand: "left", finger: "thumb" };
  const [hand, name] = finger.split("-") as [Hand, FingerName];
  return { hand, finger: name };
}

// derived, not hand-maintained: always matches KEY_MAP
export const KEY_FINGER: Record<string, FingerInfo> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, d]) => [k, split(d.finger)]),
);

export function fingerInfo(key: string): FingerInfo | null {
  const def = KEY_MAP[baseKey(key)];
  return def ? split(def.finger) : null;
}

export function fingerColor(key: string): string | null {
  const info = fingerInfo(key);
  if (!info) return null;
  return FINGER_COLORS[info.hand][info.finger];
}

export function fingerLabel(key: string): string {
  const info = fingerInfo(key);
  if (!info) return "";
  if (info.finger === "thumb") return "THUMBS";
  return `${info.hand.toUpperCase()} ${info.finger.toUpperCase()}`;
}

// The eight home-row anchor keys shown in the hand diagram (derived)
export const HOME_GUIDE: { key: string; info: FingerInfo }[] =
  ["a", "s", "d", "f", "j", "k", "l", ";"].map((key) => ({ key, info: split(KEY_MAP[key].finger) }));

export const FINGER_DISPLAY: Record<FingerName, string> = {
  pinky: "Pinky",
  ring: "Ring",
  middle: "Middle",
  index: "Index",
  thumb: "Thumb",
};
