"use client";
/* eslint-disable @next/next/no-img-element */
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Disc3, Link2Off, Monitor, Music2, Pause, Play, SkipBack, SkipForward, Smartphone, Speaker } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { OpenInSpotify, fmtMs, useProgress, useSpotify, type NPTrack } from "@/components/spotify";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Skeleton, Switch, useUI } from "@/components/ui";
import { api, useFetch } from "@/lib/client";

const ERRORS: Record<string, string> = {
  access_denied: "You declined the Spotify authorization. Nothing was connected.",
  invalid_state: "The authorization response couldn't be verified (state mismatch). Please try connecting again.",
  token_exchange_failed: "Spotify didn't accept the authorization. Check the redirect URI configured in your Spotify app.",
  not_configured: "Spotify isn't configured on this server.",
  demo: "Spotify connection is disabled in Demo Mode. Create an account to connect your own.",
};
type Device = { id: string; name: string; type: string; active: boolean; restricted: boolean; volume: number | null };
type Recent = { playedAt: string; track: NPTrack }[];

function DeviceIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  return t.includes("phone") ? <Smartphone className="size-4" /> : t.includes("speaker") ? <Speaker className="size-4" /> : <Monitor className="size-4" />;
}

function Inner() {
  const { prefs, savePrefs, t } = useApp();
  const { run, toast, confirm } = useUI();
  const sp = useSearchParams();
  const { status, np, error, errorCode, loadingStatus, refresh, reloadStatus, setBoost } = useSpotify();
  const progress = useProgress(np);
  const connected = !!status?.connected;
  const premium = status?.profile?.product === "premium";
  const track = np && !np.idle ? np.track : null;
  const recent = useFetch<{ items: Recent }>(connected ? "/api/spotify/recent" : null);
  const devices = useFetch<{ devices: Device[] }>(connected ? "/api/spotify/devices" : null);
  const artistId = track?.artists[0]?.id;
  const artist = useFetch<{ name: string; genres: string[]; followers: number | null; image: string | null; url: string | null }>(connected && artistId ? `/api/spotify/artist?id=${artistId}` : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setBoost(true); return () => setBoost(false); }, [setBoost]);
  useEffect(() => { if (sp.get("connected")) { toast("success", "Spotify connected"); reloadStatus(); } }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const urlError = sp.get("error");

  async function control(action: string, extra: object = {}) {
    setBusy(true);
    const ok = await run(() => api("/api/spotify/control", { body: { action, ...extra } }));
    setBusy(false);
    if (ok !== undefined) { setTimeout(() => refresh().catch(() => {}), 500); if (action === "transfer") devices.reload(); }
  }
  async function disconnect() {
    if (!(await confirm("Disconnect Spotify? Stored tokens will be deleted from LIFE OS.", "Disconnect"))) return;
    if (await run(() => api("/api/spotify/disconnect", { method: "POST", body: {} }), "Spotify disconnected")) reloadStatus();
  }

  if (loadingStatus) return <><PageHeader title={t("Music Hub")} /><Skeleton className="h-96" /></>;

  if (!status?.configured) {
    return (
      <>
        <PageHeader title={t("Music Hub")} subtitle={t("Your Spotify, inside LIFE OS.")} />
        <Card className="max-w-2xl space-y-4">
          <div className="flex items-center gap-3"><AlertTriangle className="size-5 text-amber-400" /><h2 className="font-semibold">{t("Spotify isn't configured on this server")}</h2></div>
          <p className="text-sm text-muted">{t("The integration is fully implemented (Authorization Code Flow with PKCE) but needs a Spotify app. The server administrator should:")}</p>
          <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted">
            <li>{t("Create an app at")} <a className="text-accent underline" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">{t("developer.spotify.com/dashboard")}</a>.</li>
            <li>Add this Redirect URI: <code className="rounded bg-[var(--input)] px-1.5 py-0.5 text-xs text-fg">{status?.redirectUri}</code> {t("(must be HTTPS, or http://127.0.0.1 for local development).")}</li>
            <li>{t("Set")} <code className="text-fg">{t("SPOTIFY_CLIENT_ID")}</code> (and optionally <code className="text-fg">{t("SPOTIFY_REDIRECT_URI")}</code>) in the server environment and restart.</li>
          </ol>
          <p className="text-xs text-faint">{t("No client secret is needed or used — PKCE keeps the flow secret-free. Tokens are encrypted at rest and never reach the browser.")}</p>
        </Card>
      </>
    );
  }

  if (!connected) {
    return (
      <>
        <PageHeader title={t("Music Hub")} subtitle={t("Your Spotify, inside LIFE OS.")} />
        {(urlError || errorCode === "expired") && <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errorCode === "expired" ? "Your Spotify authorization expired. Please reconnect." : ERRORS[urlError!] ?? `Spotify returned an error: ${urlError}`}</p>}
        <Card className="mx-auto max-w-xl py-10 text-center">
          <span className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-card text-accent"><Music2 className="size-8" /></span>
          <h2 className="text-xl font-semibold">{t("Connect Spotify")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("See what's playing, browse recently played tracks, control playback (Premium) and let album artwork tint your workspace.")}</p>
          <a href="/api/spotify/connect" className="glass-btn btn-primary mt-6 h-11 px-6"><Music2 className="size-4" /> {t("Connect Spotify")}</a>
          <div className="mx-auto mt-6 max-w-sm rounded-xl bg-card p-4 text-start text-xs text-muted"><p className="mb-1.5 font-medium text-fg">{t("Permissions requested (minimum needed)") }</p><ul className="space-y-1"><li>{t("• Read your current playback & devices")}</li><li>{t("• Read recently played tracks")}</li><li>{t("• Control playback (Premium only)")}</li><li>{t("• Read your plan type to know if controls work")}</li></ul></div>
        </Card>
      </>
    );
  }

  const pct = track ? (progress / track.durationMs) * 100 : 0;
  const ctl = "glass-btn btn-icon h-12 w-12";
  return (
    <>
      <PageHeader title={t("Music Hub")} subtitle={t("Now playing from your Spotify account.")} actions={<><Badge tone="green"><span className="size-1.5 rounded-full bg-emerald-400" /> {t("Connected")}</Badge><OpenInSpotify url={track?.url} /></>} />
      {error && errorCode !== "rate_limited" && <p role="alert" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{error} <button className="underline" onClick={() => refresh().catch(() => {})}>{t("Retry")}</button></p>}
      {errorCode === "rate_limited" && <p role="status" className="mb-4 text-xs text-amber-300">{error}</p>}

      <div className="glass overflow-hidden p-5 sm:p-8">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,380px)_1fr]">
          <AnimatePresence mode="wait">
            <motion.div key={track?.id ?? "idle"} initial={{ opacity: 0, scale: 0.92, rotate: -1 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] bg-card shadow-2xl">
              {track?.album.image ? <img src={track.album.image} alt={`${track.album.name} album cover`} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted"><Disc3 className="size-20" /></div>}
            </motion.div>
          </AnimatePresence>
          <div className="min-w-0">
            {track && np && !np.idle ? (
              <AnimatePresence mode="wait">
                <motion.div key={track.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted"><span className={`size-2 rounded-full ${np.playing ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />{np.playing ? t("Now playing") : t("Paused")}{np.device ? ` · ${np.device.name}` : ""}</p>
                  <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{track.title}</h2>
                  <p className="mt-3 text-lg text-muted">{track.artists.map((a) => a.name).join(", ")}</p>
                  <p className="text-sm text-faint">{track.album.name}</p>
                  <div className="mt-8">
                    <div role="slider" tabIndex={premium ? 0 : -1} aria-label={t("Playback position")} aria-valuemin={0} aria-valuemax={track.durationMs} aria-valuenow={Math.round(progress)} aria-valuetext={`${fmtMs(progress)} of ${fmtMs(track.durationMs)}`} onClick={(e) => { if (!premium) return; const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; control("seek", { positionMs: Math.round((document.dir === "rtl" ? 1 - x : x) * track.durationMs) }); }} className={`group h-2 rounded-full bg-[var(--input)] ${premium ? "cursor-pointer" : ""}`}><div className="progress-fill h-full rounded-full transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} /></div>
                    <div className="mt-2 flex justify-between text-xs tabular-nums text-faint"><span>{fmtMs(progress)}</span><span>-{fmtMs(track.durationMs - progress)}</span></div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div><h2 className="text-2xl font-semibold">{t("Nothing playing")}</h2><p className="mt-2 text-sm text-muted">{t("Start playing something in Spotify on any device — it will appear here within a few seconds.")}</p>{np?.idle && np.device && <p className="mt-2 text-xs text-faint">Last device: {np.device.name}</p>}</div>
            )}
            <div className="mt-6">
              {premium ? (
                <div className="flex items-center gap-3">
                  <Button className={ctl} onClick={() => control("previous")} disabled={busy || !track} aria-label={t("Previous track")}><SkipBack className="size-5" /></Button>
                  <Button variant="primary" className="glass-btn btn-icon h-14 w-14" onClick={() => control(np && !np.idle && np.playing ? "pause" : "play")} disabled={busy} aria-label={np && !np.idle && np.playing ? t("Pause") : t("Play")}>{np && !np.idle && np.playing ? <Pause className="size-6" /> : <Play className="size-6" />}</Button>
                  <Button className={ctl} onClick={() => control("next")} disabled={busy || !track} aria-label={t("Next track")}><SkipForward className="size-5" /></Button>
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-card p-4 text-sm text-muted"><p>{t("Playback controls are available with")} <b className="text-fg">{t("Spotify Premium")}</b> (a Spotify API requirement){status?.profile?.product ? ` — your plan is “${status.profile.product}”` : ""}. Use Spotify to control playback.</p><div className="mt-3"><OpenInSpotify /></div></div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-[var(--gap)] grid gap-[var(--gap)] lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 text-sm font-medium text-muted">{t("Album")}</h3>
          {track ? <div className="space-y-1 text-sm"><p className="font-medium">{track.album.name}</p>{track.album.releaseDate && <p className="text-muted">{t("Released")} {track.album.releaseDate}</p>}{track.album.totalTracks && <p className="text-muted">{track.album.totalTracks} {t("tracks")}</p>}<div className="pt-3"><OpenInSpotify url={track.album.url ?? track.url} label={t("Open album")} /></div></div> : <p className="text-sm text-muted">{t("Play something to see album details.")}</p>}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-medium text-muted">{t("Artist")}</h3>
          {track && artist.data ? <div className="flex items-start gap-3">{artist.data.image && <img src={artist.data.image} alt="" className="size-14 rounded-full object-cover" />}<div className="min-w-0 text-sm"><p className="font-medium">{artist.data.name}</p>{artist.data.genres.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{artist.data.genres.slice(0, 3).map((g) => <Badge key={g}>{g}</Badge>)}</p>}{artist.data.followers !== null && <p className="mt-1 text-muted">{artist.data.followers.toLocaleString()} followers</p>}{artist.data.url && <div className="pt-3"><OpenInSpotify url={artist.data.url} label={t("Open artist")} /></div>}</div></div> : track ? <p className="text-sm text-muted">{artist.loading ? t("Loading…") : artist.error ?? track.artists.map((a) => a.name).join(", ")}</p> : <p className="text-sm text-muted">{t("Play something to see artist details.")}</p>}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-medium text-muted">{t("Spotify profile")}</h3>
          <div className="flex items-center gap-3">{status?.profile?.imageUrl ? <img src={status.profile.imageUrl} alt="" className="size-12 rounded-full object-cover" /> : <span className="grid size-12 place-items-center rounded-full bg-card"><Music2 className="size-5" /></span>}<div className="min-w-0 text-sm"><p className="truncate font-medium">{status?.profile?.displayName || status?.profile?.spotifyUserId || t("Spotify user")}</p><p className="text-muted capitalize">{status?.profile?.product || t("plan unknown")}</p></div></div>
        </Card>
      </div>

      <div className="mt-[var(--gap)] grid gap-[var(--gap)] lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium text-muted">{t("Devices")}</h3><Button size="sm" variant="ghost" onClick={devices.reload}>{t("Refresh")}</Button></div>
          {devices.error ? <p className="text-sm text-amber-300">{devices.error}</p> : !devices.data ? <Skeleton className="h-16" /> : devices.data.devices.length === 0 ? <p className="text-sm text-muted">{t("No devices found. Open Spotify on a phone, computer or speaker.")}</p> : <ul className="space-y-2">{devices.data.devices.map((d) => <li key={d.id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-sm"><DeviceIcon type={d.type} /><span className="min-w-0 flex-1 truncate">{d.name}<span className="ms-2 text-xs text-faint">{d.type}</span></span>{d.active ? <Badge tone="green">{t("Active")}</Badge> : premium && !d.restricted ? <Button size="sm" onClick={() => control("transfer", { deviceId: d.id })}>{t("Play here")}</Button> : <Badge>{d.restricted ? t("Restricted") : t("Premium only")}</Badge>}</li>)}</ul>}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-medium text-muted">{t("Recently played")}</h3>
          {recent.error ? <p className="text-sm text-amber-300">{recent.error}</p> : !recent.data ? <Skeleton className="h-24" /> : recent.data.items.length === 0 ? <EmptyState icon={<Music2 className="size-5" />} title={t("No recent tracks")} /> : <ul className="max-h-72 space-y-1 overflow-y-auto">{recent.data.items.map((r, i) => <li key={r.playedAt + i}><a href={r.track.url ?? "#"} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-card">{r.track.album.image ? <img src={r.track.album.image} alt="" className="size-10 rounded-lg object-cover" /> : <span className="size-10 rounded-lg bg-card" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm">{r.track.title}</span><span className="block truncate text-xs text-muted">{r.track.artists.map((a) => a.name).join(", ")}</span></span></a></li>)}</ul>}
        </Card>
      </div>

      <Card className="mt-[var(--gap)]">
        <h3 className="mb-3 text-sm font-medium text-muted">{t("Preferences")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Dynamic Album Ambience")} hint={t("A very subtle glow tinted by the current album artwork.")}><Switch checked={prefs.spotify.ambience} label={t("Dynamic Album Ambience")} onChange={(v) => run(() => savePrefs({ spotify: { ...prefs.spotify, ambience: v } }))} /></Field>
          <Field label={t("Auto-refresh now playing")} hint={t("Polls Spotify only while this tab is visible.")}><Switch checked={prefs.spotify.autoRefresh} label={t("Auto refresh")} onChange={(v) => run(() => savePrefs({ spotify: { ...prefs.spotify, autoRefresh: v } }))} /></Field>
        </div>
        <div className="mt-5 border-t border-line pt-4"><Button variant="danger" onClick={disconnect}><Link2Off className="size-4" /> {t("Disconnect Spotify")}</Button></div>
      </Card>
    </>
  );
}

export default function MusicPage() {
  return <Suspense><Inner /></Suspense>;
}
