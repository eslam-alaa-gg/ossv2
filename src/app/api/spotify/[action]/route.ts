import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { spotifyConnections } from "@/db/schema";
import { ApiError, body, handle } from "@/lib/server/api";
import { assertNotDemo, getSessionUser, requireUser } from "@/lib/server/auth";
import {
  SPOTIFY_SCOPES, appOrigin, getConnection, redirectUri, saveConnection, spotify, spotifyConfigured, tokenRequest,
} from "@/lib/server/spotify";

export const dynamic = "force-dynamic";
const COOKIE = "lifeos_spotify_pkce";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Img = { url: string; width?: number }[];
const pickImg = (imgs?: Img) => (imgs && imgs.length ? [...imgs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url : null);
const mapTrack = (item: any) => {
  if (!item) return null;
  const ep = item.type === "episode";
  return {
    id: item.id as string,
    title: item.name as string,
    artists: (ep ? [{ id: null, name: item.show?.name ?? "Podcast" }] : item.artists ?? []).map((x: any) => ({ id: x.id ?? null, name: x.name })),
    album: { id: ep ? null : item.album?.id ?? null, name: ep ? item.show?.name ?? "" : item.album?.name ?? "", releaseDate: item.album?.release_date ?? item.release_date ?? null, totalTracks: item.album?.total_tracks ?? null, image: pickImg(ep ? item.images : item.album?.images), url: item.album?.external_urls?.spotify ?? null },
    durationMs: item.duration_ms as number,
    url: (item.external_urls?.spotify as string) ?? null,
    type: ep ? "episode" : "track",
  };
};

const cache = new Map<string, { at: number; data: unknown }>();

async function handleGet(req: NextRequest, action: string) {
  if (action === "callback") return callback(req);
  if (action === "connect") return connect();
  const a = await requireUser();
  if (action === "status") {
    const c = await getConnection(a.id);
    return {
      configured: spotifyConfigured(),
      connected: !!c,
      redirectUri: await redirectUri(),
      profile: c ? { displayName: c.displayName, product: c.product, imageUrl: c.imageUrl, spotifyUserId: c.spotifyUserId } : null,
      scopes: SPOTIFY_SCOPES,
      demo: a.user.isDemo,
    };
  }
  if (action === "now-playing") {
    const hit = cache.get(a.id);
    if (hit && Date.now() - hit.at < 2500) return hit.data;
    const r = await spotify<any>(a.id, "/me/player?additional_types=episode");
    const p = r.data;
    const data = !p || !p.item ? { idle: true, device: p?.device ? { id: p.device.id, name: p.device.name, type: p.device.type } : null, fetchedAt: Date.now() } : {
      idle: false,
      playing: !!p.is_playing,
      track: mapTrack(p.item),
      progressMs: p.progress_ms ?? 0,
      shuffle: !!p.shuffle_state,
      repeat: p.repeat_state ?? "off",
      device: p.device ? { id: p.device.id, name: p.device.name, type: p.device.type, volume: p.device.volume_percent, active: p.device.is_active } : null,
      disallows: p.actions?.disallows ?? {},
      fetchedAt: Date.now(),
    };
    cache.set(a.id, { at: Date.now(), data });
    return data;
  }
  if (action === "recent") {
    const r = await spotify<any>(a.id, "/me/player/recently-played?limit=12");
    return { items: (r.data?.items ?? []).map((i: any) => ({ playedAt: i.played_at, track: mapTrack(i.track) })) };
  }
  if (action === "devices") {
    const r = await spotify<any>(a.id, "/me/player/devices");
    return { devices: (r.data?.devices ?? []).map((d: any) => ({ id: d.id, name: d.name, type: d.type, active: d.is_active, restricted: d.is_restricted, volume: d.volume_percent })) };
  }
  if (action === "artist") {
    const id = (req.nextUrl.searchParams.get("id") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 30);
    if (!id) throw new ApiError(400, "Missing artist id.");
    const r = await spotify<any>(a.id, `/artists/${id}`);
    const d = r.data;
    return { id, name: d?.name, genres: d?.genres ?? [], followers: d?.followers?.total ?? null, image: pickImg(d?.images), url: d?.external_urls?.spotify ?? null };
  }
  if (action === "art") {
    const u = new URL(req.nextUrl.searchParams.get("url") ?? "");
    if (u.protocol !== "https:" || !(u.hostname.endsWith(".scdn.co") || u.hostname.endsWith(".spotifycdn.com"))) throw new ApiError(400, "Unsupported image host.");
    const res = await fetch(u, { cache: "force-cache" });
    const buf = await res.arrayBuffer();
    if (!res.ok || buf.byteLength > 3_000_000) throw new ApiError(502, "Couldn't load artwork.");
    return new Response(buf, { headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" } });
  }
  throw new ApiError(404, "Not found.");
}

async function connect() {
  const origin = await appOrigin();
  const user = await getSessionUser();
  if (!user) return Response.redirect(`${origin}/login`, 302);
  if (user.isDemo) return Response.redirect(`${origin}/music?error=demo`, 302);
  if (!spotifyConfigured()) return Response.redirect(`${origin}/music?error=not_configured`, 302);
  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(24).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(COOKIE, JSON.stringify({ state, verifier, uid: user.id }), { httpOnly: true, sameSite: "lax", secure, path: "/api/spotify", maxAge: 600 });
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: await redirectUri(),
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
    show_dialog: "false",
  }).toString();
  return Response.redirect(url.toString(), 302);
}

async function callback(req: NextRequest) {
  const origin = await appOrigin();
  const back = (q: string) => Response.redirect(`${origin}/music?${q}`, 302);
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);
  const user = await getSessionUser();
  if (!user) return Response.redirect(`${origin}/login`, 302);
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back(`error=${encodeURIComponent(sp.get("error")!)}`);
  let saved: { state: string; verifier: string; uid: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  const state = sp.get("state") ?? "";
  const code = sp.get("code");
  const okState = !!saved && state.length === saved.state.length && timingSafeEqual(Buffer.from(state), Buffer.from(saved.state));
  if (!saved || !okState || saved.uid !== user.id || !code) return back("error=invalid_state");
  const r = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: await redirectUri(), code_verifier: saved.verifier });
  if (!r.ok) return back("error=token_exchange_failed");
  await saveConnection(user.id, r.data);
  // fetch profile once
  try {
    const me = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${r.data.access_token}` }, cache: "no-store" });
    if (me.ok) {
      const p = (await me.json()) as any;
      await db.update(spotifyConnections).set({ spotifyUserId: p.id ?? "", displayName: p.display_name ?? p.id ?? "", product: p.product ?? "", imageUrl: pickImg(p.images) }).where(eq(spotifyConnections.userId, user.id));
    }
  } catch {
    /* profile is optional */
  }
  return back("connected=1");
}

export const GET = handle<{ action: string }>(async (req, { action }) => handleGet(req, action));

export const POST = handle<{ action: string }>(async (req, { action }) => {
  const a = await requireUser();
  if (action === "disconnect") {
    await db.delete(spotifyConnections).where(eq(spotifyConnections.userId, a.id));
    cache.delete(a.id);
    return { ok: true };
  }
  if (action === "control") {
    assertNotDemo(a, "Spotify playback control");
    const d = await body(req, z.object({ action: z.enum(["play", "pause", "next", "previous", "seek", "transfer"]), positionMs: z.number().int().min(0).max(36000000).optional(), deviceId: z.string().max(100).optional() }));
    const q = d.deviceId && d.action !== "transfer" ? `?device_id=${encodeURIComponent(d.deviceId)}` : "";
    if (d.action === "play") await spotify(a.id, `/me/player/play${q}`, { method: "PUT" });
    else if (d.action === "pause") await spotify(a.id, `/me/player/pause${q}`, { method: "PUT" });
    else if (d.action === "next") await spotify(a.id, `/me/player/next${q}`, { method: "POST" });
    else if (d.action === "previous") await spotify(a.id, `/me/player/previous${q}`, { method: "POST" });
    else if (d.action === "seek") await spotify(a.id, `/me/player/seek?position_ms=${d.positionMs ?? 0}`, { method: "PUT" });
    else {
      if (!d.deviceId) throw new ApiError(400, "Choose a device.");
      await spotify(a.id, "/me/player", { method: "PUT", body: { device_ids: [d.deviceId], play: true } });
    }
    cache.delete(a.id);
    return { ok: true };
  }
  throw new ApiError(404, "Not found.");
});
