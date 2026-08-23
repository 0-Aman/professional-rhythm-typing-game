import { KEY_MAP, ROW_LABEL } from "../game/keymap";
import { fingerColor, fingerLabel } from "../game/fingers";

// Animated demonstration of a finger's journey: home → reach → home.
export function MovementViz({ home, reach, tiny = false }: { home: string; reach: string; tiny?: boolean }) {
  const def = KEY_MAP[reach];
  const up = def ? def.movement === "up" || def.movement === "up2" : true;
  const color = fingerColor(reach) ?? "#00e5ff";
  const cap = (k: string, anchor: boolean) => (
    <div
      className={`flex items-center justify-center rounded-md border font-mono font-bold ${tiny ? "h-8 w-8 text-[12px]" : "h-10 w-10 text-[14px]"}`}
      style={{
        borderColor: anchor ? color : "rgba(42,56,102,0.8)",
        color: anchor ? "#04060e" : "#93a1c7",
        background: anchor ? color : "linear-gradient(180deg,#141d3a,#0b1122)",
        boxShadow: anchor ? `0 0 14px ${color}` : "0 2px 0 rgba(0,0,0,0.5)",
      }}
    >
      {k === "," ? "," : k.toUpperCase()}
    </div>
  );
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex flex-col items-center gap-0.5" style={{ height: tiny ? 92 : 116 }}>
        <div className="absolute inset-x-0 top-[10%] bottom-[10%] flex justify-center">
          <div className="w-px bg-gradient-to-b from-ink-500 via-ink-600 to-ink-500" />
        </div>
        <span
          className="finger-dot"
          style={{
            background: color,
            boxShadow: `0 0 12px ${color}`,
            ["--from" as string]: up ? "76%" : "6%",
            ["--to" as string]: up ? "6%" : "76%",
          }}
        />
        <div className="relative z-20">{up ? cap(reach, true) : cap(home, false)}</div>
        <div className="relative z-10 my-auto font-mono text-[13px] text-faint">{up ? "↑" : "↓"}</div>
        <div className="relative z-20">{up ? cap(home, false) : cap(reach, true)}</div>
      </div>
      {!tiny && (
        <div className="mt-1.5 text-center">
          <div className="font-mono text-[9px] tracking-[0.2em]" style={{ color }}>{fingerLabel(reach)}</div>
          <div className="font-mono text-[8px] text-faint">{def ? ROW_LABEL[def.row] : ""} · HOME {home.toUpperCase()}</div>
        </div>
      )}
    </div>
  );
}
