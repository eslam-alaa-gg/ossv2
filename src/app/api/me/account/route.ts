import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ApiError, body, handle } from "@/lib/server/api";
import { assertNotDemo, destroySession, hashPassword, rateLimit, requireUser, verifyPassword } from "@/lib/server/auth";

// POST = change password, DELETE = delete account permanently
export const POST = handle(async (req) => {
  const a = await requireUser();
  assertNotDemo(a, "Changing the password");
  rateLimit(`pw:${a.id}`, 6, 900000);
  const d = await body(req, z.object({ current: z.string().max(128), next: z.string().min(8, "Password must be at least 8 characters").max(128) }));
  if (a.user.hasPassword && !verifyPassword(d.current, a.user.passwordHash)) throw new ApiError(400, "Current password is incorrect.");
  await db.update(users).set({ passwordHash: hashPassword(d.next), hasPassword: true, updatedAt: new Date() }).where(eq(users.id, a.id));
  return { ok: true };
});

export const DELETE = handle(async (req) => {
  const a = await requireUser();
  assertNotDemo(a, "Deleting the account");
  rateLimit(`del:${a.id}`, 5, 900000);
  const d = await body(req, z.object({ password: z.string().max(128) }));
  if (!a.user.hasPassword) throw new ApiError(400, "Set a password before deleting this account.");
  if (!verifyPassword(d.password, a.user.passwordHash)) throw new ApiError(400, "Password is incorrect.");
  await db.delete(sessions).where(eq(sessions.userId, a.id));
  await db.delete(users).where(eq(users.id, a.id)); // cascades through every owned table
  await destroySession();
  return { ok: true };
});
