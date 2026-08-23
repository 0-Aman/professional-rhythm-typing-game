import { useMemo } from "react";
import { BackgroundFX, Icon } from "../components/ui";
import { LESSONS, SECTIONS, isUnlocked, lockReason } from "../game/lessons";
import { fingerColor } from "../game/fingers";
import {
  comfortSpeed, dailyPlan, keyAccuracyList, loadStore, skillTier, todayStr,
} from "../store";
import { ChallengeKind } from "./MiniGames";
import { audio } from "../audio/audio";

export function LearnScreen({
  onBack,
  onLesson,
  onMiniGame,
  onChallenge,
  onKeyMap,
}: {
  onBack: () => void;
  onLesson: (id: string) => void;
  onMiniGame: (kind: "find" | "finger") => void;
  onChallenge: (kind: ChallengeKind) => void;
  onKeyMap: () => void;
}) {
  const store = loadStore();
  const tier = skillTier(store);
  const comfort = comfortSpeed(store);
  const weak = useMemo(() => keyAccuracyList(store).filter((k) => k.acc < 90).slice(0, 4), [store]);

  const recent = store.recentRuns.slice(-5);
  const curWpm = recent.length ? Math.round(recent.reduce((a, b) => a + b.wpm, 0) / recent.length) : 0;
  const curAcc = recent.length ? recent.reduce((a, b) => a + b.acc, 0) / recent.length : 0;

  const recommended = LESSONS.find((l) => isUnlocked(l, store.lessons) && !(store.lessons[l.id]?.mastered ?? false))?.id;
  const plan = dailyPlan(store);
  const log = store.dailyLog.date === todayStr() ? store.dailyLog : { date: todayStr(), done: [], claimed: false };
  const masteredCount = Object.values(store.lessons).filter((l) => l.mastered).length;

  return (
    <div className="relative h-screen overflow-y-auto">
      <BackgroundFX hue={160} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={() => { audio.playUi(); onBack(); }} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Back">
            <Icon name="back" size={16} />
          </button>
          <div>
            <h1 className="font-display text-2xl tracking-wider text-fog text-glow-volt">LEARN TO TYPE</h1>
            <p className="font-mono text-[11px] text-dim">the whole keyboard, taught as finger movements · {masteredCount}/{LESSONS.length} lessons mastered</p>
          </div>
          <div className="flex-1" />
          <span className="rounded-full border border-volt/50 bg-volt/10 px-3.5 py-1.5 font-display text-[10px] tracking-[0.2em] text-volt">
            {tier.name.toUpperCase()}
          </span>
        </div>

        {/* snapshot */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["CURRENT WPM", curWpm || "—", "text-lime-neon"],
            ["BEST WPM", store.profile.bestWpm || "—", "text-lime-neon"],
            ["AVG ACCURACY", curAcc ? curAcc.toFixed(1) + "%" : "—", "text-volt"],
            ["COMFORT SPEED", comfort ? comfort.speed.toFixed(2) + "x" : "—", "text-gold"],
          ].map(([l, v, c], i) => (
            <div key={l as string} className="panel rise-in rounded-xl p-3.5 text-center" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="font-mono text-[8px] tracking-[0.22em] text-faint">{l}</div>
              <div className={`mt-1 font-display text-xl ${c}`}>{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_310px]">
          {/* ============ skill tree ============ */}
          <div className="flex flex-col gap-5">
            {SECTIONS.map((sec, si) => {
              const lessons = LESSONS.filter((l) => l.section === sec.id);
              return (
                <div key={sec.id} className="panel rise-in rounded-2xl p-5" style={{ animationDelay: `${si * 0.07}s` }}>
                  <div className="flex items-baseline gap-3">
                    <h2 className="font-display text-[13px] tracking-[0.3em] text-volt">{sec.label}</h2>
                    <span className="font-mono text-[10px] text-faint">{sec.blurb}</span>
                    <span className="ml-auto font-mono text-[10px] text-faint">
                      {lessons.filter((l) => store.lessons[l.id]?.mastered).length}/{lessons.length}
                    </span>
                  </div>

                  <div className="relative mt-4 flex flex-col gap-1.5 pl-4">
                    <div className="absolute bottom-3 left-[7px] top-3 w-px bg-ink-600" />
                    {lessons.map((l) => {
                      const prog = store.lessons[l.id];
                      const mastered = prog?.mastered ?? false;
                      const done = prog?.done ?? false;
                      const unlocked = isUnlocked(l, store.lessons);
                      const isRec = l.id === recommended;
                      const segTags = l.kind === "rhythm"
                        ? ["RHYTHM"]
                        : [...new Set(l.stages.map((s) => s.type === "find" ? "FIND" : s.type === "finger" ? "FINGER" : s.highlight === false ? "MEMORY" : s.movement ? "MOVE" : "DRILL"))];
                      return (
                        <div key={l.id} className="relative">
                          <span
                            className={`absolute -left-4 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 ${
                              mastered ? "border-gold bg-gold/40" : done ? "border-volt bg-volt/30" : unlocked ? "border-ink-500 bg-ink-800" : "border-ink-600 bg-ink-900"
                            }`}
                          />
                          <button
                            disabled={!unlocked}
                            onClick={() => { audio.ensure(); audio.playUi(); onLesson(l.id); }}
                            className={`flex w-full items-center gap-3.5 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                              !unlocked
                                ? "cursor-not-allowed border-transparent opacity-45"
                                : isRec
                                  ? "border-volt/60 bg-volt/8 shadow-[0_0_22px_rgba(0,229,255,0.12)] hover:translate-x-1"
                                  : "border-transparent hover:translate-x-1 hover:border-ink-500 hover:bg-ink-800/60"
                            }`}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-[12px] ${
                              mastered ? "border border-gold/50 bg-gold/15 text-gold" : done ? "border border-volt/50 bg-volt/15 text-volt" : "border border-ink-600 bg-ink-800 text-faint"
                            }`}>
                              {mastered ? "✓" : l.num}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className={`font-display text-[12px] tracking-wider ${mastered ? "text-gold" : done ? "text-volt" : "text-fog"}`}>
                                  {l.title.toUpperCase()}
                                </span>
                                {segTags.map((t) => (
                                  <span key={t} className="rounded border border-ink-500 px-1 font-mono text-[8px] tracking-wider text-faint">{t}</span>
                                ))}
                                {l.checkpoint && <span className="rounded border border-gold/40 px-1 font-mono text-[8px] tracking-wider text-gold/80">CHECKPOINT</span>}
                                {isRec && (
                                  <span className="rounded border border-volt/60 bg-volt/15 px-1.5 font-mono text-[8px] font-bold tracking-wider text-volt" style={{ animation: "beat-pulse 1.2s ease-in-out infinite" }}>
                                    START HERE
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-faint">
                                {unlocked ? l.desc : `🔒 ${lockReason(l)}`}
                              </span>
                              {l.newKeys.length > 0 && (
                                <span className="mt-1 flex items-center gap-1">
                                  <span className="font-mono text-[8px] text-faint">TEACHES</span>
                                  {l.newKeys.slice(0, 8).map((k) => (
                                    <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: fingerColor(k) ?? "#2a3866" }} />
                                  ))}
                                  {l.newKeys.length > 8 && <span className="font-mono text-[8px] text-faint">+{l.newKeys.length - 8}</span>}
                                  <span className="ml-auto font-mono text-[9px] text-faint">cap {l.maxSpeed.toFixed(2)}x</span>
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-mono text-[9px] text-faint">
                              {mastered ? `best ${prog!.bestAcc.toFixed(0)}%` : done ? "retry" : unlocked ? "→" : ""}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============ side ============ */}
          <div className="flex flex-col gap-4">
            {/* daily training */}
            <div className="panel rise-in rounded-2xl p-5" style={{ animationDelay: "0.08s" }}>
              <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-gold">
                <Icon name="calendar" size={14} /> TODAY'S TRAINING
              </h2>
              <div className="mt-3 flex flex-col gap-1.5">
                {plan.items.map((it) => {
                  const done = log.done.includes(it.id);
                  return (
                    <button
                      key={it.id}
                      onClick={() => { audio.ensure(); audio.playUi(); onLesson(it.target); }}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all hover:translate-x-0.5 ${
                        done ? "border-lime-neon/40 bg-lime-neon/5" : "border-ink-600 bg-ink-900/60 hover:border-volt/50"
                      }`}
                    >
                      <span className={`flex h-4.5 w-4.5 h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${
                        done ? "border-lime-neon text-lime-neon" : "border-ink-500 text-faint"
                      }`}>{done ? "✓" : ""}</span>
                      <span className="flex-1">
                        <span className={`block font-display text-[10px] tracking-wider ${done ? "text-lime-neon" : "text-fog"}`}>{it.label.toUpperCase()}</span>
                        <span className="block font-mono text-[9px] text-faint">{it.minutes} min</span>
                      </span>
                      {!done && <span className="font-mono text-[9px] text-volt">GO →</span>}
                    </button>
                  );
                })}
              </div>
              <div className={`mt-2.5 rounded-lg px-3 py-2 text-center font-mono text-[10px] ${
                log.claimed ? "border border-gold/50 bg-gold/10 text-gold" : "bg-ink-900/60 text-faint"
              }`}>
                {log.claimed ? "TRAINING COMPLETE · +300 XP BANKED" : "finish all three · +300 XP"}
              </div>
            </div>

            {/* keyboard map */}
            <button onClick={() => { audio.ensure(); audio.playUi(); onKeyMap(); }} className="panel rise-in group rounded-2xl p-5 text-left transition-all hover:border-volt/50" style={{ animationDelay: "0.14s" }}>
              <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-volt">
                <Icon name="keys" size={14} /> KEYBOARD MAP
              </h2>
              <p className="mt-2 text-[11px] leading-relaxed text-dim">
                Every key's finger, home position and movement — plus a <span className="text-fog">free-explore mode</span>. Press any key, learn its story.
              </p>
              <span className="mt-2 inline-block font-mono text-[10px] text-volt group-hover:translate-x-1 transition-transform">OPEN MAP →</span>
            </button>

            {/* mini-games */}
            <div className="panel rise-in rounded-2xl p-5" style={{ animationDelay: "0.2s" }}>
              <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-flare">
                <Icon name="target" size={14} /> MINI-GAMES
              </h2>
              <button onClick={() => { audio.ensure(); audio.playUi(); onMiniGame("find"); }} className="btn-ghost mt-3 w-full rounded-xl px-4 py-3 text-left">
                <span className="block font-display text-[12px] tracking-wider text-fog">FIND THE KEY</span>
                <span className="block text-[11px] text-faint">keyboard geography under light pressure</span>
              </button>
              <button onClick={() => { audio.ensure(); audio.playUi(); onMiniGame("finger"); }} className="btn-ghost mt-2 w-full rounded-xl px-4 py-3 text-left">
                <span className="block font-display text-[12px] tracking-wider text-fog">WHICH FINGER?</span>
                <span className="block text-[11px] text-faint">build the finger → key map in your head</span>
              </button>
            </div>

            {/* challenges */}
            <div className="panel rise-in rounded-2xl p-5" style={{ animationDelay: "0.17s" }}>
              <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-gold">
                <Icon name="trophy" size={14} /> CHALLENGES
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  ["perfect", "gem", "PERFECT RUN", "15 clean keys in a row"],
                  ["sprint", "bolt", "SPRINT", "10 seconds, max hits"],
                  ["memory", "keys", "MEMORY FLASH", "recall three sequences"],
                  ["movement", "target", "MOVE REPS", "train your weakest finger"],
                ] as [ChallengeKind, string, string, string][]).map(([kind, icon, label, sub]) => {
                  const best = store.challengeBests[kind];
                  return (
                    <button
                      key={kind}
                      onClick={() => { audio.ensure(); audio.playUi(); onChallenge(kind); }}
                      className="group rounded-xl border border-ink-600 bg-ink-900/60 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_0_18px_rgba(255,201,77,0.12)]"
                    >
                      <span className="flex items-center gap-1.5 font-display text-[10px] tracking-wider text-fog">
                        <Icon name={icon} size={12} className="text-gold" /> {label}
                      </span>
                      <span className="mt-0.5 block text-[9px] leading-snug text-faint">{sub}</span>
                      <span className="mt-1 block font-mono text-[9px] text-gold/80">
                        {best !== undefined
                          ? (kind === "movement" ? `best ${best}%` : kind === "perfect" ? `best ${best} keys` : `best ${best}`)
                          : "unranked"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* smart drill */}
            {weak.length > 0 && (
              <div className="panel rise-in rounded-2xl p-5" style={{ animationDelay: "0.26s" }}>
                <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-gold">
                  <Icon name="bolt" size={14} /> SMART DRILL
                </h2>
                <p className="mt-2 text-[11px] leading-relaxed text-dim">
                  Missing{" "}
                  {weak.map((w) => (
                    <span key={w.key} className="keycap mx-0.5" style={{ borderColor: (fingerColor(w.key) ?? "#2a3866") + "88", color: fingerColor(w.key) ?? undefined }}>
                      {w.key.toUpperCase()}
                    </span>
                  ))}{" "}
                  — the drill builds move-and-return patterns around them, then real words.
                </p>
                <button onClick={() => { audio.ensure(); audio.playUi(); onLesson("drill"); }} className="btn-primary mt-3 w-full rounded-xl py-2.5 text-xs">
                  START PERSONAL DRILL
                </button>
              </div>
            )}

            {comfort && (
              <div className="panel rise-in rounded-2xl p-5" style={{ animationDelay: "0.3s" }}>
                <h2 className="font-display text-xs tracking-[0.25em] text-dim">COMFORT SPEED</h2>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-faint">
                  <span className="text-gold">×{comfort.speed.toFixed(2)}</span> — {comfort.wpm} WPM at {comfort.acc.toFixed(1)}%.
                  Chase accuracy there before chasing speed anywhere.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
