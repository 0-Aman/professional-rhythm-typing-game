import { useEffect, useState } from "react";
import { BackgroundFX, Icon, Kbd, Logo } from "../components/ui";
import { getDaily, levelProgress, loadStore, skillTier, todayStr } from "../store";
import { getSong } from "../game/songs";
import { DIFF_COLOR, DIFF_LABEL, levelTitle } from "../game/content";
import { audio } from "../audio/audio";

interface MenuProps {
  onLearn: () => void;
  onQuickPlay: () => void;
  onSongs: (practice: boolean) => void;
  onTimeAttack: (sec: number) => void;
  onEndless: () => void;
  onCustom: (text: string) => void;
  onDaily: () => void;
  onStats: () => void;
  onSettings: () => void;
}

export function MainMenu(p: MenuProps) {
  const store = loadStore();
  const lp = levelProgress(store.profile.xp);
  const tier = skillTier(store);
  const daily = getDaily();
  const dailyDone = store.daily.date === daily.date && store.daily.completed;
  const dailySong = getSong(daily.songId);
  const [expanded, setExpanded] = useState<null | "play" | "custom">(null);
  const [customText, setCustomText] = useState("");

  const recent = store.recentRuns.slice(-5);
  const curWpm = recent.length ? Math.round(recent.reduce((a, b) => a + b.wpm, 0) / recent.length) : null;
  const curAcc = recent.length ? recent.reduce((a, b) => a + b.acc, 0) / recent.length : null;
  const isNew = !store.onboarded;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const map: Record<string, () => void> = {
        "1": p.onLearn,
        "2": () => setExpanded("play"),
        "3": () => p.onSongs(true),
        "4": () => p.onSongs(false),
        "5": p.onStats,
        "6": p.onSettings,
      };
      const fn = map[e.key];
      if (fn) {
        audio.ensure();
        audio.playUi();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]);

  const Item = (props: {
    k: string; icon: string; label: string; sub: string; onClick: () => void;
    primary?: boolean; badge?: string;
  }) => (
    <button
      onClick={() => { audio.ensure(); audio.playUi(); props.onClick(); }}
      className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all ${
        props.primary
          ? "border-volt/70 bg-volt/10 shadow-[0_0_28px_rgba(0,229,255,0.18)] hover:bg-volt/15"
          : "border-transparent hover:border-ink-500 hover:bg-ink-800/70 hover:shadow-[0_0_28px_rgba(0,229,255,0.08)]"
      }`}
    >
      <Kbd>{props.k}</Kbd>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
        props.primary
          ? "border-volt bg-volt/20 text-volt shadow-[0_0_14px_rgba(0,229,255,0.4)]"
          : "border-ink-500 bg-ink-800 text-dim group-hover:border-volt/60 group-hover:text-volt group-hover:shadow-[0_0_14px_rgba(0,229,255,0.35)]"
      }`}>
        <Icon name={props.icon} size={17} />
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2 font-display text-[13px] tracking-[0.12em] text-fog">
          {props.label}
          {props.badge && (
            <span className="rounded border border-gold/60 bg-gold/10 px-1.5 font-mono text-[8px] font-bold tracking-wider text-gold" style={{ animation: "beat-pulse 1.4s ease-in-out infinite" }}>
              {props.badge}
            </span>
          )}
        </span>
        <span className="block text-[11px] text-faint">{props.sub}</span>
      </span>
      <span className="text-faint transition-transform group-hover:translate-x-1 group-hover:text-volt">→</span>
    </button>
  );

  return (
    <div className="relative h-screen overflow-y-auto overflow-x-hidden">
      <BackgroundFX hue={190} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 mx-auto flex min-h-full max-w-6xl flex-col justify-center gap-8 px-6 py-8 lg:flex-row lg:items-center lg:gap-14">
        {/* left: logo + menu */}
        <div className="min-w-0 flex-1">
          <Logo />
          <p className="mt-4 font-mono text-[12px] text-dim">
            {isNew ? "What do you want to do? — we suggest starting with the basics." : "What do you want to do?"}
          </p>
          <div className="mt-5 flex max-w-xl flex-col gap-1">
            <Item
              k="1" icon="keys" label="LEARN TO TYPE"
              sub={isNew ? "Start here — zero knowledge required" : "15 lessons · finger guide · checkpoints"}
              onClick={p.onLearn}
              primary={isNew || tier.index < 4}
              badge={isNew ? "START HERE" : undefined}
            />

            <div className="relative">
              <Item k="2" icon="bolt" label="PLAY" sub="Quick play · time attack · endless · custom text · daily" onClick={() => setExpanded(expanded === "play" ? null : "play")} />
              {expanded === "play" && (
                <div className="panel rise-in absolute left-16 top-full z-30 mt-1 w-[300px] rounded-xl p-2.5">
                  {([
                    { label: "QUICK PLAY", sub: "random track, your settings", fn: p.onQuickPlay },
                    { label: "DAILY CHALLENGE", sub: dailyDone ? "done today — play again" : `${dailySong.title} · ${DIFF_LABEL[daily.difficulty]}`, fn: p.onDaily },
                    { label: "TIME ATTACK", sub: "30s sprint", fn: () => p.onTimeAttack(30) },
                    { label: "TIME ATTACK", sub: "60s standard", fn: () => p.onTimeAttack(60) },
                    { label: "TIME ATTACK", sub: "120s marathon", fn: () => p.onTimeAttack(120) },
                    { label: "ENDLESS", sub: "survive the ramp", fn: p.onEndless },
                  ] as { label: string; sub: string; fn: () => void }[]).map((it, i) => (
                    <button key={i} onClick={() => { audio.playUi(); it.fn(); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-all hover:bg-ink-700">
                      <span>
                        <span className="block font-display text-[11px] tracking-wider text-fog">{it.label}</span>
                        <span className="block text-[10px] text-faint">{it.sub}</span>
                      </span>
                      <span className="text-faint">→</span>
                    </button>
                  ))}
                  <div className="relative mt-1 border-t border-ink-600 pt-1">
                    <button onClick={() => setExpanded("custom")} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-all hover:bg-ink-700">
                      <span>
                        <span className="block font-display text-[11px] tracking-wider text-fog">CUSTOM TEXT</span>
                        <span className="block text-[10px] text-faint">type your own words</span>
                      </span>
                      <span className="text-faint">→</span>
                    </button>
                  </div>
                </div>
              )}
              {expanded === "custom" && (
                <div className="panel rise-in absolute left-16 top-full z-30 mt-1 w-[380px] rounded-xl p-3">
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    rows={3}
                    maxLength={400}
                    placeholder="Paste or type any sentence…"
                    className="w-full resize-none rounded-lg border border-ink-500 bg-ink-900 p-2.5 font-mono text-xs text-fog outline-none focus:border-volt/70"
                  />
                  <button
                    disabled={customText.trim().length < 3}
                    onClick={() => { audio.playUi(); p.onCustom(customText.trim()); }}
                    className="btn-primary mt-2 w-full rounded-lg py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    START TYPING
                  </button>
                </div>
              )}
            </div>

            <Item k="3" icon="wave" label="PRACTICE" sub="Songs at your speed — 50% to 150% tempo" onClick={() => p.onSongs(true)} />
            <Item k="4" icon="note" label="SONGS" sub="8 tracks from Beginner to Expert" onClick={() => p.onSongs(false)} />

            <div className="my-2 flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-600" />
              <span className="font-mono text-[9px] tracking-[0.4em] text-faint">SYSTEM</span>
              <div className="h-px flex-1 bg-ink-600" />
            </div>

            <Item k="5" icon="chart" label="PROGRESS" sub="Journey · weak keys · comfort speed · achievements" onClick={p.onStats} />
            <Item k="6" icon="gear" label="SETTINGS" sub="Speed presets · guidance · audio · calibration" onClick={p.onSettings} />
          </div>
        </div>

        {/* right: profile + daily */}
        <div className="w-full shrink-0 lg:w-[330px]">
          <div className="panel rise-in rounded-2xl p-5">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-volt/50 bg-ink-900 shadow-[0_0_24px_rgba(0,229,255,0.25)]">
                <span className="font-display text-2xl text-volt">{lp.level}</span>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-ink-700 px-1.5 font-mono text-[8px] font-bold tracking-wider text-dim">LVL</span>
              </div>
              <div className="min-w-0">
                <div className="font-display text-sm tracking-wider text-fog">{levelTitle(lp.level).toUpperCase()}</div>
                <div className="mt-0.5 font-mono text-[11px] text-gold">{tier.name}</div>
                <div className="font-mono text-[10px] text-dim">{store.profile.xp.toLocaleString()} XP</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-volt-deep to-volt shadow-[0_0_10px_rgba(0,229,255,0.7)] transition-all duration-700"
                style={{ width: lp.pct + "%" }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-ink-600 bg-ink-900/70 px-1 py-2">
                <div className="font-mono text-[8px] tracking-[0.18em] text-faint">WPM</div>
                <div className="mt-0.5 font-display text-lg text-lime-neon">{curWpm ?? store.profile.bestWpm}</div>
                <div className="font-mono text-[8px] text-faint">best {store.profile.bestWpm}</div>
              </div>
              <div className="rounded-lg border border-ink-600 bg-ink-900/70 px-1 py-2">
                <div className="font-mono text-[8px] tracking-[0.18em] text-faint">ACCURACY</div>
                <div className="mt-0.5 font-display text-lg text-volt">{curAcc !== null ? curAcc.toFixed(1) + "%" : "—"}</div>
                <div className="font-mono text-[8px] text-faint">recent runs</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-faint">
              <span>{store.profile.songsCompleted} songs cleared</span>
              <span>{Math.floor(store.profile.totalPlaySec / 60)} min practiced</span>
            </div>
          </div>

          {/* daily card */}
          <div className="panel rise-in mt-4 overflow-hidden rounded-2xl" style={{ animationDelay: "0.08s" }}>
            <div className="flex items-center justify-between border-b border-ink-600 px-5 py-3">
              <span className="flex items-center gap-2 font-display text-[11px] tracking-[0.2em] text-gold">
                <Icon name="calendar" size={14} /> DAILY CHALLENGE
              </span>
              <span className="font-mono text-[10px] text-faint">{todayStr()}</span>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm text-fog">{dailySong.title.toUpperCase()}</span>
                <span
                  className="rounded px-2 py-0.5 font-mono text-[10px] font-bold"
                  style={{ color: DIFF_COLOR[daily.difficulty], background: DIFF_COLOR[daily.difficulty] + "1f", border: `1px solid ${DIFF_COLOR[daily.difficulty]}55` }}
                >
                  {DIFF_LABEL[daily.difficulty]}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 font-mono text-[11px] text-dim">
                <div className="flex justify-between"><span>Goal</span><span className="text-fog">{daily.goalWpm} WPM</span></div>
                <div className="flex justify-between"><span>Accuracy</span><span className="text-fog">≥ {daily.goalAcc}%</span></div>
                <div className="flex justify-between"><span>Reward</span><span className="text-gold">+{daily.rewardXp} XP</span></div>
              </div>
              <button
                onClick={() => { audio.ensure(); audio.playUi(); p.onDaily(); }}
                className={`${dailyDone ? "btn-ghost" : "btn-primary"} mt-4 w-full rounded-xl py-2.5 text-xs`}
              >
                {dailyDone ? "PLAY AGAIN" : "TAKE THE CHALLENGE"}
              </button>
            </div>
          </div>

          <p className="mt-4 text-center font-mono text-[10px] leading-relaxed text-faint">
            press <span className="keycap">1</span>–<span className="keycap">6</span> to navigate ·
            a physical keyboard is required
          </p>
        </div>
      </div>
    </div>
  );
}
