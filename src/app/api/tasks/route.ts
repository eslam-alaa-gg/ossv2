import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { taskSchema } from "@/lib/server/schemas";
import { ownGoal, ownMilestone } from "@/lib/server/own";

export const dynamic = "force-dynamic";



export const GET = handle(async (req) => {
  const a = await requireUser();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const where = [eq(tasks.userId, a.id)];
  if (q) where.push(or(ilike(tasks.title, `%${q.replace(/[%_]/g, "")}%`), ilike(tasks.description, `%${q.replace(/[%_]/g, "")}%`))!);
  const rows = await db.select().from(tasks).where(and(...where)).orderBy(desc(tasks.createdAt)).limit(1000);
  return { tasks: rows };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const d = await body(req, taskSchema);
  if (d.goalId) await ownGoal(a, d.goalId);
  if (d.milestoneId) await ownMilestone(a, d.milestoneId);
  if (d.status === "completed") d.status = "todo"; // completion goes through the verified PATCH flow
  const [t] = await db.insert(tasks).values({ ...d, userId: a.id }).returning();
  return { task: t };
});
