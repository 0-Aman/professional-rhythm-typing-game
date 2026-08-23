import { useEffect, useRef } from "react";
import { fingerColor } from "../game/fingers";
import { baseKey } from "../game/keymap";

export interface KbApi {
  glow: (ch: string | null) => void;
  key: (ch: string, kind: "down" | "up" | "correct" | "error") => void;
  note: (text: string | null, typed: number, kind: "letter" | "word") => void;
}

const ROWS: string[][] = [
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
  [" "],
];

const LABELS: Record<string, string> = { " ": "SPACE" };
const HOME = new Set(["f", "j"]);
const INDENT: Record<number, string> = { 1: "ml-[4%]", 2: "ml-[7%]", 3: "ml-[11%]" };

export function Keyboard({
  api,
  compact = false,
  showFingers = false,
}: {
  api: React.MutableRefObject<KbApi | null>;
  compact?: boolean;
  showFingers?: boolean;
}) {
  const keysRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const hintRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<string | null>(null);

  useEffect(() => {
    const timers = new Map<string, number>();
    // resolve capitals AND shifted symbols (":" → ";") to the physical key
    const elFor = (ch: string) => keysRef.current.get(baseKey(ch));

    api.current = {
      glow(ch) {
        // clear previous
        if (glowRef.current) {
          const prev = elFor(glowRef.current);
          prev?.classList.remove("is-glow");
        }
        shiftRef.current?.classList.remove("is-glow");
        glowRef.current = ch;
        if (!ch) return;
        const el = elFor(ch);
        el?.classList.add("is-glow");
        if (ch !== ch.toLowerCase()) shiftRef.current?.classList.add("is-glow");
      },
      key(ch, kind) {
        const el = elFor(ch);
        if (!el) return;
        if (kind === "down") {
          el.classList.add("is-down");
        } else if (kind === "up") {
          el.classList.remove("is-down");
          el.classList.remove("is-correct-flash");
        } else if (kind === "correct") {
          el.classList.add("is-correct-flash");
        } else if (kind === "error") {
          el.classList.remove("is-down");
          el.classList.add("is-error");
          const k = ch.toLowerCase();
          window.clearTimeout(timers.get(k));
          timers.set(k, window.setTimeout(() => el.classList.remove("is-error"), 260));
        }
      },
      note(text, typed, kind) {
        // built with textContent only — chart text may originate from
        // user-pasted custom text and must never be parsed as markup
        const hint = hintRef.current;
        if (!hint) return;
        hint.replaceChildren();
        const glyph = (c: string) => (c === " " ? "␣" : c);
        if (!text) {
          const s = document.createElement("span");
          s.className = "text-faint";
          s.textContent = "get ready…";
          hint.appendChild(s);
          return;
        }
        if (kind === "letter") {
          const s = document.createElement("span");
          s.className = "text-volt font-display text-xl";
          s.textContent = glyph(text);
          hint.appendChild(s);
        } else {
          for (let i = 0; i < text.length; i++) {
            const s = document.createElement("span");
            s.textContent = glyph(text[i]);
            s.className =
              i < typed ? "text-lime-neon"
              : i === typed ? "text-fog bg-volt/25 border-b-2 border-volt px-[1px]"
              : "text-dim";
            hint.appendChild(s);
          }
        }
      },
    };
    return () => {
      api.current = null;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [api]);

  return (
    <div className={`mx-auto w-full ${compact ? "max-w-[760px]" : "max-w-[880px]"} select-none`}>
      {/* upcoming note hint */}
      <div className="mb-2 flex items-center justify-center">
        <div
          ref={hintRef}
          className="hud-chip rounded-lg px-5 py-1.5 font-mono text-lg tracking-[0.25em] min-h-[38px] flex items-center"
        >
          <span className="text-faint">get ready…</span>
        </div>
      </div>

      <div className={`flex flex-col gap-[5px] rounded-xl border border-ink-600/70 bg-ink-900/80 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-sm ${compact ? "" : ""}`}>
        {ROWS.map((row, ri) => (
          <div key={ri} className={`flex gap-[5px] ${INDENT[ri] ?? ""} ${ri === 4 ? "justify-center" : ""}`}>
            {ri === 2 && (
              <div ref={shiftRef} className="vk-key flex-[1.4] !text-[9px] tracking-widest text-faint">SHIFT</div>
            )}
            {row.map((k) => (
              <div
                key={k}
                ref={(el) => {
                  if (el) keysRef.current.set(k, el);
                }}
                className={`vk-key ${k === " " ? "flex-[6]" : "flex-1"}`}
                style={{ height: compact ? 38 : 44 }}
              >
                {showFingers && fingerColor(k) && (
                  <span
                    className="pointer-events-none absolute left-1/2 top-[3px] h-[3px] w-[55%] -translate-x-1/2 rounded-full"
                    style={{ background: fingerColor(k)!, boxShadow: `0 0 6px ${fingerColor(k)}` }}
                  />
                )}
                {LABELS[k] ?? k.toUpperCase()}
                {HOME.has(k) && <span className="home-dot" />}
              </div>
            ))}
            {ri === 2 && <div className="vk-key flex-[1.4] !text-[9px] tracking-widest text-faint">⏎</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
