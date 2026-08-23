import { useEffect, useRef, useState } from "react";
import { BackgroundFX, Icon } from "../components/ui";
import { Keyboard, KbApi } from "../components/Keyboard";
import { HandGuide } from "../components/HandGuide";
import { completeOnboarding } from "../store";
import { audio } from "../audio/audio";

// First-time experience: welcome → hand position → find F → find J → first lesson.

export function Onboarding({ onDone, onSkipToMenu }: { onDone: () => void; onSkipToMenu: () => void }) {
  const [step, setStep] = useState(0);
  const [flash, setFlash] = useState(false);
  const kbApi = useRef<KbApi | null>(null);
  const advancing = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const skip = () => {
    completeOnboarding();
    onSkipToMenu();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (step === 2 || step === 3) {
        const want = step === 2 ? "f" : "j";
        kbApi.current?.key(e.key.toLowerCase(), "down");
        if (e.key.toLowerCase() === want && !advancing.current) {
          advancing.current = true;
          kbApi.current?.key(want, "correct");
          audio.ensure();
          audio.playJudgment("perfect");
          setFlash(true);
          setTimeout(() => {
            advancing.current = false;
            if (!alive.current) return;
            setFlash(false);
            setStep((s) => s + 1);
          }, 700);
        } else if (e.key.length === 1 && !advancing.current) {
          kbApi.current?.key(e.key, "error");
          audio.ensure();
          audio.playError();
        }
      }
    };
    const onUp = (e: KeyboardEvent) => kbApi.current?.key(e.key.toLowerCase(), "up");
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [step]);

  const next = () => {
    audio.ensure();
    audio.playUi();
    setStep((s) => s + 1);
  };

  return (
    <div className="relative h-screen overflow-y-auto">
      <BackgroundFX hue={170} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-6 py-10 text-center">
        {step === 0 && (
          <div className="rise-in">
            <div className="font-mono text-[11px] tracking-[0.5em] text-volt">WELCOME</div>
            <h1 className="mt-3 font-display text-4xl leading-tight text-fog text-glow-volt">
              Let's learn<br />touch typing.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-dim">
              You don't need to know where the keys are.<br />
              You don't need to be fast.<br />
              <span className="text-volt">We'll teach you — one finger at a time.</span>
            </p>
            <button onClick={next} className="btn-primary mt-8 rounded-xl px-10 py-4 text-sm">
              START LEARNING
            </button>
            <button onClick={skip} className="btn-ghost mt-3 block w-full max-w-[280px] rounded-xl py-2.5 text-[10px] !text-faint">
              I ALREADY TYPE — SKIP TO MENU
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="rise-in w-full">
            <div className="font-mono text-[11px] tracking-[0.5em] text-volt">STEP 1 · HAND POSITION</div>
            <h2 className="mt-2 font-display text-2xl text-fog">Place your fingers here.</h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-dim">
              Left hand rests on <span className="text-flare">A S D F</span>, right hand on{" "}
              <span className="text-volt">J K L ;</span>. Thumbs hover over space.
              Feel the tiny bumps on <span className="keycap">F</span> and <span className="keycap">J</span> —
              they let you find home <em>without looking</em>.
            </p>
            <div className="mt-6 flex justify-center">
              <HandGuide active={null} />
            </div>
            <div className="mt-6">
              <Keyboard api={kbApi} showFingers />
            </div>
            <button onClick={next} className="btn-primary mt-6 rounded-xl px-10 py-3.5 text-sm">
              MY HANDS ARE SET
            </button>
          </div>
        )}

        {(step === 2 || step === 3) && (
          <div className={`rise-in w-full ${flash ? "count-glow" : ""}`} key={step}>
            <div className="font-mono text-[11px] tracking-[0.5em] text-volt">
              STEP {step === 2 ? 2 : 3} · FIND THE KEY
            </div>
            <h2 className="mt-2 font-display text-2xl text-fog">
              Find <span style={{ color: step === 2 ? "#a8ff3e" : "#00e5ff" }}>{step === 2 ? "F" : "J"}</span>
            </h2>
            <div className="mt-5 flex justify-center">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl font-display text-5xl text-ink-950"
                style={{
                  background: step === 2 ? "#a8ff3e" : "#00e5ff",
                  boxShadow: `0 0 50px ${step === 2 ? "#a8ff3e" : "#00e5ff"}88`,
                  animation: "beat-pulse 1s ease-in-out infinite",
                }}
              >
                {step === 2 ? "F" : "J"}
              </div>
            </div>
            <div className="mt-4">
              <span
                className="rounded-md px-3 py-1.5 font-display text-[13px] tracking-[0.2em] text-ink-950"
                style={{ background: step === 2 ? "#a8ff3e" : "#00e5ff" }}
              >
                {step === 2 ? "LEFT INDEX FINGER" : "RIGHT INDEX FINGER"}
              </span>
            </div>
            <p className="mt-3 font-mono text-[11px] text-faint">
              look at the keyboard now — later you won't need to · press {step === 2 ? "F" : "J"}
            </p>
            {flash && (
              <div className="milestone-blast mt-4 font-display text-2xl text-lime-neon text-glow-volt">
                {step === 2 ? "THAT'S HOME LEFT" : "THAT'S HOME RIGHT"}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="rise-in">
            <Icon name="trophy" size={44} className="mx-auto text-gold" />
            <h2 className="mt-4 font-display text-3xl text-fog text-glow-gold">You found home.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-dim">
              Everything else is built from this position. Lesson 1 waits for you —
              it's slow, patient, and nothing times out.
            </p>
            <button
              onClick={() => {
                completeOnboarding();
                audio.playUi();
                onDone();
              }}
              className="btn-primary mt-7 rounded-xl px-10 py-4 text-sm"
            >
              START LESSON 1 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
