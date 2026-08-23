import { useEffect, useMemo, useRef, useState } from "react";
import { RhythmEngine, Bridge, GameResult, Mode, HudRefs } from "../game/engine";
import { generateChart, createStream, chartFromText, getSong, MUSIC } from "../game/songs";
import { Difficulty, DIFF_LABEL, DIFF_COLOR } from "../game/content";
import { audio } from "../audio/audio";
import { loadStore } from "../store";
import { Keyboard, KbApi } from "../components/Keyboard";
import { HandGuide } from "../components/HandGuide";
import { Icon } from "../components/ui";

export interface GameConfig {
  mode: Mode;
  songId: string;
  difficulty: Difficulty;
  speedMult: number; // music tempo multiplier (practice)
  timeLimit: number;
  customText?: string;
  noteSpeed?: number; // visual note travel speed override (independent of BPM)
}

interface Toast {
  id: number;
  text: string;
  tier: number;
}

export function GameScreen({
  config,
  onFinish,
  onQuit,
}: {
  config: GameConfig;
  onFinish: (
    r: GameResult,
    stats: { attempts: Record<string, number>; mistakes: Record<string, number> },
    noteSpeedUsed: number,
  ) => void;
  onQuit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kbApi = useRef<KbApi | null>(null);
  const [paused, setPaused] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [runId, setRunId] = useState(0);
  const [musicSpeed, setMusicSpeed] = useState(config.speedMult);
  const toastId = useRef(0);

  const hudEls = useRef<HudRefs>({
    score: null, wpm: null, acc: null, combo: null, mult: null, progress: null, time: null, health: null,
  });

  const engineRef = useRef<RhythmEngine | null>(null);
  const [guideKey, setGuideKey] = useState<string | null>(null);
  const [flowOn, setFlowOn] = useState(false);
  const [coachMsg, setCoachMsg] = useState<string | null>(null);
  const coachTimer = useRef<number>(0);
  const bridgeRef = useRef<Bridge | null>(null);
  if (!bridgeRef.current) {
    bridgeRef.current = {
      glow: (ch) => {
        kbApi.current?.glow(ch);
        setGuideKey(ch);
      },
      flow: (on) => setFlowOn(on),
      coach: (msg) => {
        setCoachMsg(msg);
        window.clearTimeout(coachTimer.current);
        coachTimer.current = window.setTimeout(() => setCoachMsg(null), 3400);
      },
      key: (ch, kind) => kbApi.current?.key(ch, kind),
      note: (text, typed, kind) => kbApi.current?.note(text, typed, kind),
      combo: (combo, mult) => {
        const el = hudEls.current.combo;
        const multEl = hudEls.current.mult;
        if (el) {
          el.textContent = combo > 0 ? String(combo) : "–";
          const col = combo >= 100 ? "text-gold" : combo >= 50 ? "text-flare" : combo >= 10 ? "text-volt" : "text-fog";
          el.className = `font-display leading-none combo-pop ${combo > 0 ? col : "text-faint"} text-4xl xl:text-5xl`;
          el.style.color = combo >= 100 ? "#ffc94d" : combo >= 50 ? "#ff3d7e" : combo >= 10 ? "#00e5ff" : "#5d6c99";
        }
        if (multEl) multEl.textContent = mult + "x";
      },
      milestone: (text, tier) => {
        const id = ++toastId.current;
        setToasts((t) => [...t.slice(-1), { id, text, tier }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1500);
      },
    };
  }

  const settings = useMemo(() => loadStore().settings, [runId]);
  const song = getSong(config.songId);
  const isStream = config.mode === "endless" || config.mode === "time";

  // no timer may outlive the screen
  useEffect(() => () => window.clearTimeout(coachTimer.current), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    audio.ensure();

    let chart = null;
    let stream = null;
    let songId = config.songId;
    if (config.mode === "custom" && config.customText) {
      chart = chartFromText(config.customText);
      songId = "custom";
    } else if (isStream) {
      songId = config.songId;
      const bpm = MUSIC[songId]?.bpm ?? 128;
      stream = createStream(bpm, config.difficulty, Date.now() % 100000);
    } else {
      chart = generateChart(config.songId, config.difficulty);
    }

    const engine = new RhythmEngine(
      canvas,
      {
        mode: config.mode,
        songId,
        difficulty: config.difficulty,
        speedMult: musicSpeed,
        timeLimit: config.timeLimit,
        chart,
        stream,
        music: songId,
      },
      {
        noteSpeed: config.noteSpeed ?? settings.noteSpeed,
        timingOffset: settings.timingOffset,
        keyProfile: settings.keyProfile,
        particles: settings.particles,
        quality: settings.quality,
        screenShake: settings.screenShake,
        bgEffects: settings.bgEffects,
        reducedMotion: settings.reducedMotion,
        colorBlind: settings.colorBlind,
        skillBias: settings.adaptive ? loadStore().skillBias : 0,
        highlightKeys: settings.highlightRequiredKey,
        showNextKey: settings.showNextKey,
      },
      hudEls.current,
      bridgeRef.current!,
      (result) => onFinish(result, engine.getStats(), config.noteSpeed ?? settings.noteSpeed),
      (p) => setPaused(p),
    );
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
      kbApi.current?.glow(null);
      kbApi.current?.note(null, 0, "letter");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const restart = (speed?: number) => {
    if (speed !== undefined) setMusicSpeed(speed);
    setPaused(false);
    setRunId((r) => r + 1);
  };

  const modeLabel =
    config.mode === "song" ? "SONG" :
    config.mode === "practice" ? `PRACTICE ×${config.speedMult.toFixed(2).replace(/0+$/, "")}` :
    config.mode === "endless" ? "ENDLESS" :
    config.mode === "time" ? "TIME ATTACK" : "CUSTOM";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-ink-950">
      {/* ---------- top HUD ---------- */}
      <div className="relative z-20 flex items-center gap-4 px-4 pt-3 xl:px-6">
        <button
          onClick={() => engineRef.current?.setPaused(true)}
          className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg"
          aria-label="Pause"
        >
          <Icon name="pause" size={16} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm tracking-wider text-fog truncate">
              {config.mode === "custom" ? "CUSTOM TEXT" : song.title.toUpperCase()}
            </span>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
              style={{ color: DIFF_COLOR[config.difficulty], background: DIFF_COLOR[config.difficulty] + "1f", border: `1px solid ${DIFF_COLOR[config.difficulty]}55` }}
            >
              {DIFF_LABEL[config.difficulty]}
            </span>
            <span className="hidden font-mono text-[10px] tracking-widest text-faint sm:block">{modeLabel}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-[5px] w-40 overflow-hidden rounded-full bg-ink-700 xl:w-64">
              <div ref={(el) => { hudEls.current.progress = el; }} className="h-full w-0 rounded-full bg-volt shadow-[0_0_8px_rgba(0,229,255,0.8)] transition-none" />
            </div>
            <span ref={(el) => { hudEls.current.time = el; }} className="font-mono text-[11px] font-bold text-dim tabular-nums">0:00</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* combo + flow */}
        <div className="flex flex-col items-center">
          <span className="font-mono text-[9px] tracking-[0.3em] text-faint">COMBO</span>
          <div className="flex items-baseline gap-1.5">
            <span ref={(el) => { hudEls.current.combo = el; }} className="font-display text-4xl leading-none text-faint xl:text-5xl">–</span>
            <span ref={(el) => { hudEls.current.mult = el; }} className="font-mono text-sm font-bold text-gold">1x</span>
          </div>
          {flowOn && (
            <span
              className="mt-0.5 rounded-full border border-gold/60 bg-gold/15 px-2.5 font-display text-[10px] tracking-[0.25em] text-gold"
              style={{ animation: "beat-pulse 0.6s ease-in-out infinite", textShadow: "0 0 12px rgba(255,201,77,0.8)" }}
            >
              FLOW ×2
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* score + stats */}
        <div className="flex items-center gap-3 xl:gap-5">
          {config.mode === "endless" && (
            <div className="hidden w-28 sm:block">
              <span className="font-mono text-[9px] tracking-[0.25em] text-faint">ENERGY</span>
              <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-ink-700">
                <div ref={(el) => { hudEls.current.health = el; }} className="h-full w-full rounded-full bg-gradient-to-r from-flare to-gold" />
              </div>
            </div>
          )}
          {settings.showWpm && (
            <div className="hud-chip rounded-lg px-3 py-1.5 text-right">
              <div className="font-mono text-[9px] tracking-[0.25em] text-faint">WPM</div>
              <div ref={(el) => { hudEls.current.wpm = el; }} className="font-display text-xl leading-tight text-lime-neon tabular-nums">0</div>
            </div>
          )}
          {settings.showAcc && (
            <div className="hud-chip rounded-lg px-3 py-1.5 text-right">
              <div className="font-mono text-[9px] tracking-[0.25em] text-faint">ACC</div>
              <div ref={(el) => { hudEls.current.acc = el; }} className="font-display text-xl leading-tight text-volt tabular-nums">100%</div>
            </div>
          )}
          <div className="rounded-lg border border-gold/40 bg-gold/5 px-4 py-1.5 text-right shadow-[0_0_24px_rgba(255,201,77,0.12)]">
            <div className="font-mono text-[9px] tracking-[0.25em] text-gold/70">SCORE</div>
            <div ref={(el) => { hudEls.current.score = el; }} className="font-display text-2xl leading-tight text-gold text-glow-gold tabular-nums">0</div>
          </div>
        </div>
      </div>

      {/* ---------- play field ---------- */}
      <div className="relative flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* coaching nudge — quiet, educational, gone in a few seconds */}
        {coachMsg && (
          <div
            key={coachMsg}
            className="rise-in pointer-events-none absolute right-4 top-4 z-10 max-w-[260px] rounded-xl border border-gold/50 bg-ink-900/90 px-4 py-2.5 font-mono text-[10px] leading-relaxed tracking-wider text-gold shadow-[0_0_20px_rgba(255,201,77,0.12)]"
          >
            {coachMsg}
          </div>
        )}

        {/* milestone toasts */}
        <div className="pointer-events-none absolute inset-x-0 top-[16%] z-10 flex flex-col items-center gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`milestone-blast font-display tracking-wider ${
                t.tier >= 4 ? "text-4xl text-gold text-glow-gold" : t.tier === 3 ? "text-3xl text-flare text-glow-flare" : "text-2xl text-volt text-glow-volt"
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>

        {config.mode === "practice" && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-ink-500 bg-ink-900/80 px-4 py-1 font-mono text-[11px] text-dim">
            practice — <span className="keycap !h-5">ESC</span> pause &amp; restart anytime
          </div>
        )}
      </div>

      {/* ---------- keyboard (+ hand guide for beginner tracks) ---------- */}
      {settings.showKeyboard && (
        <div className="relative z-20 flex items-end justify-center gap-5 px-4 pb-4">
          {(config.difficulty === "beginner" || config.difficulty === "novice") && settings.showHandPosition && (
            <div className="panel hidden shrink-0 rounded-xl p-3 lg:block">
              <HandGuide active={guideKey} compact />
            </div>
          )}
          <div className="min-w-0 max-w-[880px] flex-1">
            <Keyboard api={kbApi} showFingers={settings.showFingerGuide} />
          </div>
        </div>
      )}

      {/* ---------- pause overlay ---------- */}
      {paused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/85 backdrop-blur-sm">
          <div className="panel rise-in w-[340px] rounded-2xl p-7 text-center">
            <div className="font-display text-2xl tracking-widest text-fog text-glow-volt">PAUSED</div>
            <p className="mt-2 font-mono text-[11px] text-dim">
              {config.mode === "custom" ? "custom text" : song.title} · {DIFF_LABEL[config.difficulty]}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button className="btn-primary rounded-xl py-3 text-sm" onClick={() => engineRef.current?.setPaused(false)}>
                RESUME
              </button>
              <button className="btn-ghost rounded-xl py-3 text-xs" onClick={() => restart()}>
                RESTART
              </button>
              {config.mode === "practice" && (
                <div>
                  <div className="mb-1.5 font-mono text-[9px] tracking-[0.3em] text-faint">RESTART AT MUSIC SPEED</div>
                  <div className="flex gap-1.5">
                    {[0.5, 0.75, 1, 1.25].map((s) => (
                      <button
                        key={s}
                        onClick={() => restart(s)}
                        className={`btn-ghost flex-1 rounded-lg py-2 !text-[10px] ${musicSpeed === s ? "!border-volt !text-volt" : ""}`}
                      >
                        ×{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button className="btn-ghost rounded-xl py-3 text-xs !text-dim" onClick={onQuit}>
                QUIT TO MENU
              </button>
            </div>
            <p className="mt-5 font-mono text-[10px] text-faint">
              <span className="keycap">ESC</span> to resume
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
