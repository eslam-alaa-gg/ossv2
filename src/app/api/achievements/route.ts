import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { userAchievements } from "@/db/schema";
import { handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { dashboardData, recentXp } from "@/lib/server/overview";
import { ACHIEVEMENTS, evaluateAchievements, metricsFor } from "@/lib/server/rewards";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  await evaluateAchievements(a.id, a.tz, a.user.dailyGoal);
  const m = await metricsFor(a.id, a.tz, a.user.dailyGoal);
  const un = await db.select().from(userAchievements).where(eq(userAchievements.userId, a.id)).orderBy(desc(userAchievements.unlockedAt));
  const map = new Map(un.map((u) => [u.key, u.unlockedAt]));
  const d = await dashboardData(a);
  return {
    xp: d.xp,
    level: d.level,
    streak: d.streak,
    weeklyStreak: d.weeklyStreak,
    achievements: ACHIEVEMENTS.map((x) => ({ ...x, progress: Math.min(m[x.metric], x.target), unlockedAt: map.get(x.key) ?? null })),
    xpHistory: await recentXp(a, 20),
  };
});
