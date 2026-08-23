import React, { useEffect, useRef } from "react";
import { loadStore } from "../store";

// ------------------------------------------------------------------
// icons (inline SVG)
// ------------------------------------------------------------------

const PATHS: Record<string, React.ReactNode> = {
  note: <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />,
  bolt: <path d="M13 2 3 14h7l-1 8 11-13h-7l0-7z" />,
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></>),
  flame: <path d="M12 2s5 4.5 5 9.5a5 5 0 0 1-10 0c0-2 1-3.8 2.2-5.2C9.6 8 10 9.5 11 10c0-3 .5-6 1-8z" />,
  gem: <path d="M6 3h12l4 6-10 12L2 9l4-6zm0 0 6 6 6-6M2 9h20M12 21 8 9m4 12 4-12" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>),
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1L12 2z" />,
  play: <path d="M7 4.5 19 12 7 19.5v-15z" />,
  gear: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>),
  keys: (<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" /></>),
  chart: <path d="M4 20V10m6 10V4m6 16v-8m5 8H2" />,
  pause: <path d="M8 5v14M16 5v14" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0V4zm-4 1h4m8 0h4M6 5a3 3 0 0 0 0 6m12-6a3 3 0 0 1 0 6M12 13v3m-4 4h8m-6.5 0 .5-4h4l.5 4" />,
  infinity: <path d="M8.5 8.5c-4.7 0-4.7 7 0 7 4 0 3-7 7-7 4.7 0 4.7 7 0 7-4 0-3-7-7-7z" />,
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4m8-4v4" /></>),
  text: <path d="M4 6V4h16v2M12 4v16m-3 0h6" />,
  wave: <path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" />,
  back: <path d="M15 5l-7 7 7 7" />,
};

export function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden
    >
      {PATHS[name] ?? PATHS.note}
    </svg>
  );
}

// ------------------------------------------------------------------
// logo with live EQ bars
// ------------------------------------------------------------------

export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <div className="flex items-end gap-3 select-none">
      <div className="flex items-end gap-[3px] pb-1" aria-hidden>
        {[0.9, 0.55, 1.1, 0.7, 1.25, 0.6, 0.95].map((d, i) => (
          <span
            key={i}
            className="w-[4px] rounded-sm bg-volt"
            style={{
              height: `${(big ? 30 : 16) * d}px`,
              boxShadow: "0 0 10px rgba(0,229,255,0.7)",
              animation: `beat-pulse ${0.42 + i * 0.05}s ease-in-out infinite`,
              opacity: 0.9,
            }}
          />
        ))}
      </div>
      <div>
        <div
          className={`font-display logo-flicker leading-none ${big ? "text-5xl xl:text-6xl" : "text-xl"} text-fog text-glow-volt tracking-wide`}
        >
          KEY<span className="text-volt">BEAT</span>
        </div>
        {big && (
          <div className="mt-2 font-mono text-[11px] tracking-[0.42em] text-dim uppercase">
            type the music
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// controls
// ------------------------------------------------------------------

export function Slider(props: {
  label: string; value: number; min: number; max: number; step: number;
  format?: (v: number) => string; onChange: (v: number) => void;
}) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-dim">{props.label}</span>
        <span className="font-mono text-[12px] font-bold text-volt">
          {props.format ? props.format(props.value) : props.value}
        </span>
      </div>
      <input
        type="range" min={props.min} max={props.max} step={props.step}
        value={props.value}
        style={{ ["--fill" as string]: pct + "%" }}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
      />
    </label>
  );
}

export function Toggle(props: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onChange(!props.value)}
      className="flex w-full items-center justify-between gap-4 py-1 text-left group"
    >
      <span>
        <span className="block text-[13px] font-medium text-dim group-hover:text-fog transition-colors">{props.label}</span>
        {props.hint && <span className="block text-[11px] text-faint">{props.hint}</span>}
      </span>
      <span
        className={`relative h-5 w-10 shrink-0 rounded-full border transition-all ${
          props.value ? "bg-volt/25 border-volt shadow-[0_0_12px_rgba(0,229,255,0.4)]" : "bg-ink-700 border-ink-500"
        }`}
      >
        <span
          className={`absolute top-[3px] h-3 w-3 rounded-full transition-all ${
            props.value ? "left-[22px] bg-volt" : "left-[3px] bg-faint"
          }`}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-ink-500 bg-ink-900 p-1 gap-1">
      {props.options.map((o) => (
        <button
          key={o.value}
          onClick={() => props.onChange(o.value)}
          className={`rounded-md font-display transition-all ${props.small ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-1.5 text-[11px]"} tracking-wider ${
            props.value === o.value
              ? "bg-volt text-ink-950 shadow-[0_0_14px_rgba(0,229,255,0.5)]"
              : "text-dim hover:text-fog hover:bg-ink-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="keycap">{children}</span>;
}

// ------------------------------------------------------------------
// ambient animated background for menu screens
// ------------------------------------------------------------------

export function BackgroundFX({ hue = 190 }: { hue?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const c = canvas.getContext("2d")!;
    // honor both the in-game setting and the OS preference
    let reduced = false;
    try {
      reduced =
        loadStore().settings.reducedMotion ||
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch { /* static fallback below still applies */ }
    let raf = 0;
    let W = 0, H = 0;
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(), s: Math.random() * 1.6 + 0.4, v: Math.random() * 0.012 + 0.004,
    }));

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (ms: number) => {
      const t = ms / 1000;
      const beat = (t % 0.47) / 0.47;
      const pulse = Math.pow(1 - beat, 3);

      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#070b17");
      bg.addColorStop(1, "#02030a");
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);

      // glow fields
      const g1 = c.createRadialGradient(W * 0.18, H * 0.2, 0, W * 0.18, H * 0.2, W * 0.5);
      g1.addColorStop(0, `hsla(${hue},100%,60%,${0.07 + pulse * 0.03})`);
      g1.addColorStop(1, "transparent");
      c.fillStyle = g1;
      c.fillRect(0, 0, W, H);
      const g2 = c.createRadialGradient(W * 0.85, H * 0.85, 0, W * 0.85, H * 0.85, W * 0.45);
      g2.addColorStop(0, `hsla(${hue + 130},100%,62%,0.06)`);
      g2.addColorStop(1, "transparent");
      c.fillStyle = g2;
      c.fillRect(0, 0, W, H);

      // drifting stars
      for (const st of stars) {
        st.y -= st.v * 0.16;
        if (st.y < 0) st.y = 1;
        c.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * st.v * 40 + st.x * 9));
        c.fillStyle = "#9fd8ff";
        c.fillRect(st.x * W, st.y * H, st.s, st.s);
      }
      c.globalAlpha = 1;

      // horizon grid
      const horizon = H * 0.62;
      c.strokeStyle = `hsla(${hue},100%,60%,${0.1 + pulse * 0.05})`;
      c.lineWidth = 1;
      const rows = 12;
      for (let i = 0; i < rows; i++) {
        const pp = (i + (t * 0.6) % 1) / rows;
        const y = horizon + Math.pow(pp, 2.4) * (H - horizon);
        c.globalAlpha = pp * 0.7;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
      c.globalAlpha = 0.35;
      for (let i = -8; i <= 8; i++) {
        c.beginPath();
        c.moveTo(W / 2 + i * 60, horizon);
        c.lineTo(W / 2 + i * W * 0.16, H);
        c.stroke();
      }
      c.globalAlpha = 1;
      // horizon glow line
      const hl = c.createLinearGradient(0, horizon - 1, 0, horizon + 2);
      hl.addColorStop(0, "transparent");
      hl.addColorStop(1, `hsla(${hue},100%,65%,${0.5 + pulse * 0.3})`);
      c.fillStyle = hl;
      c.fillRect(0, horizon - 2, W, 3);

      raf = requestAnimationFrame(draw);
    };
    if (reduced) {
      draw(1000); // single static frame — no animation loop
    } else {
      raf = requestAnimationFrame(draw);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [hue]);

  return <canvas ref={ref} className="fixed inset-0 -z-10 h-full w-full" aria-hidden />;
}

// procedural song cover art (SVG)
export function CoverArt({ hue, hue2, title, size = 120 }: { hue: number; hue2: number; title: string; size?: number }) {
  const bars = Array.from({ length: 24 }, (_, i) => {
    const v = Math.abs(Math.sin(i * 1.7 + hue) * Math.cos(i * 0.6 + hue2));
    return 8 + v * 46;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="rounded-lg shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`cg-${hue}-${hue2}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue},85%,16%)`} />
          <stop offset="100%" stopColor={`hsl(${hue2},80%,10%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#cg-${hue}-${hue2})`} />
      <circle cx="72" cy="26" r="16" fill={`hsl(${hue},100%,60%)`} opacity="0.25" />
      <circle cx="72" cy="26" r="8" fill={`hsl(${hue},100%,65%)`} opacity="0.5" />
      {bars.map((h, i) => (
        <rect
          key={i}
          x={6 + i * 3.8} y={88 - h} width="2.4" height={h} rx="1.2"
          fill={`hsl(${hue + (i / 24) * (hue2 - hue)},95%,62%)`}
          opacity={0.5 + (i % 3) * 0.16}
        />
      ))}
      <text x="8" y="22" fontFamily="Audiowide" fontSize="9" fill="#eaf2ff" opacity="0.9">
        {title.slice(0, 12).toUpperCase()}
      </text>
    </svg>
  );
}
