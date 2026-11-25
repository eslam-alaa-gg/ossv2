import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { goalMilestones, goals, tasks } from "@/db/schema";
import { body, handle } from "@/lib/server/api";
import { goalFields } from "@/lib/server/schemas";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";



export const GET = handle(async () => {
  const a = await requireUser();
  const gs = await db.select().from(goals).where(eq(goals.userId, a.id)).orderBy(desc(goals.createdAt));
  const ms = await db.select().from(goalMilestones).where(eq(goalMilestones.userId, a.id)).orderBy(asc(goalMilestones.sortOrder), asc(goalMilestones.createdAt));
  const ts = await db.select({ id: tasks.id, title: tasks.title, status: tasks.status, goalId: tasks.goalId, milestoneId: tasks.milestoneId, dueDate: tasks.dueDate }).from(tasks).where(eq(tasks.userId, a.id));
  const out = gs.map((g) => {
    const m = ms.filter((x) => x.goalId === g.id);
    const t = ts.filter((x) => x.goalId === g.id);
    const progress = m.length ? Math.round((100 * m.filter((x) => x.completedAt).length) / m.length) : g.status === "completed" ? 100 : g.manualProgress;
    return { ...g, progress, milestones: m.map((x) => ({ ...x, tasks: t.filter((y) => y.milestoneId === x.id) })), tasks: t, tasksDone: t.filter((x) => x.status === "completed").length };
  });
  return { goals: out };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const d = await body(req, z.object(goalFields));
  const [g] = await db.insert(goals).values({ ...d, userId: a.id }).returning();
  return { goal: g };
});
