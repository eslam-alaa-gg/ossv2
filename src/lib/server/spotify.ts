import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { spotifyConnections } from "@/db/schema";
import { ApiError } from "./api";

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
  "user-read-recently-played",
  "user-read-private",
] as const;

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

type TokenResult = { ok: true; data: SpotifyTokenResponse; status: number } | { ok: false; data: Record<string, unknown>; status: number };

export function spotifyConfigured() {
  return !!process.env.SPOTIFY_CLIENT_ID && !!process.env.APP_SECRET && process.env.APP_SECRET.length >= 32;
}

export async function appOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  if (!host) throw new ApiError(500, "Unable to determine the application URL.");
  return `${proto}://${host}`;
}

export async function redirectUri() {
  return process.env.SPOTIFY_REDIRECT_URI || `${await appOrigin()}/api/spotify/callback`;
}

function encryptionKey() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, "APP_SECRET must be configured with at least 32 characters before connecting Spotify.");
  return createHash("sha256").update("LIFE-OS-SPOTIFY-TOKEN-ENCRYPTION-v1:").update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decrypt(value: string) {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported encrypted Spotify token format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export async function tokenRequest(params: Record<string, string>): Promise<TokenResult> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) return { ok: false, data: { error: "not_configured" }, status: 503 };
  const form = new URLSearchParams({ ...params, client_id: clientId });
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  return response.ok
    ? { ok: true, data: data as SpotifyTokenResponse, status: response.status }
    : { ok: false, data, status: response.status };
}

export async function saveConnection(userId: string, tokens: SpotifyTokenResponse) {
  if (!tokens.access_token || !Number.isFinite(tokens.expires_in)) throw new ApiError(502, "Spotify returned an invalid token response.");
  const existing = (await db.select().from(spotifyConnections).where(eq(spotifyConnections.userId, userId)).limit(1))[0];
  const refreshToken = tokens.refresh_token || (existing ? decrypt(existing.refreshTokenEnc) : "");
  if (!refreshToken) throw new ApiError(502, "Spotify did not provide a refresh token. Please disconnect and connect again.");
  const values = {
    userId,
    accessTokenEnc: encrypt(tokens.access_token),
    refreshTokenEnc: encrypt(refreshToken),
    expiresAt: new Date(Date.now() + Math.max(60, tokens.expires_in) * 1000),
    scope: tokens.scope || existing?.scope || SPOTIFY_SCOPES.join(" "),
    spotifyUserId: existing?.spotifyUserId || "",
    displayName: existing?.displayName || "",
    product: existing?.product || "",
    imageUrl: existing?.imageUrl || null,
    updatedAt: new Date(),
  };
  await db.insert(spotifyConnections).values(values).onConflictDoUpdate({
    target: spotifyConnections.userId,
    set: {
      accessTokenEnc: values.accessTokenEnc,
      refreshTokenEnc: values.refreshTokenEnc,
      expiresAt: values.expiresAt,
      scope: values.scope,
      updatedAt: values.updatedAt,
    },
  });
}

export async function getConnection(userId: string) {
  const [initial] = await db.select().from(spotifyConnections).where(eq(spotifyConnections.userId, userId)).limit(1);
  if (!initial) return null;

  try {
    const initialAccessToken = decrypt(initial.accessTokenEnc);
    const initialRefreshToken = decrypt(initial.refreshTokenEnc);
    if (initial.expiresAt.getTime() > Date.now() + 60_000) {
      return { ...initial, accessToken: initialAccessToken, refreshToken: initialRefreshToken };
    }

    // Refresh-token rotation must be serialized across server instances. Re-read the row
    // only after acquiring the per-user transaction lock so a waiting request uses the
    // newly refreshed token instead of replaying a stale refresh token.
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`spotify-refresh:${userId}`}))`);
      const [current] = await tx.select().from(spotifyConnections)
        .where(eq(spotifyConnections.userId, userId)).limit(1).for("update");
      if (!current) return null;

      const accessToken = decrypt(current.accessTokenEnc);
      const refreshToken = decrypt(current.refreshTokenEnc);
      if (current.expiresAt.getTime() > Date.now() + 60_000) {
        return { ...current, accessToken, refreshToken };
      }

      let refreshed: TokenResult;
      try {
        refreshed = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
      } catch {
        throw new ApiError(502, "Spotify token refresh is temporarily unavailable. Please retry.");
      }
      if (!refreshed.ok) {
        if (refreshed.status === 400 || refreshed.status === 401) {
          await tx.delete(spotifyConnections).where(eq(spotifyConnections.userId, userId));
          return null;
        }
        throw new ApiError(502, "Spotify token refresh failed. Please try again.");
      }
      if (!refreshed.data.access_token || !Number.isFinite(refreshed.data.expires_in)) {
        throw new ApiError(502, "Spotify returned an invalid refreshed token. Please retry.");
      }

      const nextRefreshToken = refreshed.data.refresh_token || refreshToken;
      const expiresAt = new Date(Date.now() + Math.max(60, refreshed.data.expires_in) * 1000);
      await tx.update(spotifyConnections).set({
        accessTokenEnc: encrypt(refreshed.data.access_token),
        refreshTokenEnc: encrypt(nextRefreshToken),
        expiresAt,
        scope: refreshed.data.scope || current.scope,
        updatedAt: new Date(),
      }).where(eq(spotifyConnections.userId, userId));

      return {
        ...current,
        accessToken: refreshed.data.access_token,
        refreshToken: nextRefreshToken,
        expiresAt,
        scope: refreshed.data.scope || current.scope,
      };
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("[spotify] stored token could not be decrypted");
    await db.delete(spotifyConnections).where(eq(spotifyConnections.userId, userId));
    return null;
  }
}

export async function spotify<T = unknown>(userId: string, path: string, options: { method?: string; body?: unknown } = {}) {
  const connection = await getConnection(userId);
  if (!connection) throw new ApiError(401, "Your Spotify connection is missing or expired. Please reconnect.", "expired");
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: "no-store",
  });
  if (response.status === 204) return { data: null as T, status: response.status };
  const data = await response.json().catch(() => null) as T | null;
  if (response.status === 429) throw new ApiError(429, "Spotify is rate limiting requests. Please wait and try again.", "rate_limited");
  if (response.status === 401) {
    await db.delete(spotifyConnections).where(eq(spotifyConnections.userId, userId));
    throw new ApiError(401, "Your Spotify connection expired. Please connect again.", "expired");
  }
  if (!response.ok) {
    const detail = data && typeof data === "object" && "error" in data ? (data as { error?: { message?: string } }).error?.message : undefined;
    throw new ApiError(response.status >= 500 ? 502 : response.status, detail || "Spotify request failed.");
  }
  return { data: data as T, status: response.status };
}
