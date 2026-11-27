import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { syncSpecialHabit } from "@/lib/server/habits";
import { habitSchema } from "@/lib/server/schemas";

export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const d = await body(req, habitSchema.omit({ kind: true }).partial());
  const [h] = await db.update(habits).set(d).where(and(eq(habits.id, uuidParam(id)), eq(habits.userId, a.id))).returning();
  if (!h) throw new ApiError(404, "Habit not found.");
  if (d.target !== undefined) {
    // A new target changes whether today's recorded progress completes the habit.
    const today = todayIn(a.tz);
    if (h.kind !== "standard") await syncSpecialHabit(a, h.kind as "water" | "reading" | "learning", today);
    else await db.update(habitLogs).set({ completed: sql`${habitLogs.amount} >= ${h.target}` }).where(and(eq(habitLogs.habitId, h.id), eq(habitLogs.userId, a.id), eq(habitLogs.date, today)));
  }
  return { habit: h };
});

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const a = await requireUser();
  const r = await db.delete(habits).where(and(eq(habits.id, uuidParam(id)), eq(habits.userId, a.id))).returning({ id: habits.id });
  if (!r.length) throw new ApiError(404, "Habit not found.");
  return { ok: true };
});
