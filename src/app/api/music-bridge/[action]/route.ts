import { randomBytes } from "crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { musicBridgeDevices } from "@/db/schema";
import { ApiError, body, handle } from "@/lib/server/api";
import { assertNotDemo, rateLimit, requireUser, sha256 } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const trackInput = z.object({
  title: z.string().max(300).default(""),
  artist: z.string().max(500).default(""),
  album: z.string().max(300).default(""),
  artwork: z.string().max(600_000).nullable().optional(),
  url: z.string().url().max(2000).nullable().optional(),
  appName: z.string().max(100).default("Spotify"),
  isPlaying: z.boolean().default(false),
  positionMs: z.number().int().min(0).max(86_400_000).default(0),
  durationMs: z.number().int().min(0).max(86_400_000).default(0),
}).superRefine((v, ctx) => {
  if (!v.artwork) return;
  const isImageData = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.artwork);
  let isHttps = false;
  try { isHttps = new URL(v.artwork).protocol === "https:"; } catch { /* not a URL */ }
  if (!isImageData && !isHttps) ctx.addIssue({ code: "custom", path: ["artwork"], message: "Artwork must be an HTTPS URL or an image data URL." });
});

async function getDeviceToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(auth);
  if (!match) throw new ApiError(401, "Device token is missing or invalid.", "device_auth");
  const tokenHash = sha256(match[1]);
  const [device] = await db.select().from(musicBridgeDevices).where(eq(musicBridgeDevices.tokenHash, tokenHash)).limit(1);
  if (!device) throw new ApiError(401, "This device is not paired. Pair it again from OSSv2.", "device_revoked");
  rateLimit(`music-bridge:${device.id}`, 30, 60_000);
  return device;
}

export const GET = handle<{ action: string }>(async (_req, { action }) => {
  const a = await requireUser();
  if (action === "now-playing") {
    const [device] = await db.select().from(musicBridgeDevices)
      .where(and(eq(musicBridgeDevices.userId, a.id), gt(musicBridgeDevices.updatedAt, new Date(Date.now() - 25_000))))
      .orderBy(desc(musicBridgeDevices.updatedAt)).limit(1);
    if (!device || !device.trackTitle) return { idle: true, source: "device-bridge", fetchedAt: Date.now() };
    return {
      idle: false,
      playing: device.isPlaying,
      track: {
        title: device.trackTitle,
        artist: device.artist ?? "",
        album: device.album ?? "",
        artwork: device.artwork,
        url: device.trackUrl,
        appName: device.appName,
      },
      progressMs: device.positionMs,
      durationMs: device.durationMs,
      device: { id: device.id, name: device.deviceName, platform: device.platform },
      fetchedAt: device.updatedAt.getTime(),
      source: "device-bridge",
    };
  }
  if (action === "devices") {
    const devices = await db.select({
      id: musicBridgeDevices.id,
      platform: musicBridgeDevices.platform,
      deviceName: musicBridgeDevices.deviceName,
      updatedAt: musicBridgeDevices.updatedAt,
    }).from(musicBridgeDevices).where(eq(musicBridgeDevices.userId, a.id)).orderBy(desc(musicBridgeDevices.updatedAt));
    return { devices };
  }
  throw new ApiError(404, "Not found.");
});

export const POST = handle<{ action: string }>(async (req, { action }) => {
  if (action === "push") {
    const device = await getDeviceToken(req);
    const data = await body(req, trackInput);
    await db.update(musicBridgeDevices).set({
      trackTitle: data.title || null,
      artist: data.artist || null,
      album: data.album || null,
      artwork: data.artwork ?? null,
      trackUrl: data.url ?? null,
      appName: data.appName,
      isPlaying: data.isPlaying,
      positionMs: data.positionMs,
      durationMs: data.durationMs,
      updatedAt: new Date(),
    }).where(eq(musicBridgeDevices.id, device.id));
    return { ok: true };
  }

  const a = await requireUser();
  assertNotDemo(a, "Music device bridge");
  if (action === "pair") {
    const data = await body(req, z.object({
      platform: z.enum(["android", "windows"]),
      deviceName: z.string().trim().min(1).max(100),
    }));
    const token = randomBytes(36).toString("base64url");
    const [device] = await db.insert(musicBridgeDevices).values({
      userId: a.id,
      tokenHash: sha256(token),
      platform: data.platform,
      deviceName: data.deviceName,
    }).returning({ id: musicBridgeDevices.id, platform: musicBridgeDevices.platform, deviceName: musicBridgeDevices.deviceName });
    return { device, token };
  }
  if (action === "revoke") {
    const data = await body(req, z.object({ deviceId: z.string().uuid() }));
    await db.delete(musicBridgeDevices).where(and(eq(musicBridgeDevices.id, data.deviceId), eq(musicBridgeDevices.userId, a.id)));
    return { ok: true };
  }
  throw new ApiError(404, "Not found.");
});
