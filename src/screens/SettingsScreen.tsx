import { useEffect, useRef, useState } from "react";
import { BackgroundFX, Icon, Segmented, Slider, Toggle } from "../components/ui";
import { GuidanceLevel, loadStore, SPEED_PRESETS, updateSettings, Settings } from "../store";
import { audio, KeyProfile } from "../audio/audio";

const GUIDANCE_BUNDLES: Record<GuidanceLevel, Partial<Settings>> = {
  A: { showKeyboard: true, showFingerGuide: true, highlightRequiredKey: true, showNextKey: true, showHandPosition: true },
  B: { showKeyboard: true, showFingerGuide: true, highlightRequiredKey: true, showNextKey: false, showHandPosition: true },
  C: { showKeyboard: true, showFingerGuide: false, highlightRequiredKey: true, showNextKey: false, showHandPosition: false },
  D: { showKeyboard: true, showFingerGuide: false, highlightRequiredKey: false, showNextKey: false, showHandPosition: false },
  E: { showKeyboard: false, showFingerGuide: false, highlightRequiredKey: false, showNextKey: false, showHandPosition: false },
};

const PROFILES: { value: KeyProfile; label: string; desc: string }[] = [
  { value: "blue", label: "MECH BLUE", desc: "sharp clicky" },
  { value: "red", label: "MECH RED", desc: "soft linear" },
  { value: "brown", label: "MECH BROWN", desc: "tactile bump" },
  { value: "premium", label: "PREMIUM", desc: "deep & clean" },
  { value: "retro", label: "RETRO", desc: "8-bit clack" },
];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState<Settings>({ ...loadStore().settings });
  const set = (patch: Partial<Settings>) => {
    const next = updateSettings(patch);
    setS({ ...next });
    audio.setVolumes({ music: next.musicVol, keys: next.keyVol, fx: next.fxVol, muted: next.muted });
  };

  return (
    <div className="relative h-screen overflow-y-auto">
      <BackgroundFX hue={260} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center gap-4">
          <button onClick={() => { audio.playUi(); onBack(); }} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Back">
            <Icon name="back" size={16} />
          </button>
          <div>
            <h1 className="font-display text-2xl tracking-wider text-fog text-glow-volt">SETTINGS</h1>
            <p className="font-mono text-[11px] text-dim">saved locally · applied instantly</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* audio */}
          <section className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-volt"><Icon name="wave" size={14} /> AUDIO</h2>
            <div className="mt-4 space-y-4">
              <Slider label="Music volume" value={s.musicVol} min={0} max={1} step={0.05} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => set({ musicVol: v })} />
              <Slider label="Keyboard volume" value={s.keyVol} min={0} max={1} step={0.05} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => { set({ keyVol: v }); audio.playKey("a", s.keyProfile); }} />
              <Slider label="Effects volume" value={s.fxVol} min={0} max={1} step={0.05} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => { set({ fxVol: v }); audio.playJudgment("great"); }} />
              <Toggle label="Mute everything" value={s.muted} onChange={(v) => set({ muted: v })} />
            </div>

            <h3 className="mt-5 font-mono text-[9px] tracking-[0.3em] text-faint">KEY SOUND PROFILE</h3>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {PROFILES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { set({ keyProfile: p.value }); audio.playKey("k", p.value); audio.playKey("e", p.value); }}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-all ${
                    s.keyProfile === p.value
                      ? "border-volt bg-volt/10 shadow-[0_0_14px_rgba(0,229,255,0.25)]"
                      : "border-ink-600 bg-ink-900/60 hover:border-ink-500"
                  }`}
                >
                  <span className="font-display text-[11px] tracking-wider text-fog">{p.label}</span>
                  <span className="font-mono text-[10px] text-faint">{p.desc} · tap to test</span>
                </button>
              ))}
            </div>
          </section>

          {/* gameplay */}
          <section className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-volt"><Icon name="keys" size={14} /> GAMEPLAY</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Slider label="Note speed (visual — independent of music BPM)" value={s.noteSpeed} min={0.5} max={2} step={0.05} format={(v) => "×" + v.toFixed(2)} onChange={(v) => set({ noteSpeed: v })} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SPEED_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { set({ noteSpeed: p.speed }); audio.playUi(); }}
                      className={`rounded-lg border px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider transition-all ${
                        Math.abs(s.noteSpeed - p.speed) < 0.01
                          ? "border-volt bg-volt/15 text-volt shadow-[0_0_12px_rgba(0,229,255,0.3)]"
                          : "border-ink-500 bg-ink-900/70 text-dim hover:text-fog"
                      }`}
                    >
                      {p.label} {p.speed.toFixed(2).replace(/0+$/, "")}x
                    </button>
                  ))}
                </div>
              </div>
              <Slider label="Timing offset (or calibrate below)" value={s.timingOffset} min={-150} max={150} step={5} format={(v) => (v > 0 ? "+" : "") + v + " ms"} onChange={(v) => set({ timingOffset: v })} />
              <Toggle label="Smart speed suggestions" hint="suggests faster/slower after consistent runs — you always decide" value={s.adaptive} onChange={(v) => set({ adaptive: v })} />
              <Toggle label="Show WPM" value={s.showWpm} onChange={(v) => set({ showWpm: v })} />
              <Toggle label="Show accuracy" value={s.showAcc} onChange={(v) => set({ showAcc: v })} />
            </div>

            <h3 className="mt-5 font-mono text-[9px] tracking-[0.3em] text-faint">GUIDED TYPING — wean off gradually (A → E)</h3>
            <div className="mt-2 flex items-center gap-2">
              <Segmented
                small
                options={(["A", "B", "C", "D", "E"] as GuidanceLevel[]).map((l) => ({ value: l, label: l }))}
                value={s.guidanceLevel}
                onChange={(l) => set({ guidanceLevel: l, ...GUIDANCE_BUNDLES[l] })}
              />
              <span className="font-mono text-[9px] text-faint">A full help · E keyboard hidden</span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
              <Toggle label="Show keyboard" value={s.showKeyboard} onChange={(v) => set({ showKeyboard: v })} />
              <Toggle label="Show finger guide" value={s.showFingerGuide} onChange={(v) => set({ showFingerGuide: v })} />
              <Toggle label="Highlight required key" value={s.highlightRequiredKey} onChange={(v) => set({ highlightRequiredKey: v })} />
              <Toggle label="Show next key" value={s.showNextKey} onChange={(v) => set({ showNextKey: v })} />
              <Toggle label="Show hand position" value={s.showHandPosition} onChange={(v) => set({ showHandPosition: v })} />
            </div>

            <h3 className="mt-5 font-mono text-[9px] tracking-[0.3em] text-faint">TIMING WINDOWS (NORMAL)</h3>
            <div className="mt-2 flex gap-2 font-mono text-[10px]">
              <span className="rounded-md bg-lime-neon/10 px-2 py-1 text-lime-neon">PERFECT ±50ms</span>
              <span className="rounded-md bg-volt/10 px-2 py-1 text-volt">GREAT ±100ms</span>
              <span className="rounded-md bg-gold/10 px-2 py-1 text-gold">GOOD ±180ms</span>
            </div>
          </section>

          {/* visual */}
          <section className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-volt"><Icon name="bolt" size={14} /> VISUAL</h2>
            <div className="mt-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-dim">Quality</span>
                <Segmented
                  small
                  options={[{ value: "low", label: "LOW" }, { value: "high", label: "HIGH" }]}
                  value={s.quality}
                  onChange={(v) => set({ quality: v })}
                />
              </div>
              <Toggle label="Particle effects" value={s.particles} onChange={(v) => set({ particles: v })} />
              <Toggle label="Screen shake" value={s.screenShake} onChange={(v) => set({ screenShake: v })} />
              <Toggle label="Background effects" value={s.bgEffects} onChange={(v) => set({ bgEffects: v })} />
              <Toggle label="Reduced motion" value={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
              <Toggle label="High contrast text" value={s.highContrast} onChange={(v) => set({ highContrast: v })} />
              <Toggle label="Color-blind friendly judgments" hint="shape-coded popups" value={s.colorBlind} onChange={(v) => set({ colorBlind: v })} />
            </div>
          </section>

          {/* calibration */}
          <section className="panel rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-xs tracking-[0.25em] text-gold"><Icon name="target" size={14} /> AUDIO CALIBRATION</h2>
            <p className="mt-3 text-[12px] leading-relaxed text-dim">
              Every device has a little audio latency. Press <span className="keycap">SPACE</span> exactly when you
              hear each beep — we'll compute your offset automatically.
            </p>
            <div className="mt-3 font-mono text-[11px] text-faint">
              current offset:{" "}
              <span className={s.timingOffset === 0 ? "text-dim" : "text-gold"}>
                {s.timingOffset > 0 ? "+" : ""}{s.timingOffset} ms
              </span>
            </div>
            <Calibration
              onApply={(ms) => set({ timingOffset: ms })}
            />
          </section>
        </div>

        <div className="mt-5 flex justify-between">
          <button onClick={() => { audio.playUi(); onBack(); }} className="btn-primary rounded-xl px-8 py-3 text-sm">
            DONE
          </button>
          <span className="self-center font-mono text-[10px] text-faint">KEYBEAT v1.0 · progress stored in this browser</span>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// calibration widget
// ------------------------------------------------------------------

function Calibration({ onApply }: { onApply: (ms: number) => void }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [beeps, setBeeps] = useState(0);
  const [offset, setOffset] = useState<number | null>(null);
  const diffs = useRef<number[]>([]);
  const beepTimes = useRef<number[]>([]);
  const timers = useRef<number[]>([]);

  const TOTAL = 8;

  const start = () => {
    audio.ensure();
    diffs.current = [];
    beepTimes.current = [];
    setOffset(null);
    setBeeps(0);
    setPhase("running");
    for (let i = 0; i < TOTAL; i++) {
      const delay = 1200 + i * 620;
      timers.current.push(
        window.setTimeout(() => {
          beepTimes.current.push(audio.now());
          audio.playCalib(i % 4 === 0);
          setBeeps(i + 1);
        }, delay),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        finish();
      }, 1200 + TOTAL * 620 + 600),
    );
  };

  const finish = () => {
    setPhase("done");
    const ds = diffs.current;
    if (ds.length >= 3) {
      ds.sort((a, b) => a - b);
      const median = ds[Math.floor(ds.length / 2)];
      setOffset(Math.round(Math.max(-150, Math.min(150, median * 1000))));
    } else {
      setOffset(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || phase !== "running" || e.repeat) return;
      e.preventDefault();
      const now = audio.now();
      // match to most recent beep
      const last = beepTimes.current[beepTimes.current.length - 1];
      if (last !== undefined && now - last < 0.5) {
        diffs.current.push(now - last);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, [phase]);

  return (
    <div className="mt-4">
      {phase === "idle" && (
        <button onClick={start} className="btn-ghost w-full rounded-xl py-2.5 text-xs">
          START CALIBRATION
        </button>
      )}
      {phase === "running" && (
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 text-center">
          <div className="font-display text-sm tracking-widest text-gold">LISTEN… TAP SPACE ON THE BEEP</div>
          <div className="mt-2 flex justify-center gap-1.5">
            {Array.from({ length: TOTAL }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full transition-all ${i < beeps ? "bg-gold shadow-[0_0_8px_rgba(255,201,77,0.8)]" : "bg-ink-600"}`}
              />
            ))}
          </div>
          <div className="mt-2 font-mono text-[10px] text-faint">{diffs.current.length} taps recorded</div>
        </div>
      )}
      {phase === "done" && (
        <div className="rise-in rounded-xl border border-volt/40 bg-volt/5 p-4 text-center">
          {offset !== null ? (
            <>
              <div className="font-mono text-[10px] tracking-[0.3em] text-faint">MEASURED LATENCY</div>
              <div className="font-display text-3xl text-volt text-glow-volt">{offset > 0 ? "+" : ""}{offset} ms</div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => { audio.playUi(); onApply(offset); setPhase("idle"); }} className="btn-primary flex-1 rounded-lg py-2 text-xs">
                  APPLY
                </button>
                <button onClick={start} className="btn-ghost flex-1 rounded-lg py-2 text-xs">RETRY</button>
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-sm text-alarm">NOT ENOUGH TAPS</div>
              <button onClick={start} className="btn-ghost mt-3 w-full rounded-lg py-2 text-xs">TRY AGAIN</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
