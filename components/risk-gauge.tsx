"use client";

import { useEffect, useState } from "react";
import type { Risk } from "@/engine/types";
import { cn } from "@/lib/utils";

// Where the needle points for each risk level, from 0 (left) to 100 (right).
const VALUE: Record<Risk, number> = { none: 4, low: 25, medium: 50, high: 76, critical: 96 };
const TICKS = 31;
const CX = 120;
const CY = 120;
const R = 96;

// Green, then amber, then red along the dial, like a rev counter.
// The text colour matches, because the glow uses currentColor.
const tickColor = (share: number) =>
  share < 0.4 ? "stroke-success text-success" : share < 0.7 ? "stroke-warning text-warning" : share < 0.88 ? "stroke-destructive text-destructive" : "stroke-danger-deep text-danger-deep";
const fillColor: Record<Risk, string> = { none: "fill-success", low: "fill-success", medium: "fill-warning", high: "fill-destructive", critical: "fill-danger-soft" };
const textColor: Record<Risk, string> = { none: "text-success", low: "text-success", medium: "text-warning", high: "text-destructive", critical: "text-danger-deep" };

function point(share: number, radius: number) {
  const angle = Math.PI * (1 - share);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

// An animated dial: the needle sweeps up to the risk level and the ticks light up behind it.
// It always starts at safe (0), like a car dashboard waking up, and a digital readout
// counts up with the needle.
export function RiskGauge({ risk, label, caption, size = "lg" }: { risk: Risk; label: string; caption: string; size?: "sm" | "lg" }) {
  const [value, setValue] = useState(0);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const target = VALUE[risk];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      setCount(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / 1100);
      setCount(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    const kick = requestAnimationFrame(() => setValue(target));
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(kick);
    };
  }, [risk]);

  return (
    <figure className="grid justify-items-center gap-1" aria-label={`${caption}: ${label}`}>
      <svg viewBox="0 0 240 140" className={cn("w-full", size === "sm" ? "max-w-[170px]" : "max-w-[280px]")} role="img" aria-hidden>
        {Array.from({ length: TICKS }, (_, index) => {
          const share = index / (TICKS - 1);
          const major = index % 5 === 0;
          const outer = point(share, R);
          const inner = point(share, major ? R - 16 : R - 9);
          const lit = share * 100 <= value;
          return (
            <line
              key={index}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              strokeWidth={major ? 4 : 2.5}
              strokeLinecap="round"
              className={cn("motion-safe:transition-[stroke,opacity] motion-safe:duration-300", lit ? tickColor(share) : "stroke-border-strong", lit ? "opacity-100" : "opacity-60")}
              style={{ transitionDelay: `${index * 30}ms`, filter: lit ? "drop-shadow(0 0 3px currentColor)" : undefined }}
            />
          );
        })}
        {/* Drawn pointing at 0 and rotated, so the sweep can be animated. */}
        <line
          x1={CX}
          y1={CY}
          x2={CX - (R - 22)}
          y2={CY}
          strokeWidth={4}
          strokeLinecap="round"
          className="stroke-foreground motion-safe:transition-transform motion-safe:duration-[1100ms] motion-safe:ease-[cubic-bezier(.34,1.4,.64,1)]"
          style={{ transform: `rotate(${(value / 100) * 180}deg)`, transformOrigin: `${CX}px ${CY}px`, transformBox: "view-box" }}
        />
        <circle cx={CX} cy={CY} r={9} className="fill-card stroke-foreground" strokeWidth={3} />
        {/* The digital readout, like the trip counter under a speedometer. */}
        <rect x={CX - 26} y={CY - 52} width={52} height={22} rx={5} className="fill-foreground" />
        <text x={CX} y={CY - 36} textAnchor="middle" className={cn("font-mono text-[15px] font-bold tabular-nums", fillColor[risk])}>
          {String(count).padStart(3, "0")}
        </text>
      </svg>
      <figcaption className="-mt-3 grid justify-items-center">
        <span className={cn("font-bold tracking-tight", size === "sm" ? "text-lg" : "text-2xl", textColor[risk])}>{label}</span>
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{caption}</span>
      </figcaption>
    </figure>
  );
}
