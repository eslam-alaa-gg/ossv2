import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { ApiError, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { award, evaluateAchievements } from "@/lib/server/rewards";

export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const a = await requireUser();
  const [c] = await db.select().from(dailyChallenges).where(and(eq(dailyChallenges.id, uuidParam(id)), eq(dailyChallenges.userId, a.id))).limit(1);
  if (!c) throw new ApiError(404, "Challenge not found.");
  if (c.date !== todayIn(a.tz)) throw new ApiError(400, "Only today's challenge can be completed.");
  // atomic claim: only one request can flip completed_at from null
  const r = await db.update(dailyChallenges).set({ completedAt: new Date() }).where(and(eq(dailyChallenges.id, c.id), isNull(dailyChallenges.completedAt))).returning();
  if (!r.length) throw new ApiError(409, "This challenge was already completed — reward already claimed.");
  const xp = await award(a.id, "challenge", c.id, c.xp, `Challenge: ${c.title}`);
  const unlocked = await evaluateAchievements(a.id, a.tz, a.user.dailyGoal);
  return { xp, unlocked };
});
