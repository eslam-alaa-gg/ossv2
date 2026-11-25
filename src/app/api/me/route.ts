import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { body, handle } from "@/lib/server/api";
import { publicUser, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  return { user: publicUser(a.user), prefs: a.prefs };
});

export const PATCH = handle(async (req) => {
  const a = await requireUser();
  const d = await body(
    req,
    z.object({
      displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(40, "Name must be at most 40 characters").optional(),
      language: z.enum(["en", "ar"]).optional(),
      timezone: z.string().max(60).optional(),
      dailyGoal: z.number().int().min(1).max(30).optional(),
      onboarded: z.boolean().optional(),
    }),
  );
  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (d.displayName) set.displayName = d.displayName.replace(/\s+/g, " ");
  if (d.language) set.language = d.language;
  if (d.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: d.timezone });
      set.timezone = d.timezone;
    } catch {
      return Response.json({ error: "Unknown timezone." }, { status: 400 });
    }
  }
  if (d.dailyGoal) set.dailyGoal = d.dailyGoal;
  if (d.onboarded !== undefined) set.onboarded = d.onboarded;
  const [u] = await db.update(users).set(set).where(eq(users.id, a.id)).returning();
  return { user: publicUser(u) };
});
