import { useEffect, useMemo, useRef, useState } from "react";
import { BackgroundFX, Icon, Toggle } from "../components/ui";
import { Keyboard, KbApi } from "../components/Keyboard";
import { HandGuide } from "../components/HandGuide";
import { MovementViz } from "../components/MovementViz";
import { fingerColor, fingerLabel, KEY_FINGER } from "../game/fingers";
import {
  gainXp, keyAccuracyList, keyMastery, loadStore, masteredKeys,
  recordChallengeBest, fingerStrength,
} from "../store";
import { RhythmEngine, Bridge, HudRefs } from "../game/engine";
import { buildChartFromTokens } from "../game/lessons";
import { movementTokens, FINGER_ZONES } from "../game/keymap";
import { createStream } from "../game/songs";
import { audio } from "../audio/audio";

// ------------------------------------------------------------------
// FIND THE KEY — core (embeddable) + full-screen wrapper
// ------------------------------------------------------------------

export function FindCore({
  targets,
  hintDefault = true,
  strictDefault = false,
  showControls = true,
  onDone,
}: {
  targets: string[];
  hintDefault?: boolean;
  strictDefault?: boolean;
  showControls?: boolean;
  onDone: (accPct: number, misses: number) => void;
}) {
  const [hint, setHint] = useState(hintDefault);
  const [strict, setStrict] = useState(strictDefault);
  const [idx, setIdx] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(8);
  const [reveal, setReveal] = useState<string | null>(null);
  const doneRef = useRef(false);
  const kbApi = useRef<KbApi | null>(null);
  // an old round's timers must never touch a remounted game
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const ROUNDS = targets.length;
  const target = targets[Math.min(idx, ROUNDS - 1)];

  useEffect(() => {
    if (!strict || doneRef.current || reveal) return;
    setTimeLeft(8);
    const iv = setInterval(() => setTimeLeft((t) => Math.max(0, t - 0.1)), 100);
    return () => clearInterval(iv);
  }, [idx, strict, reveal]);

  useEffect(() => {
    if (strict && !doneRef.current && !reveal && timeLeft <= 0) miss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, strict, reveal, idx]);

  const advance = (missCount: number) => {
    if (idx + 1 >= ROUNDS) {
      doneRef.current = true;
      onDone(((ROUNDS - missCount) / ROUNDS) * 100, missCount);
    } else {
      setIdx((i) => i + 1);
    }
  };

  const miss = () => {
    const m = misses + 1;
    setMisses(m);
    setReveal(target);
    kbApi.current?.glow(target);
    audio.ensure();
    audio.playError();
    setTimeout(() => {
      if (!alive.current) return;
      setReveal(null);
      kbApi.current?.glow(null);
      advance(m);
    }, 900);
  };

  useEffect(() => {
    if (doneRef.current) return;
    const onKey = (e: KeyboardEvent) => {
      if (reveal || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k.length !== 1 && k !== ";") return;
      kbApi.current?.key(k, "down");
      setTimeout(() => kbApi.current?.key(k, "up"), 120);
      if (k === target) {
        kbApi.current?.key(k, "correct");
        audio.ensure();
        audio.playJudgment("great");
        setTimeout(() => {
          if (alive.current) advance(misses);
        }, 220);
      } else {
        miss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reveal, idx, misses]);

  useEffect(() => {
    if (hint && !reveal && !doneRef.current) kbApi.current?.glow(target);
    else if (!reveal) kbApi.current?.glow(null);
  }, [target, hint, reveal]);

  return (
    <div className="flex flex-col items-center gap-5">
      {showControls && (
        <div className="flex items-center gap-6">
          <Toggle label="Highlight target" value={hint} onChange={setHint} />
          <Toggle label="8s timer" value={strict} onChange={setStrict} />
        </div>
      )}
      <div className="flex items-center gap-6">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl font-display text-5xl text-ink-950"
          style={{
            background: fingerColor(target) ?? "#00e5ff",
            boxShadow: `0 0 50px ${fingerColor(target) ?? "#00e5ff"}77`,
            animation: "beat-pulse 1.1s ease-in-out infinite",
          }}
        >
          {target === " " ? "␣" : target.toUpperCase()}
        </div>
        <div className="text-left">
          <div className="font-mono text-[10px] tracking-[0.3em] text-faint">KEY {idx + 1}/{ROUNDS}</div>
          <div className="mt-1 font-display text-lg" style={{ color: fingerColor(target) ?? "#00e5ff" }}>
            {fingerLabel(target)}
          </div>
          {strict && (
            <div className={`mt-1 font-mono text-sm ${timeLeft < 3 ? "text-alarm" : "text-dim"}`}>{timeLeft.toFixed(1)}s</div>
          )}
          {reveal && <div className="mt-1 font-mono text-[11px] text-gold">it's the glowing key — look down</div>}
          <div className="mt-1 font-mono text-[10px] text-faint">misses {misses}</div>
        </div>
      </div>
      <Keyboard api={kbApi} showFingers />
    </div>
  );
}

export function FindKeyGame({ onExit }: { onExit: () => void }) {
  const store = loadStore();
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<{ acc: number; misses: number } | null>(null);

  const targets = useMemo(() => {
    const pool0 = "asdfjkl;qwertyuio".split("");
    const weak = keyAccuracyList(store).filter((w) => w.acc < 90).slice(0, 3).map((w) => w.key).filter((k) => k.length === 1);
    const arr: string[] = [];
    for (let i = 0; i < 12; i++) {
      const useWeak = weak.length > 0 && i % 3 === 2;
      arr.push(useWeak ? weak[i % weak.length] : pool0[Math.floor(Math.random() * pool0.length)]);
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return (
    <GameShell title="FIND THE KEY" onExit={onExit}>
      {result ? (
        <EndCard
          title={result.acc >= 90 ? "GEOGRAPHY LOCKED IN" : "GOOD REP — KEEP HUNTING"}
          acc={result.acc} misses={result.misses} total={12}
          onRetry={() => { setResult(null); setRunId((r) => r + 1); }}
          onExit={onExit}
        />
      ) : (
        <FindCore
          targets={targets}
          onDone={(acc, misses) => {
            gainXp(Math.round(20 + acc * 0.4));
            setResult({ acc, misses });
          }}
        />
      )}
    </GameShell>
  );
}

// ------------------------------------------------------------------
// WHICH FINGER? — core + wrapper
// ------------------------------------------------------------------

const ALL_KEYS = Object.keys(KEY_FINGER).filter((k) => /[a-z;,./']/.test(k));
const LABELS = [
  "LEFT PINKY", "LEFT RING", "LEFT MIDDLE", "LEFT INDEX",
  "RIGHT INDEX", "RIGHT MIDDLE", "RIGHT RING", "RIGHT PINKY",
];

export function FingerCore({
  keys,
  onDone,
}: {
  keys: string[];
  onDone: (score: number, total: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const doneRef = useRef(false);

  const key = keys[Math.min(idx, keys.length - 1)];
  const answer = fingerLabel(key);

  const options = useMemo(() => {
    const opts = new Set<string>([answer]);
    while (opts.size < 4) opts.add(LABELS[Math.floor(Math.random() * LABELS.length)]);
    return [...opts].sort(() => Math.random() - 0.5);
  }, [answer]);

  const pick = (label: string) => {
    if (picked || doneRef.current) return;
    audio.ensure();
    const correct = label === answer;
    const newScore = score + (correct ? 1 : 0);
    setPicked(label);
    if (correct) {
      setScore(newScore);
      audio.playJudgment("perfect");
    } else {
      audio.playError();
    }
    setTimeout(() => {
      setPicked(null);
      if (idx + 1 >= keys.length) {
        doneRef.current = true;
        onDone(newScore, keys.length);
      } else setIdx((i) => i + 1);
    }, 1400);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4 && !picked && !doneRef.current) pick(options[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, picked, idx]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <div className="font-mono text-[10px] tracking-[0.3em] text-faint">KEY {idx + 1}/{keys.length} · SCORE {score}</div>
        <div className="mt-3 font-mono text-[12px] text-dim">Which finger should press</div>
        <div
          className="mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-2xl font-display text-4xl text-ink-950"
          style={{ background: fingerColor(key) ?? "#00e5ff", boxShadow: `0 0 40px ${fingerColor(key) ?? "#00e5ff"}66` }}
        >
          {key.toUpperCase()}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {options.map((o, i) => {
          const isAns = o === answer;
          const isPick = o === picked;
          const showState = picked !== null;
          return (
            <button
              key={o}
              onClick={() => pick(o)}
              className={`rounded-xl border px-4 py-3.5 font-display text-[12px] tracking-wider transition-all ${
                showState && isAns
                  ? "border-lime-neon bg-lime-neon/15 text-lime-neon shadow-[0_0_18px_rgba(168,255,62,0.3)]"
                  : showState && isPick
                    ? "border-alarm bg-alarm/15 text-alarm shake-soft"
                    : "border-ink-500 bg-ink-900/70 text-fog hover:border-volt/60 hover:bg-volt/5"
              }`}
            >
              <span className="keycap mr-2 !text-[9px]">{i + 1}</span>
              {o}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex justify-center">
        <HandGuide active={picked ? key : null} compact />
      </div>
    </div>
  );
}

export function WhichFingerGame({ onExit }: { onExit: () => void }) {
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const keys = useMemo(() => {
    const arr = [...ALL_KEYS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return (
    <GameShell title="WHICH FINGER?" onExit={onExit}>
      {result ? (
        <EndCard
          title={result.score >= 8 ? "FINGER MAP ACQUIRED" : "WARMING UP NICELY"}
          acc={(result.score / result.total) * 100} misses={result.total - result.score} total={result.total}
          onRetry={() => { setResult(null); setRunId((r) => r + 1); }}
          onExit={onExit}
        />
      ) : (
        <FingerCore
          keys={keys}
          onDone={(score, total) => {
            gainXp(15 + score * 5);
            setResult({ score, total });
          }}
        />
      )}
    </GameShell>
  );
}

// ------------------------------------------------------------------
// shared bits
// ------------------------------------------------------------------

function GameShell({ title, onExit, children }: {
  title: string; onExit: () => void; children: React.ReactNode;
}) {
  return (
    <div className="relative h-screen overflow-y-auto">
      <BackgroundFX hue={300} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />
      <div className="relative z-20 mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={() => { audio.playUi(); onExit(); }} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Back">
            <Icon name="back" size={16} />
          </button>
          <h1 className="font-display text-xl tracking-wider text-fog text-glow-flare">{title}</h1>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

function EndCard({ title, acc, misses, total, onRetry, onExit }: {
  title: string; acc: number; misses: number; total: number; onRetry: () => void; onExit: () => void;
}) {
  return (
    <div className="panel rise-in mx-auto max-w-md rounded-2xl p-7 text-center">
      <div className="font-display text-xl tracking-widest text-gold text-glow-gold">{title}</div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-ink-900/80 py-3">
          <div className="font-mono text-[8px] tracking-[0.2em] text-faint">ACCURACY</div>
          <div className="font-display text-2xl text-lime-neon">{acc.toFixed(0)}%</div>
        </div>
        <div className="rounded-xl bg-ink-900/80 py-3">
          <div className="font-mono text-[8px] tracking-[0.2em] text-faint">MISSES</div>
          <div className="font-display text-2xl text-flare">{misses}/{total}</div>
        </div>
      </div>
      <p className="mt-3 font-mono text-[10px] text-faint">XP banked · find it in your progress</p>
      <div className="mt-5 flex gap-2.5">
        <button onClick={onRetry} className="btn-primary flex-1 rounded-xl py-3 text-xs">PLAY AGAIN</button>
        <button onClick={onExit} className="btn-ghost flex-1 rounded-xl py-3 text-xs">BACK TO LEARN</button>
      </div>
    </div>
  );
}

// ==================================================================
// CHALLENGES — short, focused, high-feedback gameplay variety.
// Each one communicates one thing: precision, speed, memory, movement.
// ==================================================================

export type ChallengeKind = "perfect" | "sprint" | "memory" | "movement";

const CH_META: Record<ChallengeKind, {
  title: string; desc: string; icon: string; best: (v: number) => string; bestMode: "max" | "min";
}> = {
  perfect: { title: "PERFECT RUN", desc: "Land 15 keys in a row without a single miss. Misses reset the run — breathe.", icon: "gem", best: (v) => `${v} total keys`, bestMode: "min" },
  sprint: { title: "10-SECOND SPRINT", desc: "Ten seconds on the clock. How many correct keys can you land?", icon: "bolt", best: (v) => `${v} hits`, bestMode: "max" },
  memory: { title: "MEMORY FLASH", desc: "Study the sequence, then type it from memory. Three rounds, growing longer.", icon: "keys", best: (v) => `${v} keys recalled`, bestMode: "max" },
  movement: { title: "MOVEMENT REPS", desc: "Home → reach → home for your weakest finger. Clean reps build fast hands.", icon: "target", best: (v) => `${v}% accuracy`, bestMode: "max" },
};

function challengeSettings() {
  const s = loadStore().settings;
  return {
    noteSpeed: s.noteSpeed, timingOffset: s.timingOffset, keyProfile: s.keyProfile,
    particles: s.particles, quality: s.quality, screenShake: s.screenShake,
    bgEffects: s.bgEffects, reducedMotion: s.reducedMotion, colorBlind: s.colorBlind,
    skillBias: 0, highlightKeys: true, showNextKey: true,
  };
}

const emptyHud = (): HudRefs => ({
  score: null, wpm: null, acc: null, combo: null, mult: null, progress: null, time: null, health: null,
});

function PauseVeil({ paused, onResume }: { paused: boolean; onResume: () => void }) {
  if (!paused) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm">
      <div className="panel rise-in rounded-2xl p-6 text-center">
        <div className="font-display text-lg tracking-widest text-fog text-glow-volt">PAUSED</div>
        <button onClick={onResume} className="btn-primary mt-4 rounded-xl px-8 py-2.5 text-xs">
          RESUME
        </button>
        <div className="mt-2 font-mono text-[9px] text-faint">or press ESC</div>
      </div>
    </div>
  );
}

// ---------- PERFECT RUN ----------

const PERFECT_TARGET = 15;

function PerfectRunCore({ onDone }: { onDone: (success: boolean, attempts: number, bestStreak: number) => void }) {
  const kbApi = useRef<KbApi | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RhythmEngine | null>(null);
  const [paused, setPaused] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    audio.ensure();
    const chars = masteredKeys(loadStore()).filter((k) => k.length === 1);
    const pool = chars.length >= 8 ? chars : "asdfjkl;".split("");
    const tokens: string[] = [];
    for (let i = 0; i < 22; i++) tokens.push(pool[Math.floor(Math.random() * pool.length)]);
    for (let i = 0; i < 6; i++) tokens.push(pool[i % pool.length] + pool[(i + 3) % pool.length]);

    const bridge: Bridge = {
      glow: (ch) => kbApi.current?.glow(ch),
      key: (ch, kind) => kbApi.current?.key(ch, kind),
      combo: (n) => {
        setStreak(n);
        setBestStreak((b) => Math.max(b, n));
      },
    };
    const engine = new RhythmEngine(
      canvas,
      { mode: "song", songId: "custom", difficulty: "easy", speedMult: 1, timeLimit: 0, chart: buildChartFromTokens(tokens), stream: null, music: null },
      challengeSettings(),
      emptyHud(),
      bridge,
      (r) => onDone(r.maxCombo >= PERFECT_TARGET, r.totalKeystrokes, r.maxCombo),
      (p) => setPaused(p),
    );
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-center gap-1.5 py-2">
        {Array.from({ length: PERFECT_TARGET }, (_, i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full border transition-all duration-150"
            style={
              i < Math.min(streak, PERFECT_TARGET)
                ? { background: "#a8ff3e", borderColor: "#a8ff3e", boxShadow: "0 0 8px rgba(168,255,62,0.8)" }
                : { borderColor: "rgba(42,56,102,0.9)", background: "rgba(12,18,38,0.6)" }
            }
          />
        ))}
        <span className="ml-3 font-mono text-[10px] text-faint">
          streak <span className="text-lime-neon">{streak}</span> · best {bestStreak}/{PERFECT_TARGET}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <PauseVeil paused={paused} onResume={() => engineRef.current?.setPaused(false)} />
      </div>
      <div className="px-4 pb-4 pt-2">
        <Keyboard api={kbApi} showFingers compact />
      </div>
    </div>
  );
}

// ---------- 10-SECOND SPRINT ----------

function SprintCore({ onDone }: { onDone: (hits: number, acc: number) => void }) {
  const kbApi = useRef<KbApi | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RhythmEngine | null>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [hits, setHits] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    audio.ensure();
    const bridge: Bridge = {
      glow: (ch) => kbApi.current?.glow(ch),
      key: (ch, kind) => {
        kbApi.current?.key(ch, kind);
        if (kind === "correct") setHits((h) => h + 1);
      },
    };
    const hud = emptyHud();
    hud.time = timeRef.current;
    const engine = new RhythmEngine(
      canvas,
      { mode: "time", songId: "custom", difficulty: "normal", speedMult: 1, timeLimit: 10, chart: null, stream: createStream(132, "normal", Date.now() % 100000), music: null },
      challengeSettings(),
      hud,
      bridge,
      (r) => onDone(r.correctChars, r.accuracy),
      (p) => setPaused(p),
    );
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-center gap-6 py-2">
        <div ref={timeRef} className="font-display text-3xl text-gold text-glow-gold tabular-nums">10s</div>
        <div className="font-mono text-[11px] text-dim">
          hits <span className="font-display text-xl text-lime-neon tabular-nums">{hits}</span>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <PauseVeil paused={paused} onResume={() => engineRef.current?.setPaused(false)} />
      </div>
      <div className="px-4 pb-4 pt-2">
        <Keyboard api={kbApi} compact />
      </div>
    </div>
  );
}

// ---------- MEMORY FLASH ----------

function MemoryFlashCore({ onDone }: { onDone: (correct: number, roundsCleared: number) => void }) {
  const kbApi = useRef<KbApi | null>(null);
  const pool = useMemo(() => {
    const m = masteredKeys(loadStore()).filter((k) => k.length === 1);
    return m.length >= 8 ? m : "asdfjkl;qwer".split("");
  }, []);
  const [rounds] = useState(() =>
    [5, 6, 7].map((n) => Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)])),
  );
  const [r, setR] = useState(0);
  const [phase, setPhase] = useState<"show" | "type" | "reveal">("show");
  const [pos, setPos] = useState(0);
  const counters = useRef({ correct: 0, cleared: 0 });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const seq = rounds[r];

  useEffect(() => {
    if (phase !== "show") return;
    const t = setTimeout(() => setPhase("type"), r === 0 ? 2300 : 1800);
    return () => clearTimeout(t);
  }, [phase, r]);

  const nextRound = () => {
    setPos(0);
    if (r + 1 >= rounds.length) {
      onDone(counters.current.correct, counters.current.cleared);
    } else {
      setR((x) => x + 1);
      setPhase("show");
    }
  };

  useEffect(() => {
    if (phase !== "type") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k.length !== 1 && k !== ";") return;
      if (pos >= seq.length) return; // round already resolved, transitioning
      const want = seq[pos];
      kbApi.current?.key(k, "down");
      setTimeout(() => kbApi.current?.key(k, "up"), 130);
      if (k === want) {
        kbApi.current?.key(k, "correct");
        audio.ensure();
        audio.playJudgment(pos + 1 >= seq.length ? "perfect" : "great");
        counters.current.correct++;
        if (pos + 1 >= seq.length) {
          counters.current.cleared++;
          setTimeout(() => {
            if (alive.current) nextRound();
          }, 350);
        } else {
          setPos((p) => p + 1);
        }
      } else {
        kbApi.current?.key(k, "error");
        kbApi.current?.glow(want);
        audio.ensure();
        audio.playError();
        setPhase("reveal");
        setTimeout(() => {
          if (!alive.current) return;
          kbApi.current?.glow(null);
          nextRound();
        }, 1100);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pos, r]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
      <div className="font-mono text-[10px] tracking-[0.3em] text-faint">
        ROUND {r + 1}/{rounds.length} · RECALLED {counters.current.correct}
      </div>

      {phase === "show" && (
        <div className="rise-in text-center">
          <div className="font-display text-sm tracking-[0.3em] text-volt text-glow-volt">MEMORIZE</div>
          <div className="mt-4 flex justify-center gap-2">
            {seq.map((k, i) => (
              <span
                key={i}
                className="flex h-14 w-14 items-center justify-center rounded-xl font-display text-2xl text-ink-950"
                style={{
                  background: fingerColor(k) ?? "#00e5ff",
                  boxShadow: `0 0 20px ${fingerColor(k) ?? "#00e5ff"}66`,
                  animation: `beat-pulse 1s ease-in-out ${i * 0.12}s infinite`,
                }}
              >
                {k.toUpperCase()}
              </span>
            ))}
          </div>
          <p className="mt-4 font-mono text-[10px] text-faint">the colors are the fingers — let them help you</p>
        </div>
      )}

      {(phase === "type" || phase === "reveal") && (
        <div className="text-center">
          <div className={`font-display text-sm tracking-[0.3em] ${phase === "reveal" ? "text-alarm" : "text-gold"}`}>
            {phase === "reveal" ? "THE SEQUENCE WAS…" : "NOW TYPE IT"}
          </div>
          <div className="mt-4 flex justify-center gap-2">
            {seq.map((k, i) => (
              <span
                key={i}
                className="flex h-14 w-14 items-center justify-center rounded-xl border-2 font-display text-2xl"
                style={{
                  borderColor: i < pos || phase === "reveal" ? fingerColor(k) ?? "#00e5ff" : i === pos ? "#00e5ff" : "rgba(42,56,102,0.8)",
                  color: i < pos || phase === "reveal" ? fingerColor(k) ?? "#00e5ff" : i === pos ? "#eaf2ff" : "#3d4c7a",
                  background: "rgba(12,18,38,0.7)",
                  boxShadow: i < pos ? `0 0 14px ${fingerColor(k) ?? "#00e5ff"}55` : "none",
                }}
              >
                {i < pos || phase === "reveal" ? k.toUpperCase() : i === pos ? "?" : "·"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-[760px]">
        <Keyboard api={kbApi} showFingers compact />
      </div>
    </div>
  );
}

// ---------- MOVEMENT REPS ----------

function MovementCore({ onDone }: { onDone: (acc: number) => void }) {
  const kbApi = useRef<KbApi | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RhythmEngine | null>(null);
  const [paused, setPaused] = useState(false);
  const pick = useMemo(() => {
    const store = loadStore();
    const ordered = fingerStrength(store).filter((f) => f.strength > 0).sort((a, b) => a.strength - b.strength);
    const zone = Object.values(FINGER_ZONES).find((z) => z.label === ordered[0]?.label) ?? FINGER_ZONES["left-ring"];
    const reaches = zone.keys.filter((k) => k !== zone.home && k.length === 1);
    let reach = reaches[0] ?? "w";
    let worst = Infinity;
    for (const r of reaches) {
      const m = keyMastery(store, r).mastery;
      if (m < worst) {
        worst = m;
        reach = r;
      }
    }
    return { home: zone.home, reach, zone };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    audio.ensure();
    const once = movementTokens(pick.home, pick.reach);
    const tokens = [...once, ...once];
    const bridge: Bridge = {
      glow: (ch) => kbApi.current?.glow(ch),
      key: (ch, kind) => kbApi.current?.key(ch, kind),
    };
    const engine = new RhythmEngine(
      canvas,
      { mode: "song", songId: "custom", difficulty: "beginner", speedMult: 1, timeLimit: 0, chart: buildChartFromTokens(tokens), stream: null, music: null },
      { ...challengeSettings(), noteSpeed: Math.min(challengeSettings().noteSpeed, 0.75) },
      emptyHud(),
      bridge,
      (r) => onDone(r.accuracy),
      (p) => setPaused(p),
    );
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-center gap-8 py-2">
        <MovementViz home={pick.home} reach={pick.reach} tiny />
        <div className="text-left">
          <div className="font-mono text-[9px] tracking-[0.3em] text-faint">TRAINING</div>
          <div className="font-display text-sm tracking-wider" style={{ color: pick.zone.color }}>{pick.zone.label}</div>
          <div className="mt-0.5 font-mono text-[10px] text-dim">
            {pick.home.toUpperCase()} → {pick.reach.toUpperCase()} → {pick.home.toUpperCase()} · out and back, every rep
          </div>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <PauseVeil paused={paused} onResume={() => engineRef.current?.setPaused(false)} />
      </div>
      <div className="px-4 pb-4 pt-2">
        <Keyboard api={kbApi} showFingers compact />
      </div>
    </div>
  );
}

// ---------- challenge shell ----------

export function ChallengeScreen({ kind, onExit }: { kind: ChallengeKind; onExit: () => void }) {
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<{ value: number; success: boolean; note: string } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const meta = CH_META[kind];
  // re-read after each run so a fresh record shows immediately
  const best = useMemo(() => loadStore().challengeBests[kind], [kind, result]);

  const finish = (value: number, success: boolean, note: string, xp: number, record: boolean) => {
    setNewBest(record && value > 0 ? recordChallengeBest(kind, Math.round(value), meta.bestMode) : false);
    gainXp(xp);
    audio.ensure();
    audio.playCombo(success ? 2 : 1);
    setResult({ value, success, note });
  };

  return (
    <div className="relative h-screen overflow-hidden">
      <BackgroundFX hue={40} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />
      <div className="relative z-20 flex h-full flex-col">
        <div className="flex items-center gap-4 px-6 py-4">
          <button onClick={() => { audio.playUi(); onExit(); }} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Back">
            <Icon name="back" size={16} />
          </button>
          <div>
            <h1 className="flex items-center gap-2 font-display text-xl tracking-wider text-fog text-glow-gold">
              <Icon name={meta.icon} size={18} className="text-gold" /> {meta.title}
            </h1>
            <p className="font-mono text-[11px] text-dim">{meta.desc}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="font-mono text-[8px] tracking-[0.25em] text-faint">PERSONAL BEST</div>
            <div className="font-display text-sm text-gold">{best !== undefined ? meta.best(best) : "—"}</div>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {result ? (
            <div className="flex h-full items-center justify-center px-4">
              <div className="panel rise-in w-full max-w-md rounded-2xl p-8 text-center">
                <div className={`font-display text-2xl tracking-widest ${result.success ? "text-lime-neon" : "text-gold"}`}>
                  {result.success ? "CHALLENGE CLEARED" : "GOOD EFFORT"}
                </div>
                <div className="mt-4 font-display text-5xl text-fog text-glow-volt tabular-nums">
                  {kind === "movement" ? result.value.toFixed(0) + "%" : Math.round(result.value)}
                </div>
                <div className="mt-1 font-mono text-[11px] text-dim">{result.note}</div>
                {newBest && (
                  <div className="milestone-blast mt-3 inline-block rounded-full border border-gold/60 bg-gold/10 px-3 py-1 font-display text-[11px] tracking-[0.2em] text-gold">
                    ★ NEW PERSONAL BEST
                  </div>
                )}
                <div className="mt-6 flex gap-2.5">
                  <button
                    onClick={() => { setResult(null); setRunId((x) => x + 1); }}
                    className="btn-primary flex-1 rounded-xl py-3 text-xs"
                  >
                    RUN IT AGAIN
                  </button>
                  <button onClick={onExit} className="btn-ghost flex-1 rounded-xl py-3 text-xs">
                    BACK TO LEARN
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div key={runId} className="h-full">
              {kind === "perfect" && (
                <PerfectRunCore
                  onDone={(success, attempts, bestStreak) =>
                    finish(attempts, success, success ? `clean ${PERFECT_TARGET} — ${attempts} total keys` : `best streak ${bestStreak}/${PERFECT_TARGET}`, success ? 120 : 40, success)
                  }
                />
              )}
              {kind === "sprint" && (
                <SprintCore onDone={(hits, acc) => finish(hits, hits > 0, `${hits} keys · ${acc.toFixed(0)}% accuracy`, hits * 3, true)} />
              )}
              {kind === "memory" && (
                <MemoryFlashCore onDone={(correct, rounds) => finish(correct, rounds > 0, `${correct} keys recalled · ${rounds}/3 rounds clean`, correct * 8, true)} />
              )}
              {kind === "movement" && (
                <MovementCore onDone={(acc) => finish(acc, acc >= 85, `movement accuracy`, Math.round(acc * 1.2), true)} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
