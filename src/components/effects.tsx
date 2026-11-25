"use client";
import { useEffect, useRef } from "react";
import { useApp } from "./providers";
import { cn } from "./ui";

/** Background layers (solid / soft / ambient / gradient / noise) + subtle pointer light + directional button edge lighting. */
export function Backdrop() {
  const { theme } = useApp();
  const light = useRef<HTMLDivElement>(null);
  const off = theme.reducedMotion || theme.animation === 0;

  useEffect(() => {
    if (off || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let x = -999, y = -999;
    const R = 90; // px proximity radius for edge lighting
    const lit = new Set<HTMLElement>();
    const tick = () => {
      raf = 0;
      if (light.current) light.current.style.transform = `translate3d(${x - 300}px,${y - 300}px,0)`;
      const next = new Set<HTMLElement>();
      document.querySelectorAll<HTMLElement>(".glass-btn").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < y - R || r.top > y + R || r.right < x - R || r.left > x + R) return;
        const dx = Math.max(r.left - x, 0, x - r.right);
        const dy = Math.max(r.top - y, 0, y - r.bottom);
        const d = Math.hypot(dx, dy);
        if (d >= R) return;
        // nearest-edge direction: gradient hot-spot is clamped to the button box, so the closest border segment lights up
        el.style.setProperty("--lx", `${Math.min(Math.max(x - r.left, 0), r.width)}px`);
        el.style.setProperty("--ly", `${Math.min(Math.max(y - r.top, 0), r.height)}px`);
        el.style.setProperty("--le", String(Math.pow(1 - d / R, 1.3).toFixed(3)));
        next.add(el);
      });
      lit.forEach((el) => {
        if (!next.has(el)) el.style.setProperty("--le", "0");
      });
      lit.clear();
      next.forEach((el) => lit.add(el));
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      x = y = -999;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [off]);

  return (
    <>
      <div className={cn("app-bg", theme.background)} aria-hidden />
      {theme.background === "ambient" && <div className="app-glow" aria-hidden />}
      {theme.targets.app && <div className={cn("grad-layer", theme.gradient.animated && "anim")} aria-hidden />}
      {theme.noise && <div className="noise" aria-hidden />}
      {theme.mouseLight && !off && <div ref={light} className="pointer-light" aria-hidden />}
    </>
  );
}
