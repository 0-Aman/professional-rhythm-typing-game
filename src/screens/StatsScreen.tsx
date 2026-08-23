import { useMemo } from "react";
import { BackgroundFX, Icon } from "../components/ui";
import {
  comfortSpeed, fingerStrength, keyAccuracyList, keyMastery, levelProgress,
  loadStore, skillTier,
} from "../store";
import { ACHIEVEMENTS, levelTitle } from "../game/content";
import { LESSONS } from "../game/lessons";
import { fingerColor } from "../game/fingers";
import { FINGER_ZONES } from "../game/keymap";
import { audio } from "../audio/audio";

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const store = loadStore();
  const lp = levelProgress(store.profile.xp);
  const p = store.profile;

  const spark = useMemo(() => {
    const h = store.wpmHistory;
    if (h.length < 2) return "";
    const max = Math.max(...h, 1);
    const pts = h.map((v, i) => `${(i / (h.length - 1)) * 100},${40 - (v / max) * 36}`);
    return pts.join(" ");
  }, [store.wpmHistory]);

  const keyAcc = useMemo(() => keyAccuracyList(store).slice(0, 8), [store]);
  const weak = useMemo(() => {
    if (keyAcc.length) return keyAcc.map((k) => [k.key, k.misses] as [string, number]);
    return Object.entries(store.mistyped).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [keyAcc, store.mistyped]);
  const maxWeak = Math.max(1, ...weak.map(([, v]) => v));
  const unlockedCount = Object.keys(store.achievements).length;
  const tier = skillTier(store);
  const comfort = comfortSpeed(store);
  const masteredCount = Object.values(store.lessons).filter((l) => l.mastered).length;

  const totals: [string, string | number, string][] = [
    ["GAMES PLAYED", p.gamesPlayed, "text-fog"],
    ["KEYS TYPED", p.totalKeysTyped.toLocaleString(), "text-fog"],
    ["BEST WPM", p.bestWpm, "text-lime-neon"],
    ["BEST ACCURACY", p.bestAccuracy ? p.bestAccuracy.toFixed(1) + "%" : "—", "text-lime-neon"],
    ["BEST COMBO", p.bestCombo, "text-flare"],
    ["TOP SCORE", p.bestScore.toLocaleString(), "text-gold"],
    ["SONGS CLEARED", p.songsCompleted, "text-volt"],
    ["PRACTICE TIME", `${Math.floor(p.totalPlaySec / 60)}m ${p.totalPlaySec % 60}s`, "text-volt"],
  ];
  const strengths = fingerStrength(store);
  const masteryKeys = Object.values(FINGER_ZONES).flatMap((z) => z.keys).filter((k) => k.length === 1 && /[a-z0-9;,./]/.test(k));

  return (
    <div className="relative h-screen overflow-y-auto">
      <BackgroundFX hue={150} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center gap-4">
          <button onClick={() => { audio.playUi(); onBack(); }} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Back">
            <Icon name="back" size={16} />
          </button>
          <div>
            <h1 className="font-display text-2xl tracking-wider text-fog text-glow-volt">PROGRESS & ANALYSIS</h1>
            <p className="font-mono text-[11px] text-dim">
              Level {lp.level} {levelTitle(lp.level)} · {p.xp.toLocaleString()} XP
            </p>
          </div>
          <div className="flex-1" />
          <div className="rounded-xl border border-gold/50 bg-gold/8 px-4 py-2 text-right">
            <div className="font-mono text-[8px] tracking-[0.25em] text-gold/70">SKILL TIER</div>
            <div className="font-display text-[13px] tracking-wider text-gold">{tier.name.toUpperCase()}</div>
          </div>
        </div>

        {/* journey + comfort speed */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-volt">
              <Icon name="keys" size={14} /> TYPING JOURNEY
              <span className="ml-auto font-mono text-[10px] tracking-normal text-faint">{masteredCount}/{LESSONS.length} mastered</span>
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {LESSONS.map((l) => {
                const prog = store.lessons[l.id];
                const mastered = prog?.mastered ?? false;
                const done = prog?.done ?? false;
                return (
                  <div key={l.id} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${mastered ? "bg-gold/5" : "bg-ink-900/40"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[9px] font-bold ${
                      mastered ? "border-gold text-gold" : done ? "border-volt text-volt" : "border-ink-500 text-faint"
                    }`}>
                      {mastered ? "✓" : done ? "◉" : "○"}
                    </span>
                    <span className={`font-display text-[10px] tracking-wider ${mastered ? "text-gold" : done ? "text-volt" : "text-dim"}`}>
                      {l.title.toUpperCase()}
                    </span>
                    {prog && <span className="ml-auto font-mono text-[9px] text-faint">{prog.bestAcc.toFixed(0)}%</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="panel rounded-2xl p-5">
              <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-gold">
                <Icon name="wave" size={14} /> COMFORT SPEED
              </h2>
              {comfort ? (
                <>
                  <div className="mt-2 font-display text-4xl text-gold text-glow-gold">×{comfort.speed.toFixed(2)}</div>
                  <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-dim">
                    at this speed: <span className="text-lime-neon">{comfort.wpm} WPM</span> ·{" "}
                    <span className="text-volt">{comfort.acc.toFixed(1)}%</span> acc
                  </p>
                </>
              ) : (
                <p className="mt-3 font-mono text-[10px] text-faint">play a few sessions and your optimal speed will appear here</p>
              )}
            </div>
            <div className="panel rounded-2xl p-5">
              <h2 className="font-display text-xs tracking-[0.25em] text-dim">SKILL LADDER</h2>
              <div className="mt-2.5 flex flex-col gap-1">
                {["Keyboard Explorer", "Home Row Beginner", "Finger Learner", "Novice Typist", "Comfortable Typist", "Touch Typist", "Fast Typist", "Advanced Typist", "Expert Rhythm Typist", "Typing Master"].map((t, i) => (
                  <div key={t} className={`flex items-center gap-2 font-mono text-[10px] ${i === tier.index ? "text-gold" : i < tier.index ? "text-volt" : "text-faint"}`}>
                    <span>{i < tier.index ? "✓" : i === tier.index ? "▶" : "·"}</span>
                    <span className={i === tier.index ? "font-bold" : ""}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* totals */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {totals.map(([l, v, c], i) => (
            <div key={l} className="panel rise-in rounded-xl p-3.5 text-center" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="font-mono text-[8px] tracking-[0.2em] text-faint">{l}</div>
              <div className={`mt-1 font-display text-lg ${c}`}>{v}</div>
            </div>
          ))}
        </div>

        {/* key mastery + finger strength */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-volt">
              <Icon name="keys" size={14} /> KEY MASTERY
              <span className="ml-auto font-mono text-[10px] tracking-normal text-faint">accuracy × repetitions</span>
            </h2>
            <div className="mt-4 grid grid-cols-8 gap-1.5 sm:grid-cols-12">
              {masteryKeys.map((k) => {
                const m = keyMastery(store, k).mastery;
                const c = fingerColor(k) ?? "#2a3866";
                return (
                  <div key={k} className="flex flex-col items-center gap-1 rounded-lg border border-ink-600/60 bg-ink-900/50 px-0.5 py-1.5">
                    <span className="font-mono text-[11px] font-bold" style={{ color: m >= 75 ? c : m > 0 ? "#93a1c7" : "#3d4c7a" }}>
                      {k === " " ? "␣" : k.toUpperCase()}
                    </span>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-ink-700">
                      <div className="h-full rounded-full" style={{ width: m + "%", background: m >= 75 ? "#a8ff3e" : m >= 40 ? "#ffc94d" : "#ff4d6d" }} />
                    </div>
                    <span className="font-mono text-[7px] text-faint">{m > 0 ? m + "%" : "·"}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 font-mono text-[10px] text-faint">75%+ counts as mastered · the smart drill targets everything below</p>
          </div>

          <div className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-flare">
              <Icon name="target" size={14} /> FINGER STRENGTH
            </h2>
            <div className="mt-4 space-y-2.5">
              {strengths.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <span className="w-24 shrink-0 font-mono text-[9px] tracking-wider" style={{ color: f.color }}>{f.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: f.strength + "%", background: f.color, boxShadow: `0 0 8px ${f.color}66` }} />
                  </div>
                  <span className="w-9 text-right font-mono text-[10px] text-dim tabular-nums">{f.strength}%</span>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-faint">
              weakest finger: <span className="text-flare">{[...strengths].filter((f) => f.strength > 0).sort((a, b) => a.strength - b.strength)[0]?.label ?? "—"}</span>
              {" · "}strongest: <span className="text-lime-neon">{[...strengths].sort((a, b) => b.strength - a.strength)[0]?.label ?? "—"}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* wpm history */}
          <div className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-volt">
              <Icon name="chart" size={14} /> WPM — LAST {store.wpmHistory.length || 0} SESSIONS
            </h2>
            {spark ? (
              <svg viewBox="0 0 100 42" className="mt-4 h-32 w-full" preserveAspectRatio="none">
                <polyline points={spark} fill="none" stroke="#00e5ff" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
                <polygon points={`0,42 ${spark} 100,42`} fill="url(#wg)" opacity="0.35" />
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            ) : (
              <p className="mt-6 text-center font-mono text-[11px] text-faint">play a few sessions to see your speed curve</p>
            )}
            <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
              <span>avg {store.wpmHistory.length ? Math.round(store.wpmHistory.reduce((a, b) => a + b, 0) / store.wpmHistory.length) : 0} wpm</span>
              <span>peak {store.wpmHistory.length ? Math.max(...store.wpmHistory) : 0} wpm</span>
            </div>
          </div>

          {/* weak keys with per-key accuracy */}
          <div className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-flare">
              <Icon name="target" size={14} /> YOUR WEAK KEYS
            </h2>
            {weak.length ? (
              <div className="mt-4 space-y-2.5">
                {weak.map(([k, v]) => {
                  const acc = keyAcc.find((x) => x.key === k)?.acc;
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <span className="keycap w-9 !text-sm" style={{ borderColor: (fingerColor(k) ?? "#2a3866") + "88", color: fingerColor(k) ?? undefined }}>
                        {k === " " ? "␣" : k.toUpperCase()}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-flare to-gold"
                          style={{ width: `${(v / maxWeak) * 100}%`, boxShadow: "0 0 8px rgba(255,61,126,0.5)" }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono text-[10px] text-dim tabular-nums">
                        {acc !== undefined ? `${acc.toFixed(0)}% acc` : `${v} miss`}
                      </span>
                    </div>
                  );
                })}
                <p className="pt-2 text-[11px] leading-relaxed text-faint">
                  The Learn screen turns these into a personal drill — or slow Practice mode works too.
                </p>
              </div>
            ) : (
              <p className="mt-6 text-center font-mono text-[11px] text-faint">no mistakes recorded yet — suspiciously clean</p>
            )}
          </div>
        </div>

        {/* achievements */}
        <div className="panel mt-4 rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-gold">
            <Icon name="trophy" size={14} /> ACHIEVEMENTS
            <span className="ml-auto font-mono text-[10px] tracking-normal text-faint">{unlockedCount}/{ACHIEVEMENTS.length}</span>
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENTS.map((a) => {
              const got = !!store.achievements[a.id];
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all ${
                    got
                      ? "border-gold/40 bg-gold/5"
                      : "border-ink-600 bg-ink-900/50 opacity-55"
                  }`}
                >
                  <span className={got ? "text-gold" : "text-faint"}>
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate font-display text-[11px] tracking-wider ${got ? "text-gold" : "text-dim"}`}>{a.name.toUpperCase()}</span>
                    <span className="block truncate font-mono text-[10px] text-faint">{a.desc}</span>
                  </span>
                  {got && <span className="ml-auto text-gold">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
