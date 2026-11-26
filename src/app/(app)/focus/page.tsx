"use client";
/* eslint-disable @next/next/no-img-element */
import { ImagePlus, Keyboard, Maximize2, Minimize2, Music2, Pause, Play, RotateCcw, SkipBack, SkipForward, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { PriorityBadge, type Task } from "@/components/task-form";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Segmented, cn, useUI } from "@/components/ui";
import { api, minutesLabel, useFetch } from "@/lib/client";
import { SOUNDS, startAmbient, type AmbientHandle } from "@/lib/ambient";
import { useProgress, useSpotify } from "@/components/spotify";

type Session = { id: string; mode: string; plannedSeconds: number; actualSeconds: number; status: string; startedAt: string; lastResumedAt?: string | null; pausedAt?: string | null; taskTitle?: string | null };
type FocusData = { todayMinutes: number; weekMinutes: number; totalSessions: number; sessions: Session[]; running: (Session & { serverNow: number }) | null; tasks: { id: string; title: string; priority: Task["priority"] }[]; prefs: { sound: string; volume: number; preset: number } };
type Mode = "focus" | "short_break" | "long_break" | "custom";
const MODES: { value: Mode; label: string; min: number }[] = [{ value: "focus", label: "Standard Focus", min: 25 }, { value: "short_break", label: "Short Break", min: 5 }, { value: "long_break", label: "Long Break", min: 15 }, { value: "custom", label: "Custom Session", min: 30 }];
const PRESETS = [15, 25, 45, 60];
type FocusWallpaper = "none" | "forest" | "ocean" | "rain" | "sunset" | "cosmos";
type TimerStyle = "ring" | "digital" | "minimal" | "bar";
const WALLPAPER_VIDEO_URLS: Record<Exclude<FocusWallpaper, "none">, string> = {
  forest: "https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4",
  ocean: "https://assets.mixkit.co/videos/preview/mixkit-waves-coming-to-the-beach-5016-large.mp4",
  rain: "https://assets.mixkit.co/videos/preview/mixkit-window-on-a-rainy-day-2846-large.mp4",
  sunset: "https://assets.mixkit.co/videos/preview/mixkit-sunset-behind-the-skyline-on-the-beach-over-the-sea-51445-large.mp4",
  cosmos: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1610-large.mp4",
};
const WALLPAPERS: { id: Exclude<FocusWallpaper, "none">; label: string; hint: string }[] = [
  { id: "forest", label: "Misty Forest", hint: "Soft green light and drifting fog" },
  { id: "ocean", label: "Ocean Drift", hint: "Deep blue waves and moving light" },
  { id: "rain", label: "Rainy Window", hint: "Quiet rain and blurred city lights" },
  { id: "sunset", label: "Golden Hour", hint: "Warm sunset clouds and soft glow" },
  { id: "cosmos", label: "Deep Space", hint: "Slow stars and violet nebula" },
];
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function FocusWallpaperLayer({ scene, failed, onError }: { scene: Exclude<FocusWallpaper, "none">; failed: boolean; onError: () => void }) {
  return (
    <div className={`focus-wallpaper focus-wallpaper-${scene}`} aria-hidden>
      {!failed && <video key={scene} autoPlay muted loop playsInline preload="metadata" tabIndex={-1} onError={onError} className="absolute inset-0 size-full object-cover">
        <source src={WALLPAPER_VIDEO_URLS[scene]} type="video/mp4" />
      </video>}
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
}

type BridgeNowPlaying = {
  idle: boolean;
  playing?: boolean;
  track?: { title: string; artist: string; album: string; artwork: string | null; appName: string };
  device?: { id: string; name: string; platform: string };
  progressMs?: number;
  durationMs?: number;
  fetchedAt?: number;
};

function FocusNowPlaying({ immersive = false }: { immersive?: boolean }) {
  const { np, status, refresh } = useSpotify();
  const { t } = useApp();
  const progress = useProgress(np);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [bridge, setBridge] = useState<BridgeNowPlaying | null>(null);
  const spotifyNowPlaying = np && !np.idle ? np : null;
  const track = spotifyNowPlaying?.track ?? null;
  const bridgeTrack = bridge && !bridge.idle ? bridge.track ?? null : null;
  const premium = status?.profile?.product === "premium";
  const displayTitle = track?.title ?? bridgeTrack?.title ?? null;
  const displayArtist = track ? track.artists.map((artist) => artist.name).join(", ") : bridgeTrack?.artist ?? "";
  const displayArtwork = track?.album.image ?? bridgeTrack?.artwork ?? null;
  const displayDevice = track ? spotifyNowPlaying?.device?.name : bridge?.device?.name ?? bridgeTrack?.appName ?? null;
  const isPlaying = track ? !!spotifyNowPlaying?.playing : !!bridgeTrack && !!bridge?.playing;
  const displayProgress = track ? progress : bridge?.progressMs ?? 0;
  const displayDuration = track?.durationMs ?? bridge?.durationMs ?? 0;

  useEffect(() => {
    if (!open || track) return;
    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof window.setInterval> | null = null;
    const load = async () => {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try { setBridge(await api<BridgeNowPlaying>("/api/music-bridge/now-playing")); } catch { /* Bridge is optional. */ }
      finally { inFlight = false; }
    };
    const start = () => {
      if (document.visibilityState !== "visible" || timer) return;
      void load();
      timer = window.setInterval(() => void load(), 10000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else if (timer) { window.clearInterval(timer); timer = null; }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open, track?.id]);

  async function control(action: "play" | "pause" | "next" | "previous") {
    setBusy(true);
    setMessage("");
    try {
      await api("/api/spotify/control", { body: { action } });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Could not control Spotify."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={immersive ? "pointer-events-auto absolute bottom-4 left-1/2 z-30 w-[min(92vw,390px)] -translate-x-1/2 sm:bottom-6" : "pointer-events-auto relative z-20 flex w-full justify-center"}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={t("Open music controls")} className="flex max-w-full items-center gap-2.5 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-white shadow-xl backdrop-blur-2xl transition hover:bg-black/60">
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">{displayArtwork ? <img src={displayArtwork} alt="" className="size-full object-cover" /> : <Music2 className="size-4 text-white/75" />}</span>
        <span className="min-w-0 text-start">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/55">{displayTitle ? (isPlaying ? t("Now playing") : t("Paused")) : t("Music")}</span>
          <span className="block max-w-[230px] truncate text-xs font-medium">{displayTitle ?? (status?.connected ? t("Nothing playing") : t("Connect Spotify"))}</span>
        </span>
        <Music2 className="size-4 shrink-0 text-white/65" />
      </button>
      {open && <div role="dialog" aria-label={t("Music controls")} className="absolute bottom-[calc(100%+10px)] left-1/2 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#11131b]/95 p-3 text-white shadow-2xl backdrop-blur-2xl">
        {displayTitle ? <>
          <div className="flex items-center gap-3">
            <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-white/10">{displayArtwork ? <img src={displayArtwork} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center"><Music2 className="size-5" /></div>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{displayTitle}</p><p className="truncate text-xs text-white/60">{displayArtist}</p><p className="truncate text-[10px] text-white/40">{displayDevice ?? "Music"}</p></div>
            <span className={"size-2 rounded-full " + (isPlaying ? "bg-emerald-400" : "bg-amber-300")} />
          </div>
          {displayDuration > 0 && <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white/75" style={{ width: `${Math.min(100, displayProgress / displayDuration * 100)}%` }} /></div>}
          <div className="mt-3 flex items-center justify-center gap-4">
            {track && premium ? <>
              <button type="button" disabled={busy || spotifyNowPlaying?.disallows?.previous} onClick={() => void control("previous")} className="rounded-full p-2 hover:bg-white/10 disabled:opacity-40" aria-label={t("Previous track")}><SkipBack className="size-4" /></button>
              <button type="button" disabled={busy || (isPlaying ? spotifyNowPlaying?.disallows?.pausing : spotifyNowPlaying?.disallows?.resuming)} onClick={() => void control(isPlaying ? "pause" : "play")} className="grid size-10 place-items-center rounded-full bg-white text-black disabled:opacity-50" aria-label={isPlaying ? t("Pause") : t("Play")}>{isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
              <button type="button" disabled={busy || spotifyNowPlaying?.disallows?.skipping_next} onClick={() => void control("next")} className="rounded-full p-2 hover:bg-white/10 disabled:opacity-40" aria-label={t("Next track")}><SkipForward className="size-4" /></button>
            </> : <a href={track ? "/music" : "/music-bridge"} className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium hover:bg-white/15">{t(track ? "Open Music Hub" : "Open Music Detection")}</a>}
          </div>
        </> : <div className="py-2 text-center"><Music2 className="mx-auto mb-2 size-6 text-white/55" /><p className="text-sm font-medium">{status?.connected ? t("Nothing playing") : t("Connect Spotify")}</p><p className="mt-1 text-xs text-white/55">{status?.connected ? t("Start playback in Spotify and it will show up here.") : t("Connect Spotify to see what you're listening to.")}</p><a href="/music" className="mt-3 inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-medium hover:bg-white/15">{t("Open Music Hub")}</a></div>}
        {message && <p role="status" className="mt-2 text-center text-xs text-amber-300">{message}</p>}
      </div>}
    </div>
  );
}
export default function FocusPage() {
  const { savePrefs, prefs, t, lang } = useApp();
  const { run, toast } = useUI();
  const { data, reload } = useFetch<FocusData>("/api/focus");
  const [mode, setMode] = useState<Mode>("focus");
  const [minutes, setMinutes] = useState(25);
  const [taskId, setTaskId] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "paused">("idle");
  const [remaining, setRemaining] = useState(25 * 60);
  const [sid, setSid] = useState<string | null>(null);
  const [planned, setPlanned] = useState(25 * 60);
  const [zen, setZen] = useState(false);
  const [sound, setSound] = useState(prefs.focus.sound);
  const [volume, setVolume] = useState(prefs.focus.volume);
  const [audioOn, setAudioOn] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundScene, setBackgroundScene] = useState<FocusWallpaper>(prefs.focus.background);
  const [wallpaperVideoFailed, setWallpaperVideoFailed] = useState(false);
  const [timerStyle, setTimerStyle] = useState<TimerStyle>(prefs.focus.timerStyle);
  useEffect(() => { setBackgroundScene(prefs.focus.background); setTimerStyle(prefs.focus.timerStyle); setWallpaperVideoFailed(false); }, [prefs.focus.background, prefs.focus.timerStyle]);
  const [imageMessage, setImageMessage] = useState("");
  const endAt = useRef(0);
  const amb = useRef<AmbientHandle | null>(null);
  const finishing = useRef(false);
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
    const elapsed = r.actualSeconds + (r.status === "running" ? Math.max(0, Math.floor((Date.now() - new Date(r.lastResumedAt ?? r.startedAt).getTime()) / 1000)) : 0);
    const left = Math.max(0, r.plannedSeconds - elapsed);
    setSid(r.id); setPlanned(r.plannedSeconds); setMode(r.mode as Mode); setMinutes(Math.round(r.plannedSeconds / 60)); setRemaining(left); endAt.current = Date.now() + left * 1000; setPhase(r.status === "paused" ? "paused" : "running");
  }, [data, phase]);

  const complete = useCallback(async (id: string) => {
    if (finishing.current) return;
    finishing.current = true;
    const r = await run(() => api<{ xp: number; unlocked: string[] }>(`/api/focus/${id}`, { body: { action: "complete" } }));
    if (!r) { finishing.current = false; return; }
    toast("success", r.xp ? ` ${t("Focus session complete")} · +${r.xp} XP` : t("Session complete"));
    r.unlocked.forEach((u) => toast("success", t(u)));
    setPhase("idle"); setSid(null); setRemaining(minutes * 60); finishing.current = false; reload();
  }, [run, toast, minutes, reload]);

  useEffect(() => {
    if (phase !== "running") return;
    const i = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && sid) complete(sid);
    }, 250);
    return () => clearInterval(i);
  }, [phase, sid, complete]);

  useEffect(() => {
    const originalTitle = document.title;
    if (phase === "running") document.title = `${mmss(remaining)} · ${t("Focus")}`;
    return () => { document.title = originalTitle; };
  }, [phase, remaining]);

  // ambient audio — only after explicit user action, never autoplay
  useEffect(() => {
    amb.current?.stop(); amb.current = null;
    if (audioOn && sound !== "none") amb.current = startAmbient(sound, volume);
    return () => { amb.current?.stop(); amb.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioOn, sound]);
  useEffect(() => { amb.current?.setVolume(volume); }, [volume]);
  useEffect(() => { const h = setTimeout(() => { if (sound !== prefs.focus.sound || volume !== prefs.focus.volume) savePrefs({ focus: { ...prefs.focus, sound, volume } }).catch(() => {}); }, 800); return () => clearTimeout(h); }, [sound, volume]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => { if (!document.fullscreenElement) setZen(false); }; document.addEventListener("fullscreenchange", h); return () => document.removeEventListener("fullscreenchange", h); }, []);

  const setDuration = (m: number) => { if (phase !== "idle") return; const v = Math.min(240, Math.max(1, Math.round(m) || 1)); setMinutes(v); setRemaining(v * 60); setPlanned(v * 60); };
  const pickMode = (m: Mode) => { if (phase !== "idle") return; setMode(m); setDuration(MODES.find((x) => x.value === m)!.min); };

  async function uploadFocusBackground(file: File) {
    if (!file.type.startsWith("image/")) { setImageMessage(t("Choose an image file.")); return; }
    const objectUrl = URL.createObjectURL(file);
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
        if (result && result.size <= 440 * 1024) break;
        if (quality > 0.5) quality -= 0.08;
        else { width *= 0.82; height *= 0.82; quality = 0.82; }
      }
      if (!result || result.size > 440 * 1024) throw new Error("The image could not be reduced below 450 KB. Try a smaller image.");
      const form = new FormData();
      form.append("file", new File([result], "focus-background.webp", { type: "image/webp" }));
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
      await savePrefs({ focus: { ...prefs.focus, background: backgroundScene, timerStyle: style } });
    } catch {
      setImageMessage(t("Could not save the timer style. Please try again."));
    }
  }

  async function selectWallpaper(id: FocusWallpaper) {
    setBackgroundScene(id);
    setWallpaperVideoFailed(false);
    try {
      await savePrefs({ focus: { ...prefs.focus, background: id, timerStyle } });
    } catch {
      setImageMessage(t("Could not save the wallpaper selection. Please try again."));
    }
  }

  async function start() {
    const r = await run(() => api<{ session: Session }>("/api/focus", { body: { mode, minutes, taskId: taskId || null } }));
    if (!r) return;
    finishing.current = false; setSid(r.session.id); setPlanned(minutes * 60); setRemaining(minutes * 60); endAt.current = Date.now() + minutes * 60000; setPhase("running");
  }
  const pause = async () => {
    if (!sid || phase !== "running") return;
    const nextRemaining = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
    const result = await run(() => api(`/api/focus/${sid}`, { body: { action: "pause" } }));
    if (!result) return;
    setRemaining(nextRemaining); setPhase("paused"); reload();
  };
  const resume = async () => {
    if (!sid || phase !== "paused") return;
    const result = await run(() => api(`/api/focus/${sid}`, { body: { action: "resume" } }));
    if (!result) return;
    endAt.current = Date.now() + remaining * 1000; setPhase("running"); reload();
  };
  async function end(reset = false): Promise<boolean> {
    if (sid) {
      const result = await run(() => api(`/api/focus/${sid}`, { body: { action: "end", activeSeconds: Math.max(0, planned - remaining) } }), reset ? undefined : t("Session ended — time so far was recorded"));
      if (!result) return false;
    }
    setPhase("idle"); setSid(null); setRemaining(minutes * 60); setPlanned(minutes * 60); reload();
    return true;
  }

  async function skipPhase() {
    if (phase === "idle" || !(await end(true))) return;
    const nextMode: Mode = mode === "focus" || mode === "custom" ? "short_break" : "focus";
    const nextMinutes = MODES.find((item) => item.value === nextMode)!.min;
    setMode(nextMode); setMinutes(nextMinutes); setRemaining(nextMinutes * 60); setPlanned(nextMinutes * 60);
  }

  async function exitFocus() {
    if (phase !== "idle" && !(await end(false))) return;
    if (zen) await toggleZen();
  }
  async function toggleZen() {
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
    phase, sound, zen, start: () => {}, pause: () => {}, resume: () => {}, skipPhase: () => {}, exitFocus: () => {}, toggleZen: () => {},
  });
  useEffect(() => {
    keyboardActions.current = {
      phase, sound, zen, start: () => { void start(); }, pause, resume, skipPhase: () => { void skipPhase(); }, exitFocus: () => { void exitFocus(); }, toggleZen: () => { void toggleZen(); },
    };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const actions = keyboardActions.current;
      if (event.code === "Space") {
        event.preventDefault();
        if (actions.phase === "idle") actions.start();
        else if (actions.phase === "running") actions.pause();
        else actions.resume();
      } else if (event.key.toLowerCase() === "s") {
        actions.skipPhase();
      } else if (event.key.toLowerCase() === "e") {
        actions.exitFocus();
      } else if (event.key.toLowerCase() === "m" && actions.sound !== "none") {
        setAudioOn((value) => !value);
      } else if (event.key.toLowerCase() === "f" || (event.key === "Escape" && actions.zen)) {
        actions.toggleZen();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  const pct = planned ? ((planned - remaining) / planned) * 100 : 0;
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
            <p role="timer" aria-live="off" className="my-1 text-[clamp(3.2rem,14vw,5.5rem)] font-light tabular-nums leading-none tracking-tight">{mmss(remaining)}</p>
            <p className="mx-auto max-w-[14rem] truncate text-sm text-muted">{task ? task.title : phase === "idle" ? t("Ready when you are") : t("Stay with it")}</p>
          </div>
        </div>
      ) : timerStyle === "digital" ? (
        <div className="flex min-h-[220px] w-full max-w-[520px] flex-col items-center justify-center rounded-[32px] border border-white/10 bg-black/25 px-5 py-9 shadow-2xl backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">{t(MODES.find((m) => m.value === mode)?.label ?? "Focus")}</p>
          <p role="timer" aria-live="off" className="my-5 font-mono text-[clamp(4rem,17vw,7.5rem)] font-light leading-none tracking-[-0.08em] text-white tabular-nums">{mmss(remaining)}</p>
          <div className="h-1.5 w-full max-w-[340px] overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white/80 transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
          <p className="mt-4 max-w-[80%] truncate text-sm text-white/65">{task?.title ?? t("Ready when you are")}</p>
        </div>
      ) : timerStyle === "minimal" ? (
        <div className="flex min-h-[220px] w-full flex-col items-center justify-center py-8">
          <p className="mb-4 text-xs uppercase tracking-[0.32em] text-faint">{t(MODES.find((m) => m.value === mode)?.label ?? "Focus")}</p>
          <p role="timer" aria-live="off" className="text-[clamp(5rem,22vw,10rem)] font-extralight leading-none tracking-[-0.09em] tabular-nums">{mmss(remaining)}</p>
          <div className="mt-7 h-px w-28 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
          <p className="mt-4 max-w-[80%] truncate text-sm text-muted">{task?.title ?? t("Stay with it")}</p>
        </div>
      ) : (
        <div className="flex min-h-[220px] w-full max-w-[520px] flex-col justify-center rounded-3xl border border-line bg-card/70 p-6 sm:p-9">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><p className="text-xs uppercase tracking-[0.2em] text-faint">{t(MODES.find((m) => m.value === mode)?.label ?? "Focus")}</p><p className="mt-2 text-sm text-muted">{task?.title ?? t("Ready when you are")}</p></div>
            <p role="timer" aria-live="off" className="text-[clamp(3.5rem,13vw,6rem)] font-light leading-none tracking-tight tabular-nums">{mmss(remaining)}</p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--input)]"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
          <p className="mt-3 text-end text-xs tabular-nums text-faint">{Math.round(pct)}%</p>
        </div>
      )}
      <div className="mt-6 flex items-center gap-3">
        {phase === "idle" && <Button variant="primary" className="h-12 px-8 text-base" onClick={start}><Play className="size-5" /> {t("Start")}</Button>}
        {phase === "running" && <Button className="h-12 px-6" onClick={pause}><Pause className="size-5" /> {t("Pause")}</Button>}
        {phase === "paused" && <Button variant="primary" className="h-12 px-6" onClick={resume}><Play className="size-5" /> {t("Resume")}</Button>}
        {phase !== "idle" && <Button className="h-12" onClick={() => end(false)}><Square className="size-4" /> {t("End")}</Button>}
        {phase !== "idle" && <Button variant="ghost" className="h-12" onClick={() => end(true)} aria-label={t("Reset")}><RotateCcw className="size-4" /> {t("Reset")}</Button>}
        <Button variant="ghost" size="icon" className="h-12 w-12" onClick={toggleZen} aria-label={zen ? t("Exit fullscreen focus") : t("Fullscreen focus mode")}>{zen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}</Button>
      </div>
      {phase !== "idle" && <p className="mt-3 text-xs text-faint">{t("Rewards are only granted when the full duration has elapsed on the server.")}</p>}
      <div className="relative mt-3 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setShortcutsOpen((value) => !value)} aria-expanded={shortcutsOpen} aria-label={t("Keyboard shortcuts")}><Keyboard className="size-4" /> {t("Keyboard shortcuts")}</Button>
        {shortcutsOpen && <div role="dialog" aria-label={t("Keyboard shortcuts")} className="absolute bottom-full z-30 mb-2 w-[min(90vw,300px)] rounded-xl border border-line bg-pop p-3 text-xs shadow-xl">
          <div className="flex items-center justify-between"><p className="font-semibold">{t("Keyboard shortcuts")}</p><button type="button" onClick={() => setShortcutsOpen(false)} aria-label={t("Close")} className="rounded-md p-1 hover:bg-card">×</button></div>
          <ul className="mt-2 space-y-2">
            <li className="flex justify-between gap-3"><span><kbd className="kbd">Space</kbd></span><span>{t("Start / pause")}</span></li>
            <li className="flex justify-between gap-3"><span><kbd className="kbd">F</kbd></span><span>{t("Immersive mode")}</span></li>
            <li className="flex justify-between gap-3"><span><kbd className="kbd">S</kbd></span><span>{t("Skip phase")}</span></li>
            <li className="flex justify-between gap-3"><span><kbd className="kbd">M</kbd></span><span>{t("Mute / unmute ambient sound")}</span></li>
            <li className="flex justify-between gap-3"><span><kbd className="kbd">E</kbd></span><span>{t("End session and exit")}</span></li>
            <li className="flex justify-between gap-3"><span><kbd className="kbd">Esc</kbd></span><span>{t("Exit immersive mode")}</span></li>
          </ul>
        </div>}
      </div>
    </div>
  );

  if (zen) return (
    <div className="fixed inset-0 z-[90] flex min-h-[100dvh] w-screen flex-col items-center justify-start overflow-y-auto overscroll-contain p-3 pb-[max(5rem,env(safe-area-inset-bottom))] sm:justify-center sm:p-6">
      {backgroundImage ? (
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center center" }} aria-hidden />
      ) : backgroundScene !== "none" ? (
        <FocusWallpaperLayer scene={backgroundScene} failed={wallpaperVideoFailed || !!prefs.theme.reducedMotion} onError={() => setWallpaperVideoFailed(true)} />
      ) : <div className="absolute inset-0 app-glow" />}
      <div className="absolute inset-0 bg-black/35" aria-hidden />
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-5 py-4 sm:py-0">
        <div className="flex w-full flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
          <select className="input w-auto" value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={phase !== "idle"} aria-label={t("Focus on a task (optional)")}><option value="">{t("No task — general focus")}</option>{data?.tasks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          <Segmented value={mode} onChange={pickMode} label={t("Focus mode")} options={MODES.map((m) => ({ value: m.value, label: t(m.label) }))} />
          <Segmented value={timerStyle} onChange={(value) => void selectTimerStyle(value as TimerStyle)} label={t("Timer style")} options={[{ value: "ring", label: t("Ring") }, { value: "digital", label: t("Digital") }, { value: "minimal", label: t("Minimal") }, { value: "bar", label: t("Progress bar") }]} />
          {(mode === "focus" || mode === "custom") && <>
            {PRESETS.map((p) => <button key={p} type="button" disabled={phase !== "idle"} onClick={() => setDuration(p)} aria-pressed={minutes === p} className={cn("chip px-3 py-1 text-sm", minutes === p && "!border-accent !text-fg", "disabled:opacity-40")}>{p} {t("min")}</button>)}
            <label className="chip px-3 py-1 text-sm">{t("Custom")} <input type="number" min={1} max={240} disabled={phase !== "idle"} value={minutes} onChange={(e) => setDuration(Number(e.target.value))} className="w-14 bg-transparent text-center outline-none" aria-label={t("Custom minutes")} /> {t("min")}</label>
          </>}
        </div>
        {timer}
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm backdrop-blur-xl">
          <span className="text-white/80">{t("Ambient sound")}</span>
          <select className="input w-auto" value={sound} onChange={(e) => { setSound(e.target.value); setAudioOn(e.target.value !== "none"); }} aria-label={t("Ambient sound")}>
            <option value="none">{t("Silent")}</option>
            {SOUNDS.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
          </select>
          <Volume2 className="size-4 text-white/80" />
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label={t("Volume")} />
        </div>
      </div>
      <FocusNowPlaying immersive />
    </div>
  );

  return (
    <>
      <PageHeader title={t("Focus Room")} subtitle={t("Deep work, one session at a time.")} />
      {(backgroundImage || backgroundScene !== "none") && <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        {backgroundImage ? <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-45" style={{ backgroundImage: `url(${backgroundImage})` }} /> : <FocusWallpaperLayer scene={backgroundScene as Exclude<FocusWallpaper, "none">} failed={wallpaperVideoFailed || !!prefs.theme.reducedMotion} onError={() => setWallpaperVideoFailed(true)} />}
        <div className="absolute inset-0 bg-gradient-to-b from-[color-mix(in_srgb,var(--bg)_48%,transparent)] via-[color-mix(in_srgb,var(--bg)_72%,transparent)] to-[var(--bg)]" />
      </div>}
      <div className="relative z-10">
      <div className="mb-4 flex justify-center"><FocusNowPlaying /></div>
      <div className="grid gap-[var(--gap)] lg:grid-cols-[1fr_340px]">
        <Card className="flex flex-col items-center py-8">
          <div className="mb-6 flex w-full flex-col items-center gap-3">
            <Segmented value={mode} onChange={pickMode} label={t("Focus mode")} options={MODES.map((m) => ({ value: m.value, label: t(m.label) }))} />
            <Segmented value={timerStyle} onChange={(value) => void selectTimerStyle(value as TimerStyle)} label={t("Timer style")} options={[{ value: "ring", label: t("Ring") }, { value: "digital", label: t("Digital") }, { value: "minimal", label: t("Minimal") }, { value: "bar", label: t("Progress bar") }]} />
            {(mode === "focus" || mode === "custom") && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {PRESETS.map((p) => <button key={p} disabled={phase !== "idle"} onClick={() => setDuration(p)} aria-pressed={minutes === p} className={cn("chip px-3 py-1 text-sm disabled:opacity-50", minutes === p && "!border-accent !text-fg")}>{p} {t("min")}</button>)}
                <label className="chip px-3 py-1 text-sm">{t("Custom")} <input type="number" min={1} max={240} disabled={phase !== "idle"} value={minutes} onChange={(e) => setDuration(Number(e.target.value))} className="w-14 bg-transparent text-center outline-none" aria-label={t("Custom minutes")} /> {t("min")}</label>
              </div>
            )}
          </div>
          {timer}
        </Card>
        <div className="space-y-[var(--gap)]">
          <Card>
            <Field label={t("Focus on a task (optional)")}>
              <select className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={phase !== "idle"} aria-label={t("Task")}>
                <option value="">{t("No task — general focus")}</option>
                {data?.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </Field>
            {task && <div className="mt-3 flex items-center gap-2 text-sm"><PriorityBadge p={task.priority} /><span className="truncate text-muted">{task.title}</span></div>}
            {data && data.tasks.length === 0 && <p className="mt-2 text-xs text-faint">{t("No pending tasks. Create one to link sessions to it.")}</p>}
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Ambient sound")}</h2><Badge>{t("optional")}</Badge></div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setSound("none"); setAudioOn(false); }} aria-pressed={sound === "none"} className={cn("rounded-xl border px-3 py-2 text-sm", sound === "none" ? "border-accent bg-accent/10" : "border-line")}>{t("Silent")}</button>
              {SOUNDS.map((s) => <button key={s.id} onClick={() => { setSound(s.id); setAudioOn(true); }} aria-pressed={sound === s.id} className={cn("rounded-xl border px-3 py-2 text-sm", sound === s.id ? "border-accent bg-accent/10" : "border-line hover:bg-card")}>{t(s.label)}</button>)}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button size="icon" onClick={() => setAudioOn(!audioOn)} disabled={sound === "none"} aria-label={audioOn ? t("Pause sound") : t("Play sound")}>{audioOn && sound !== "none" ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
              {volume === 0 ? <VolumeX className="size-4 text-muted" /> : <Volume2 className="size-4 text-muted" />}
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label={t("Volume")} />
            </div>
            <p className="mt-2 text-xs text-faint">{t("Sounds are synthesised in your browser. Never autoplays; your choice is remembered.")}</p>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Focus background")}</h2>{(backgroundImage || backgroundScene !== "none") && <Badge tone="green">{t("Ready")}</Badge>}</div>
            <p className="mb-3 text-xs text-faint">{t("Choose one of five looping video wallpapers. Your selection is saved to your account.")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WALLPAPERS.map((wallpaper) => <button key={wallpaper.id} type="button" onClick={() => void selectWallpaper(wallpaper.id)} aria-pressed={backgroundScene === wallpaper.id} className={cn("group overflow-hidden rounded-xl border text-start transition", backgroundScene === wallpaper.id ? "border-accent ring-1 ring-accent/40" : "border-line hover:border-[var(--border-strong)]")}>
                <div className={`focus-wallpaper-preview focus-wallpaper-${wallpaper.id}`} />
                <span className="block px-2.5 py-2 text-xs font-medium">{t(wallpaper.label)}</span>
              </button>)}
              <button type="button" onClick={() => void selectWallpaper("none")} aria-pressed={backgroundScene === "none"} className={cn("flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-xl border text-xs", backgroundScene === "none" ? "border-accent ring-1 ring-accent/40" : "border-line hover:border-[var(--border-strong)]")}><span className="text-lg">◌</span>{t("No wallpaper")}</button>
            </div>
            {backgroundImage && <p className="mt-3 text-[11px] text-faint">{t("Your uploaded image currently appears above the selected live wallpaper.")}</p>}
            <div className="my-3 border-t border-line" />
            <label className="glass-btn btn-secondary flex h-10 cursor-pointer items-center justify-center gap-2 text-sm">
              <ImagePlus className="size-4" /> {t("Upload background image")}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFocusBackground(file); e.currentTarget.value = ""; }} />
            </label>
            <p className="mt-2 text-xs text-faint">{t("Images are compressed to 450 KB or less and saved privately to your account.")}</p>
            <p className="mt-2 text-xs text-muted">{t("Tap")} <a className="text-accent underline" href="https://share.google/XH6X3uwEOF0VNJKzi" target="_blank" rel="noreferrer">{t("here")}</a> {t("to reduce image quality before uploading.")}</p>
            {imageMessage && <p role="status" className="mt-2 text-xs text-muted">{imageMessage}</p>}
            {backgroundImage && <button type="button" onClick={removeFocusBackground} className="mt-2 flex items-center gap-1.5 text-xs text-muted hover:text-fg"><Trash2 className="size-3.5" /> {t("Remove background")}</button>}
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-medium text-muted">{t("Your focus")}</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Today", minutesLabel(data?.todayMinutes ?? 0)], ["This week", minutesLabel(data?.weekMinutes ?? 0)], ["Sessions", String(data?.totalSessions ?? 0)]].map(([l, v]) => <div key={l} className="rounded-xl bg-card p-3"><p className="text-lg font-semibold tabular-nums">{v}</p><p className="text-[11px] text-faint">{t(l)}</p></div>)}
            </div>
          </Card>
        </div>
      </div>
      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">{t("Session history")}</h2>
      {!data?.sessions.length ? <EmptyState icon={<Play className="size-5" />} title={t("No sessions yet")} text={t("Finish your first session and it will be recorded here.")} /> : (
        <Card pad={false}><ul className="divide-y divide-[var(--border)]">{data.sessions.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="min-w-0"><span className="block truncate">{s.taskTitle ?? t(MODES.find((m) => m.value === s.mode)?.label ?? s.mode)}</span><span className="text-xs text-faint">{new Date(s.startedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></span><span className="flex items-center gap-2"><Badge tone={s.status === "completed" ? "green" : undefined}>{t(t(s.status === "completed" ? "Completed" : "Ended early"))}</Badge><span className="tabular-nums text-muted">{Math.round(s.actualSeconds / 60)}m</span></span></li>)}</ul></Card>
      )}
      </div>
    </>
  );
}
