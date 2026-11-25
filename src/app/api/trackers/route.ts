import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { habits, learningEntries, readingLogs, waterLogs } from "@/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  const today = todayIn(a.tz);
  const from = addDays(today, -13);
  const waterToday = await db.select().from(waterLogs).where(and(eq(waterLogs.userId, a.id), eq(waterLogs.date, today))).orderBy(desc(waterLogs.createdAt));
  const waterDays = (await db.execute(sql`select date::text d, sum(ml)::int v from ossv2.water_logs where user_id=${a.id} and date >= ${from}::date group by date order by date`)).rows as { d: string; v: number }[];
  const reading = await db.select().from(readingLogs).where(eq(readingLogs.userId, a.id)).orderBy(desc(readingLogs.date), desc(readingLogs.createdAt)).limit(30);
  const readingDays = (await db.execute(sql`select date::text d, sum(pages)::int v from ossv2.reading_logs where user_id=${a.id} and date >= ${from}::date group by date order by date`)).rows as { d: string; v: number }[];
  const learning = await db.select().from(learningEntries).where(eq(learningEntries.userId, a.id)).orderBy(desc(learningEntries.date), desc(learningEntries.createdAt)).limit(30);
  const [rh] = await db.select().from(habits).where(and(eq(habits.userId, a.id), eq(habits.kind, "reading"), eq(habits.archived, false))).limit(1);
  const [lh] = await db.select().from(habits).where(and(eq(habits.userId, a.id), eq(habits.kind, "learning"), eq(habits.archived, false))).limit(1);
  void gte;
  return {
    today,
    water: { goal: a.prefs.waterGoal, total: waterToday.reduce((s, w) => s + w.ml, 0), entries: waterToday, days: waterDays },
    reading: { target: rh?.target ?? 20, todayPages: reading.filter((r) => r.date === today).reduce((s, r) => s + r.pages, 0), entries: reading, days: readingDays },
    learning: { target: lh?.target ?? 1, todayCount: learning.filter((e) => e.date === today).length, entries: learning },
  };
});
