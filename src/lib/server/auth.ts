import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ApiError } from "./api";
import { parsePrefs, type Prefs } from "@/lib/prefs";
import { safeTz } from "@/lib/dates";

export const SESSION_COOKIE = "lifeos_session";
export type DbUser = typeof users.$inferSelect;

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  language: string;
  timezone: string;
  dailyGoal: number;
  emailVerified: boolean;
  hasPassword: boolean;
  isDemo: boolean;
  onboarded: boolean;
  avatarVersion: number | null;
  createdAt: string;
};

export function publicUser(u: DbUser): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    language: u.language,
    timezone: safeTz(u.timezone),
    dailyGoal: u.dailyGoal,
    emailVerified: u.emailVerified,
    hasPassword: u.hasPassword,
    isDemo: u.isDemo,
    onboarded: u.onboarded,
    avatarVersion: u.avatarVersion,
    createdAt: u.createdAt.toISOString(),
  };
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [s, h] = stored.split(":");
  if (!s || !h) return false;
  const hash = scryptSync(pw, Buffer.from(s, "hex"), 64);
  const exp = Buffer.from(h, "hex");
  return exp.length === hash.length && timingSafeEqual(hash, exp);
}

export async function createSession(userId: string, days = 30) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 86400000);
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt });
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async (): Promise<DbUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date()), eq(users.isDemo, false)))
    .limit(1);
  return rows[0]?.u ?? null;
});

export type Authed = { user: DbUser; id: string; tz: string; prefs: Prefs };

/** Verifies identity server-side. The user id ALWAYS comes from the session, never the request. */
export async function requireUser(): Promise<Authed> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  return { user, id: user.id, tz: safeTz(user.timezone), prefs: parsePrefs(user.preferences) };
}

export function assertNotDemo(a: Authed, what: string) {
  if (a.user.isDemo) throw new ApiError(403, `${what} isn't available in Demo Mode. Create a free account to unlock it.`, "demo");
}

/* simple in-memory rate limiter (per server instance) */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return;
  }
  b.n += 1;
  if (b.n > max) throw new ApiError(429, "Too many attempts. Please wait a moment and try again.");
}
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
