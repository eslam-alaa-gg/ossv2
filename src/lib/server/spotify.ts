import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
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

type SpotifyToken = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

type TokenResult = { ok: true; data: SpotifyToken } | { ok: false; data: { error?: string; error_description?: string } };

function encryptionKey() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new Error("APP_SECRET must be set to at least 32 characters to encrypt Spotify tokens.");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decrypt(value: string) {
  const [iv, tag, data] = value.split(".");
  if (!iv || !tag || !data) throw new Error("Stored Spotify token has an invalid format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function spotifyConfigured() {
  return !!process.env.SPOTIFY_CLIENT_ID && !!process.env.APP_SECRET;
}

export async function appOrigin() {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3000";
}

export async function redirectUri() {
  return process.env.SPOTIFY_REDIRECT_URI || `${await appOrigin()}/api/spotify/callback`;
}

export async function tokenRequest(params: Record<string, string>): Promise<TokenResult> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: process.env.SPOTIFY_CLIENT_ID ?? "" }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, data: data as SpotifyToken } : { ok: false, data: data as { error?: string; error_description?: string } };
}

export async function getConnection(userId: string) {
  const [row] = await db.select().from(spotifyConnections).where(eq(spotifyConnections.userId, userId)).limit(1);
  return row ?? null;
}

export async function saveConnection(userId: string, token: SpotifyToken) {
  const existing = await getConnection(userId);
  const refreshToken = token.refresh_token || (existing ? decrypt(existing.refreshTokenEnc) : "");
  if (!token.access_token || !refreshToken || !token.expires_in) throw new Error("Spotify returned an incomplete token response.");
  const values = {
    userId,
    accessTokenEnc: encrypt(token.access_token),
    refreshTokenEnc: encrypt(refreshToken),
    expiresAt: new Date(Date.now() + Math.max(60, token.expires_in) * 1000),
    scope: token.scope ?? existing?.scope ?? "",
    spotifyUserId: existing?.spotifyUserId ?? "",
    displayName: existing?.displayName ?? "",
    product: existing?.product ?? "",
    imageUrl: existing?.imageUrl ?? null,
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

async function refreshConnection(userId: string, current: NonNullable<Awaited<ReturnType<typeof getConnection>>>) {
  const refreshToken = decrypt(current.refreshTokenEnc);
  const result = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  if (!result.ok) {
    if (result.data.error === "invalid_grant") {
      await db.delete(spotifyConnections).where(eq(spotifyConnections.userId, userId));
      throw new ApiError(401, "Spotify authorization expired. Please reconnect your account.");
    }
    throw new ApiError(502, "Spotify token refresh failed. Please try again.");
  }
  await saveConnection(userId, { ...result.data, refresh_token: result.data.refresh_token || refreshToken });
  const next = await getConnection(userId);
  if (!next) throw new ApiError(401, "Spotify connection is no longer available.");
  return next;
}

export async function spotify<T = unknown>(userId: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<{ data: T; status: number }> {
  let connection = await getConnection(userId);
  if (!connection) throw new ApiError(404, "Connect Spotify first.");
  if (connection.expiresAt.getTime() <= Date.now() + 60_000) connection = await refreshConnection(userId, connection);

  const request = async (accessToken: string) => {
    const response = await fetch(`https://api.spotify.com/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    if (response.status === 204) return { response, data: null as T };
    const data = await response.json().catch(() => null) as T;
    return { response, data };
  };

  let accessToken = decrypt(connection.accessTokenEnc);
  let result = await request(accessToken);
  if (result.response.status === 401) {
    connection = await refreshConnection(userId, connection);
    accessToken = decrypt(connection.accessTokenEnc);
    result = await request(accessToken);
  }
  if (!result.response.ok) {
    const status = result.response.status === 429 ? 429 : result.response.status >= 500 ? 502 : 400;
    throw new ApiError(status, result.response.status === 429 ? "Spotify is rate limiting requests. Please wait and try again." : "Spotify request failed.");
  }
  return { data: result.data, status: result.response.status };
}
