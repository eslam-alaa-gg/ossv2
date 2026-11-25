import { and, desc, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { dailyChallenges } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { ApiError, body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { todaysChallenges, XP_BY_DIFFICULTY } from "@/lib/server/challenges";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  const today = await todaysChallenges(a);
  const history = await db.select().from(dailyChallenges).where(and(eq(dailyChallenges.userId, a.id), lt(dailyChallenges.date, todayIn(a.tz)))).orderBy(desc(dailyChallenges.date)).limit(30);
  const done = (await db.execute(sql`select count(*)::int c from daily_challenges where user_id=${a.id} and completed_at is not null`)).rows[0] as { c: number };
  return { today, history, completedTotal: done.c, notifyTime: a.prefs.notifications.challengeTime };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const d = await body(
    req,
    z.object({
      title: z.string().trim().min(1, "Title is required").max(120),
      description: z.string().max(500).default(""),
      difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
      minutes: z.number().int().min(1).max(480).default(15),
    }),
  );
  const date = todayIn(a.tz);
  const n = (await db.execute(sql`select count(*)::int c from daily_challenges where user_id=${a.id} and date=${date}::date and is_custom`)).rows[0] as { c: number };
  if (n.c >= 3) throw new ApiError(400, "You can add up to 3 custom challenges per day.");
  const [c] = await db
    .insert(dailyChallenges)
    .values({ userId: a.id, date, templateKey: `custom:${crypto.randomUUID()}`, title: d.title, description: d.description, difficulty: d.difficulty, minutes: d.minutes, xp: Math.floor(XP_BY_DIFFICULTY[d.difficulty] / 2), isCustom: true })
    .returning();
  return { challenge: c };
});
