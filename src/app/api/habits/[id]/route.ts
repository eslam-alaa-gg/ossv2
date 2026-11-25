import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { habits } from "@/db/schema";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { habitSchema } from "@/lib/server/schemas";

export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const d = await body(req, habitSchema.omit({ kind: true }).partial());
  const [h] = await db.update(habits).set(d).where(and(eq(habits.id, uuidParam(id)), eq(habits.userId, a.id))).returning();
  if (!h) throw new ApiError(404, "Habit not found.");
  return { habit: h };
});

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const a = await requireUser();
  const r = await db.delete(habits).where(and(eq(habits.id, uuidParam(id)), eq(habits.userId, a.id))).returning({ id: habits.id });
  if (!r.length) throw new ApiError(404, "Habit not found.");
  return { ok: true };
});
