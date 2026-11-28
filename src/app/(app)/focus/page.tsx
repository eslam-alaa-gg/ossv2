"use client";
/* eslint-disable @next/next/no-img-element */
import { ImagePlus, Keyboard, Maximize2, Minimize2, Palette, Pause, Play, RotateCcw, Search, SlidersHorizontal, Square, Trash2, Video, X } from "lucide-react";
import type { CSSProperties } from "react";
import { FOCUS_THEME_PRESETS } from "@/lib/focus-theme";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { type Task } from "@/components/task-form";
import { Badge, Button, Card, EmptyState, Field, cn, useUI } from "@/components/ui";
import { api, minutesLabel, useFetch } from "@/lib/client";
import { YouTubeMusicPlayer } from "@/components/youtube-music";
import { AudiusPlayer } from "@/components/audius";
import { NowPlayingWidget } from "@/components/spotify";

type Session = { id: string; mode: string; plannedSeconds: number; actualSeconds: number; status: string; startedAt: string; lastResumedAt?: string | null; pausedAt?: string | null; taskTitle?: string | null };
type FocusData = { todayMinutes: number; weekMinutes: number; totalSessions: number; sessions: Session[]; running: (Session & { serverNow: number }) | null; tasks: { id: string; title: string; priority: Task["priority"] }[] };
type Mode = "focus" | "short_break" | "long_break" | "custom" | "stopwatch";
type SessionKind = "focus" | "break" | "stopwatch";
const MODES: { value: Mode; label: string; min: number }[] = [{ value: "focus", label: "Focus", min: 25 }, { value: "short_break", label: "Short Break", min: 5 }, { value: "long_break", label: "Long Break", min: 15 }, { value: "custom", label: "Custom Focus", min: 30 }, { value: "stopwatch", label: "Stopwatch", min: 0 }];
const FOCUS_PRESETS = [25, 50, 120];
const BREAK_PRESETS = [5, 10, 15, 20];
const MAX_SESSION_MINUTES = 10080;
const MAX_SESSION_SECONDS = MAX_SESSION_MINUTES * 60;
type WallpaperScene = "aurora" | "forest" | "ocean" | "rain" | "sunset" | "cosmos";
type FocusWallpaper = "none" | WallpaperScene;
type TimerStyle = "ring" | "digital" | "minimal" | "bar" | "orbit";
const WALLPAPERS: { id: WallpaperScene; label: string; hint: string }[] = [
  { id: "aurora", label: "Aurora Drift", hint: "Soft northern lights over quiet mountains" },
  { id: "forest", label: "Misty Forest", hint: "Slow-moving forest mist and filtered light" },
  { id: "ocean", label: "Ocean Calm", hint: "Gentle waves under a fading sky" },
  { id: "rain", label: "Rainy Night", hint: "Soft rainfall over a quiet city" },
  { id: "sunset", label: "Golden Dusk", hint: "Slow clouds and a warm horizon" },
  { id: "cosmos", label: "Deep Space", hint: "Drifting stars and a distant planet" },
];
const mmss = (s: number) => {
  const totalMinutes = Math.max(0, Math.floor(s / 60));
  const seconds = String(Math.max(0, s % 60)).padStart(2, "0");
  if (totalMinutes >= 1440) {
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return `${String(totalMinutes).padStart(2, "0")}:${seconds}`;
};

function FocusWallpaperLayer({ scene, failed, reducedMotion = false, onError }: { scene: WallpaperScene; failed: boolean; reducedMotion?: boolean; onError: () => void }) {
  return (
    <div className={`focus-wallpaper focus-wallpaper-${scene}`} aria-hidden>
      {!failed && !reducedMotion ? <img src={`/focus-wallpapers/${scene}.svg`} alt="" decoding="async" fetchPriority="high" onError={onError} className="size-full object-cover" /> : <span className="focus-wallpaper-static" />}
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
}

export default function FocusPage() {
  const { savePrefs, prefs, t, lang } = useApp();
  const { run, toast } = useUI();
  const { data, reload } = useFetch<FocusData>("/api/focus");
  const [mode, setMode] = useState<Mode>("focus");
  const [sessionKind, setSessionKind] = useState<SessionKind>("focus");
  const [minutes, setMinutes] = useState(25);
  const [durationOpen, setDurationOpen] = useState(false);
  const [durationDays, setDurationDays] = useState(0);
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [taskId, setTaskId] = useState("");
  useEffect(() => { const requestedTask = new URLSearchParams(window.location.search).get("task"); if (requestedTask) setTaskId(requestedTask); }, []);
  const [phase, setPhase] = useState<"idle" | "running" | "paused">("idle");
  const [remaining, setRemaining] = useState(25 * 60);
  const [sid, setSid] = useState<string | null>(null);
  const [planned, setPlanned] = useState(25 * 60);
  const [zen, setZen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [musicSearchOpen, setMusicSearchOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [focusMusicProvider, setFocusMusicProvider] = useState<"youtube" | "audius">(prefs.dashboard.musicSource === "audius" ? "audius" : "youtube");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [backgroundScene, setBackgroundScene] = useState<FocusWallpaper>(prefs.focus.background);
  const [backgroundOverlay, setBackgroundOverlay] = useState(prefs.focus.overlay);
  const [wallpaperVideoFailed, setWallpaperVideoFailed] = useState(false);
  const focusOverlaysOpen = themeOpen || backgroundOpen || musicSearchOpen || mixerOpen || shortcutsOpen;
  const [timerStyle, setTimerStyle] = useState<TimerStyle>(prefs.focus.timerStyle);
  const focusTheme = FOCUS_THEME_PRESETS.find((item) => item.id === prefs.focus.themePreset) ?? FOCUS_THEME_PRESETS[0];
  const focusAccentRgb = [1, 3, 5].map((offset) => Number.parseInt(focusTheme.accent.slice(offset, offset + 2), 16)).join(", ");
  const focusThemeStyle = { "--accent": focusTheme.accent, "--accent-rgb": focusAccentRgb, "--on-accent": "#ffffff", backgroundColor: focusTheme.d.bg } as CSSProperties;
  const focusPageStyle = focusThemeStyle;
  useEffect(() => { setBackgroundScene(prefs.focus.background); setTimerStyle(prefs.focus.timerStyle); setBackgroundOverlay(prefs.focus.overlay); setWallpaperVideoFailed(false); }, [prefs.focus.background, prefs.focus.timerStyle, prefs.focus.overlay]);
  const [imageMessage, setImageMessage] = useState("");
  const endAt = useRef(0);
  const finishing = useRef(false);
  const starting = useRef(false);
  const transitioning = useRef(false);
  const restored = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let loadedUrl: string | null = null;
    const applyBlob = (blob: Blob) => {
      if (cancelled) return;
      loadedUrl = URL.createObjectURL(blob);
      setBackgroundImage(loadedUrl);
    };
    void (async () => {
      try {
        const response = await fetch("/api/me/focus-background", { cache: "no-store" });
        if (response.ok) {
          applyBlob(await response.blob());
          return;
        }
        if (response.status !== 404) return;
        // Migrate the old browser-only background into the signed-in user's account once.
        const legacy = localStorage.getItem("ukiyo.focus.background");
        if (!legacy) return;
        const legacyBlob = await (await fetch(legacy)).blob();
        const form = new FormData();
        form.append("file", new File([legacyBlob], "focus-background.webp", { type: legacyBlob.type || "image/webp" }));
        const saved = await fetch("/api/me/focus-background", { method: "POST", body: form });
        if (saved.ok) {
          applyBlob(legacyBlob);
          localStorage.removeItem("ukiyo.focus.background");
        }
      } catch {
        // A missing or temporarily unavailable background must never block the Focus Room.
      }
    })();
    return () => {
      cancelled = true;
      if (loadedUrl) URL.revokeObjectURL(loadedUrl);
    };
  }, []);
  useEffect(() => () => {
    if (backgroundImage?.startsWith("blob:")) URL.revokeObjectURL(backgroundImage);
  }, [backgroundImage]);

  // restore a session that is still running on the server (e.g. after reload)
  useEffect(() => {
    if (!data?.running || restored.current || phase !== "idle") return;
    restored.current = true;
    const r = data.running;
    const elapsed = Math.min(r.plannedSeconds, r.actualSeconds + (r.status === "running" ? Math.max(0, Math.floor((r.serverNow - new Date(r.lastResumedAt ?? r.startedAt).getTime()) / 1000)) : 0));
    const restoredMode = r.mode as Mode;
    const isStopwatchSession = restoredMode === "stopwatch";
    const left = Math.max(0, r.plannedSeconds - elapsed);
    setSid(r.id); setPlanned(r.plannedSeconds); setMode(restoredMode); setSessionKind(isStopwatchSession ? "stopwatch" : restoredMode === "short_break" || restoredMode === "long_break" ? "break" : "focus"); setMinutes(Math.round(r.plannedSeconds / 60)); setRemaining(isStopwatchSession ? elapsed : left); endAt.current = isStopwatchSession ? performance.now() - elapsed * 1000 : performance.now() + left * 1000; setPhase(r.status === "paused" ? "paused" : "running");
  }, [data, phase]);

  const complete = useCallback(async (id: string) => {
    if (finishing.current || transitioning.current) return;
    finishing.current = true;
    const r = await run(() => api<{ xp: number; unlocked: string[] }>(`/api/focus/${id}`, { body: { action: "complete" } }));
    if (!r) { finishing.current = false; return; }
    toast("success", r.xp ? ` ${t("Focus session complete")} · +${r.xp} XP` : t("Session complete"));
    r.unlocked.forEach((u) => toast("success", t(u)));
    setPhase("idle"); setSid(null);
    const resetSeconds = mode === "stopwatch" ? 0 : minutes * 60;
    setRemaining(resetSeconds); setPlanned(mode === "stopwatch" ? MAX_SESSION_SECONDS : resetSeconds);
    endAt.current = 0; finishing.current = false; reload();
  }, [run, toast, minutes, mode, reload]);

  useEffect(() => {
    if (phase !== "running") return;
    const i = setInterval(() => {
      if (mode === "stopwatch") {
        const elapsed = Math.min(MAX_SESSION_SECONDS, Math.max(0, Math.floor((performance.now() - endAt.current) / 1000)));
        setRemaining(elapsed);
        if (elapsed >= MAX_SESSION_SECONDS && sid) complete(sid);
        return;
      }
      const left = Math.max(0, Math.ceil((endAt.current - performance.now()) / 1000));
      setRemaining(left);
      if (left === 0 && sid) complete(sid);
    }, 250);
    return () => clearInterval(i);
  }, [phase, sid, complete, mode]);

  useEffect(() => {
    const originalTitle = document.title;
    if (phase === "running") document.title = `${mmss(remaining)} · ${t(mode === "stopwatch" ? "Stopwatch" : sessionKind === "break" ? "Break" : "Focus")}`;
    return () => { document.title = originalTitle; };
  }, [phase, remaining, mode, sessionKind]);

  useEffect(() => { const h = setTimeout(() => { if (backgroundOverlay !== prefs.focus.overlay) savePrefs({ focus: { ...prefs.focus, overlay: backgroundOverlay } }).catch(() => {}); }, 500); return () => clearTimeout(h); }, [backgroundOverlay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => { if (!document.fullscreenElement) setZen(false); }; document.addEventListener("fullscreenchange", h); return () => document.removeEventListener("fullscreenchange", h); }, []);

  const applyDuration = (m: number, kind: SessionKind = sessionKind, allowActiveTransition = false) => {
    if (phase !== "idle" && !allowActiveTransition) return;
    const value = Math.min(MAX_SESSION_MINUTES, Math.max(1, Math.round(m) || 1));
    setMinutes(value); setRemaining(value * 60); setPlanned(value * 60);
    setDurationDays(Math.floor(value / 1440)); setDurationHours(Math.floor((value % 1440) / 60)); setDurationMinutes(value % 60);
    if (kind === "break") setMode(value <= 10 ? "short_break" : "long_break");
    else if (kind === "focus") setMode(value === 25 ? "focus" : "custom");
  };
  const setDuration = (m: number) => applyDuration(m);
  const pickSessionKind = (kind: SessionKind) => {
    if (phase !== "idle") return;
    setSessionKind(kind); setDurationOpen(false);
    if (kind === "stopwatch") { setMode("stopwatch"); setMinutes(MAX_SESSION_MINUTES); setPlanned(MAX_SESSION_SECONDS); setRemaining(0); return; }
    applyDuration(kind === "break" ? 5 : 25, kind);
  };

  async function uploadFocusBackground(file: File) {
    if (backgroundUploading) return;
    if (!file.type.startsWith("image/")) { setImageMessage(t("Choose an image file.")); return; }
    const objectUrl = URL.createObjectURL(file);
    setBackgroundUploading(true);
    setImageMessage(t("Preparing your background image…"));
    try {
      const img = new Image();
      img.src = objectUrl;
      await img.decode();
      const scale = Math.min(1, 1920 / img.naturalWidth, 1920 / img.naturalHeight);
      let width = Math.round(img.naturalWidth * scale);
      let height = Math.round(img.naturalHeight * scale);
      let quality = 0.84;
      let result: Blob | null = null;
      const canvas = document.createElement("canvas");
      for (let attempt = 0; attempt < 14; attempt++) {
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image processing is not available in this browser.");
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (!result) result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (result && result.size <= 440 * 1024) break;
        if (quality > 0.5) quality -= 0.08;
        else { width *= 0.82; height *= 0.82; quality = 0.82; }
      }
      if (!result || result.size > 440 * 1024) throw new Error("The image could not be reduced below 450 KB. Try a smaller image.");
      const form = new FormData();
      const mime = result.type === "image/webp" ? "image/webp" : "image/jpeg";
      form.append("file", new File([result], mime === "image/webp" ? "focus-background.webp" : "focus-background.jpg", { type: mime }));
      const response = await fetch("/api/me/focus-background", { method: "POST", body: form });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || t("Image upload failed."));
      }
      setBackgroundImage(URL.createObjectURL(result));
      setImageMessage(t("Background image saved to your account. It appears in the Focus Room and immersive focus mode."));
    } catch (e) {
      setImageMessage(e instanceof Error ? e.message : t("Image upload failed."));
    } finally {
      setBackgroundUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  }
  async function removeFocusBackground() {
    try {
      const response = await fetch("/api/me/focus-background", { method: "DELETE" });
      if (!response.ok) throw new Error(t("Could not remove the background."));
      setBackgroundImage(null);
      setImageMessage(t("Background image removed from your account."));
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : t("Could not remove the background."));
    }
  }

  async function selectTimerStyle(style: TimerStyle) {
    setTimerStyle(style);
    try {
      await savePrefs({ focus: { ...prefs.focus, background: backgroundScene, timerStyle: style, overlay: backgroundOverlay } });
    } catch {
      setImageMessage(t("Could not save the timer style. Please try again."));
    }
  }

  function closeFocusOverlays() {
    setThemeOpen(false);
    setBackgroundOpen(false);
    setMusicSearchOpen(false);
    setMixerOpen(false);
    setShortcutsOpen(false);
    setDurationOpen(false);
  }

  async function selectWallpaper(id: FocusWallpaper) {
    setBackgroundScene(id);
    setWallpaperVideoFailed(false);
    try {
      await savePrefs({ focus: { ...prefs.focus, background: id, timerStyle, overlay: backgroundOverlay } });
    } catch {
      setImageMessage(t("Could not save the wallpaper selection. Please try again."));
    }
  }

  async function start() {
    // Guard click + keyboard shortcut races before the request reaches the API.
    if (starting.current || phase !== "idle") return;
    starting.current = true;
    try {
      const sessionMinutes = mode === "stopwatch" ? MAX_SESSION_MINUTES : minutes;
      const r = await run(() => api<{ session: Session }>("/api/focus", { body: { mode, minutes: sessionMinutes, taskId: taskId || null } }));
      if (!r) return;
      finishing.current = false;
      setSid(r.session.id);
      setPlanned(sessionMinutes * 60);
      setRemaining(mode === "stopwatch" ? 0 : sessionMinutes * 60);
      endAt.current = mode === "stopwatch" ? performance.now() : performance.now() + sessionMinutes * 60000;
      setDurationOpen(false);
      setPhase("running");
    } finally {
      starting.current = false;
    }
  }
  const pause = async () => {
    if (!sid || phase !== "running" || transitioning.current || finishing.current) return;
    transitioning.current = true;
    try {
      const result = await run(() => api<{ session: Session }>(`/api/focus/${sid}`, { body: { action: "pause" } }));
      if (!result) return;
      setRemaining(mode === "stopwatch" ? result.session.actualSeconds : Math.max(0, result.session.plannedSeconds - result.session.actualSeconds));
      setPhase("paused"); reload();
    } finally { transitioning.current = false; }
  };
  const resume = async () => {
    if (!sid || phase !== "paused" || transitioning.current || finishing.current) return;
    transitioning.current = true;
    try {
      const result = await run(() => api(`/api/focus/${sid}`, { body: { action: "resume" } }));
      if (!result) return;
      endAt.current = mode === "stopwatch" ? performance.now() - remaining * 1000 : performance.now() + remaining * 1000; setPhase("running"); reload();
    } finally { transitioning.current = false; }
  };
  async function end(reset = false): Promise<boolean> {
    if (transitioning.current || finishing.current) return false;
    transitioning.current = true;
    try {
      if (sid) {
        const action = mode === "stopwatch" && !reset ? "complete" : "end";
        const activeSeconds = mode === "stopwatch" ? remaining : Math.max(0, planned - remaining);
        const result = await run(() => api(`/api/focus/${sid}`, { body: { action, activeSeconds } }), reset ? undefined : t("Session ended — time so far was recorded"));
        if (!result) return false;
      }
      setPhase("idle"); setSid(null);
      const resetSeconds = mode === "stopwatch" ? 0 : minutes * 60;
      setRemaining(resetSeconds); setPlanned(mode === "stopwatch" ? MAX_SESSION_SECONDS : resetSeconds);
      endAt.current = 0; reload();
      return true;
    } finally { transitioning.current = false; }
  }

  async function skipPhase() {
    if (phase === "idle" || sessionKind === "stopwatch" || !(await end(true))) return;
    const nextKind: SessionKind = sessionKind === "break" ? "focus" : "break";
    setSessionKind(nextKind);
    // end(true) schedules the idle state update, but this callback still closes over
    // the previous phase. Allow this one intentional transition to apply its preset.
    applyDuration(nextKind === "break" ? 5 : 25, nextKind, true);
  }

  async function exitFocus() {
    if (phase !== "idle" && !(await end(false))) return;
    if (zen) await toggleZen();
  }
  async function toggleZen() {
    setDurationOpen(false);
    if (!zen) {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      } catch { /* Keep immersive in-page mode if fullscreen is unavailable. */ }
      setZen(true);
    } else {
      setZen(false);
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch { /* browser may already have exited */ }
      }
    }
  }

  const keyboardActions = useRef({
    phase, zen, shortcutsOpen, durationOpen, start: () => {}, pause: () => {}, resume: () => {}, skipPhase: () => {}, exitFocus: () => {}, closeShortcuts: () => {}, closeDuration: () => {}, toggleZen: () => {},
  });
  useEffect(() => {
    keyboardActions.current = {
      phase, zen, shortcutsOpen, durationOpen, start: () => { void start(); }, pause, resume, skipPhase: () => { void skipPhase(); }, exitFocus: () => { void exitFocus(); }, closeShortcuts: () => setShortcutsOpen(false), closeDuration: () => setDurationOpen(false), toggleZen: () => { void toggleZen(); },
    };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target instanceof HTMLElement && target.closest("button, a") && event.key !== "Escape") return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const actions = keyboardActions.current;
      if (event.key === "Escape" && actions.durationOpen) {
        actions.closeDuration();
      } else if (event.key === "Escape" && actions.shortcutsOpen) {
        actions.closeShortcuts();
      } else if (event.code === "Space") {
        event.preventDefault();
        if (actions.phase === "idle") actions.start();
        else if (actions.phase === "running") actions.pause();
        else actions.resume();
      } else if (event.key.toLowerCase() === "s") {
        actions.skipPhase();
      } else if (event.key.toLowerCase() === "e") {
        actions.exitFocus();
      } else if (event.key.toLowerCase() === "f" || (event.key === "Escape" && actions.zen)) {
        actions.toggleZen();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  const pct = mode === "stopwatch" ? 0 : planned ? ((planned - remaining) / planned) * 100 : 0;
  const R = 150, C = 2 * Math.PI * R;
  const task = data?.tasks.find((t) => t.id === taskId);
  const timer = (
    <div className="flex flex-col items-center">
      {timerStyle === "ring" ? (
        <div className="relative grid place-items-center" style={{ width: "min(78vw, 360px)", aspectRatio: "1" }}>
          <svg viewBox="0 0 340 340" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="170" cy="170" r={R} fill="none" stroke="var(--input)" strokeWidth="8" />
            <circle cx="170" cy="170" r={R} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .5s linear", filter: "drop-shadow(0 0 10px rgba(var(--accent-rgb),.5))" }} />
          </svg>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-faint">{t(MODES.find((m) => m.value === mode)?.label ?? "Focus")}</p>
            <p role="timer" aria-live="off" className={`my-1 ${remaining >= 86400 ? "text-[clamp(2rem,8vw,3.6rem)]" : "text-[clamp(3.2rem,14vw,5.5rem)]"} font-light tabular-nums leading-none tracking-tight`}>{mmss(remaining)}</p>
            <p className="mx-auto max-w-[14rem] truncate text-sm text-muted">{task ? task.title : phase === "idle" ? t("Ready when you are") : t("Stay with it")}</p>
          </div>
        </div>
      ) : timerStyle === "digital" ? (
        <div className="flex min-h-[220px] w-full max-w-[520px] flex-col items-center justify-center rounded-[32px] border border-white/10 bg-black/25 px-5 py-9 shadow-2xl backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">{t(MODES.find((m) => m.value === mode)?.label ?? "Focus")}</p>
          <p role="timer" aria-live="off" className={`my-5 font-mono ${remaining >= 86400 ? "text-[clamp(2.5rem,10vw,4.5rem)]" : "text-[clamp(4rem,17vw,7.5rem)]"} font-light leading-none tracking-[-0.08em] text-white tabular-nums`}>{mmss(remaining)}</p>
          <div className="h-1.5 w-full max-w-[340px] overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white/80 transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
          <p className="mt-4 max-w-[80%] truncate text-sm text-white/65">{task?.title ?? t("Ready when you are")}</p>
        </div>
      ) : timerStyle === "orbit" ? (
        <div className="relative grid place-items-center" style={{ width: "min(78vw, 360px)", aspectRatio: "1" }}>
          <svg viewBox="0 0 340 340" className="absolute inset-0" aria-hidden>
            <circle cx="170" cy="170" r="132" fill="none" stroke="var(--input)" strokeWidth="1.5" strokeDasharray="3 9" />
            <circle cx="170" cy="170" r="104" fill="none" stroke="var(--input)" strokeWidth="1" />
            <circle cx="170" cy="170" r="132" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 132} strokeDashoffset={2 * Math.PI * 132 * (1 - pct / 100)} transform="rotate(-90 170 170)" style={{ transition: "stroke-dashoffset .5s linear", filter: "drop-shadow(0 0 8px rgba(var(--accent-rgb),.45))" }} />
            <circle cx="170" cy="38" r="6" fill="var(--accent)" style={{ transformOrigin: "170px 170px", transform: `rotate(${pct * 3.6}deg)` }} />
          </svg>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-faint">{t(MODES.find((m) => m.value === mode)?.label ?? "Focus")}</p>
            <p role="timer" aria-live="off" className={`my-2 ${remaining >= 86400 ? "text-[clamp(2rem,8vw,3.6rem)]" : "text-[clamp(3.2rem,14vw,5.5rem)]"} font-light tabular-nums leading-none tracking-tight`}>{mmss(remaining)}</p>
            <p className="mx-auto max-w-[14rem] truncate text-sm text-muted">{task?.title ?? t("Stay with it")}</p>
          </div>
        </div>
      ) : timerStyle === "minimal" ? (
        <div className="flex min-h-[220px] w-full flex-col items-center justify-center py-8">
          <p className="mb-4 text-xs uppercase tracking-[0.32em] text-faint">{t(MODES.find((m) => m.value === mode)?.label ?? "Focus")}</p>
          <p role="timer" aria-live="off" className={`font-extralight leading-none tracking-[-0.09em] tabular-nums ${remaining >= 86400 ? "text-[clamp(3rem,12vw,5rem)]" : "text-[clamp(5rem,22vw,10rem)]"}`}>{mmss(remaining)}</p>
          <div className="mt-7 h-px w-28 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
          <p className="mt-4 max-w-[80%] truncate text-sm text-muted">{task?.title ?? t("Stay with it")}</p>
        </div>
      ) : (
        <div className="flex min-h-[220px] w-full max-w-[520px] flex-col justify-center rounded-3xl border border-line bg-card/70 p-6 sm:p-9">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><p className="text-xs uppercase tracking-[0.2em] text-faint">{t(MODES.find((m) => m.value === mode)?.label ?? "Focus")}</p><p className="mt-2 text-sm text-muted">{task?.title ?? t("Ready when you are")}</p></div>
            <p role="timer" aria-live="off" className={`font-light leading-none tracking-tight tabular-nums ${remaining >= 86400 ? "text-[clamp(2.5rem,10vw,4.5rem)]" : "text-[clamp(3.5rem,13vw,6rem)]"}`}>{mmss(remaining)}</p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--input)]"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
          <p className="mt-3 text-end text-xs tabular-nums text-faint">{Math.round(pct)}%</p>
        </div>
      )}
      {phase === "idle" && <div className="mb-2 flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t("Session type")}>
        {([{ value: "focus", label: "Focus" }, { value: "break", label: "Break / Rest" }, { value: "stopwatch", label: "Stopwatch" }] as const).map((item) => <button key={item.value} type="button" onClick={() => pickSessionKind(item.value)} aria-pressed={sessionKind === item.value} className={cn("rounded-full border px-4 py-2 text-xs font-medium transition", sessionKind === item.value ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-line bg-card/50 text-muted hover:bg-card")}>{t(item.label)}</button>)}
      </div>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {phase === "idle" && <Button variant="primary" className="h-12 px-8 text-base" onClick={start}><Play className="size-5" /> {t("Start")}</Button>}
        {phase === "idle" && sessionKind !== "stopwatch" && <div className="relative">
          <Button className="h-12 px-5" onClick={() => setDurationOpen((open) => !open)} aria-expanded={durationOpen} aria-haspopup="dialog"><SlidersHorizontal className="size-4" /> {t("Duration")} <span className="text-xs opacity-70">{minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h ${minutes % 60}m` : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`}</span></Button>
          {durationOpen && <>
            <button type="button" aria-label={t("Close duration picker")} onClick={() => setDurationOpen(false)} className="fixed inset-0 z-[150] cursor-default" />
            <div role="dialog" aria-label={t("Choose session duration")} className="absolute bottom-[calc(100%+10px)] left-1/2 z-[151] w-[min(90vw,340px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#101622]/95 p-4 text-white shadow-2xl backdrop-blur-3xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{t("Choose duration")}</p><button type="button" onClick={() => setDurationOpen(false)} aria-label={t("Close")} className="rounded-lg p-1 text-white/60 hover:bg-white/10"><X className="size-4" /></button></div>
              <div className="grid grid-cols-3 gap-2">{(sessionKind === "break" ? BREAK_PRESETS : FOCUS_PRESETS).map((preset) => <button key={preset} type="button" onClick={() => { setDuration(preset); setDurationOpen(false); }} aria-pressed={minutes === preset} className={cn("rounded-xl border px-2 py-3 text-xs font-medium", minutes === preset ? "border-white/70 bg-white/15 text-white" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")}>{preset === 120 ? t("2 hours") : `${preset} ${t("minutes")}`}</button>)}</div>
              <div className="mt-4 border-t border-white/10 pt-3"><p className="mb-2 text-xs font-medium text-white/65">{t("Custom duration")}</p><div className="grid grid-cols-3 gap-2">{[{label:"Days",value:durationDays,set:setDurationDays,max:7},{label:"Hours",value:durationHours,set:setDurationHours,max:23},{label:"Minutes",value:durationMinutes,set:setDurationMinutes,max:59}].map((part) => <label key={part.label} className="min-w-0 text-[11px] text-white/60">{t(part.label)}<input type="number" inputMode="numeric" min={0} max={part.max} value={part.value} onChange={(event) => part.set(Math.min(part.max, Math.max(0, Number(event.target.value) || 0)))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-center text-sm text-white outline-none focus:border-white/40" /></label>)}</div><p className="mt-2 text-[10px] text-white/40">{t("Maximum duration: 7 days.")}</p><Button variant="primary" className="mt-3 w-full" disabled={durationDays * 1440 + durationHours * 60 + durationMinutes < 1 || durationDays * 1440 + durationHours * 60 + durationMinutes > MAX_SESSION_MINUTES} onClick={() => { setDuration(durationDays * 1440 + durationHours * 60 + durationMinutes); setDurationOpen(false); }}>{t("Apply duration")}</Button></div>
            </div>
          </>}
        </div>}
        {phase === "running" && <Button className="h-12 px-6" onClick={pause}><Pause className="size-5" /> {t("Pause")}</Button>}
        {phase === "paused" && <Button variant="primary" className="h-12 px-6" onClick={resume}><Play className="size-5" /> {t("Resume")}</Button>}
        {phase !== "idle" && <Button className="h-12" onClick={() => end(false)}><Square className="size-4" /> {t("End")}</Button>}
        {phase !== "idle" && <Button variant="ghost" className="h-12" onClick={() => end(true)} aria-label={t("Reset")}><RotateCcw className="size-4" /> {t("Reset")}</Button>}
      </div>
      {phase !== "idle" && <p className="mt-3 text-xs text-faint">{t("Rewards are only granted when the full duration has elapsed on the server.")}</p>}
    </div>
  );

  if (zen) return (
    <main className="focus-zone-surface fixed inset-0 z-[9999] isolate h-[100dvh] w-screen overflow-hidden bg-[#05070c] text-white" style={focusThemeStyle}>
      {backgroundImage ? (
        <img src={backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center" aria-hidden />
      ) : backgroundScene !== "none" ? (
        <div className="absolute inset-0"><FocusWallpaperLayer scene={backgroundScene as WallpaperScene} failed={wallpaperVideoFailed} reducedMotion={prefs.theme.reducedMotion} onError={() => setWallpaperVideoFailed(true)} /></div>
      ) : <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#1b2638_0%,#080d17_55%,#030509_100%)]" />}
      <div className="absolute inset-0 z-[1] bg-black" style={{ opacity: backgroundOverlay / 100 }} aria-hidden />
      {focusOverlaysOpen && <button type="button" aria-label={t("Close open panel")} onClick={closeFocusOverlays} className="absolute inset-0 z-30 cursor-default bg-transparent" />}
      <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-end gap-2 p-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:p-5">
        <div className="relative">
          <button type="button" onClick={() => { setThemeOpen(v => !v); setBackgroundOpen(false); setMusicSearchOpen(false); setMixerOpen(false); setShortcutsOpen(false); }} aria-label={t("Focus settings")} aria-expanded={themeOpen} className="grid size-9 sm:size-10 place-items-center rounded-xl sm:rounded-2xl border border-white/15 bg-black/25 text-white shadow-lg backdrop-blur-2xl transition hover:bg-white/15"><Palette className="size-5" /></button>
          {themeOpen && <div role="dialog" aria-label={t("Focus Zone appearance")} className="absolute end-0 top-[calc(100%+10px)] max-h-[min(78dvh,620px)] w-[min(92vw,350px)] overflow-y-auto rounded-3xl border border-white/15 bg-[#101622]/95 p-3.5 text-white shadow-2xl backdrop-blur-3xl">
            <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{t("Focus Zone appearance")}</h2><p className="mt-1 max-w-[250px] text-[10px] leading-relaxed text-white/45">{t("These settings only affect Focus Zone.")}</p></div><button type="button" onClick={() => setThemeOpen(false)} aria-label={t("Close")} className="rounded-xl p-2 text-white/65 hover:bg-white/10"><X className="size-4" /></button></div>
            <section aria-label={t("Color theme")}><p className="mb-2 text-[11px] font-semibold text-white/65">{t("Color theme")}</p><div className="grid grid-cols-3 gap-2">{FOCUS_THEME_PRESETS.map(item => <button key={item.id} type="button" onClick={() => void savePrefs({ focus: { ...prefs.focus, themePreset: item.id } })} aria-pressed={prefs.focus.themePreset === item.id} className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-2 py-2 text-[10px]", prefs.focus.themePreset === item.id ? "border-white/70 bg-white/15 text-white" : "border-white/10 bg-white/5 text-white/65")}><span className="size-3 shrink-0 rounded-full ring-2 ring-white/15" style={{ background: item.accent }} />{t(item.name)}</button>)}</div></section>
            <section className="mt-4 border-t border-white/10 pt-3" aria-label={t("Timer style")}><p className="mb-2 text-[11px] font-semibold text-white/65">{t("Timer style")}</p><div className="grid grid-cols-2 gap-2">{[{value:"ring",label:"Ring"},{value:"digital",label:"Digital"},{value:"minimal",label:"Minimal"},{value:"bar",label:"Progress bar"},{value:"orbit",label:"Orbit"}].map(item => <button key={item.value} type="button" onClick={() => void selectTimerStyle(item.value as TimerStyle)} aria-pressed={timerStyle === item.value} className={cn("min-h-9 rounded-xl border px-2 py-2 text-[11px]", timerStyle === item.value ? "border-white/70 bg-white/15 text-white" : "border-white/10 bg-white/5 text-white/65")}>{t(item.label)}</button>)}</div></section>
            <section className="mt-4 border-t border-white/10 pt-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-white/65">{t("Readability overlay")}</p><span className="text-[10px] tabular-nums text-white/45">{backgroundOverlay}%</span></div><input type="range" min={0} max={80} step={5} value={backgroundOverlay} onChange={e => setBackgroundOverlay(Number(e.target.value))} className="w-full" aria-label={t("Readability overlay")} /></section>
            <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer list-none text-[11px] font-semibold text-white/65">{t("Session options")}</summary><label className="mt-3 block text-xs text-white/65">{t("Focus on a task (optional)")}
              <select className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white" value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={phase !== "idle"}><option value="">{t("No task — general focus")}</option>{data?.tasks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            </label></details>
          </div>}
        </div>
        <button type="button" onClick={() => { setMusicSearchOpen(v => !v); setThemeOpen(false); setBackgroundOpen(false); setMixerOpen(false); setShortcutsOpen(false); }} aria-label={t("Search music")} aria-expanded={musicSearchOpen} className="grid size-9 sm:size-10 place-items-center rounded-xl sm:rounded-2xl border border-white/15 bg-black/25 text-white shadow-lg backdrop-blur-2xl transition hover:bg-white/15"><Search className="size-5" /></button>
        <div className="relative">
          <button type="button" onClick={() => { setBackgroundOpen(v => !v); setThemeOpen(false); setMusicSearchOpen(false); setMixerOpen(false); setShortcutsOpen(false); }} aria-label={t("Focus background")} aria-expanded={backgroundOpen} className="grid size-9 sm:size-10 place-items-center rounded-xl sm:rounded-2xl border border-white/15 bg-black/25 text-white shadow-lg backdrop-blur-2xl transition hover:bg-white/15"><Video className="size-5" /></button>
          {backgroundOpen && <div role="dialog" aria-label={t("Focus background")} className="absolute end-0 top-[calc(100%+10px)] max-h-[min(78dvh,650px)] w-[min(92vw,370px)] overflow-y-auto rounded-3xl border border-white/15 bg-[#101622]/92 p-3 text-white shadow-2xl backdrop-blur-3xl">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{t("Focus background")}</h2><button type="button" onClick={() => setBackgroundOpen(false)} aria-label={t("Close")} className="rounded-xl p-2 text-white/65 hover:bg-white/10"><X className="size-4" /></button></div>
            <p className="mb-2 text-[11px] text-white/55">{t("Choose one of six original animated wallpapers. Your selection is saved to your account.")}</p>
            <div className="grid grid-cols-2 gap-2">{WALLPAPERS.map(w => <button key={w.id} type="button" onClick={() => void selectWallpaper(w.id)} aria-pressed={backgroundScene === w.id} className={cn("overflow-hidden rounded-xl border text-start transition", backgroundScene === w.id ? "border-white/80 ring-1 ring-white/30" : "border-white/10 hover:border-white/35")}><div className="focus-wallpaper-preview"><img src={`/focus-wallpapers/${w.id}.svg`} alt="" loading="lazy" decoding="async" className="size-full object-cover" /></div><span className="block px-2 py-2 text-xs font-medium">{t(w.label)}</span><span className="block px-2 pb-2 text-[10px] leading-snug text-white/45">{t(w.hint)}</span></button>)}
              <button type="button" onClick={() => void selectWallpaper("none")} aria-pressed={backgroundScene === "none"} className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[.03] text-xs text-white/65">{t("No wallpaper")}</button></div>
            <label aria-disabled={backgroundUploading} className={cn("mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 text-xs", backgroundUploading ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-white/15")}><ImagePlus className="size-4" />{backgroundUploading ? t("Uploading…") : t("Upload background image")}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={backgroundUploading} className="sr-only" onChange={e => {const file=e.currentTarget.files?.[0];if(file)void uploadFocusBackground(file);e.currentTarget.value="";}} /></label>
            {backgroundImage && <div className="mt-3 overflow-hidden rounded-xl border border-white/10"><img src={backgroundImage} alt={t("Uploaded focus background preview")} className="h-24 w-full object-cover" /><p className="px-2 py-1.5 text-[10px] text-white/60">{t("Your uploaded background is saved to your account.")}</p></div>}
            {imageMessage && <p role="status" aria-live="polite" className="mt-2 text-xs text-white/65">{imageMessage}</p>}
            {backgroundImage && <button type="button" onClick={removeFocusBackground} className="mt-2 flex items-center gap-1.5 text-xs text-white/55"><Trash2 className="size-3.5" />{t("Remove background image")}</button>}
          </div>}
        </div>
        <button type="button" onClick={() => { setMixerOpen(v => !v); setThemeOpen(false); setBackgroundOpen(false); setMusicSearchOpen(false); setShortcutsOpen(false); }} aria-label={t("Music mixer")} aria-expanded={mixerOpen} className="grid size-9 sm:size-10 place-items-center rounded-xl sm:rounded-2xl border border-white/15 bg-black/25 text-white shadow-lg backdrop-blur-2xl transition hover:bg-white/15"><SlidersHorizontal className="size-5" /></button>
        <button type="button" onClick={() => { setShortcutsOpen(v => !v); setThemeOpen(false); setBackgroundOpen(false); setMusicSearchOpen(false); setMixerOpen(false); }} aria-label={t("Keyboard shortcuts")} aria-expanded={shortcutsOpen} className="hidden xl:grid size-9 sm:size-10 place-items-center rounded-xl sm:rounded-2xl border border-white/15 bg-black/25 text-white shadow-lg backdrop-blur-2xl transition hover:bg-white/15"><Keyboard className="size-5" /></button>
        <button type="button" onClick={() => void toggleZen()} aria-label={t("Exit fullscreen focus")} className="grid size-9 sm:size-10 place-items-center rounded-xl sm:rounded-2xl border border-white/15 bg-black/25 text-white shadow-lg backdrop-blur-2xl transition hover:bg-white/15"><Minimize2 className="size-5" /></button>
      </div>
      {shortcutsOpen && <div role="dialog" aria-label={t("Keyboard shortcuts")} className="absolute right-3 top-16 z-40 w-[min(90vw,300px)] rounded-2xl border border-white/15 bg-[#101622]/90 p-4 text-xs text-white shadow-2xl backdrop-blur-3xl"><div className="mb-2 flex items-center justify-between"><p className="font-semibold">{t("Keyboard shortcuts")}</p><button type="button" onClick={() => setShortcutsOpen(false)} aria-label={t("Close")}><X className="size-4" /></button></div><ul className="space-y-2"><li className="flex justify-between"><kbd className="kbd">Space</kbd>{t("Start / pause")}</li><li className="flex justify-between"><kbd className="kbd">F</kbd>{t("Immersive mode")}</li><li className="flex justify-between"><kbd className="kbd">S</kbd>{t("Skip phase")}</li><li className="flex justify-between"><kbd className="kbd">E</kbd>{t("End session and exit")}</li><li className="flex justify-between"><kbd className="kbd">Esc</kbd>{t("Exit immersive mode")}</li></ul></div>}
      <div className="relative z-40 flex h-full w-full flex-col items-center justify-start overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16 sm:justify-center sm:px-8 sm:pt-20" onClick={(event) => { if (event.target === event.currentTarget) closeFocusOverlays(); }}>
        <div className="flex w-full max-w-4xl flex-col items-center" onClick={(event) => { const target = event.target; if (!(target instanceof Element) || !target.closest('[role="dialog"], [data-focus-overlay-safe]')) closeFocusOverlays(); }}>
          {timer}
          <div className="mt-5 flex w-full justify-center">
            <div className="w-full space-y-2">
              <div className="flex items-center justify-center gap-1.5" role="group" aria-label={t("Focus music provider")} data-focus-overlay-safe>
                <button type="button" onClick={() => setFocusMusicProvider("youtube")} aria-pressed={focusMusicProvider === "youtube"} className={cn("rounded-full border px-3 py-1.5 text-[11px] font-medium transition", focusMusicProvider === "youtube" ? "border-white/50 bg-white/15 text-white" : "border-white/10 bg-black/20 text-white/55 hover:bg-white/10")}>YouTube Music</button>
                <button type="button" onClick={() => setFocusMusicProvider("audius")} aria-pressed={focusMusicProvider === "audius"} className={cn("rounded-full border px-3 py-1.5 text-[11px] font-medium transition", focusMusicProvider === "audius" ? "border-white/50 bg-white/15 text-white" : "border-white/10 bg-black/20 text-white/55 hover:bg-white/10")}>Audius</button>
              </div>
              {focusMusicProvider === "youtube" ? <YouTubeMusicPlayer compact searchPlacement="viewport" searchOpen={musicSearchOpen} mixerOpen={mixerOpen} onCloseSearch={() => setMusicSearchOpen(false)} onCloseMixer={() => setMixerOpen(false)} /> : <AudiusPlayer compact searchPlacement="viewport" searchOpen={musicSearchOpen} mixerOpen={mixerOpen} onCloseSearch={() => setMusicSearchOpen(false)} onCloseMixer={() => setMixerOpen(false)} />}
            </div>
          </div>
        </div>
      </div>
    </main>
  );

  return (
    <div className="focus-zone-surface relative isolate mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-5xl flex-col items-center justify-center overflow-hidden rounded-[2rem] px-3 py-6 sm:px-6" style={focusPageStyle}>
      {backgroundImage ? <img src={backgroundImage} alt="" aria-hidden className="absolute inset-0 z-0 h-full w-full object-cover object-center" /> : backgroundScene !== "none" && <FocusWallpaperLayer scene={backgroundScene} failed={wallpaperVideoFailed} reducedMotion={prefs.theme.reducedMotion} onError={() => setWallpaperVideoFailed(true)} />}
      {(backgroundImage || backgroundScene !== "none") && <div className="absolute inset-0 z-[1] bg-black" style={{ opacity: backgroundOverlay / 100 }} aria-hidden />}
      <div className="relative z-10 flex w-full flex-col items-center">
      <section className="w-full max-w-2xl rounded-[2rem] border border-line bg-card/55 p-5 shadow-xl backdrop-blur-2xl sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.2em] text-muted">{t("Focus Room")}</p><p className="mt-1 text-sm text-faint">{task?.title ?? t("Deep work, one session at a time.")}</p></div><Button variant="ghost" size="icon" className="size-11 rounded-2xl border border-line bg-card/70" onClick={toggleZen} aria-label={t("Fullscreen focus mode")}><Maximize2 className="size-5" /></Button></div>
        {timer}
      </section>
      <div className="mt-8 grid w-full max-w-2xl grid-cols-3 gap-3 text-center">{[["Today", minutesLabel(data?.todayMinutes ?? 0)],["This week",minutesLabel(data?.weekMinutes ?? 0)],["Sessions",String(data?.totalSessions ?? 0)]].map(([label,value])=><div key={label} className="rounded-2xl border border-line bg-card/45 p-3 backdrop-blur-xl"><p className="text-lg font-semibold tabular-nums">{value}</p><p className="text-xs text-faint">{t(label)}</p></div>)}</div>
      <div className="mt-6 w-full max-w-2xl"><Field label={t("Focus on a task (optional)")}><select className="input" value={taskId} onChange={e=>setTaskId(e.target.value)} disabled={phase!=="idle"}><option value="">{t("No task — general focus")}</option>{data?.tasks.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></Field></div>
      <div className="mt-6 w-full max-w-2xl"><h2 className="mb-3 text-sm font-medium text-muted">{t("Session history")}</h2>{!data?.sessions.length?<EmptyState icon={<Play className="size-5" />} title={t("No sessions yet")} text={t("Finish your first session and it will be recorded here.")}/>:<Card pad={false}><ul className="divide-y divide-[var(--border)]">{data.sessions.map(s=><li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="min-w-0"><span className="block truncate">{s.taskTitle??t(MODES.find(m=>m.value===s.mode)?.label??s.mode)}</span><span className="text-xs text-faint">{new Date(s.startedAt).toLocaleString(lang==="ar"?"ar-EG":"en",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span></span><span className="flex items-center gap-2"><Badge tone={s.status==="completed"?"green":undefined}>{t(s.status==="completed"?"Completed":"Ended early")}</Badge><span className="tabular-nums text-muted">{Math.round(s.actualSeconds/60)}m</span></span></li>)}</ul></Card>}</div>
      </div>
    </div>
  );
}
