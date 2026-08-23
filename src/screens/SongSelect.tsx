import { useMemo, useState } from "react";
import { BackgroundFX, CoverArt, Icon, Segmented } from "../components/ui";
import { SONGS } from "../game/songs";
import { DIFF_COLOR, DIFF_LABEL, Difficulty } from "../game/content";
import { loadStore } from "../store";
import { audio } from "../audio/audio";

export function SongSelect({
  practice,
  onPlay,
  onBack,
}: {
  practice: boolean;
  onPlay: (songId: string, speedMult: number, noteSpeed?: number) => void;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<Difficulty | "all">("all");
  const [speed, setSpeed] = useState<"1" | "0.85" | "0.7" | "0.55">("0.85");
  const store = loadStore();

  const songs = useMemo(
    () => SONGS.filter((s) => filter === "all" || s.difficulty === filter),
    [filter],
  );

  return (
    <div className="relative h-screen overflow-y-auto">
      <BackgroundFX hue={practice ? 150 : 210} />
      <div className="scanlines pointer-events-none fixed inset-0 z-10" />

      <div className="relative z-20 mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={() => { audio.playUi(); onBack(); }} className="btn-ghost flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Back">
            <Icon name="back" size={16} />
          </button>
          <div>
            <h1 className="font-display text-2xl tracking-wider text-fog text-glow-volt">
              {practice ? "PRACTICE MODE" : "SONG LIBRARY"}
            </h1>
            <p className="font-mono text-[11px] text-dim">
              {practice
                ? "music tempo 50–150% · note speed stays yours · pause anytime"
                : "BPM sets the rhythm · note speed sets how fast notes fall — they're independent"}
            </p>
          </div>
          <div className="flex-1" />
          {practice && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-widest text-faint">MUSIC TEMPO</span>
              <Segmented
                small
                options={[
                  { value: "1", label: "×1.0" },
                  { value: "0.85", label: "×0.85" },
                  { value: "0.7", label: "×0.7" },
                  { value: "0.55", label: "×0.55" },
                ]}
                value={speed}
                onChange={(v) => { audio.playUi(); setSpeed(v); }}
              />
            </div>
          )}
        </div>

        {/* filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["all", "beginner", "novice", "easy", "normal", "hard", "expert"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { audio.playUi(); setFilter(f); }}
              className={`rounded-full border px-4 py-1.5 font-display text-[10px] tracking-[0.18em] transition-all ${
                filter === f
                  ? "border-volt bg-volt/15 text-volt shadow-[0_0_16px_rgba(0,229,255,0.3)]"
                  : "border-ink-500 bg-ink-900/70 text-dim hover:text-fog"
              }`}
            >
              {f === "all" ? "ALL TRACKS" : DIFF_LABEL[f]}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-faint">{songs.length} tracks</span>
        </div>

        {/* cards */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {songs.map((s, i) => {
            const best = store.songBests[s.id];
            const dc = DIFF_COLOR[s.difficulty];
            const stars = best ? Math.max(1, Math.round(best.completion * 5)) : 0;
            return (
              <div
                key={s.id}
                className="panel rise-in group flex gap-4 rounded-2xl p-4 transition-all hover:border-volt/40 hover:shadow-[0_0_36px_rgba(0,229,255,0.1)]"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <CoverArt hue={s.hue} hue2={s.hue2} title={s.title} size={118} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-display text-[15px] tracking-wide text-fog">{s.title.toUpperCase()}</div>
                      <div className="font-mono text-[10px] text-faint">{s.artist}</div>
                    </div>
                    <span
                      className="shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold"
                      style={{ color: dc, background: dc + "1f", border: `1px solid ${dc}55` }}
                    >
                      {DIFF_LABEL[s.difficulty]}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-dim">
                    <span className="text-volt">♩ {s.bpm} BPM</span>
                    <span className="text-gold" title="typing complexity">
                      TYPING {"★".repeat(s.complexity)}<span className="text-ink-500">{"★".repeat(5 - s.complexity)}</span>
                    </span>
                    <span className="tracking-wider text-dim" aria-label={`${stars} stars`}>
                      {"★".repeat(stars)}<span className="text-ink-500">{"★".repeat(5 - stars)}</span>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] italic text-faint">{s.tagline}</p>

                  <div className="mt-auto">
                    {best ? (
                      <div className="grid grid-cols-4 gap-1.5 pt-2 text-center">
                        {[
                          ["WPM", best.wpm, "text-lime-neon"],
                          ["ACC", best.accuracy.toFixed(0) + "%", "text-volt"],
                          ["COMBO", best.maxCombo, "text-flare"],
                          ["SCORE", best.score >= 1000 ? (best.score / 1000).toFixed(1) + "k" : best.score, "text-gold"],
                        ].map(([l, v, c]) => (
                          <div key={l as string} className="rounded-md bg-ink-900/80 px-1 py-1.5">
                            <div className="font-mono text-[8px] tracking-[0.15em] text-faint">{l}</div>
                            <div className={`font-display text-[12px] ${c}`}>{v}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="pt-2 font-mono text-[10px] italic text-faint">not played yet — set the first record</div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => { audio.ensure(); audio.playUi(); onPlay(s.id, practice ? parseFloat(speed) : 1); }}
                        className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs"
                      >
                        <Icon name="play" size={13} />
                        {practice ? `PRACTICE ×${speed}` : "PLAY"}
                      </button>
                      {!practice && (
                        <button
                          onClick={() => { audio.ensure(); audio.playUi(); onPlay(s.id, 1, s.recSpeed); }}
                          className="btn-ghost rounded-xl px-3 py-2.5 font-mono text-[10px] !tracking-normal"
                          title="Play with this track's recommended note speed"
                        >
                          @ {s.recSpeed.toFixed(2)}x
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center font-mono text-[10px] text-faint">
          high BPM never forces fast typing — every track can be played at any note speed in Settings → Gameplay
        </p>
      </div>
    </div>
  );
}
