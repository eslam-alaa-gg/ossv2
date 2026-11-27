"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Music2, Search, SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { useApp } from "@/components/providers";
import { api } from "@/lib/client";

type Video = { id: string; title: string; channel: string; thumbnail: string; publishedAt: string };
type YTPlayerStateEvent = { data: number; target: YTPlayer };
type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};
type YTApi = {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    width?: string;
    height?: string;
    playerVars?: Record<string, number>;
    events?: {
      onReady?: (event: { target: YTPlayer }) => void;
      onStateChange?: (event: YTPlayerStateEvent) => void;
      onError?: () => void;
    };
  }) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;
function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube player is unavailable."));
  if (window.YT?.Player) return Promise.resolve();
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        resolve();
      };
      let script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
      if (!script) {
        script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("error", () => {
        youtubeApiPromise = null;
        reject(new Error("Could not load the official YouTube player."));
      }, { once: true });
    });
  }
  return youtubeApiPromise;
}

const isVideo = (value: unknown): value is Video => {
  if (!value || typeof value !== "object") return false;
  const video = value as Partial<Video>;
  return typeof video.id === "string" && /^[A-Za-z0-9_-]{11}$/.test(video.id)
    && typeof video.title === "string" && video.title.length <= 500
    && typeof video.channel === "string" && typeof video.publishedAt === "string"
    && typeof video.thumbnail === "string" && /^https:\/\/(?:i\.ytimg\.com|lh3\.googleusercontent\.com|yt3\.ggpht\.com)\//.test(video.thumbnail);
};

export function YouTubeMusicPlayer({ compact = false, searchOpen = true, onCloseSearch, onTrackChange, spotifyPlaying = false }: { compact?: boolean; searchOpen?: boolean; onCloseSearch?: () => void; onTrackChange?: (video: Video | null) => void; spotifyPlaying?: boolean }) {
  const { lang } = useApp();
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const searchRequest = useRef(0);
  const playerMount = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const resultsRef = useRef(results);
  const selectedRef = useRef(selected);
  useEffect(() => {
    resultsRef.current = results;
    selectedRef.current = selected;
  }, [results, selected]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ukiyo.youtube.player");
      if (saved) {
        const value = JSON.parse(saved) as { selected?: Video | null; results?: Video[] };
        if (Array.isArray(value.results)) setResults(value.results.filter(isVideo).slice(0, 12));
        if (isVideo(value.selected)) setSelected(value.selected);
      }
    } catch { /* Ignore unavailable or invalid local playback state. */ }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) onTrackChange?.(selected); }, [hydrated, selected, onTrackChange]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("ukiyo.youtube.player", JSON.stringify({ selected, results })); } catch { /* Playback still works without persistence. */ }
  }, [hydrated, selected, results]);

  useEffect(() => {
    if (!selected) {
      player.current?.destroy();
      player.current = null;
      setPlayerReady(false);
      setPlaying(false);
      return;
    }
    let cancelled = false;
    setPlayerReady(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    loadYouTubeIframeApi().then(() => {
      if (cancelled || !playerMount.current || !window.YT?.Player) return;
      player.current?.destroy();
      player.current = new window.YT.Player(playerMount.current, {
        videoId: selected.id,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 0, enablejsapi: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            setPlayerReady(true);
            setDuration(event.target.getDuration() || 0);
            event.target.playVideo();
          },
          onStateChange: (event) => {
            if (cancelled) return;
            setPlaying(event.data === 1);
            if (event.data === 0) {
              const queue = resultsRef.current;
              const current = selectedRef.current;
              const index = current ? queue.findIndex((item) => item.id === current.id) : -1;
              const next = index >= 0 ? queue[index + 1] : null;
              if (next) setSelected(next);
            }
          },
          onError: () => {
            if (!cancelled) setError(ar ? "تعذر تشغيل هذا الفيديو داخل الموقع. جرّب نتيجة أخرى." : "This video cannot play here. Try another result.");
          },
        },
      });
    }).catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : (ar ? "تعذر تحميل مشغل YouTube." : "Could not load the YouTube player."));
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [selected?.id, ar]);

  useEffect(() => {
    if (!playing || !playerReady || !player.current) return;
    const timer = window.setInterval(() => {
      if (!player.current) return;
      setCurrentTime(player.current.getCurrentTime() || 0);
      setDuration(player.current.getDuration() || 0);
    }, 500);
    return () => window.clearInterval(timer);
  }, [playing, playerReady, selected?.id]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    const requestId = ++searchRequest.current;
    setLoading(true); setError("");
    try {
      const data = await api<{ results: Video[] }>(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      if (requestId !== searchRequest.current) return;
      const safeResults = Array.isArray(data.results) ? data.results.filter(isVideo).slice(0, 12) : [];
      setResults(safeResults);
      if (!safeResults.length) setError(ar ? "لم نعثر على نتائج موسيقية قابلة للتشغيل." : "No playable music results found.");
    } catch (e) {
      if (requestId !== searchRequest.current) return;
      setError(e instanceof Error ? e.message : (ar ? "تعذر البحث الآن." : "Search is unavailable right now."));
    } finally { if (requestId === searchRequest.current) setLoading(false); }
  };
  const choose = (video: Video) => { if (isVideo(video)) { setError(""); setSelected(video); } };
  const move = (direction: -1 | 1) => {
    if (!selected || !results.length) return;
    const index = results.findIndex((item) => item.id === selected.id);
    const next = results[index + direction];
    if (next) { setError(""); setSelected(next); }
  };
  const seek = (value: number) => {
    if (!playerReady || !player.current || !Number.isFinite(value)) return;
    player.current.seekTo(Math.max(0, Math.min(duration, value)), true);
    setCurrentTime(value);
  };
  const formatTime = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  const togglePlayback = () => {
    if (!playerReady || !player.current) return;
    if (playing) player.current.pauseVideo();
    else player.current.playVideo();
  };

  return (
    <section className={compact ? "w-full max-w-3xl space-y-3" : "mx-auto w-full max-w-3xl space-y-4"}>
      {searchOpen && <div className="fixed right-3 top-16 z-[100] w-[min(92vw,420px)] rounded-[1.6rem] border border-white/15 bg-[#0b111c]/90 p-3 text-white shadow-2xl backdrop-blur-3xl sm:right-5 sm:top-20 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-white/10"><Music2 className="size-4" /></span><div className="min-w-0"><h3 className="text-sm font-semibold">YouTube Music</h3><p className="text-[11px] text-white/45">{ar ? "نتائج من بحث YouTube Music" : "Results from YouTube Music search"}</p></div></div>{onCloseSearch && <button type="button" onClick={onCloseSearch} aria-label={ar ? "إغلاق البحث" : "Close search"} className="grid size-8 place-items-center rounded-lg text-white/55 hover:bg-white/10"><span className="text-xl leading-none">×</span></button>}</div>
        <form onSubmit={search} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 p-1.5"><Search className="ms-2 size-4 shrink-0 text-white/45" /><input className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-white/35" value={query} onChange={e => setQuery(e.target.value)} maxLength={120} minLength={2} placeholder={ar ? "ابحث عن أغنية أو فنان..." : "Search songs or artists..."} aria-label="Search YouTube Music" /><button type="submit" disabled={loading || query.trim().length < 2} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40">{loading ? "…" : ar ? "بحث" : "Search"}</button></form>
        {error && <p role="status" className="mt-2 text-xs text-amber-300">{error}</p>}
        {results.length > 0 && <div className="mt-3 max-h-56 divide-y divide-white/[.07] overflow-y-auto">{results.map((video, index) => <button key={video.id} type="button" onClick={() => choose(video)} aria-pressed={selected?.id === video.id} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition hover:bg-white/[.07] ${selected?.id === video.id ? "bg-white/[.09]" : ""}`}><span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-white/35">{index + 1}</span><img src={video.thumbnail} alt="" className="size-11 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-white/90">{video.title}</span><span className="mt-1 block truncate text-[11px] text-white/45">{video.channel}</span></span>{selected?.id === video.id && <span className="text-xs text-white/65">♪</span>}</button>)}</div>}
        {!results.length && !loading && !error && <p className="py-5 text-center text-xs text-white/40">{ar ? "اكتب اسم أغنية أو فنان لعرض النتائج." : "Search for a song or artist to see results."}</p>}
      </div>}
      {selected && <div className="w-full rounded-[1.6rem] border border-white/15 bg-white/[.075] p-3 text-white shadow-[0_18px_60px_rgba(0,0,0,.3)] backdrop-blur-3xl sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><img src={selected.thumbnail} alt="" className="size-14 shrink-0 rounded-xl object-cover shadow-lg" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{selected.title}</p><p className="mt-1 truncate text-xs text-white/50">{selected.channel}</p><p className="mt-1 text-[10px] text-white/35">{playing ? (ar ? "يعمل الآن" : "Now playing") : (ar ? "متوقف مؤقتًا" : "Paused")}</p></div></div><div className="flex shrink-0 items-center justify-center gap-2"><button type="button" onClick={() => move(-1)} disabled={results.findIndex(item => item.id === selected.id) <= 0} aria-label={ar ? "السابق" : "Previous"} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.07] transition hover:bg-white/15 disabled:opacity-30"><SkipBack className="size-4" /></button><button type="button" onClick={togglePlayback} disabled={!playerReady} aria-label={playing ? "Pause" : "Play"} className="grid size-11 place-items-center rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-105 disabled:opacity-40">{playing ? <Pause className="size-5" /> : <Play className="size-5" />}</button><button type="button" onClick={() => move(1)} disabled={results.findIndex(item => item.id === selected.id) < 0 || results.findIndex(item => item.id === selected.id) >= results.length - 1} aria-label={ar ? "التالي" : "Next"} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[.07] transition hover:bg-white/15 disabled:opacity-30"><SkipForward className="size-4" /></button></div></div>
        <div className="mt-3 flex items-center gap-2 text-[10px] tabular-nums text-white/40"><span>{formatTime(currentTime)}</span><input type="range" min={0} max={Math.max(1,duration)} step={1} value={Math.min(currentTime,duration || 0)} onChange={e => seek(Number(e.target.value))} aria-label={ar ? "تقدم الأغنية" : "Track progress"} className="min-w-0 flex-1 accent-white" /><span>{formatTime(duration)}</span></div>
        <div className="mt-3 flex justify-center"><div className="h-[200px] w-[200px] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-xl"><div ref={playerMount} className="h-full w-full" aria-label={ar ? "مشغل YouTube الرسمي" : "Official YouTube player"} /></div></div>
      </div>}
      {spotifyPlaying && <p className="text-[10px] text-amber-300">{ar ? "Spotify يعمل أيضًا؛ أوقفه يدويًا لتجنب تشغيل مصدرين معًا." : "Spotify is also playing; pause it manually to avoid overlapping audio."}</p>}
    </section>
  );
}
