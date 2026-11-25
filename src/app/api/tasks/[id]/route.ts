import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { addDays, addMonths } from "@/lib/dates";
import { body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { ownGoal, ownMilestone, ownTask } from "@/lib/server/own";
import { award, evaluateAchievements, XP_TASK } from "@/lib/server/rewards";
import { taskSchema } from "@/lib/server/schemas";

export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const cur = await ownTask(a, uuidParam(id));
  const d = await body(req, taskSchema.partial());
  if (d.goalId) await ownGoal(a, d.goalId);
  if (d.milestoneId) await ownMilestone(a, d.milestoneId);
  const set: Partial<typeof tasks.$inferInsert> = { ...d, updatedAt: new Date() };
  let xp = 0;
  let unlocked: string[] = [];
  if (d.status && d.status !== cur.status) {
    if (d.status === "completed") {
      set.completedAt = new Date();
      // atomic: only the transition that actually flips the row can reward (no double-claim races)
      const flipped = await db
        .update(tasks)
        .set({ ...set })
        .where(and(eq(tasks.id, cur.id), eq(tasks.userId, a.id), eq(tasks.status, cur.status)))
        .returning();
      if (!flipped.length) return { task: await ownTask(a, cur.id), xp: 0, unlocked: [] };
      xp = await award(a.id, "task", cur.id, XP_TASK[cur.priority] ?? 15, `Task: ${cur.title}`);
      if (cur.recurrence !== "none" && cur.status !== "archived") {
        const base = cur.dueDate ?? new Date().toISOString().slice(0, 10);
        const next = cur.recurrence === "daily" ? addDays(base, 1) : cur.recurrence === "weekly" ? addDays(base, 7) : addMonths(base, 1);
        await db.insert(tasks).values({ ...cur, id: undefined, status: "todo", completedAt: null, dueDate: next, createdAt: undefined, updatedAt: undefined });
      }
      unlocked = await evaluateAchievements(a.id, a.tz, a.user.dailyGoal);
      return { task: flipped[0], xp, unlocked };
    }
    if (cur.status === "completed") set.completedAt = null; // restore
  }
  const [t] = await db.update(tasks).set(set).where(and(eq(tasks.id, cur.id), eq(tasks.userId, a.id))).returning();
  return { task: t, xp, unlocked };
});

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const a = await requireUser();
  await ownTask(a, uuidParam(id));
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, a.id)));
  return { ok: true };
});
