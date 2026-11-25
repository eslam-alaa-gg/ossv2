"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useApp } from "./providers";
import { cn } from "./ui";

const HUES = [255, 210, 160, 330, 30, 190];

export function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Single source of truth for the signed-in user's avatar (reads the same context everywhere). */
export function Avatar({ size = 36, ring, className, previewUrl }: { size?: number; ring?: boolean; className?: string; previewUrl?: string | null }) {
  const { user } = useApp();
  const [failed, setFailed] = useState<number | null>(null);
  const name = user?.displayName ?? "?";
  const hue = HUES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length];
  const v = user?.avatarVersion ?? null;
  const src = previewUrl ?? (v && failed !== v ? `/api/me/avatar?v=${v}` : null);
  const inner = src ? (
    <img src={src} alt={`${name}'s profile picture`} width={size} height={size} className="size-full rounded-full object-cover" onError={() => setFailed(v)} />
  ) : (
    <span className="grid size-full place-items-center rounded-full font-semibold text-white" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 50) % 360} 70% 40%))`, fontSize: size * 0.38 }} aria-label={name}>
      {initials(name)}
    </span>
  );
  return (
    <span className={cn("inline-block shrink-0", ring && "avatar-ring", className)} style={{ width: size, height: size }}>
      {inner}
    </span>
  );
}
