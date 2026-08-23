import { useEffect, useRef, useState } from "react";
import { BackgroundFX, Icon, Toggle } from "../components/ui";
import { KEY_MAP, FINGER_ZONES, FingerId, movementArrow, ROW_LABEL, relatedKeys } from "../game/keymap";
import { fingerColor, fingerLabel } from "../game/fingers";
import { keyMastery, loadStore } from "../store";
import { audio } from "../audio/audio";

const ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

// Interactive reference: hover/click any key, or free-explore by typing.
export function KeyMapScreen({ onBack }: { onBack: () => void }) {
  const store = loadStore();
  const [sel, setSel] = useState("f");
  const [free, setFree] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    if (!free) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!KEY_MAP[k]) return;
      setSel(k);
      setFlash(k);
      audio.ensure();
      audio.playKey(k, loadStore().settings.keyProfile);
      setTimeout(() => {
        if (alive.current) setFlash((f) => (f === k ? null : f));
      }, 300);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [free]);

  const def = KEY_MAP[sel];
  const zone = def && def.finger !== "thumb" ? FINGER_ZONES[def.finger as FingerId] : null;
  const mastery = keyMastery(store, sel);
  const color = fingerColor(sel) ?? "#00e5ff";

  return (
    <div className="relative h-screen overflow-y-auto">
      <BackgroundFX hue={210} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={() => { audio.playUi(); onBack(); }} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Back">
            <Icon name="back" size={16} />
          </button>
          <div>
            <h1 className="font-display text-2xl tracking-wider text-fog text-glow-volt">KEYBOARD MAP</h1>
            <p className="font-mono text-[11px] text-dim">every key has a finger, a home and a movement</p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 rounded-xl border border-ink-500 bg-ink-900/70 px-4 py-2">
            <span className="font-mono text-[10px] tracking-[0.2em] text-dim">FREE EXPLORE</span>
            <Toggle label="" value={free} onChange={setFree} />
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* the board */}
          <div className="panel rounded-2xl p-5">
            <div className="flex flex-col gap-1.5">
              {ROWS.map((row, ri) => (
                <div key={ri} className={`flex gap-1.5 ${ri === 1 ? "ml-[3%]" : ri === 2 ? "ml-[6%]" : ri === 3 ? "ml-[10%]" : ""}`}>
                  {row.map((k) => {
                    const d = KEY_MAP[k];
                    const c = fingerColor(k) ?? "#2a3866";
                    const m = keyMastery(store, k).mastery;
                    const active = k === sel;
                    return (
                      <button
                        key={k}
                        onClick={() => { setSel(k); audio.ensure(); audio.playKey(k, store.settings.keyProfile); }}
                        className={`relative flex h-12 flex-1 flex-col items-center justify-center rounded-lg border font-mono text-[13px] font-bold transition-all ${
                          active ? "z-10 scale-110" : flash === k ? "scale-105" : "hover:scale-105"
                        }`}
                        style={{
                          borderColor: active ? c : "rgba(42,56,102,0.7)",
                          color: active ? "#04060e" : "#93a1c7",
                          background: active ? c : "linear-gradient(180deg,#141d3a,#0b1122)",
                          boxShadow: active ? `0 0 22px ${c}` : "0 3px 0 rgba(0,0,0,0.5)",
                        }}
                      >
                        <span className="pointer-events-none absolute left-1/2 top-[3px] h-[3px] w-[55%] -translate-x-1/2 rounded-full" style={{ background: c, opacity: active ? 0 : 0.9 }} />
                        {k.toUpperCase()}
                        {m > 0 && (
                          <span className="pointer-events-none absolute bottom-1 h-[3px] rounded-full bg-lime-neon" style={{ width: `${Math.max(8, m * 0.6)}%`, opacity: active ? 0 : 0.7 }} />
                        )}
                        {d.movement === "home" && <span className="home-dot" style={{ bottom: 4 }} />}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="ml-[22%] mr-[22%]">
                <button
                  onClick={() => setSel(" ")}
                  className={`flex h-10 w-full items-center justify-center rounded-lg border font-mono text-[10px] tracking-[0.3em] transition-all ${sel === " " ? "border-volt text-volt" : "border-ink-600 text-faint"}`}
                  style={{ background: sel === " " ? "rgba(0,229,255,0.12)" : "linear-gradient(180deg,#141d3a,#0b1122)" }}
                >
                  SPACE — THUMBS
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-600 pt-3">
              <span className="font-mono text-[9px] tracking-[0.25em] text-faint">FINGERS</span>
              {Object.values(FINGER_ZONES).map((z) => (
                <span key={z.id} className="flex items-center gap-1.5 font-mono text-[9px] text-dim">
                  <span className="h-2 w-2 rounded-full" style={{ background: z.color }} /> {z.label}
                </span>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] text-faint">
              {free ? "free explore is on — press any physical key and watch its story appear" : "click any key to inspect it"}
            </p>
          </div>

          {/* detail panel */}
          <div className="flex flex-col gap-4">
            <div className="panel rise-in rounded-2xl p-5 text-center" key={sel}>
              <div
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl font-display text-4xl text-ink-950"
                style={{ background: color, boxShadow: `0 0 40px ${color}77` }}
              >
                {sel === " " ? "␣" : sel.toUpperCase()}
              </div>
              <div className="mt-3 font-display text-[13px] tracking-[0.2em]" style={{ color }}>{def ? fingerLabel(sel) : ""}</div>
              <div className="mt-1 font-mono text-[10px] text-dim">{def ? ROW_LABEL[def.row] : ""}</div>

              {def && def.movement !== "home" && (
                <div className="mt-3 rounded-xl border border-ink-600 bg-ink-900/70 px-3 py-2.5">
                  <div className="font-mono text-[9px] tracking-[0.25em] text-faint">MOVEMENT {movementArrow(def)}</div>
                  <div className="mt-1 font-display text-[13px] tracking-wider text-fog">
                    {def.homeKey.toUpperCase()} → {sel.toUpperCase()} → {def.homeKey.toUpperCase()}
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] text-faint">home is {def.homeKey.toUpperCase()} — always return there</div>
                </div>
              )}
              {def && def.movement === "home" && (
                <div className="mt-3 rounded-xl border border-lime-neon/30 bg-lime-neon/5 px-3 py-2.5 font-mono text-[10px] text-lime-neon">
                  HOME KEY — {sel === "f" || sel === "j" ? "feel the bump, it's your anchor" : "where the finger rests"}
                </div>
              )}

              <div className="mt-3">
                <div className="flex justify-between font-mono text-[9px] text-faint">
                  <span>MASTERY</span><span>{mastery.mastery}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: mastery.mastery + "%", background: color, boxShadow: `0 0 8px ${color}` }} />
                </div>
                <div className="mt-1 font-mono text-[9px] text-faint">{mastery.attempts} attempts logged</div>
              </div>
            </div>

            {zone && (
              <div className="panel rounded-2xl p-5">
                <div className="font-mono text-[9px] tracking-[0.25em] text-faint">{zone.label} TERRITORY</div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {zone.keys.map((k) => (
                    <button
                      key={k}
                      onClick={() => setSel(k)}
                      className={`keycap !h-8 !min-w-8 transition-all ${k === sel ? "!text-ink-950" : ""}`}
                      style={k === sel ? { background: zone.color, borderColor: zone.color } : { borderColor: zone.color + "66", color: zone.color }}
                    >
                      {k === " " ? "␣" : k.toUpperCase()}
                    </button>
                  ))}
                </div>
                {relatedKeys(sel).length > 0 && (
                  <p className="mt-3 font-mono text-[10px] leading-relaxed text-faint">
                    siblings: {relatedKeys(sel).slice(0, 5).map((k) => k.toUpperCase()).join(" ")} — same finger, different reach
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
