"use client";
import { ImagePlus, Maximize2, Minimize2, Pause, Play, RotateCcw, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { PriorityBadge, type Task } from "@/components/task-form";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Segmented, cn, useUI } from "@/components/ui";
import { api, minutesLabel, useFetch } from "@/lib/client";
import { SOUNDS, startAmbient, type AmbientHandle } from "@/lib/ambient";

type Session = { id: string; mode: string; plannedSeconds: number; actualSeconds: number; status: string; startedAt: string; taskTitle?: string | null };
type FocusData = { todayMinutes: number; weekMinutes: number; totalSessions: number; sessions: Session[]; running: (Session & { serverNow: number }) | null; tasks: { id: string; title: string; priority: Task["priority"] }[]; prefs: { sound: string; volume: number; preset: number } };
type Mode = "focus" | "short_break" | "long_break" | "custom";
const MODES: { value: Mode; label: string; min: number }[] = [{ value: "focus", label: "Standard Focus", min: 25 }, { value: "short_break", label: "Short Break", min: 5 }, { value: "long_break", label: "Long Break", min: 15 }, { value: "custom", label: "Custom Session", min: 30 }];
const PRESETS = [15, 25, 45, 60];
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
  const [imageMessage, setImageMessage] = useState("");
  const endAt = useRef(0);
  const amb = useRef<AmbientHandle | null>(null);
  const finishing = useRef(false);
  const restored = useRef(false);

  useEffect(() => { try { setBackgroundImage(localStorage.getItem("ukiyo.focus.background")); } catch { /* storage may be unavailable */ } }, []);

  // restore a session that is still running on the server (e.g. after reload)
  useEffect(() => {
    if (!data?.running || restored.current || phase !== "idle") return;
    restored.current = true;
    const r = data.running;
    const left = Math.max(0, r.plannedSeconds - Math.floor((Date.now() - new Date(r.startedAt).getTime()) / 1000));
    setSid(r.id); setPlanned(r.plannedSeconds); setMode(r.mode as Mode); setMinutes(Math.round(r.plannedSeconds / 60)); setRemaining(left); endAt.current = Date.now() + left * 1000; setPhase("running");
  }, [data, phase]);

  const complete = useCallback(async (id: string) => {
    if (finishing.current) return;
    finishing.current = true;
    const r = await run(() => api<{ xp: number; unlocked: string[] }>(`/api/focus/${id}`, { body: { action: "complete" } }));
    if (r) { toast("success", r.xp ? ` ${t("Focus session complete")} · +${r.xp} XP` : t("Session complete")); r.unlocked.forEach((u) => toast("success", `🏆 ${t(u)}`)); }
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
      let width = Math.min(img.naturalWidth, 1920);
      let height = Math.round(img.naturalHeight * (width / img.naturalWidth));
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
        if (result && result.size <= 400 * 1024) break;
        if (quality > 0.5) quality -= 0.08;
        else { width *= 0.82; height *= 0.82; quality = 0.82; }
      }
      if (!result || result.size > 400 * 1024) throw new Error("The image could not be reduced below 400 KB. Try a smaller image.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the optimised image."));
        reader.onerror = () => reject(new Error("Could not read the optimised image."));
        reader.readAsDataURL(result!);
      });
      localStorage.setItem("ukiyo.focus.background", dataUrl);
      setBackgroundImage(dataUrl);
      setImageMessage(t("Background image saved. It appears in full-screen focus."));
    } catch (e) {
      setImageMessage(e instanceof Error ? e.message : t("Image upload failed."));
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  function removeFocusBackground() {
    try { localStorage.removeItem("ukiyo.focus.background"); } catch { /* storage may be unavailable */ }
    setBackgroundImage(null);
    setImageMessage(t("Background image removed."));
  }

  async function start() {
    const r = await run(() => api<{ session: Session }>("/api/focus", { body: { mode, minutes, taskId: taskId || null } }));
    if (!r) return;
    finishing.current = false; setSid(r.session.id); setPlanned(minutes * 60); setRemaining(minutes * 60); endAt.current = Date.now() + minutes * 60000; setPhase("running");
  }
  const pause = () => { setRemaining(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))); setPhase("paused"); };
  const resume = () => { endAt.current = Date.now() + remaining * 1000; setPhase("running"); };
  async function end(reset = false) {
    if (sid) await run(() => api(`/api/focus/${sid}`, { body: { action: "end", activeSeconds: Math.max(0, planned - remaining) } }), reset ? undefined : t("Session ended — time so far was recorded"));
    setPhase("idle"); setSid(null); setRemaining(minutes * 60); setPlanned(minutes * 60); reload();
  }
  async function toggleZen() {
    if (!zen) { setZen(true); try { await document.documentElement.requestFullscreen?.(); } catch { /* fullscreen optional */ } }
    else { setZen(false); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }
  }

  const pct = planned ? ((planned - remaining) / planned) * 100 : 0;
  const R = 150, C = 2 * Math.PI * R;
  const task = data?.tasks.find((t) => t.id === taskId);
  const timer = (
    <div className="flex flex-col items-center">
      <div className="relative grid place-items-center" style={{ width: "min(78vw, 360px)", aspectRatio: "1" }}>
        <svg viewBox="0 0 340 340" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="170" cy="170" r={R} fill="none" stroke="var(--input)" strokeWidth="8" />
          <circle cx="170" cy="170" r={R} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .5s linear", filter: "drop-shadow(0 0 10px rgba(var(--accent-rgb),.5))" }} />
        </svg>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-faint">{MODES.find((m) => m.value === mode)?.label && t(MODES.find((m) => m.value === mode)!.label)}</p>
          <p role="timer" aria-live="off" className="my-1 text-[clamp(3.2rem,14vw,5.5rem)] font-light tabular-nums leading-none tracking-tight">{mmss(remaining)}</p>
          <p className="mx-auto max-w-[14rem] truncate text-sm text-muted">{task ? task.title : phase === "idle" ? t("Ready when you are") : t("Stay with it")}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        {phase === "idle" && <Button variant="primary" className="h-12 px-8 text-base" onClick={start}><Play className="size-5" /> {t("Start")}</Button>}
        {phase === "running" && <Button className="h-12 px-6" onClick={pause}><Pause className="size-5" /> {t("Pause")}</Button>}
        {phase === "paused" && <Button variant="primary" className="h-12 px-6" onClick={resume}><Play className="size-5" /> {t("Resume")}</Button>}
        {phase !== "idle" && <Button className="h-12" onClick={() => end(false)}><Square className="size-4" /> {t("End")}</Button>}
        {phase !== "idle" && <Button variant="ghost" className="h-12" onClick={() => end(true)} aria-label={t("Reset")}><RotateCcw className="size-4" /> {t("Reset")}</Button>}
        <Button variant="ghost" size="icon" className="h-12 w-12" onClick={toggleZen} aria-label={zen ? t("Exit fullscreen focus") : t("Fullscreen focus mode")}>{zen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}</Button>
      </div>
      {phase !== "idle" && <p className="mt-3 text-xs text-faint">{t("Rewards are only granted when the full duration has elapsed on the server.")}</p>}
    </div>
  );

  if (zen) return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto p-3 sm:p-6">
      {backgroundImage && <div className="absolute inset-0 scale-105 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImage})`, filter: "blur(14px)" }} />}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      {!backgroundImage && <div className="app-glow" />}
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-5">
        <div className="flex w-full flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
          <Segmented value={mode} onChange={pickMode} label={t("Focus mode")} options={MODES.map((m) => ({ value: m.value, label: t(m.label) }))} />
          {(mode === "focus" || mode === "custom") && PRESETS.map((p) => <button key={p} type="button" disabled={phase !== "idle"} onClick={() => setDuration(p)} aria-pressed={minutes === p} className={cn("chip px-3 py-1 text-sm", minutes === p && "!border-accent !text-fg", "disabled:opacity-40")}>{p} {t("min")}</button>)}
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
    </div>
  );

  return (
    <>
      <PageHeader title={t("Focus Room")} subtitle={t("Deep work, one session at a time.")} />
      <div className="grid gap-[var(--gap)] lg:grid-cols-[1fr_340px]">
        <Card className="flex flex-col items-center py-8">
          <div className="mb-6 flex w-full flex-col items-center gap-3">
            <Segmented value={mode} onChange={pickMode} label={t("Focus mode")} options={MODES.map((m) => ({ value: m.value, label: t(m.label) }))} />
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
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Focus background")}</h2>{backgroundImage && <Badge tone="green">{t("Ready")}</Badge>}</div>
            <label className="glass-btn btn-secondary flex h-10 cursor-pointer items-center justify-center gap-2 text-sm">
              <ImagePlus className="size-4" /> {t("Upload background image")}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFocusBackground(file); e.currentTarget.value = ""; }} />
            </label>
            <p className="mt-2 text-xs text-faint">{t("Images are automatically compressed to a maximum of 400 KB and blurred in full-screen focus.")}</p>
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
    </>
  );
}
