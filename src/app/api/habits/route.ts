import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { ApiError, body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { habitStreaks } from "@/lib/server/stats";
import { habitSchema } from "@/lib/server/schemas";
import { PREDEFINED_HABITS } from "@/lib/server/habits";

export const dynamic = "force-dynamic";



export const GET = handle(async () => {
  const a = await requireUser();
  const today = todayIn(a.tz);
  const hs = await db.select().from(habits).where(and(eq(habits.userId, a.id), eq(habits.archived, false))).orderBy(asc(habits.createdAt));
  const logs = await db.select().from(habitLogs).where(and(eq(habitLogs.userId, a.id), gte(habitLogs.date, addDays(today, -800))));
  const out = hs.map((h) => {
    const mine = logs.filter((l) => l.habitId === h.id);
    const done = new Set(mine.filter((l) => l.completed).map((l) => l.date));
    const t = mine.find((l) => l.date === today);
    const s = habitStreaks(done, h.days, today, h.startDate);
    return {
      ...h,
      todayAmount: t?.amount ?? 0,
      todayDone: !!t?.completed,
      current: s.current,
      longest: s.longest,
      history: [...done].filter((d) => d >= addDays(today, -90)),
      total: done.size,
    };
  });
  return { habits: out, today, templates: PREDEFINED_HABITS };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const d = await body(req, habitSchema);
  if (d.kind !== "standard") {
    const ex = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.userId, a.id), eq(habits.kind, d.kind), eq(habits.archived, false))).limit(1);
    if (ex.length) throw new ApiError(409, "You already track this habit.");
    if (d.kind === "water") d.target = a.prefs.waterGoal;
  }
  const count = (await db.select({ id: habits.id }).from(habits).where(eq(habits.userId, a.id))).length;
  if (count >= 50) throw new ApiError(400, "Habit limit reached.");
  const { archived: _ignored, ...rest } = d;
  void _ignored;
  const [h] = await db.insert(habits).values({ ...rest, userId: a.id, startDate: todayIn(a.tz) }).returning();
  return { habit: h };
});
