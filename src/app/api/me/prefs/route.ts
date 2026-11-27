import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { habits, users } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { syncSpecialHabit } from "@/lib/server/habits";
import { ApiError, body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { PREF_KEYS, parsePrefs, prefSchemas, type Prefs } from "@/lib/prefs";

export const PATCH = handle(async (req) => {
  const a = await requireUser();
  const raw = await body(req, z.record(z.string(), z.unknown()));
  const next: Record<string, unknown> = { ...a.prefs };
  let changed = 0;
  for (const k of Object.keys(raw)) {
    if (!(PREF_KEYS as string[]).includes(k)) throw new ApiError(400, `Unknown preference: ${k}`);
    next[k] = prefSchemas[k as keyof Prefs].parse(raw[k]); // strict validation per key
    changed++;
  }
  if (!changed) throw new ApiError(400, "Nothing to update.");
  const [u] = await db.update(users).set({ preferences: next, updatedAt: new Date() }).where(eq(users.id, a.id)).returning();
  const prefs = parsePrefs(u.preferences);
  if (prefs.waterGoal !== a.prefs.waterGoal) {
    // Keep the linked water habit's target and today's completion in step with the new goal.
    await db.update(habits).set({ target: prefs.waterGoal }).where(and(eq(habits.userId, a.id), eq(habits.kind, "water")));
    await syncSpecialHabit({ ...a, prefs }, "water", todayIn(a.tz));
  }
  return { prefs };
});
