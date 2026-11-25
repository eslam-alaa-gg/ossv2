import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { goalMilestones } from "@/db/schema";
import { body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { ownGoal } from "@/lib/server/own";

export const POST = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const g = await ownGoal(a, uuidParam(id));
  const d = await body(
    req,
    z.object({ title: z.string().trim().min(1, "Name is required").max(160), description: z.string().max(1000).default(""), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null) }),
  );
  const n = (await db.execute(sql`select count(*)::int c from goal_milestones where goal_id=${g.id}`)).rows[0] as { c: number };
  const [m] = await db.insert(goalMilestones).values({ ...d, goalId: g.id, userId: a.id, sortOrder: n.c }).returning();
  return { milestone: m };
});
