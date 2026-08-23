import { useEffect, useMemo, useRef, useState } from "react";
import { RhythmEngine, Bridge, GameResult, HudRefs } from "../game/engine";
import {
  buildChartFromTokens, getLesson, nextLessonId, LessonDef, StageDef,
  validateTokens, focusFingerInfo,
} from "../game/lessons";
import { generateChart } from "../game/songs";
import { fingerColor, fingerLabel } from "../game/fingers";
import { Keyboard, KbApi } from "../components/Keyboard";
import { HandGuide } from "../components/HandGuide";
import { MovementViz } from "../components/MovementViz";
import { FindCore, FingerCore } from "./MiniGames";
import { Icon, Segmented, Slider, Toggle } from "../components/ui";
import {
  GuidanceLevel, keyMastery, loadStore, processLesson, updateSettings, weakKeyDrill,
} from "../store";
import { audio } from "../audio/audio";

const LEVEL_BUNDLES: Record<GuidanceLevel, { keyboard: boolean; fingers: boolean; highlight: boolean; next: boolean; hands: boolean }> = {
  A: { keyboard: true, fingers: true, highlight: true, next: true, hands: true },
  B: { keyboard: true, fingers: true, highlight: true, next: false, hands: true },
  C: { keyboard: true, fingers: false, highlight: true, next: false, hands: false },
  D: { keyboard: true, fingers: false, highlight: false, next: false, hands: false },
  E: { keyboard: false, fingers: false, highlight: false, next: false, hands: false },
};

function resolveLesson(id: string): LessonDef {
  const real = getLesson(id);
  if (real) return real;
  const tokens = weakKeyDrill(loadStore());
  return {
    id: "drill", num: 0, section: "muscle", title: "Personal Drill",
    desc: "Auto-generated around your most-missed keys: the key alone, move-and-return patterns, then real words.",
    allowedKeys: "abcdefghijklmnopqrstuvwxyz;,.".split(""),
    newKeys: [],
    stages: [{ type: "engine", tokens: tokens.length ? tokens : ["a", "s", "d", "f", "sad", "ask"] }],
    maxSpeed: 0.8, kind: "learning", goalAcc: 90, goalMaxMiss: 8, xp: 80, requires: [],
  };
}

interface SegStat { correct: number; total: number }

export function LessonScreen({
  lessonId,
  onExit,
  onOpenLesson,
}: {
  lessonId: string;
  onExit: () => void;
  onOpenLesson: (id: string) => void;
}) {
  const lesson = useMemo(() => resolveLesson(lessonId), [lessonId]);
  const settings = useMemo(() => loadStore().settings, []);
  const isRhythm = lesson.kind === "rhythm";
  const stages: StageDef[] = isRhythm ? [{ type: "engine", tokens: [] }] : lesson.stages;

  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [segIdx, setSegIdx] = useState(0);
  const [runId, setRunId] = useState(0);
  const [speed, setSpeed] = useState(() => {
    // adaptive lessons start deliberately slow and earn their speed
    const cap = lesson.id === "adaptive" ? Math.min(lesson.maxSpeed, 0.7) : lesson.maxSpeed;
    return Math.max(0.5, Math.min(settings.noteSpeed, cap));
  });
  const [adaptiveNote, setAdaptiveNote] = useState<string | null>(null);
  const [level, setLevel] = useState<GuidanceLevel>(settings.guidanceLevel);
  const [toggles, setToggles] = useState(LEVEL_BUNDLES[settings.guidanceLevel]);
  const [activeChar, setActiveChar] = useState<string | null>(null);
  const [noteHint, setNoteHint] = useState<{ text: string; typed: number; kind: string } | null>(null);
  const [outcome, setOutcome] = useState<{
    acc: number; miss: number; passed: boolean; xp: number; firstMaster: boolean; weak: string[]; keysTyped: number; maxCombo: number;
  } | null>(null);

  const statsRef = useRef<{ segs: SegStat[]; attempts: Record<string, number>; mistakes: Record<string, number>; keys: number; maxCombo: number }>({
    segs: [], attempts: {}, mistakes: {}, keys: 0, maxCombo: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kbApi = useRef<KbApi | null>(null);
  const hudEls = useRef<HudRefs>({ score: null, wpm: null, acc: null, combo: null, mult: null, progress: null, time: null, health: null });
  const engineRef = useRef<RhythmEngine | null>(null);

  const seg = stages[Math.min(segIdx, stages.length - 1)];
  const zone = focusFingerInfo(lesson);

  const setLevelBundle = (lv: GuidanceLevel) => {
    setLevel(lv);
    setToggles(LEVEL_BUNDLES[lv]);
    updateSettings({ guidanceLevel: lv, ...mapBundle(LEVEL_BUNDLES[lv]) });
  };
  const flip = (k: keyof typeof toggles) => {
    const next = { ...toggles, [k]: !toggles[k] };
    setToggles(next);
    updateSettings(mapBundle(next));
  };

  // ------------------------------------------------ segment progression
  const pushStat = (s: SegStat) => statsRef.current.segs.push(s);

  const advance = () => {
    if (segIdx + 1 < stages.length) {
      // adaptive practice: the lesson owns the throttle. Consistent accuracy
      // earns speed, slipping accuracy buys patience — never a forced jump.
      if (lesson.id === "adaptive") {
        const last = statsRef.current.segs[statsRef.current.segs.length - 1];
        if (last && last.total > 0) {
          const acc = (last.correct / last.total) * 100;
          if (acc >= 95 && speed < lesson.maxSpeed - 0.001) {
            const nv = Math.min(lesson.maxSpeed, Math.round((speed + 0.1) * 100) / 100);
            setSpeed(nv);
            setAdaptiveNote(`CLEAN RUN ${acc.toFixed(0)}% — SPEED UP ×${nv.toFixed(2)}`);
          } else if (acc < 85 && speed > 0.501) {
            const nv = Math.max(0.5, Math.round((speed - 0.1) * 100) / 100);
            setSpeed(nv);
            setAdaptiveNote(`SHAKY AT ${acc.toFixed(0)}% — EASING TO ×${nv.toFixed(2)}`);
          } else {
            setAdaptiveNote(`STEADY AT ${acc.toFixed(0)}% — HOLDING ×${speed.toFixed(2)}`);
          }
        }
      }
      setSegIdx((i) => i + 1);
    } else {
      const st = statsRef.current;
      const correct = st.segs.reduce((a, b) => a + b.correct, 0);
      const total = Math.max(1, st.segs.reduce((a, b) => a + b.total, 0));
      const acc = (correct / total) * 100;
      const missTotal = Object.values(st.mistakes).reduce((a, b) => a + b, 0);
      const passed = acc >= lesson.goalAcc && missTotal <= lesson.goalMaxMiss;
      const { xpGained, firstMaster } = processLesson(lesson.id, lesson.xp, {
        acc, misses: missTotal, passed, keysTyped: st.keys,
        attempts: st.attempts, mistakes: st.mistakes,
      });
      const weak = Object.entries(st.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
      setOutcome({ acc, miss: missTotal, passed, xp: xpGained, firstMaster, weak, keysTyped: st.keys, maxCombo: st.maxCombo });
      setPhase("done");
    }
  };

  // ------------------------------------------------ engine per engine-segment
  useEffect(() => {
    if (phase !== "run" || seg.type !== "engine") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    audio.ensure();

    const isLearn = lesson.kind === "learning";
    const tokens = validateTokens(seg.tokens ?? [], lesson.allowedKeys);
    const chart = isLearn
      ? buildChartFromTokens(tokens)
      : generateChart(lesson.music!, lesson.difficulty!, 24, lesson.allowedKeys);

    const bridge: Bridge = {
      glow: (ch) => { kbApi.current?.glow(ch); setActiveChar(ch); },
      key: (ch, kind) => kbApi.current?.key(ch, kind),
      note: (text, typed, kind) => setNoteHint(text ? { text, typed, kind } : null),
      combo: (n) => {
        const el = hudEls.current.combo;
        if (el) el.textContent = n > 0 ? String(n) : "–";
        statsRef.current.maxCombo = Math.max(statsRef.current.maxCombo, n);
      },
      milestone: () => {},
    };

    const engine = new RhythmEngine(
      canvas,
      {
        mode: "song",
        songId: lesson.music ?? "custom",
        difficulty: isLearn ? "beginner" : lesson.difficulty!,
        speedMult: 1, timeLimit: 0, chart, stream: null,
        music: isLearn ? null : lesson.music!,
      },
      {
        noteSpeed: speed,
        timingOffset: settings.timingOffset,
        keyProfile: settings.keyProfile,
        particles: settings.particles,
        quality: settings.quality,
        screenShake: settings.screenShake && !isLearn,
        bgEffects: settings.bgEffects,
        reducedMotion: settings.reducedMotion,
        colorBlind: settings.colorBlind,
        skillBias: 0,
        noPressure: isLearn,
        learnMode: isLearn,
        highlightKeys: (seg.highlight !== false) && toggles.highlight,
        showNextKey: toggles.next,
      },
      hudEls.current,
      bridge,
      (result: GameResult) => {
        const s = engine.getStats();
        const st = statsRef.current;
        pushStat({ correct: result.correctChars, total: Math.max(result.correctChars, result.totalKeystrokes) });
        for (const [k, v] of Object.entries(s.attempts)) st.attempts[k] = (st.attempts[k] ?? 0) + v;
        for (const [k, v] of Object.entries(s.mistakes)) st.mistakes[k] = (st.mistakes[k] ?? 0) + v;
        st.keys += result.correctChars;
        advance();
      },
      () => {},
    );
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
      kbApi.current?.glow(null);
      setActiveChar(null);
      setNoteHint(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, runId, segIdx]);

  const retry = () => {
    statsRef.current = { segs: [], attempts: {}, mistakes: {}, keys: 0, maxCombo: 0 };
    setSegIdx(0);
    setOutcome(null);
    setPhase("run");
    setRunId((r) => r + 1);
  };

  // ============================================================== INTRO
  if (phase === "intro") {
    const firstMove = stages.find((s) => s.movement)?.movement;
    return (
      <div className="relative h-screen overflow-y-auto">
        <div className="scanlines pointer-events-none fixed inset-0 z-10" />
        <div className="relative z-20 mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-8">
          <button onClick={onExit} className="btn-ghost mb-5 flex h-10 w-10 items-center justify-center rounded-lg self-start" aria-label="Back">
            <Icon name="back" size={16} />
          </button>

          <div className="rise-in">
            <div className="font-mono text-[11px] tracking-[0.4em] text-volt">
              {lesson.id === "drill" ? "PERSONAL TRAINING" : `LESSON ${lesson.num} · ${lesson.section.toUpperCase()}`}
            </div>
            <h1 className="mt-1 font-display text-3xl tracking-wider text-fog text-glow-volt">{lesson.title.toUpperCase()}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-dim">{lesson.desc}</p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="panel rise-in rounded-2xl p-5" style={{ animationDelay: "0.06s" }}>
              {zone ? (
                <>
                  <div className="font-mono text-[9px] tracking-[0.3em] text-faint">THIS LESSON OWNS</div>
                  <div className="mt-2 flex items-center gap-2.5">
                    <span className="rounded-md px-2.5 py-1 font-display text-[12px] tracking-[0.15em] text-ink-950" style={{ background: zone.color }}>
                      {zone.label}
                    </span>
                    <span className="font-mono text-[11px] text-dim">home {zone.home.toUpperCase()}</span>
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    {zone.keys.slice(0, 6).map((k) => (
                      <span key={k} className="keycap !h-8 !min-w-8 !text-[13px]" style={{ borderColor: zone.color + "88", color: zone.color }}>
                        {k === " " ? "␣" : k.toUpperCase()}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-faint">
                    Move out, press, <span className="text-fog">return home</span>. Speed comes later — the pattern comes first.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-mono text-[9px] tracking-[0.3em] text-faint">KEYS IN PLAY</div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {[...new Set(lesson.newKeys.length ? lesson.newKeys : lesson.allowedKeys)].slice(0, 16).map((k) => (
                      <span key={k} className="keycap !h-8 !min-w-8 !text-[13px]" style={{ borderColor: (fingerColor(k) ?? "#2a3866") + "88", color: fingerColor(k) ?? "#93a1c7" }}>
                        {k === " " ? "␣" : k.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-4 grid gap-2 font-mono text-[11px] text-dim">
                <div className="rounded-lg bg-ink-900/70 px-3 py-2">
                  <span className="text-faint">PASS MARK</span> · <span className="text-volt">≥ {lesson.goalAcc}% acc · ≤ {lesson.goalMaxMiss} misses</span>
                </div>
                <div className="rounded-lg bg-ink-900/70 px-3 py-2">
                  <span className="text-faint">SEGMENTS</span> ·{" "}
                  <span className="text-lime-neon">
                    {isRhythm ? "1 rhythm run" : stages.map((s) => s.type === "find" ? "FIND" : s.type === "finger" ? "FINGER" : (s.highlight === false ? "MEMORY" : "DRILL")).join(" → ")}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel rise-in flex flex-col items-center justify-center rounded-2xl p-5" style={{ animationDelay: "0.1s" }}>
              {firstMove ? (
                <>
                  <div className="font-mono text-[9px] tracking-[0.3em] text-faint">THE MOVEMENT YOU'LL LEARN</div>
                  <div className="mt-3"><MovementViz home={firstMove.home} reach={firstMove.reach} /></div>
                </>
              ) : isRhythm ? (
                <>
                  <Icon name="note" size={36} className="text-volt" />
                  <p className="mt-3 text-center text-[12px] leading-relaxed text-dim">
                    Notes fall to the beat of <span className="text-volt">{lesson.music}</span>.<br />Press each one as it lands on the line.
                  </p>
                </>
              ) : (
                <>
                  <Icon name="keys" size={36} className="text-volt" />
                  <p className="mt-3 text-center text-[12px] leading-relaxed text-dim">
                    See the key → know the finger →<br />press → return home.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="panel rise-in mt-4 rounded-2xl p-5" style={{ animationDelay: "0.14s" }}>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div className="min-w-[220px] flex-1">
                <Slider
                  label={`Note speed (lesson cap ${lesson.maxSpeed.toFixed(2)}x)`}
                  value={speed} min={0.5} max={lesson.maxSpeed} step={0.05}
                  format={(v) => v.toFixed(2) + "x"}
                  onChange={setSpeed}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-medium text-dim">Guidance level</div>
                <Segmented
                  small
                  options={(["A", "B", "C", "D", "E"] as GuidanceLevel[]).map((l) => ({ value: l, label: l }))}
                  value={level}
                  onChange={setLevelBundle}
                />
                <div className="mt-1 font-mono text-[9px] text-faint">A = full help · E = keyboard hidden</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
              <Toggle label="Show keyboard" value={toggles.keyboard} onChange={() => flip("keyboard")} />
              <Toggle label="Finger guide" value={toggles.fingers} onChange={() => flip("fingers")} />
              <Toggle label="Highlight required key" value={toggles.highlight} onChange={() => flip("highlight")} />
              <Toggle label="Show next key" value={toggles.next} onChange={() => flip("next")} />
              <Toggle label="Hand position" value={toggles.hands} onChange={() => flip("hands")} />
            </div>
          </div>

          <button onClick={() => { audio.ensure(); audio.playUi(); setPhase("run"); }} className="btn-primary rise-in mt-6 rounded-xl py-4 text-base" style={{ animationDelay: "0.2s" }}>
            START LESSON
          </button>
          <p className="mt-3 text-center font-mono text-[10px] text-faint">
            {isRhythm ? "type each note as it lands · ESC pauses" : "nothing times out · mistakes teach instead of punish · ESC pauses"}
          </p>
        </div>
      </div>
    );
  }

  // ============================================================== RUN
  const isEngineSeg = seg.type === "engine";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-ink-950">
      {/* HUD */}
      <div className="relative z-20 flex items-center gap-4 px-4 pt-3 xl:px-6">
        <button onClick={onExit} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Back">
          <Icon name="back" size={16} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm tracking-wider text-fog truncate">
              {lesson.num > 0 ? `L${lesson.num} · ` : ""}{lesson.title.toUpperCase()}
            </span>
            <span className="rounded border border-lime-neon/50 bg-lime-neon/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-lime-neon">
              {seg.label ?? (isRhythm ? "RHYTHM" : seg.type.toUpperCase())}
            </span>
          </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-[5px] w-40 overflow-hidden rounded-full bg-ink-700 xl:w-56">
                <div
                  className="h-full rounded-full bg-lime-neon shadow-[0_0_8px_rgba(168,255,62,0.8)] transition-all duration-500"
                  style={{ width: `${((segIdx + (isEngineSeg ? 0.5 : 0)) / stages.length) * 100}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-faint">SEGMENT {segIdx + 1}/{stages.length}</span>
              {lesson.id === "adaptive" && (
                <span
                  className="rounded border border-volt/50 bg-volt/10 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-volt"
                  style={{ animation: "beat-pulse 1.6s ease-in-out infinite" }}
                >
                  ADAPTIVE ×{speed.toFixed(2)}
                </span>
              )}
            </div>
            {lesson.id === "adaptive" && adaptiveNote && (
              <div key={adaptiveNote} className="rise-in mt-1 font-mono text-[10px] tracking-wider text-gold">
                {adaptiveNote}
              </div>
            )}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="hud-chip rounded-lg px-3 py-1.5 text-right">
            <div className="font-mono text-[9px] tracking-[0.25em] text-faint">STREAK</div>
            <div ref={(el) => { hudEls.current.combo = el; }} className="font-display text-xl leading-tight text-volt tabular-nums">–</div>
          </div>
          <div className="hud-chip rounded-lg px-3 py-1.5 text-right">
            <div className="font-mono text-[9px] tracking-[0.25em] text-faint">ACC</div>
            <div ref={(el) => { hudEls.current.acc = el; }} className="font-display text-xl leading-tight text-lime-neon tabular-nums">100%</div>
          </div>
          <div className="rounded-lg border border-gold/40 bg-gold/5 px-3 py-1.5 text-right">
            <div className="font-mono text-[9px] tracking-[0.25em] text-gold/70">SCORE</div>
            <div ref={(el) => { hudEls.current.score = el; }} className="font-display text-xl leading-tight text-gold tabular-nums">0</div>
          </div>
        </div>
      </div>

      {/* segment body */}
      {isEngineSeg ? (
        <>
          <div className="relative flex-1">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          </div>

          {toggles.fingers && (
            <div className="relative z-20 flex justify-center px-4">
              <div className="hud-chip flex items-center gap-3 rounded-xl px-5 py-2">
                {activeChar ? (
                  <>
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-lg font-display text-lg text-ink-950"
                      style={{ background: fingerColor(activeChar) ?? "#00e5ff", boxShadow: `0 0 18px ${fingerColor(activeChar) ?? "#00e5ff"}88` }}
                    >
                      {activeChar === " " ? "␣" : activeChar.toUpperCase()}
                    </span>
                    {activeChar.toUpperCase() !== activeChar && (
                      <span className="rounded-md border border-flare/60 bg-flare/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-flare">
                        ⇧ SHIFT +
                      </span>
                    )}
                    <span className="text-left">
                      <span className="block font-display text-[12px] tracking-[0.18em]" style={{ color: fingerColor(activeChar) ?? "#00e5ff" }}>
                        {fingerLabel(activeChar)}
                      </span>
                      {seg.movement ? (
                        <span className="block font-mono text-[11px] text-gold">
                          {seg.movement.home.toUpperCase()} → {seg.movement.reach.toUpperCase()} → {seg.movement.home.toUpperCase()} · then home
                        </span>
                      ) : noteHint && noteHint.kind === "word" ? (
                        <span className="block font-mono text-[11px] text-dim">
                          <span className="text-fog">{noteHint.text.slice(0, noteHint.typed)}</span>
                          <span className="text-volt">{noteHint.text.slice(noteHint.typed)}</span>
                        </span>
                      ) : (
                        <span className="block font-mono text-[10px] text-faint">press it — no rush</span>
                      )}
                    </span>
                    {seg.movement && <MovementViz home={seg.movement.home} reach={seg.movement.reach} tiny />}
                  </>
                ) : (
                  <span className="font-mono text-[11px] text-faint">get ready…</span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div key={segIdx} className="relative flex flex-1 items-start justify-center overflow-y-auto pt-6">
          {seg.type === "find" ? (
            <FindCore
              targets={pickTargets(seg.tokens ?? lesson.newKeys, seg.count ?? 8)}
              hintDefault={toggles.highlight}
              showControls={false}
              onDone={(acc) => {
                const total = seg.count ?? 8;
                pushStat({ correct: Math.round((acc / 100) * total), total });
                advance();
              }}
            />
          ) : (
            <FingerCore
              keys={pickTargets(seg.tokens ?? lesson.newKeys, seg.count ?? 6)}
              onDone={(score, total) => {
                pushStat({ correct: score, total });
                advance();
              }}
            />
          )}
        </div>
      )}

      {/* hand guide + keyboard + live controls */}
      {isEngineSeg && (
        <div className="relative z-20 flex items-end justify-center gap-6 px-4 pb-4 pt-2">
          {toggles.hands && (
            <div className="panel hidden shrink-0 rounded-xl p-3 lg:block">
              <HandGuide active={activeChar} compact />
            </div>
          )}
          <div className="min-w-0 flex-1 max-w-[880px]">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[10px] text-faint">
              <label className="flex items-center gap-2">
                SPEED
                <input
                  type="range" min={0.5} max={lesson.maxSpeed} step={0.05} value={speed}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setSpeed(v);
                    engineRef.current?.setNoteSpeed(v);
                  }}
                  className="w-28"
                  style={{ ["--fill" as string]: `${((speed - 0.5) / (lesson.maxSpeed - 0.5)) * 100}%` }}
                />
                <span className="text-volt">{speed.toFixed(2)}x</span>
              </label>
              <span className="hidden items-center gap-1.5 sm:flex">
                GUIDANCE
                {(["A", "B", "C", "D", "E"] as GuidanceLevel[]).map((l) => (
                  <button key={l} onClick={() => setLevelBundle(l)} className={`h-5 w-5 rounded border text-[9px] font-bold ${level === l ? "border-volt bg-volt text-ink-950" : "border-ink-500 text-dim"}`}>
                    {l}
                  </button>
                ))}
              </span>
            </div>
            {toggles.keyboard && <Keyboard api={kbApi} showFingers={toggles.fingers} />}
          </div>
        </div>
      )}

      {/* done overlay */}
      {phase === "done" && outcome && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/88 backdrop-blur-sm">
          <div className="panel rise-in max-h-[92vh] w-[450px] max-w-[94vw] overflow-y-auto rounded-2xl p-7 text-center">
            {lesson.checkpoint && outcome.firstMaster && (
              <div className="milestone-blast font-display text-xl tracking-widest text-gold text-glow-gold">
                ✓ {lesson.checkpoint} MASTERED
              </div>
            )}
            <div className={`font-display text-2xl tracking-widest ${outcome.passed ? "text-lime-neon" : "text-gold"}`}>
              {outcome.passed ? "LESSON COMPLETE" : "GOOD EFFORT"}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              <div className="rounded-xl bg-ink-900/80 py-3">
                <div className="font-mono text-[8px] tracking-[0.2em] text-faint">ACCURACY</div>
                <div className={`font-display text-2xl ${outcome.acc >= lesson.goalAcc ? "text-lime-neon" : "text-gold"}`}>{outcome.acc.toFixed(1)}%</div>
                <div className="font-mono text-[9px] text-faint">goal {lesson.goalAcc}%</div>
              </div>
              <div className="rounded-xl bg-ink-900/80 py-3">
                <div className="font-mono text-[8px] tracking-[0.2em] text-faint">MISSES</div>
                <div className={`font-display text-2xl ${outcome.miss <= lesson.goalMaxMiss ? "text-lime-neon" : "text-flare"}`}>{outcome.miss}</div>
                <div className="font-mono text-[9px] text-faint">max {lesson.goalMaxMiss}</div>
              </div>
              <div className="rounded-xl bg-ink-900/80 py-3">
                <div className="font-mono text-[8px] tracking-[0.2em] text-faint">BEST STREAK</div>
                <div className="font-display text-2xl text-flare">{outcome.maxCombo}</div>
                <div className="font-mono text-[9px] text-faint">in a row</div>
              </div>
              <div className="rounded-xl bg-ink-900/80 py-3">
                <div className="font-mono text-[8px] tracking-[0.2em] text-faint">REWARD</div>
                <div className="font-display text-2xl text-volt">+{outcome.xp}</div>
                <div className="font-mono text-[9px] text-faint">XP</div>
              </div>
            </div>

            {/* key mastery reward */}
            {lesson.newKeys.length > 0 && (
              <div className="mt-4 rounded-xl border border-volt/30 bg-volt/5 p-3">
                <div className="font-mono text-[9px] tracking-[0.3em] text-faint">KEY MASTERY</div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {lesson.newKeys.filter((k) => k.length === 1).map((k) => {
                    const m = keyMastery(loadStore(), k).mastery;
                    const mastered = m >= 75;
                    return (
                      <span key={k} className="flex flex-col items-center gap-0.5">
                        <span className={`keycap !h-8 !min-w-8 ${mastered ? "!text-lime-neon !border-lime-neon/60" : ""}`} style={{ borderColor: (fingerColor(k) ?? "#2a3866") + "88" }}>
                          {k.toUpperCase()}
                        </span>
                        <span className={`font-mono text-[8px] ${mastered ? "text-lime-neon" : "text-faint"}`}>{mastered ? `${m}% ✓` : `${m}%`}</span>
                      </span>
                    );
                  })}
                </div>
                {outcome.passed && outcome.firstMaster && lesson.newKeys.length > 0 && (
                  <div className="mt-2 font-display text-[11px] tracking-[0.2em] text-gold">
                    NEW UNLOCK: {lesson.newKeys.slice(0, 5).map((k) => k.toUpperCase()).join(" ")}
                  </div>
                )}
              </div>
            )}

            {!outcome.passed ? (
              <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-3 text-left">
                <div className="font-mono text-[10px] tracking-[0.25em] text-gold">KEEP PRACTICING</div>
                {outcome.weak.length > 0 && (
                  <div className="mt-1.5 text-[12px] text-dim">
                    Weak keys: {outcome.weak.map((k) => <span key={k} className="keycap mx-0.5">{k.toUpperCase()}</span>)}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
                  Try guidance level A and a slower speed — the movement matters more than the pace.
                </p>
              </div>
            ) : (
              outcome.weak.length > 0 && (
                <div className="mt-4 font-mono text-[11px] text-dim">
                  tiny slips on {outcome.weak.map((k) => <span key={k} className="keycap mx-0.5">{k.toUpperCase()}</span>)} — the drill will catch them
                </div>
              )
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              {outcome.passed && nextLessonId(lesson.id) && (
                <button className="btn-primary rounded-xl py-3 text-sm" onClick={() => onOpenLesson(nextLessonId(lesson.id)!)}>
                  NEXT LESSON →
                </button>
              )}
              <button className={`${outcome.passed ? "btn-ghost" : "btn-primary"} rounded-xl py-3 text-xs`} onClick={retry}>
                {outcome.passed ? "PLAY AGAIN" : "TRY AGAIN"}
              </button>
              <button className="btn-ghost rounded-xl py-3 text-xs !text-dim" onClick={onExit}>
                LEARN MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------

function pickTargets(tokens: string[], count: number): string[] {
  const chars = [...new Set(tokens.filter((t) => t.length === 1))];
  if (!chars.length) return "asdfjkl;".split("").slice(0, count);
  const out: string[] = [];
  while (out.length < count) out.push(chars[out.length % chars.length]);
  return out.sort(() => Math.random() - 0.5);
}

function mapBundle(b: { keyboard: boolean; fingers: boolean; highlight: boolean; next: boolean; hands: boolean }) {
  return {
    showKeyboard: b.keyboard,
    showFingerGuide: b.fingers,
    highlightRequiredKey: b.highlight,
    showNextKey: b.next,
    showHandPosition: b.hands,
  };
}
