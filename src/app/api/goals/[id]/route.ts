import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { ownGoal } from "@/lib/server/own";
import { award, evaluateAchievements, XP_GOAL } from "@/lib/server/rewards";
import { goalFields } from "@/lib/server/schemas";

export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const cur = await ownGoal(a, uuidParam(id));
  const d = await body(req, z.object({ ...goalFields, status: z.enum(["active", "completed", "paused"]) }).partial());
  const set: Partial<typeof goals.$inferInsert> = { ...d };
  if (d.status === "completed" && cur.status !== "completed") set.completedAt = new Date();
  if (d.status && d.status !== "completed") set.completedAt = null;
  const [g] = await db.update(goals).set(set).where(and(eq(goals.id, cur.id), eq(goals.userId, a.id))).returning();
  let xp = 0;
  let unlocked: string[] = [];
  if (d.status === "completed" && cur.status !== "completed") {
    xp = await award(a.id, "goal", cur.id, XP_GOAL, `Goal: ${cur.title}`);
    unlocked = await evaluateAchievements(a.id, a.tz, a.user.dailyGoal);
  }
  return { goal: g, xp, unlocked };
});

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const a = await requireUser();
  const g = await ownGoal(a, uuidParam(id));
  await db.delete(goals).where(and(eq(goals.id, g.id), eq(goals.userId, a.id)));
  return { ok: true };
});
