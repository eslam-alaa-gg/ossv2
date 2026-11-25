"use client";
/* eslint-disable @next/next/no-img-element */
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Music2, Pause, Play } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiErr } from "@/lib/client";
import { useApp } from "./providers";
import { Button, Card, Progress, Skeleton } from "./ui";

export type NPTrack = {
  id: string;
  title: string;
  artists: { id: string | null; name: string }[];
  album: { id: string | null; name: string; releaseDate: string | null; totalTracks: number | null; image: string | null; url: string | null };
  durationMs: number;
  url: string | null;
  type: "track" | "episode";
};
export type NowPlaying = { idle: true; device: { id: string; name: string; type: string } | null; fetchedAt: number } | { idle: false; playing: boolean; track: NPTrack; progressMs: number; shuffle: boolean; repeat: string; device: { id: string; name: string; type: string; volume?: number; active?: boolean } | null; disallows: Record<string, boolean>; fetchedAt: number };
export type SpStatus = { configured: boolean; connected: boolean; redirectUri: string; profile: { displayName: string; product: string; imageUrl: string | null; spotifyUserId: string } | null; scopes: string[]; demo: boolean };

type Ctx = { status: SpStatus | null; np: NowPlaying | null; error: string | null; errorCode: string | null; refresh: () => Promise<void>; loadingStatus: boolean; reloadStatus: () => Promise<void>; setBoost: (b: boolean) => void };
const SpCtx = createContext<Ctx | null>(null);
export const useSpotify = () => useContext(SpCtx)!;

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const { prefs } = useApp();
  const [status, setStatus] = useState<SpStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [np, setNp] = useState<NowPlaying | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const boost = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connected = !!status?.connected;

  const reloadStatus = useCallback(async () => {
    try {
      setStatus(await api<SpStatus>("/api/spotify/status"));
    } catch {
      /* ignore */
    } finally {
      setLoadingStatus(false);
    }
  }, []);
  useEffect(() => {
    reloadStatus();
  }, [reloadStatus]);

  const refresh = useCallback(async () => {
    try {
      const d = await api<NowPlaying>("/api/spotify/now-playing");
      setNp(d);
      setError(null);
      setErrorCode(null);
      return;
    } catch (e) {
      const ae = e as ApiErr;
      setError(ae.message);
      setErrorCode(ae.code ?? null);
      if (ae.code === "expired" || ae.code === "not_connected") {
        setNp(null);
        reloadStatus();
      }
      throw e;
    }
  }, [reloadStatus]);

  useEffect(() => {
    if (!connected) return;
    let stop = false;
    const loop = async () => {
      if (stop) return;
      let wait = boost.current ? 4000 : 8000;
      if (document.visibilityState === "visible" && prefs.spotify.autoRefresh) {
        try {
          await refresh();
        } catch (e) {
          const code = (e as ApiErr).code;
          if (code === "expired" || code === "not_connected") return;
          wait = code === "rate_limited" ? 20000 : 15000;
        }
      }
      timer.current = setTimeout(loop, wait);
    };
    loop();
    const vis = () => document.visibilityState === "visible" && refresh().catch(() => {});
    document.addEventListener("visibilitychange", vis);
    return () => {
      stop = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [connected, refresh, prefs.spotify.autoRefresh]);

  const setBoost = useCallback((b: boolean) => {
    boost.current = b;
  }, []);
  const value = useMemo(() => ({ status, np, error, errorCode, refresh, loadingStatus, reloadStatus, setBoost }), [status, np, error, errorCode, refresh, loadingStatus, reloadStatus, setBoost]);
  return (
    <SpCtx.Provider value={value}>
      <AlbumGlow />
      {children}
    </SpCtx.Provider>
  );
}

/* ---------- dominant colour extraction (client-side canvas, via same-origin art proxy) ---------- */
const colorCache = new Map<string, [string, string]>();
export async function extractColors(url: string): Promise<[string, string]> {
  if (colorCache.has(url)) return colorCache.get(url)!;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `/api/spotify/art?url=${encodeURIComponent(url)}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 32, 32);
  const px = ctx.getImageData(0, 0, 32, 32).data;
  const buckets = new Map<number, { r: number; g: number; b: number; n: number; w: number }>();
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    if (mx < 40 || (mx > 245 && sat < 0.1)) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, w: 0 };
    e.r += r; e.g += g; e.b += b; e.n++; e.w += 0.4 + sat;
    buckets.set(key, e);
  }
  const list = [...buckets.values()].map((e) => ({ rgb: [e.r / e.n, e.g / e.n, e.b / e.n], w: e.w })).sort((a, b) => b.w - a.w);
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const first = list[0]?.rgb ?? [109, 93, 252];
  const second = list.find((x) => dist(x.rgb, first) > 70)?.rgb ?? first;
  const hex = (c: number[]) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const out: [string, string] = [hex(first), hex(second)];
  colorCache.set(url, out);
  return out;
}

function AlbumGlow() {
  const { prefs, theme } = useApp();
  const { np } = useSpotify() ?? { np: null };
  const [cols, setCols] = useState<[string, string] | null>(null);
  const img = np && !np.idle ? np.track.album.image : null;
  useEffect(() => {
    if (!img || !prefs.spotify.ambience) {
      setCols(null);
      return;
    }
    let dead = false;
    extractColors(img).then((c) => !dead && setCols(c)).catch(() => !dead && setCols(null));
    return () => {
      dead = true;
    };
  }, [img, prefs.spotify.ambience]);
  if (!prefs.spotify.ambience || theme.reducedMotion && !cols) return null;
  return <div className="album-glow" aria-hidden style={{ ["--amb1" as string]: cols?.[0] ?? "rgba(0,0,0,0)", ["--amb2" as string]: cols?.[1] ?? "rgba(0,0,0,0)", opacity: cols ? undefined : 0 }} />;
}

export const fmtMs = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Smoothly interpolated playback position between polls. */
export function useProgress(np: NowPlaying | null) {
  const [now, setNow] = useState(() => Date.now());
  const playing = !!np && !np.idle && np.playing;
  useEffect(() => {
    if (!playing) return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [playing]);
  if (!np || np.idle) return 0;
  const base = np.progressMs + (np.playing ? Math.max(0, now - np.fetchedAt) : 0);
  return Math.min(base, np.track.durationMs);
}

/** Dashboard widget */
export function NowPlayingWidget() {
  const { t: tr } = useApp();
  const { status, np, error, errorCode, loadingStatus, refresh } = useSpotify();
  const progress = useProgress(np);
  if (loadingStatus) return <Skeleton className="h-[148px]" />;
  if (!status?.configured || !status.connected) {
    return (
      <Card className="flex items-center gap-4">
        <div className="grid size-14 place-items-center rounded-2xl bg-card text-accent"><Music2 className="size-6" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{tr("Spotify Now Playing")}</p>
          <p className="text-sm text-muted">{status?.configured ? tr("Connect Spotify to see what you're listening to.") : tr("Spotify isn't configured on this server yet.")}</p>
        </div>
        <Link href="/music" className="glass-btn btn-sm">{status?.configured ? tr("Connect") : tr("Details")}</Link>
      </Card>
    );
  }
  const t = np && !np.idle ? np.track : null;
  return (
    <Card className="relative overflow-hidden">
      {error && errorCode !== "rate_limited" && <p className="mb-2 text-xs text-amber-400" role="status">{error} <button className="underline" onClick={() => refresh().catch(() => {})}>{tr("Retry")}</button></p>}
      <div className="flex items-center gap-4">
        <AnimatePresence mode="wait">
          <motion.div key={t?.id ?? "none"} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="size-20 shrink-0 overflow-hidden rounded-2xl bg-card shadow-lg">
            {t?.album.image ? <img src={t.album.image} alt={`${t.album.name} cover`} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted"><Music2 /></div>}
          </motion.div>
        </AnimatePresence>
        <div className="min-w-0 flex-1">
          {t && np && !np.idle ? (
            <>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className={`size-1.5 rounded-full ${np.playing ? "bg-emerald-400" : "bg-amber-400"}`} />
                {np.playing ? tr("Playing") : tr("Paused")} {np.device ? `· ${np.device.name}` : ""}
              </div>
              <p className="truncate text-base font-semibold">{t.title}</p>
              <p className="truncate text-sm text-muted">{t.artists.map((a) => a.name).join(", ")} · {t.album.name}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] tabular-nums text-faint">
                <span>{fmtMs(progress)}</span>
                <Progress value={(progress / t.durationMs) * 100} className="h-1 flex-1" />
                <span>-{fmtMs(t.durationMs - progress)}</span>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium">{tr("Nothing playing")}</p>
              <p className="text-sm text-muted">{tr("Start playback in Spotify and it will show up here.")}</p>
            </>
          )}
        </div>
        <Link href="/music" className="glass-btn btn-icon" aria-label={tr("Open Music Hub")}>{np && !np.idle && np.playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Link>
      </div>
    </Card>
  );
}

export function OpenInSpotify({ url, label = "Open in Spotify" }: { url?: string | null; label?: string }) {
  return (
    <a href={url ?? "https://open.spotify.com"} target="_blank" rel="noreferrer noopener" className="glass-btn">
      <ExternalLink className="size-4" /> {label}
    </a>
  );
}
export { Button };
