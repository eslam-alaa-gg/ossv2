"use client";
import { useEffect, useRef } from "react";

export const HABITS_CHANGED = "ossv2:habits-changed";

/** True for successful requests that can change what any habit surface displays. */
export function changesHabits(url: string, method: string, body: unknown) {
  if (method === "GET") return false;
  if (url.startsWith("/api/habits") || url.startsWith("/api/trackers")) return true;
  return url.startsWith("/api/me/prefs") && !!body && typeof body === "object" && "waterGoal" in body;
}

/** Re-runs `reload` when habit data changes anywhere in the app, or when the tab becomes visible again. */
export function useHabitsChanged(reload: () => void) {
  const latest = useRef(reload);
  useEffect(() => { latest.current = reload; });
  useEffect(() => {
    const changed = () => latest.current();
    const visible = () => { if (document.visibilityState === "visible") latest.current(); };
    window.addEventListener(HABITS_CHANGED, changed);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener(HABITS_CHANGED, changed); document.removeEventListener("visibilitychange", visible); };
  }, []);
}
