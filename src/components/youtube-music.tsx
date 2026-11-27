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
    && typeof video.thumbnail === "string" && /^https:\/\/i\.ytimg\.com\//.test(video.thumbnail);
};

export function YouTubeMusicPlayer({ compact = false, onTrackChange, spotifyPlaying = false }: { compact?: boolean; onTrackChange?: (video: Video | null) => void; spotifyPlaying?: boolean }) {
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
  const searchRequest = useRef(0);
  const playerMount = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const resultsRef = useRef(results);
  const selectedRef = useRef(selected);
  resultsRef.current = results;
  selectedRef.current = selected;

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
    loadYouTubeIframeApi().then(() => {
      if (cancelled || !playerMount.current || !window.YT?.Player) return;
      player.current?.destroy();
      player.current = new window.YT.Player(playerMount.current, {
        videoId: selected.id,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 1, enablejsapi: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            setPlayerReady(true);
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
  const togglePlayback = () => {
    if (!playerReady || !player.current) return;
    if (playing) player.current.pauseVideo();
    else player.current.playVideo();
  };

  return (
    <section className={compact ? "w-full space-y-3" : "mx-auto w-full max-w-3xl space-y-4"}>
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-card text-accent"><Music2 className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">YouTube Music</h3>
          <p className="text-xs text-muted">{ar ? "ابحث واختر وشغّل من داخل Ukiyo" : "Search, choose and play from inside Ukiyo"}</p>
        </div>
        {selected && <span className="rounded-full bg-card px-2 py-1 text-[10px] text-muted">{playing ? (ar ? "يعمل الآن" : "Playing") : (ar ? "متوقف" : "Paused")}</span>}
      </div>
      <form onSubmit={search} className="flex gap-2">
        <input className="input min-w-0 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} minLength={2} placeholder={ar ? "ابحث عن أغنية أو فنان..." : "Search songs or artists..."} aria-label="Search YouTube Music" />
        <button type="submit" disabled={loading || query.trim().length < 2} className="glass-btn btn-primary shrink-0" aria-label={ar ? "بحث" : "Search"}><Search className="size-4" />{loading ? (ar ? "..." : "Searching") : (ar ? "بحث" : "Search")}</button>
      </form>
      {error && <p role="status" className="text-xs text-amber-400">{error}</p>}
      {selected && <div className="space-y-2 rounded-xl border border-line bg-card/70 p-3">
        <div className="flex items-center gap-3">
          <img src={selected.thumbnail} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{selected.title}</p><p className="truncate text-xs text-muted">{selected.channel}</p></div>
        </div>
        <div className="overflow-hidden rounded-xl bg-black">
          <div ref={playerMount} className="aspect-video min-h-[200px] w-full" aria-label={ar ? "مشغل YouTube" : "YouTube player"} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => move(-1)} disabled={results.findIndex((item) => item.id === selected.id) <= 0} className="glass-btn btn-secondary" aria-label={ar ? "السابق" : "Previous"}><SkipBack className="size-4" />{ar ? "السابق" : "Previous"}</button>
          <button type="button" onClick={togglePlayback} disabled={!playerReady} className="glass-btn btn-primary" aria-label={playing ? (ar ? "إيقاف مؤقت" : "Pause") : (ar ? "تشغيل" : "Play")}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}{playing ? (ar ? "إيقاف" : "Pause") : (ar ? "تشغيل" : "Play")}</button>
          <button type="button" onClick={() => move(1)} disabled={results.findIndex((item) => item.id === selected.id) < 0 || results.findIndex((item) => item.id === selected.id) >= results.length - 1} className="glass-btn btn-secondary" aria-label={ar ? "التالي" : "Next"}>{ar ? "التالي" : "Next"}<SkipForward className="size-4" /></button>
        </div>
      </div>}
      {results.length > 0 && <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted">{ar ? "قائمة النتائج" : "Search results"} · {results.length}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {results.map((video) => <button key={video.id} type="button" onClick={() => choose(video)} aria-pressed={selected?.id === video.id} className={`flex min-w-0 items-center gap-3 rounded-xl border p-2 text-start transition ${selected?.id === video.id ? "border-accent bg-accent/10" : "border-line bg-card hover:border-[var(--border-strong)]"}`}>
            <img src={video.thumbnail} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0"><span className="block line-clamp-2 text-xs font-medium">{video.title}</span><span className="mt-1 block truncate text-[10px] text-muted">{video.channel}</span></span>
            {selected?.id === video.id && <span className="shrink-0 text-accent"><Music2 className="size-4" /></span>}
          </button>)}
        </div>
      </div>}
      {!results.length && !selected && !loading && <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">{ar ? "ابحث عن أغنية أو فنان لبدء الاستماع." : "Search for a song or artist to start listening."}</p>}
      {spotifyPlaying && <p className="text-[10px] text-amber-400">{ar ? "Spotify يعمل أيضًا؛ أوقفه يدويًا لتجنب تشغيل مصدرين معًا." : "Spotify is also playing; pause it manually to avoid overlapping audio."}</p>}
      <p className="text-[10px] leading-relaxed text-faint">{ar ? "يتم تشغيل نتائج YouTube الموسيقية القابلة للتضمين عبر مشغل YouTube الرسمي. قد لا تكون بعض النتائج متاحة للتشغيل داخل الموقع." : "Embeddable music-category results use the official YouTube player. Some results may not be available for in-site playback."}</p>
    </section>
  );
}
