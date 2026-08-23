import { Component, ReactNode, useEffect, useRef, useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { SongSelect } from "./screens/SongSelect";
import { GameScreen, GameConfig } from "./screens/GameScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { LearnScreen } from "./screens/LearnScreen";
import { LessonScreen } from "./screens/LessonScreen";
import { Onboarding } from "./screens/Onboarding";
import { KeyMapScreen } from "./screens/KeyMapScreen";
import { FindKeyGame, WhichFingerGame, ChallengeScreen, ChallengeKind } from "./screens/MiniGames";
import { GameResult } from "./game/engine";
import { SONGS, getSong } from "./game/songs";
import { audio } from "./audio/audio";
import { getDaily, loadStore, processGame, resetSave, GameOutcome } from "./store";

// Last line of defense: a bad save, an unsupported API or a content bug
// shows a recovery panel instead of a blank screen.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    // details go to the dev console only — never into the rendered UI
    console.error("KEYBEAT crashed:", error);
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-screen items-center justify-center bg-ink-950 px-6">
        <div className="panel w-full max-w-md rounded-2xl p-8 text-center">
          <div className="font-display text-xl tracking-widest text-flare">SOMETHING WENT OFF-BEAT</div>
          <p className="mt-3 text-[13px] leading-relaxed text-dim">
            The game hit an unexpected error. Your progress is stored safely in this browser — reloading will almost always fix it.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button className="btn-primary rounded-xl py-3 text-sm" onClick={() => window.location.reload()}>
              RELOAD GAME
            </button>
            <button
              className="btn-ghost rounded-xl py-3 text-xs !text-dim"
              onClick={() => {
                resetSave();
                window.location.reload();
              }}
            >
              RESET SAVE DATA (last resort)
            </button>
          </div>
        </div>
      </div>
    );
  }
}

type Screen =
  | { name: "menu" }
  | { name: "songs"; practice: boolean }
  | { name: "game"; config: GameConfig }
  | { name: "results"; result: GameResult; outcome: GameOutcome }
  | { name: "settings" }
  | { name: "stats" }
  | { name: "learn" }
  | { name: "lesson"; lessonId: string }
  | { name: "onboarding" }
  | { name: "keymap" }
  | { name: "minigame"; kind: "find" | "finger" }
  | { name: "challenge"; kind: ChallengeKind };

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const [screen, setScreen] = useState<Screen>({ name: "menu" });
  const [gameId, setGameId] = useState(0);
  const lastConfig = useRef<GameConfig | null>(null);

  // unlock audio on first interaction + apply saved volumes
  useEffect(() => {
    const unlock = () => {
      const s = loadStore().settings;
      audio.ensure();
      audio.setVolumes({ music: s.musicVol, keys: s.keyVol, fx: s.fxVol, muted: s.muted });
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // high-contrast accessibility hook
  useEffect(() => {
    document.body.classList.toggle("hc", loadStore().settings.highContrast);
  }, [screen]);

  const startGame = (config: GameConfig) => {
    lastConfig.current = config;
    setGameId((g) => g + 1);
    setScreen({ name: "game", config });
  };

  const quickPlay = () => {
    const song = SONGS[Math.floor(Math.random() * SONGS.length)];
    startGame({ mode: "song", songId: song.id, difficulty: song.difficulty, speedMult: 1, timeLimit: 0 });
  };

  const handleFinish = (
    result: GameResult,
    stats: { attempts: Record<string, number>; mistakes: Record<string, number> },
    noteSpeedUsed: number,
  ) => {
    const outcome = processGame(result, stats.mistakes, stats.attempts, noteSpeedUsed);
    setScreen({ name: "results", result, outcome });
  };

  const nextSongFrom = (songId: string): GameConfig | null => {
    const idx = SONGS.findIndex((s) => s.id === songId);
    if (idx < 0) return null;
    const next = SONGS[(idx + 1) % SONGS.length];
    return { mode: "song", songId: next.id, difficulty: next.difficulty, speedMult: 1, timeLimit: 0 };
  };

  if (screen.name === "game") {
    return (
      <GameScreen
        key={gameId}
        config={screen.config}
        onFinish={handleFinish}
        onQuit={() => setScreen({ name: "menu" })}
      />
    );
  }

  if (screen.name === "results") {
    const { result, outcome } = screen;
    const next = nextSongFrom(result.songId);
    return (
      <ResultsScreen
        result={result}
        outcome={outcome}
        onRetry={() => lastConfig.current && startGame(lastConfig.current)}
        onNext={next ? () => startGame(next) : null}
        onSongs={() => setScreen({ name: "songs", practice: false })}
        onMenu={() => setScreen({ name: "menu" })}
      />
    );
  }

  if (screen.name === "songs") {
    return (
      <SongSelect
        practice={screen.practice}
        onBack={() => setScreen({ name: "menu" })}
        onPlay={(songId, speedMult, noteSpeed) => {
          const song = getSong(songId);
          startGame({
            mode: screen.practice ? "practice" : "song",
            songId,
            difficulty: song.difficulty,
            speedMult,
            timeLimit: 0,
            noteSpeed,
          });
        }}
      />
    );
  }

  if (screen.name === "settings") {
    return <SettingsScreen onBack={() => setScreen({ name: "menu" })} />;
  }
  if (screen.name === "stats") {
    return <StatsScreen onBack={() => setScreen({ name: "menu" })} />;
  }
  if (screen.name === "learn") {
    return (
      <LearnScreen
        onBack={() => setScreen({ name: "menu" })}
        onLesson={(id) => setScreen({ name: "lesson", lessonId: id })}
        onMiniGame={(kind) => setScreen({ name: "minigame", kind })}
        onChallenge={(kind) => setScreen({ name: "challenge", kind })}
        onKeyMap={() => setScreen({ name: "keymap" })}
      />
    );
  }
  if (screen.name === "keymap") {
    return <KeyMapScreen onBack={() => setScreen({ name: "learn" })} />;
  }
  if (screen.name === "challenge") {
    return <ChallengeScreen key={screen.kind} kind={screen.kind} onExit={() => setScreen({ name: "learn" })} />;
  }
  if (screen.name === "lesson") {
    return (
      <LessonScreen
        key={screen.lessonId}
        lessonId={screen.lessonId}
        onExit={() => setScreen({ name: "learn" })}
        onOpenLesson={(id) => setScreen({ name: "lesson", lessonId: id })}
      />
    );
  }
  if (screen.name === "onboarding") {
    return (
      <Onboarding
        onDone={() => setScreen({ name: "lesson", lessonId: "basics" })}
        onSkipToMenu={() => setScreen({ name: "menu" })}
      />
    );
  }
  if (screen.name === "minigame") {
    return screen.kind === "find"
      ? <FindKeyGame onExit={() => setScreen({ name: "learn" })} />
      : <WhichFingerGame onExit={() => setScreen({ name: "learn" })} />;
  }

  return (
    <MainMenu
      onLearn={() => setScreen(loadStore().onboarded ? { name: "learn" } : { name: "onboarding" })}
      onQuickPlay={quickPlay}
      onSongs={(practice) => setScreen({ name: "songs", practice })}
      onTimeAttack={(sec) =>
        startGame({
          mode: "time",
          songId: SONGS[2].id,
          difficulty: "normal",
          speedMult: 1,
          timeLimit: sec,
        })
      }
      onEndless={() =>
        startGame({
          mode: "endless",
          songId: SONGS[Math.floor(Math.random() * SONGS.length)].id,
          difficulty: "normal",
          speedMult: 1,
          timeLimit: 0,
        })
      }
      onCustom={(text) =>
        startGame({ mode: "custom", songId: "custom", difficulty: "normal", speedMult: 1, timeLimit: 0, customText: text })
      }
      onDaily={() => {
        const d = getDaily();
        startGame({ mode: "song", songId: d.songId, difficulty: d.difficulty, speedMult: 1, timeLimit: 0 });
      }}
      onStats={() => setScreen({ name: "stats" })}
      onSettings={() => setScreen({ name: "settings" })}
    />
  );
}
