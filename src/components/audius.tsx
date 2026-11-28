"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Music2, Search, SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, X } from "lucide-react";
import { useApp } from "@/components/providers";
import { api } from "@/lib/client";

type AudiusTrack = { id: string; title: string; artist: string; artwork: string | null; duration: number };

function isAudiusTrack(value: unknown): value is AudiusTrack {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<AudiusTrack>;
  return typeof track.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(track.id)
    && typeof track.title === "string" && track.title.length <= 500
    && typeof track.artist === "string" && track.artist.length <= 300
    && (track.artwork === null || (typeof track.artwork === "string" && /^https:\/\//.test(track.artwork)))
    && typeof track.duration === "number" && Number.isFinite(track.duration) && track.duration >= 0;
}

export function AudiusPlayer({ compact = false, searchOpen = true, mixerOpen = false, onCloseSearch, onCloseMixer }: {
  compact?: boolean; searchOpen?: boolean; mixerOpen?: boolean; onCloseSearch?: () => void; onCloseMixer?: () => void;
}) {
  const { lang } = useApp();
  const ar = lang === "ar";
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef(0);
  const playRequest = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AudiusTrack[]>([]);
  const [selected, setSelected] = useState<AudiusTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.volume = volume / 100;
    audio.current.muted = muted;
  }, [volume, muted]);

  useEffect(() => () => {
    request.current += 1;
    playRequest.current += 1;
    if (audio.current) { audio.current.pause(); audio.current.removeAttribute("src"); audio.current.load(); }
  }, []);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++request.current;
    setLoading(true); setError("");
    try {
      const data = await api<{ results: AudiusTrack[] }>("/api/audius/search?q=" + encodeURIComponent(q));
      if (id !== request.current) return;
      const safe = Array.isArray(data.results) ? data.results.filter(isAudiusTrack).slice(0, 15) : [];
      setResults(safe);
      if (!safe.length) setError(ar ? "لم نعثر على نتائج. جرّب اسم أغنية أو فنان آخر." : "No results found. Try another song or artist.");
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : (ar ? "تعذر البحث في Audius الآن." : "Audius search is unavailable."));
    } finally { if (id === request.current) setLoading(false); }
  };

  const choose = async (track: AudiusTrack) => {
    if (!isAudiusTrack(track) || !audio.current) return;
    const playId = ++playRequest.current;
    setLoadingTrack(track.id); setError(""); setPlaying(false);
    try {
      // The authenticated same-origin route resolves Audius' distributed CDN redirect.
      // The browser then streams directly from the returned HTTPS CDN URL.
      const streamUrl = "/api/audius/stream?id=" + encodeURIComponent(track.id);
      if (playId !== playRequest.current || !audio.current) return;
      audio.current.src = streamUrl; audio.current.load();
      setSelected(track); setCurrentTime(0); setDuration(track.duration || 0);
      await audio.current.play();
      if (playId === playRequest.current) setPlaying(true);
    } catch (e) {
      if (playId === playRequest.current) setError(e instanceof Error ? e.message : (ar ? "تعذر تشغيل هذه الأغنية." : "This track could not be played."));
    } finally {
      if (playId === playRequest.current) setLoadingTrack(null);
    }
  };

  const move = (direction: -1 | 1) => {
    if (!selected || !results.length) return;
    const index = results.findIndex((item) => item.id === selected.id);
    const next = results[index + direction];
    if (next) void choose(next);
  };
  const togglePlayback = async () => {
    if (!audio.current || !selected) return;
    if (audio.current.paused) {
      try { await audio.current.play(); setPlaying(true); }
      catch { setError(ar ? "تعذر استئناف التشغيل. اختر الأغنية مرة أخرى." : "Playback could not resume. Select the track again."); }
    } else { audio.current.pause(); setPlaying(false); }
  };
  const changeVolume = (value: number) => { const next = Math.max(0, Math.min(100, value)); setVolume(next); setMuted(next === 0); };
  const formatTime = (value: number) => { const safe = Math.max(0, Math.floor(value || 0)); return Math.floor(safe / 60) + ":" + String(safe % 60).padStart(2, "0"); };
  const seek = (value: number) => {
    if (!audio.current || !Number.isFinite(value)) return;
    audio.current.currentTime = Math.max(0, Math.min(duration || value, value));
    setCurrentTime(audio.current.currentTime);
  };

  return (
    <section className={compact ? "relative w-full max-w-3xl space-y-3" : "relative mx-auto w-full max-w-3xl space-y-4"}>
      <audio ref={audio} preload="none"
        onTimeUpdate={() => { if (audio.current) setCurrentTime(audio.current.currentTime || 0); }}
        onLoadedMetadata={() => { if (audio.current) setDuration(audio.current.duration || selected?.duration || 0); }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); move(1); }}
        onError={() => { if (selected) setError(ar ? "تعذر تحميل البث الصوتي من Audius." : "Audius audio stream could not be loaded."); }}
      />
      {mixerOpen && <div role="dialog" aria-label={ar ? "خلاط الصوت" : "Music mixer"} className="fixed right-3 top-16 z-[100] w-[min(92vw,320px)] rounded-2xl border border-white/15 bg-[#0b111c]/95 p-4 text-white shadow-2xl backdrop-blur-3xl sm:right-5 sm:top-20">
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="size-4" />{ar ? "مستوى صوت الموسيقى" : "Music volume"}</div>{onCloseMixer && <button type="button" onClick={onCloseMixer} aria-label={ar ? "إغلاق" : "Close"} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10"><X className="size-4" /></button>}</div>
        <div className="flex items-center gap-3"><button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? (ar ? "إلغاء كتم الصوت" : "Unmute") : (ar ? "كتم الصوت" : "Mute")} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10">{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button><input type="range" min={0} max={100} value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} aria-label={ar ? "مستوى صوت الموسيقى" : "Music volume"} className="min-w-0 flex-1 accent-white" /><span className="w-9 text-end text-xs tabular-nums text-white/55">{muted ? 0 : volume}%</span></div>
      </div>}
      {searchOpen && <div className="absolute right-0 top-0 z-[100] max-h-[min(70dvh,520px)] w-[min(92vw,420px)] rounded-[1.6rem] border border-white/15 bg-[#0b111c]/90 p-3 text-white shadow-2xl backdrop-blur-3xl sm:right-5 sm:top-20 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-white/10"><Music2 className="size-4" /></span><div className="min-w-0"><h3 className="text-sm font-semibold">Audius</h3><p className="text-[11px] text-white/45">{ar ? "ابحث في مكتبة Audius الموسيقية" : "Search the Audius music catalog"}</p></div></div>{onCloseSearch && <button type="button" onClick={onCloseSearch} aria-label={ar ? "إغلاق البحث" : "Close search"} className="grid size-8 place-items-center rounded-lg text-white/55 hover:bg-white/10"><X className="size-4" /></button>}</div>
        <form onSubmit={search} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 p-1.5"><Search className="ms-2 size-4 shrink-0 text-white/45" /><input className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-white/35" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} minLength={2} placeholder={ar ? "ابحث عن أغنية أو فنان..." : "Search songs or artists..."} aria-label={ar ? "البحث في Audius" : "Search Audius"} /><button type="submit" disabled={loading || query.trim().length < 2} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40">{loading ? "…" : ar ? "بحث" : "Search"}</button></form>
        {error && <p role="status" className="mt-2 text-xs text-amber-300">{error}</p>}
        {results.length > 0 && <div className="mt-3 max-h-56 divide-y divide-white/[.07] overflow-y-auto">{results.map((track) => <button key={track.id} type="button" onClick={() => void choose(track)} disabled={loadingTrack === track.id} aria-pressed={selected?.id === track.id} className={"flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition hover:bg-white/[.07] " + (selected?.id === track.id ? "bg-white/[.09]" : "")}>{track.artwork ? <img src={track.artwork} alt="" className="size-11 shrink-0 rounded-lg object-cover" /> : <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/10"><Music2 className="size-4" /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-white/90">{track.title}</span><span className="mt-1 block truncate text-[11px] text-white/45">{track.artist}</span></span><span className="text-[10px] text-white/45">{loadingTrack === track.id ? "…" : formatTime(track.duration)}</span></button>)}</div>}
        {!results.length && !loading && !error && <p className="py-5 text-center text-xs text-white/40">{ar ? "اكتب اسم أغنية أو فنان لعرض النتائج." : "Search for a song or artist to see results."}</p>}
      </div>}
      {selected ? <div className="w-full rounded-[1.6rem] border border-white/15 bg-white/[.075] p-3 text-white shadow-[0_18px_60px_rgba(0,0,0,.3)] backdrop-blur-3xl sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3">{selected.artwork ? <img src={selected.artwork} alt="" className="size-14 shrink-0 rounded-xl object-cover shadow-lg" /> : <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/10"><Music2 /></span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{selected.title}</p><p className="mt-1 truncate text-xs text-white/50">{selected.artist}</p><p className="mt-1 text-[10px] text-white/35">{playing ? (ar ? "يعمل الآن" : "Now playing") : (ar ? "متوقف مؤقتًا" : "Paused")}</p></div></div><div className="flex shrink-0 items-center justify-center gap-2"><button type="button" onClick={() => move(-1)} disabled={results.findIndex((item) => item.id === selected.id) <= 0} aria-label={ar ? "السابق" : "Previous"} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.07] transition hover:bg-white/15 disabled:opacity-30"><SkipBack className="size-4" /></button><button type="button" onClick={() => void togglePlayback()} disabled={!!loadingTrack} aria-label={playing ? (ar ? "إيقاف مؤقت" : "Pause") : (ar ? "تشغيل" : "Play")} className="grid size-11 place-items-center rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-105 disabled:opacity-40">{playing ? <Pause className="size-5" /> : <Play className="size-5" />}</button><button type="button" onClick={() => move(1)} disabled={results.findIndex((item) => item.id === selected.id) < 0 || results.findIndex((item) => item.id === selected.id) >= results.length - 1} aria-label={ar ? "التالي" : "Next"} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.07] transition hover:bg-white/15 disabled:opacity-30"><SkipForward className="size-4" /></button></div></div>
        <div className="mt-3 flex items-center gap-2 text-[10px] tabular-nums text-white/40"><span>{formatTime(currentTime)}</span><input type="range" min={0} max={Math.max(1, duration)} step={1} value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label={ar ? "تقدم الأغنية" : "Track progress"} className="min-w-0 flex-1 accent-white" /><span>{formatTime(duration)}</span></div>
        <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[10px] text-white/40">{ar ? "الصوت عبر Audius" : "Audio via Audius"}</span><span className="text-[10px] text-white/40">{muted ? (ar ? "صامت" : "Muted") : volume + "%"}</span></div>
      </div> : !searchOpen && <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-3 text-white/65"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10"><Music2 className="size-5" /></span><p className="text-xs">{ar ? "اضغط على البحث لاختيار أغنية من Audius." : "Open search to choose a track from Audius."}</p></div>}
      {error && !searchOpen && <p role="status" className="text-xs text-amber-300">{error}</p>}
    </section>
  );
}
