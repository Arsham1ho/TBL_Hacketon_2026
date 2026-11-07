"use client";

import { useEffect, useRef, type RefObject } from "react";

export type OrbMode = "idle" | "listening" | "thinking" | "speaking";

// The orb, ported from Arsham's LiveAgents voice guide: a glass sphere with light moving inside it.
//
// Five soft blobs of colour drift on their own slow orbits inside a circle, added together
// so they bloom where they cross. Round it, a halo in the same colours; over it, a glass rim
// and a highlight. It breathes at rest, swirls faster while thinking, and swells and ripples
// with the voice: the person's while listening, SafeStep's while speaking.
//
// `size` is the sphere's radius as a share of the canvas: 0.3 leaves room for the halo,
// and a larger value fills a small button.
export function SiriOrb({ mode, level, size = 0.3, className }: { mode: OrbMode; level?: RefObject<number>; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d")!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
    // colour, orbit size, speed, phase: each blob its own path
    const blobs: [string, number, number, number][] = [
      ["74 222 128", 0.55, 0.9, 0],
      ["34 211 238", 0.6, -0.7, 1.7],
      ["59 130 246", 0.5, 0.55, 3.3],
      ["167 139 250", 0.58, -1.1, 4.6],
      ["244 114 182", 0.5, 1.3, 2.4],
    ];
    // How bright each blob burns in each state: cooler blue and violet while
    // listening, warmer mint and cyan while speaking, all of them otherwise.
    const WEIGHT: Record<OrbMode, number[]> = {
      idle: [1, 1, 1, 1, 1],
      thinking: [1, 1, 1, 1, 1],
      listening: [0.35, 0.6, 1.25, 1.3, 0.7],
      speaking: [1.3, 1.25, 0.7, 0.45, 0.5],
    };
    const w = [1, 1, 1, 1, 1];
    let raf = 0;
    let t = 0;
    let speed = 0.3;
    let swell = 0;
    let ripple = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      const m = modeRef.current;
      const lv = level?.current ?? 0;
      const wantSpeed = still ? 0 : m === "thinking" ? 2.4 : m === "speaking" ? 1.1 : m === "listening" ? 0.7 + lv * 2 : 0.35;
      speed += (wantSpeed - speed) * Math.min(1, dt * 3);
      t += speed * dt;
      const breath = still ? 0 : 0.025 * Math.sin(now / 1100);
      const wantSwell = m === "listening" ? lv * 0.28 : m === "speaking" ? 0.03 + lv * 0.22 : breath;
      swell += (wantSwell - swell) * Math.min(1, dt * 9);
      ripple += ((m === "listening" || m === "speaking" ? lv : 0) - ripple) * Math.min(1, dt * 12);

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * size * (1 + swell);

      // the halo, in the colour of whichever blob is leading
      const lead = blobs[Math.floor(((t * 0.15) % blobs.length) + blobs.length) % blobs.length][0];
      const halo = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, Math.min(W, H) / 2);
      halo.addColorStop(0, `rgb(${lead} / ${0.22 + swell})`);
      halo.addColorStop(0.35, `rgb(59 130 246 / ${0.07 + swell * 0.3})`);
      halo.addColorStop(0.7, "rgb(59 130 246 / 0.015)");
      halo.addColorStop(1, "rgb(59 130 246 / 0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, W, H);

      // inside the glass: a deep base, then the light, added together
      g.save();
      g.beginPath();
      // the edge ripples a little with the voice, as a liquid surface would
      const steps = 96;
      for (let k = 0; k <= steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const wob = ripple * 0.05 * Math.sin(a * 5 + t * 4) + ripple * 0.03 * Math.sin(a * 3 - t * 3);
        const rr = R * (1 + wob);
        if (k === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.clip();
      // a deep blue-violet body, so no part of the sphere is ever dead
      const body = g.createRadialGradient(cx, cy + R * 0.2, R * 0.1, cx, cy, R * 1.05);
      body.addColorStop(0, "#16224a");
      body.addColorStop(1, "#070b18");
      g.fillStyle = body;
      g.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
      g.globalCompositeOperation = "lighter";
      const want = WEIGHT[m];
      for (let k = 0; k < w.length; k++) w[k] += (want[k] - w[k]) * Math.min(1, dt * 2.5);
      for (let k = 0; k < blobs.length; k++) {
        const [rgb, orbit, sp, ph] = blobs[k];
        const wk = w[k];
        const a = t * sp + ph;
        const bx = cx + Math.cos(a) * R * orbit;
        const by = cy + Math.sin(a * 1.15) * R * orbit;
        const br = R * (0.72 + 0.12 * Math.sin(a * 0.7));
        const grd = g.createRadialGradient(bx, by, 0, bx, by, br);
        grd.addColorStop(0, `rgb(${rgb} / ${Math.min(1, 0.7 * wk)})`);
        grd.addColorStop(0.5, `rgb(${rgb} / ${Math.min(1, 0.26 * wk)})`);
        grd.addColorStop(1, `rgb(${rgb} / 0)`);
        g.fillStyle = grd;
        g.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
      }
      g.globalCompositeOperation = "source-over";
      // the glass: a highlight up and to the left, a darker floor
      const hl = g.createRadialGradient(cx - R * 0.35, cy - R * 0.5, 0, cx - R * 0.35, cy - R * 0.5, R * 0.55);
      hl.addColorStop(0, "rgba(255,255,255,.22)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = hl;
      g.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
      const floor = g.createLinearGradient(0, cy - R, 0, cy + R);
      floor.addColorStop(0.55, "rgba(0,0,0,0)");
      floor.addColorStop(1, "rgba(0,0,0,.35)");
      g.fillStyle = floor;
      g.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
      g.restore();

      // the rim: bright where the light falls, almost gone underneath
      const rim = g.createLinearGradient(cx, cy - R, cx, cy + R);
      rim.addColorStop(0, "rgba(255,255,255,.55)");
      rim.addColorStop(0.5, "rgba(255,255,255,.08)");
      rim.addColorStop(1, "rgba(255,255,255,.22)");
      g.strokeStyle = rim;
      g.lineWidth = 1.25;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.stroke();

      raf = requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [level, size]);

  return <canvas ref={ref} className={className ?? "h-full w-full"} aria-hidden />;
}
