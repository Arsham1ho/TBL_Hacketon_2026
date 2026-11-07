"use client";

import { useEffect, useState } from "react";
import type { Risk } from "@/engine/types";
import { motionReduced } from "@/lib/preferences";
import { cn } from "@/lib/utils";

// Risk has five levels. The dial is split into five zones, and the needle points at the
// middle of the zone for this case.
const LEVELS: Risk[] = ["none", "low", "medium", "high", "critical"];
const VALUE: Record<Risk, number> = { none: 10, low: 30, medium: 50, high: 70, critical: 90 };
// 26 ticks, so every fifth (a major tick) falls on a zone boundary.
const TICKS = 26;
const CX = 120;
const CY = 120;
const R = 96;

// Green, then amber, then red along the dial, like a rev counter.
// The text colour matches, because the glow uses currentColor.
const tickColor = (share: number) =>
  share < 0.4 ? "stroke-success text-success" : share < 0.6 ? "stroke-warning text-warning" : share < 0.8 ? "stroke-destructive text-destructive" : "stroke-danger-deep text-danger-deep";
const zoneColor: Record<Risk, string> = { none: "stroke-success", low: "stroke-success", medium: "stroke-warning", high: "stroke-destructive", critical: "stroke-danger-deep" };
// The readout is a dark display with bright digits in both themes, like a car's dashboard.
const fillColor: Record<Risk, string> = { none: "fill-[oklch(0.82_0.15_155)]", low: "fill-[oklch(0.82_0.15_155)]", medium: "fill-[oklch(0.84_0.14_80)]", high: "fill-[oklch(0.72_0.19_25)]", critical: "fill-[oklch(0.7_0.21_25)]" };
const textColor: Record<Risk, string> = { none: "text-success", low: "text-success", medium: "text-warning", high: "text-destructive", critical: "text-danger-deep" };

function point(share: number, radius: number) {
  const angle = Math.PI * (1 - share);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number, radius: number) {
  const start = point(from, radius);
  const end = point(to, radius);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

// An animated dial: the needle sweeps up to the risk level and the ticks light up behind it.
// It always starts at safe, like a car dashboard waking up, and the readout counts up to the
// level, out of five.
export function RiskGauge({ risk, label, caption, size = "lg" }: { risk: Risk; label: string; caption: string; size?: "sm" | "lg" }) {
  const level = LEVELS.indexOf(risk);
  const [value, setValue] = useState(0);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const target = VALUE[risk];
    if (motionReduced()) {
      setValue(target);
      setCount(level + 1);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / 1100);
      setCount(Math.max(1, Math.round((level + 1) * (1 - Math.pow(1 - progress, 3)))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    const kick = requestAnimationFrame(() => setValue(target));
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(kick);
    };
  }, [risk, level]);

  const large = size === "lg";

  return (
    <figure className="grid justify-items-center gap-1" aria-label={`${caption}: ${label}`}>
      <svg viewBox="0 0 240 140" className={cn("w-full", large ? "max-w-[280px]" : "max-w-[170px]")} role="img" aria-hidden>
        {/* A faint coloured band under the ticks, showing the five zones. The active zone is solid. */}
        {LEVELS.map((name, index) => (
          <path
            key={name}
            d={arc(index / 5 + 0.006, (index + 1) / 5 - 0.006, R - 21)}
            fill="none"
            strokeWidth={index === level ? 4 : 3}
            className={cn("motion-safe:transition-opacity motion-safe:duration-500", zoneColor[name], index === level ? "opacity-90" : "opacity-20")}
            style={{ transitionDelay: "900ms" }}
          />
        ))}
        {Array.from({ length: TICKS }, (_, index) => {
          const share = index / (TICKS - 1);
          const major = index % 5 === 0;
          const outer = point(share, R);
          const inner = point(share, major ? R - 15 : R - 9);
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
              style={{ transitionDelay: `${index * 36}ms`, filter: lit ? "drop-shadow(0 0 3px currentColor)" : undefined }}
            />
          );
        })}
        {/* Level numbers 1 to 5 inside the band, on the large dial only. */}
        {large &&
          LEVELS.map((name, index) => {
            const at = point((index + 0.5) / 5, R - 34);
            return (
              <text
                key={name}
                x={at.x}
                y={at.y + 3.5}
                textAnchor="middle"
                className={cn("text-[10px] font-semibold tabular-nums", index === level ? cn("fill-current", textColor[name]) : "fill-muted-foreground opacity-60")}
              >
                {index + 1}
              </text>
            );
          })}
        {/* Drawn pointing at 0 and rotated, so the sweep can be animated. A short tail balances it. */}
        <g
          className="motion-safe:transition-transform motion-safe:duration-[1100ms] motion-safe:ease-[cubic-bezier(.34,1.4,.64,1)]"
          style={{ transform: `rotate(${(value / 100) * 180}deg)`, transformOrigin: `${CX}px ${CY}px`, transformBox: "view-box" }}
        >
          <line x1={CX + 12} y1={CY} x2={CX - (R - 24)} y2={CY} strokeWidth={4} strokeLinecap="round" className="stroke-foreground" />
          <circle cx={CX - (R - 24)} cy={CY} r={2.5} className={cn("fill-current", textColor[risk])} style={{ filter: "drop-shadow(0 0 3px currentColor)" }} />
        </g>
        <circle cx={CX} cy={CY} r={9} className="fill-card stroke-foreground" strokeWidth={3} />
        <circle cx={CX} cy={CY} r={3} className="fill-foreground" />
        {/* The digital readout, like the trip counter under a speedometer: the level out of five. */}
        <rect x={CX - 26} y={CY - 52} width={52} height={22} rx={5} className="fill-[oklch(0.16_0_0)] stroke-[oklch(0.32_0_0)]" strokeWidth={1} />
        <text x={CX} y={CY - 36} textAnchor="middle" className={cn("font-mono text-[15px] font-bold tabular-nums", fillColor[risk])}>
          {count}
          <tspan className="fill-[oklch(0.6_0_0)] text-[11px]">/5</tspan>
        </text>
      </svg>
      <figcaption className="-mt-3 grid justify-items-center">
        <span className={cn("font-bold tracking-tight", large ? "text-2xl" : "text-lg", textColor[risk])}>{label}</span>
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{caption}</span>
      </figcaption>
    </figure>
  );
}
