"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Music2, Search, SkipBack, SkipForward, ExternalLink } from "lucide-react";
import { useApp } from "@/components/providers";
import { api } from "@/lib/client";

type Video = { id: string; title: string; channel: string; thumbnail: string; publishedAt: string };

export function YouTubeMusicPlayer({ compact = false, onTrackChange, spotifyPlaying = false }: { compact?: boolean; onTrackChange?: (video: Video | null) => void; spotifyPlaying?: boolean }) {
  const { lang } = useApp();
  const ar = lang === "ar";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ukiyo.youtube.player");
      if (saved) {
        const value = JSON.parse(saved) as { selected?: Video | null; results?: Video[] };
        if (Array.isArray(value.results)) setResults(value.results.filter((item) => item && typeof item.id === "string" && typeof item.title === "string"));
        if (value.selected && typeof value.selected.id === "string" && typeof value.selected.title === "string") setSelected(value.selected);
      }
    } catch { /* Ignore unavailable or invalid local playback state. */ }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) onTrackChange?.(selected); }, [hydrated, selected, onTrackChange]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("ukiyo.youtube.player", JSON.stringify({ selected, results })); } catch { /* Playback still works without persistence. */ }
  }, [hydrated, selected, results]);
  const search = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true); setError("");
    try {
      const data = await api<{ results: Video[] }>(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      setResults(data.results);
      if (!data.results.length) setError(ar ? "لم نعثر على نتائج قابلة للتشغيل." : "No playable results found.");
    } catch (e) {
      setError(e instanceof Error ? e.message : (ar ? "تعذر البحث الآن." : "Search is unavailable right now."));
    } finally { setLoading(false); }
  };
  const choose = (video: Video) => setSelected(video);
  const move = (direction: -1 | 1) => {
    if (!selected || !results.length) return;
    const index = results.findIndex((item) => item.id === selected.id);
    const next = results[index + direction];
    if (next) setSelected(next);
  };
  return (
    <section className={compact ? "w-full space-y-3" : "mx-auto w-full max-w-3xl space-y-4"}>
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-card text-accent"><Music2 className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{ar ? "YouTube Music" : "YouTube Music"}</h3>
          <p className="text-xs text-muted">{ar ? "ابحث واختر وشغّل من داخل Ukiyo" : "Search, choose and play from inside Ukiyo"}</p>
        </div>
      </div>
      <form onSubmit={search} className="flex gap-2">
        <input className="input min-w-0 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} minLength={2} placeholder={ar ? "ابحث عن أغنية أو فنان..." : "Search songs or artists..."} aria-label="Search YouTube" />
        <button type="submit" disabled={loading || query.trim().length < 2} className="glass-btn btn-primary shrink-0" aria-label={ar ? "بحث" : "Search"}><Search className="size-4" />{loading ? (ar ? "..." : "Searching") : (ar ? "بحث" : "Search")}</button>
      </form>
      {error && <p role="status" className="text-xs text-amber-400">{error}</p>}
      {selected && <div className="space-y-2 rounded-xl border border-line bg-card/70 p-3">
        <div className="flex items-center gap-3">
          <img src={selected.thumbnail} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{selected.title}</p><p className="truncate text-xs text-muted">{selected.channel}</p></div>
          <a href={`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noreferrer noopener" className="text-muted hover:text-fg" aria-label={ar ? "فتح على YouTube" : "Open on YouTube"}><ExternalLink className="size-4" /></a>
        </div>
        <div className="overflow-hidden rounded-xl bg-black">
          <iframe key={selected.id} title={selected.title} src={`https://www.youtube.com/embed/${selected.id}?autoplay=0&controls=1&enablejsapi=1&playsinline=1&rel=0&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`} className="aspect-video min-h-[200px] w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        </div>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => move(-1)} disabled={results.findIndex((item) => item.id === selected.id) <= 0} className="glass-btn btn-secondary" aria-label={ar ? "السابق" : "Previous"}><SkipBack className="size-4" />{ar ? "السابق" : "Previous"}</button>
          <span className="text-[11px] text-muted">{ar ? "استخدم أدوات المشغل للتحكم في التشغيل والصوت والتقديم" : "Use the player controls for playback, volume and seeking"}</span>
          <button type="button" onClick={() => move(1)} disabled={results.findIndex((item) => item.id === selected.id) < 0 || results.findIndex((item) => item.id === selected.id) >= results.length - 1} className="glass-btn btn-secondary" aria-label={ar ? "التالي" : "Next"}>{ar ? "التالي" : "Next"}<SkipForward className="size-4" /></button>
        </div>
      </div>}
      {results.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
        {results.map((video) => <button key={video.id} type="button" onClick={() => choose(video)} aria-pressed={selected?.id === video.id} className={`flex min-w-0 items-center gap-3 rounded-xl border p-2 text-start transition ${selected?.id === video.id ? "border-accent bg-accent/10" : "border-line bg-card hover:border-[var(--border-strong)]"}`}>
          <img src={video.thumbnail} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
          <span className="min-w-0"><span className="block line-clamp-2 text-xs font-medium">{video.title}</span><span className="mt-1 block truncate text-[10px] text-muted">{video.channel}</span></span>
        </button>)}
      </div>}
      {spotifyPlaying && <p className="text-[10px] text-amber-400">{ar ? "Spotify يعمل أيضًا؛ أوقفه يدويًا لتجنب تشغيل مصدرين معًا." : "Spotify is also playing; pause it manually to avoid overlapping audio."}</p>}
      <p className="text-[10px] leading-relaxed text-faint">{ar ? "يتم تشغيل نتائج YouTube القابلة للتضمين عبر مشغل YouTube الرسمي. قد لا تكون بعض الأغاني متاحة للتشغيل داخل الموقع." : "Playable, embeddable YouTube results use the official YouTube player. Some tracks may not be available for in-site playback."}</p>
    </section>
  );
}
