import { useEffect, useMemo, useRef, useState } from "react";
import { BackgroundFX, Icon } from "../components/ui";
import { GameResult } from "../game/engine";
import {
  GameOutcome, applySuggestion, dismissSuggestion, levelProgress, loadStore,
} from "../store";
import { ACHIEVEMENTS, DIFF_COLOR, DIFF_LABEL } from "../game/content";
import { getSong } from "../game/songs";

function useCountUp(target: number, duration = 900, delay = 0): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / duration));
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return v;
}

const RANK_COLOR: Record<string, string> = {
  S: "#ffc94d", A: "#a8ff3e", B: "#00e5ff", C: "#ff8a3d", D: "#ff4d5e",
};

export function ResultsScreen({
  result,
  outcome,
  onRetry,
  onNext,
  onSongs,
  onMenu,
}: {
  result: GameResult;
  outcome: GameOutcome;
  onRetry: () => void;
  onNext: (() => void) | null;
  onSongs: () => void;
  onMenu: () => void;
}) {
  const store = loadStore();
  const lp = levelProgress(store.profile.xp);
  const songTitle =
    result.songId === "custom" ? "CUSTOM TEXT" : getSong(result.songId).title.toUpperCase();
  const score = useCountUp(result.score, 1100, 200);
  const wpm = useCountUp(result.wpm, 900, 350);
  const acc = useCountUp(result.accuracy, 900, 500);
  const combo = useCountUp(result.maxCombo, 900, 650);
  const [showRank, setShowRank] = useState(false);
  const rankRef = useRef<HTMLDivElement>(null);
  const [sug, setSug] = useState(store.suggestion);
  const [appliedSpeed, setAppliedSpeed] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowRank(true), 150);
    return () => clearTimeout(t);
  }, []);

  const weakKeys = useMemo(() => {
    return Object.entries(store.mistyped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [store.mistyped]);

  const hue = result.accuracy >= 95 ? 45 : result.accuracy >= 85 ? 150 : 200;

  const rows: [string, number, string][] = [
    ["PERFECT", result.judgments.perfect, "#a8ff3e"],
    ["GREAT", result.judgments.great, "#00e5ff"],
    ["GOOD", result.judgments.good, "#ffc94d"],
    ["MISS", result.judgments.miss, "#ff4d5e"],
  ];
  const totalJ = Math.max(1, rows.reduce((s, r) => s + r[1], 0));

  return (
    <div className="relative h-screen overflow-y-auto">
      <BackgroundFX hue={hue} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 mx-auto flex min-h-full max-w-5xl flex-col justify-center px-6 py-8">
        {/* header */}
        <div className="rise-in text-center">
          <div className="font-mono text-[11px] tracking-[0.5em] text-dim">
            {result.died ? "RUN OVER" : result.mode === "time" ? "TIME UP" : "TRACK COMPLETE"}
          </div>
          <h1 className="mt-1 font-display text-3xl tracking-wider text-fog text-glow-volt">
            {songTitle}
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[11px]">
            <span style={{ color: DIFF_COLOR[result.difficulty] }}>{DIFF_LABEL[result.difficulty]}</span>
            <span className="text-faint">·</span>
            <span className="text-dim">{result.correctChars} keys</span>
            <span className="text-faint">·</span>
            <span className="text-dim">{Math.round(result.timePlayed)}s</span>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* rank + score */}
          <div className="panel rise-in flex flex-col items-center rounded-2xl p-6" style={{ animationDelay: "0.05s" }}>
            <div
              ref={rankRef}
              className={`font-display text-[110px] leading-none transition-all duration-500 ${showRank ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
              style={{
                color: RANK_COLOR[outcome.rank],
                textShadow: `0 0 40px ${RANK_COLOR[outcome.rank]}88, 0 0 90px ${RANK_COLOR[outcome.rank]}44`,
              }}
            >
              {outcome.rank}
            </div>
            <div className="font-mono text-[10px] tracking-[0.4em] text-faint">RANK</div>

            <div className="mt-5 w-full text-center">
              <div className="font-mono text-[9px] tracking-[0.3em] text-gold/70">FINAL SCORE</div>
              <div className="font-display text-4xl text-gold text-glow-gold tabular-nums">
                {Math.round(score).toLocaleString()}
              </div>
              <div className="mt-2 flex justify-center gap-1.5">
                {outcome.newBest.score && <Badge label="NEW BEST SCORE" color="#ffc94d" />}
              </div>
            </div>

            <div className="mt-5 w-full border-t border-ink-600 pt-4">
              <div className="flex items-center justify-between font-mono text-[10px] text-dim">
                <span>LEVEL {lp.level}</span>
                <span className="text-volt">+{outcome.xpGained} XP</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-700">
                <div
                  className="xp-animate h-full rounded-full bg-gradient-to-r from-volt-deep to-volt shadow-[0_0_10px_rgba(0,229,255,0.7)]"
                  style={{
                    ["--xp-from" as string]: `${Math.max(0, lp.pct - (outcome.xpGained / lp.span) * 100)}%`,
                    ["--xp-to" as string]: `${lp.pct}%`,
                  }}
                />
              </div>
              {outcome.levelAfter > outcome.levelBefore && (
                <div className="mt-2 text-center font-display text-xs tracking-widest text-lime-neon">
                  ★ LEVEL UP — {lp.level} ★
                </div>
              )}
              {outcome.dailyPassed && (
                <div className="mt-2 rounded-lg border border-gold/50 bg-gold/10 px-3 py-1.5 text-center font-mono text-[10px] text-gold">
                  DAILY CHALLENGE COMPLETE +500 XP
                </div>
              )}
            </div>
          </div>

          {/* stats grid */}
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "WPM", val: Math.round(wpm), final: result.wpm, color: "text-lime-neon", best: outcome.newBest.wpm, suffix: "" },
                { label: "ACCURACY", val: acc, final: result.accuracy, color: "text-volt", best: outcome.newBest.accuracy, suffix: "%" },
                { label: "MAX COMBO", val: Math.round(combo), final: result.maxCombo, color: "text-flare", best: false, suffix: "" },
              ].map((s, i) => (
                <div key={s.label} className="panel rise-in rounded-2xl p-4 text-center" style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
                  <div className="font-mono text-[9px] tracking-[0.3em] text-faint">{s.label}</div>
                  <div className={`mt-1 font-display text-3xl tabular-nums ${s.color}`}>
                    {s.suffix === "%" ? s.val.toFixed(1) : s.val.toLocaleString()}{s.suffix}
                  </div>
                  {s.best && <Badge label="PERSONAL BEST" color="#a8ff3e" />}
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {/* judgments */}
              <div className="panel rise-in rounded-2xl p-4" style={{ animationDelay: "0.3s" }}>
                <div className="font-mono text-[9px] tracking-[0.3em] text-faint">TIMING BREAKDOWN</div>
                <div className="mt-3 space-y-2.5">
                  {rows.map(([label, n, color]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-16 font-display text-[11px]" style={{ color }}>{label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(n / totalJ) * 100}%`, background: color, boxShadow: `0 0 8px ${color}88` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs text-fog tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* typing analysis */}
              <div className="panel rise-in rounded-2xl p-4" style={{ animationDelay: "0.36s" }}>
                <div className="font-mono text-[9px] tracking-[0.3em] text-faint">TYPING ANALYSIS</div>
                {weakKeys.length > 0 ? (
                  <>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="font-mono text-[11px] text-dim">weak keys:</span>
                      {weakKeys.map(([k]) => (
                        <span key={k} className="keycap !text-alarm !border-alarm/50">{k === " " ? "␣" : k.toUpperCase()}</span>
                      ))}
                    </div>
                    <p className="mt-3 text-[12px] leading-relaxed text-dim">
                      {recommendation(weakKeys.map(([k]) => k))}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-[12px] leading-relaxed text-dim">
                    Clean run — no recurring weak keys detected. Keep this up and push the tempo.
                  </p>
                )}
                <div className="mt-3 border-t border-ink-600 pt-2 font-mono text-[10px] text-faint">
                  best WPM {store.profile.bestWpm} · avg session {store.wpmHistory.length ? Math.round(store.wpmHistory.reduce((a, b) => a + b, 0) / store.wpmHistory.length) : 0} WPM
                </div>
              </div>
            </div>

            {/* achievements */}
            {outcome.unlocked.length > 0 && (
              <div className="rise-in flex flex-wrap gap-2" style={{ animationDelay: "0.45s" }}>
                {outcome.unlocked.map((id) => {
                  const a = ACHIEVEMENTS.find((x) => x.id === id)!;
                  return (
                    <div key={id} className="flex items-center gap-2.5 rounded-xl border border-gold/50 bg-gold/10 px-3.5 py-2 shadow-[0_0_20px_rgba(255,201,77,0.15)]">
                      <span className="text-gold"><Icon name={a.icon} size={18} /></span>
                      <span>
                        <span className="block font-display text-[10px] tracking-wider text-gold">ACHIEVEMENT — {a.name.toUpperCase()}</span>
                        <span className="block font-mono text-[10px] text-dim">{a.desc}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* smart speed suggestion — the player always decides */}
        {sug && (
          <div className="panel rise-in mx-auto mt-6 w-full max-w-lg rounded-2xl border-volt/40 p-4 text-center" style={{ animationDelay: "0.42s" }}>
            {appliedSpeed !== null ? (
              <div className="font-display text-sm tracking-wider text-lime-neon">
                NOTE SPEED SET TO ×{appliedSpeed.toFixed(2)}
              </div>
            ) : (
              <>
                <div className="font-display text-[13px] tracking-wider text-fog">
                  {sug.dir === "up"
                    ? "You're ready for a little more speed."
                    : "Your accuracy is dipping — ease off a touch?"}
                </div>
                <div className="mt-1 font-mono text-[11px] text-dim">
                  {sug.dir === "up" ? "Increase" : "Reduce"} to <span className="text-volt">×{sug.speed.toFixed(2)}</span>?
                </div>
                <div className="mt-3 flex justify-center gap-2.5">
                  <button
                    className="btn-primary rounded-lg px-5 py-2 text-[11px]"
                    onClick={() => setAppliedSpeed(applySuggestion(sug.dir))}
                  >
                    YES — ×{sug.speed.toFixed(2)}
                  </button>
                  <button
                    className="btn-ghost rounded-lg px-5 py-2 text-[11px]"
                    onClick={() => { dismissSuggestion(); setSug(null); }}
                  >
                    KEEP CURRENT SPEED
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* actions */}
        <div className="rise-in mt-7 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.5s" }}>
          <button onClick={onRetry} className="btn-primary flex items-center gap-2 rounded-xl px-7 py-3 text-sm">
            <Icon name="play" size={14} /> RETRY
          </button>
          {onNext && (
            <button onClick={onNext} className="btn-ghost flex items-center gap-2 rounded-xl px-6 py-3 text-xs">
              NEXT SONG →
            </button>
          )}
          <button onClick={onSongs} className="btn-ghost rounded-xl px-6 py-3 text-xs">SONG SELECT</button>
          <button onClick={onMenu} className="btn-ghost rounded-xl px-6 py-3 text-xs !text-dim">MAIN MENU</button>
        </div>
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="mt-1.5 inline-block rounded-full px-2 py-0.5 font-mono text-[8px] font-bold tracking-[0.15em]"
      style={{ color, background: color + "1a", border: `1px solid ${color}66` }}
    >
      ★ {label}
    </span>
  );
}

function recommendation(keys: string[]): string {
  const has = (k: string) => keys.includes(k);
  if (has("t") || has("h")) return "Common mistake: the T–H pair is slowing you down. Practice words like “the”, “that”, “rhythm” in Practice mode at ×0.7.";
  if (has("q") || has("z") || has("x")) return "Corner keys are tripping you. Slow drills with “quiz”, “jazz” and “box” will build the stretch reflex.";
  if (has("p") || has("o") || has("l")) return "Right-hand pinky strength is lagging — drill “loop”, “polo” and “palm” until it feels boring.";
  if (has(";") || has("'")) return "Punctuation rows need love. Try Expert tracks or a custom text full of semicolons.";
  if (has(" ")) return "Your spacebar timing is off — let the beat carry your thumb, don't rush the gap.";
  return `Focus drills on ${keys.slice(0, 3).map((k) => k.toUpperCase()).join(", ")} — short Practice runs at ×0.7 will lock them in.`;
}
