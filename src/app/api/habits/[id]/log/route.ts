import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { habits } from "@/db/schema";
import { addDays, isDateStr, todayIn } from "@/lib/dates";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { setHabitAmount } from "@/lib/server/habits";

export const POST = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const d = await body(req, z.object({ date: z.string().refine(isDateStr, "Invalid calendar date").optional(), amount: z.number().int().min(0).max(100000) }));
  const [h] = await db.select().from(habits).where(and(eq(habits.id, uuidParam(id)), eq(habits.userId, a.id))).limit(1);
  if (!h) throw new ApiError(404, "Habit not found.");
  if (h.kind !== "standard") throw new ApiError(400, "This habit is driven by its tracker — add an entry there.");
  const today = todayIn(a.tz);
  const date = d.date ?? today;
  if (date > today) throw new ApiError(400, "You can't log a habit in the future.");
  if (date < addDays(today, -30)) throw new ApiError(400, "You can only edit the last 30 days.");
  return setHabitAmount(a, h, date, d.amount);
});
