import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { goalMilestones } from "@/db/schema";
import { body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { ownMilestone } from "@/lib/server/own";
import { award, evaluateAchievements, XP_MILESTONE } from "@/lib/server/rewards";

export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const cur = await ownMilestone(a, uuidParam(id));
  const d = await body(
    req,
    z.object({
      title: z.string().trim().min(1).max(160),
      description: z.string().max(1000),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      completed: z.boolean(),
    }).partial(),
  );
  const { completed, ...rest } = d;
  const set: Partial<typeof goalMilestones.$inferInsert> = { ...rest };
  if (completed !== undefined) set.completedAt = completed ? cur.completedAt ?? new Date() : null;
  const [m] = await db.update(goalMilestones).set(set).where(and(eq(goalMilestones.id, cur.id), eq(goalMilestones.userId, a.id))).returning();
  let xp = 0;
  let unlocked: string[] = [];
  if (completed && !cur.completedAt) {
    xp = await award(a.id, "milestone", cur.id, XP_MILESTONE, `Milestone: ${cur.title}`);
    unlocked = await evaluateAchievements(a.id, a.tz, a.user.dailyGoal);
  }
  return { milestone: m, xp, unlocked };
});

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const a = await requireUser();
  const m = await ownMilestone(a, uuidParam(id));
  await db.delete(goalMilestones).where(and(eq(goalMilestones.id, m.id), eq(goalMilestones.userId, a.id)));
  return { ok: true };
});
