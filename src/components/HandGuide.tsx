import { FINGER_COLORS, HOME_GUIDE, fingerColor, fingerInfo, fingerLabel } from "../game/fingers";

// Animated hand-position diagram: two hands resting on the home row.
// The responsible finger dives down when its key is required.

const HEIGHTS: Record<string, number> = {
  pinky: 46, ring: 58, middle: 64, index: 56,
};

export function HandGuide({ active, compact = false }: { active: string | null; compact?: boolean }) {
  const info = active ? fingerInfo(active) : null;
  const scale = compact ? 0.85 : 1;

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ transform: `scale(${scale})` }}>
      {/* readout */}
      <div className="flex h-7 items-center gap-2">
        {active && info ? (
          <>
            <span
              className="rounded-md px-2.5 py-1 font-display text-[11px] tracking-[0.15em] text-ink-950"
              style={{ background: fingerColor(active)!, boxShadow: `0 0 16px ${fingerColor(active)}88` }}
            >
              {fingerLabel(active)}
            </span>
            <span className="font-mono text-[11px] text-dim">
              press <span className="font-bold text-fog">{active === " " ? "SPACE" : active.toUpperCase()}</span>
            </span>
          </>
        ) : (
          <span className="font-mono text-[10px] tracking-[0.25em] text-faint">FINGERS ON HOME ROW</span>
        )}
      </div>

      <div className="flex items-end gap-6">
        {/* left hand */}
        <Hand
          side="left"
          keys={HOME_GUIDE.filter((k) => k.info.hand === "left")}
          active={active}
        />
        {/* thumbs + space */}
        <div className="flex flex-col items-center gap-1 pb-[2px]">
          <div
            className="h-4 w-14 rounded-full border transition-all duration-150"
            style={{
              borderColor: active === " " ? FINGER_COLORS.left.thumb : "rgba(42,56,102,0.7)",
              background: active === " " ? FINGER_COLORS.left.thumb : "rgba(18,26,54,0.5)",
              boxShadow: active === " " ? `0 0 14px ${FINGER_COLORS.left.thumb}` : "none",
            }}
          />
          <span className="font-mono text-[8px] tracking-[0.2em] text-faint">SPACE</span>
        </div>
        {/* right hand */}
        <Hand
          side="right"
          keys={HOME_GUIDE.filter((k) => k.info.hand === "right")}
          active={active}
        />
      </div>
    </div>
  );
}

function Hand({
  side,
  keys,
  active,
}: {
  side: "left" | "right";
  keys: { key: string; info: { hand: "left" | "right"; finger: "pinky" | "ring" | "middle" | "index" | "thumb" } }[];
  active: string | null;
}) {
  const activeInfo = active ? fingerInfo(active) : null;
  return (
    <div className="flex items-end gap-[5px]">
      {keys.map(({ key, info }) => {
        const color = FINGER_COLORS[info.hand][info.finger];
        const isActive =
          !!activeInfo && activeInfo.hand === info.hand && activeInfo.finger === info.finger;
        const h = HEIGHTS[info.finger];
        return (
          <div key={key} className="flex flex-col items-center gap-1">
            {/* finger capsule */}
            <div
              className="w-7 rounded-t-full border transition-all duration-150"
              style={{
                height: h,
                transform: isActive ? "translateY(7px)" : "translateY(0)",
                borderColor: color,
                background: isActive
                  ? `linear-gradient(180deg, ${color}, ${color}55)`
                  : `linear-gradient(180deg, ${color}44, ${color}18)`,
                boxShadow: isActive ? `0 0 18px ${color}aa` : `inset 0 -6px 10px ${color}22`,
              }}
            >
              <div className="mx-auto mt-1 h-2 w-3 rounded-full" style={{ background: isActive ? "#04060e55" : `${color}66` }} />
            </div>
            {/* key */}
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md border font-mono text-[11px] font-bold transition-all duration-150"
              style={{
                borderColor: isActive ? color : "rgba(42,56,102,0.8)",
                color: isActive ? "#04060e" : "#93a1c7",
                background: isActive ? color : "linear-gradient(180deg,#141d3a,#0b1122)",
                boxShadow: isActive ? `0 0 14px ${color}` : "0 2px 0 rgba(0,0,0,0.5)",
              }}
            >
              {key === ";" ? ";" : key.toUpperCase()}
            </div>
          </div>
        );
      })}
      <span
        className="mb-8 font-mono text-[8px] tracking-[0.2em] text-faint"
        style={{ writingMode: "vertical-rl" }}
      >
        {side === "left" ? "LEFT" : "RIGHT"}
      </span>
    </div>
  );
}
