import { randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { authTokens, sessions, users } from "@/db/schema";
import { ApiError, body, handle } from "@/lib/server/api";
import { clientIp, createSession, destroySession, getSessionUser, hashPassword, rateLimit, sha256, verifyPassword } from "@/lib/server/auth";
import { cleanupDemoUsers, createDemoUser } from "@/lib/server/demo";
import { sendEmail } from "@/lib/server/secure";
import { DEFAULT_PREFS } from "@/lib/prefs";
import { safeTz } from "@/lib/dates";

const email = z.string().trim().toLowerCase().email().max(200);
const password = z.string().min(8, "Password must be at least 8 characters").max(128);
const name = z.string().trim().min(2, "Name must be at least 2 characters").max(40, "Name must be at most 40 characters");

const DUMMY_HASH = hashPassword("dummy-password-for-timing");

async function origin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

async function issueToken(userId: string, type: "reset" | "verify", hours: number) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(authTokens).values({ userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + hours * 3600000) });
  return token;
}

export const POST = handle<{ action: string }>(async (req, { action }) => {
  const ip = await clientIp();
  switch (action) {
    case "signup": {
      rateLimit(`signup:${ip}`, 10, 3600000);
      const d = await body(req, z.object({ email, password, displayName: name, timezone: z.string().optional() }));
      const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
      if (exists.length) throw new ApiError(409, "An account with this email already exists.");
      const [u] = await db
        .insert(users)
        .values({ email: d.email, passwordHash: hashPassword(d.password), displayName: d.displayName.replace(/\s+/g, " "), timezone: safeTz(d.timezone), preferences: DEFAULT_PREFS })
        .returning();
      const token = await issueToken(u.id, "verify", 48);
      const link = `${await origin()}/verify-email?token=${token}`;
      const sent = await sendEmail(u.email, "Verify your LIFE OS email", `<p>Welcome to LIFE OS. <a href="${link}">Verify your email</a></p>`, link);
      await createSession(u.id);
      return { ok: true, emailSent: sent };
    }
    case "login": {
      const d = await body(req, z.object({ email, password: z.string().min(1).max(128) }));
      rateLimit(`login:${ip}:${d.email}`, 8, 15 * 60000);
      const [u] = await db.select().from(users).where(eq(users.email, d.email)).limit(1);
      const ok = verifyPassword(d.password, u?.passwordHash ?? DUMMY_HASH);
      if (!u || !u.hasPassword || !ok || u.isDemo) throw new ApiError(401, "Incorrect email or password.");
      await createSession(u.id);
      return { ok: true };
    }
    case "demo": {
      rateLimit(`demo:${ip}`, 20, 3600000);
      const existing = await getSessionUser();
      if (existing?.isDemo) return { ok: true, reused: true };
      const d = await body(req, z.object({ timezone: z.string().optional() })).catch(() => ({ timezone: undefined }));
      await cleanupDemoUsers();
      const u = await createDemoUser(d.timezone);
      await createSession(u.id, 1);
      return { ok: true };
    }
    case "logout": {
      const u = await getSessionUser();
      // Exiting demo discards that visitor's private demo workspace entirely.
      if (u?.isDemo) await db.delete(users).where(eq(users.id, u.id));
      await destroySession();
      return { ok: true };
    }
    case "forgot": {
      rateLimit(`forgot:${ip}`, 5, 3600000);
      const d = await body(req, z.object({ email }));
      const [u] = await db.select().from(users).where(eq(users.email, d.email)).limit(1);
      if (u && !u.isDemo) {
        const token = await issueToken(u.id, "reset", 1);
        const link = `${await origin()}/reset-password?token=${token}`;
        await sendEmail(u.email, "Reset your LIFE OS password", `<p><a href="${link}">Reset your password</a> (valid for 1 hour)</p>`, link);
      }
      return { ok: true, emailConfigured: !!process.env.RESEND_API_KEY };
    }
    case "reset": {
      rateLimit(`reset:${ip}`, 10, 3600000);
      const d = await body(req, z.object({ token: z.string().min(10).max(200), password }));
      const [t] = await db
        .select()
        .from(authTokens)
        .where(and(eq(authTokens.tokenHash, sha256(d.token)), eq(authTokens.type, "reset"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
        .limit(1);
      if (!t) throw new ApiError(400, "This reset link is invalid or has expired.");
      await db.update(users).set({ passwordHash: hashPassword(d.password), hasPassword: true, updatedAt: new Date() }).where(eq(users.id, t.userId));
      await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, t.id));
      await db.delete(sessions).where(eq(sessions.userId, t.userId));
      return { ok: true };
    }
    case "verify": {
      const d = await body(req, z.object({ token: z.string().min(10).max(200) }));
      const [t] = await db
        .select()
        .from(authTokens)
        .where(and(eq(authTokens.tokenHash, sha256(d.token)), eq(authTokens.type, "verify"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
        .limit(1);
      if (!t) throw new ApiError(400, "This verification link is invalid or has expired.");
      await db.update(users).set({ emailVerified: true }).where(eq(users.id, t.userId));
      await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, t.id));
      return { ok: true };
    }
    case "resend": {
      const u = await getSessionUser();
      if (!u) throw new ApiError(401, "Please sign in.");
      if (u.isDemo) throw new ApiError(403, "Not available in Demo Mode.", "demo");
      rateLimit(`resend:${u.id}`, 3, 3600000);
      const token = await issueToken(u.id, "verify", 48);
      const link = `${await origin()}/verify-email?token=${token}`;
      const sent = await sendEmail(u.email, "Verify your LIFE OS email", `<p><a href="${link}">Verify your email</a></p>`, link);
      return { ok: true, emailSent: sent };
    }
    default:
      throw new ApiError(404, "Not found.");
  }
});
