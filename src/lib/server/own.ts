import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { goalMilestones, goals, tasks } from "@/db/schema";
import type { Authed } from "./auth";
import { ApiError } from "./api";

export async function ownGoal(a: Authed, id: string) {
  const [row] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, a.id))).limit(1);
  if (!row) throw new ApiError(404, "Goal not found.");
  return row;
}

export async function ownTask(a: Authed, id: string) {
  const [row] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, a.id))).limit(1);
  if (!row) throw new ApiError(404, "Task not found.");
  return row;
}

export async function ownMilestone(a: Authed, id: string) {
  const [row] = await db.select().from(goalMilestones).where(and(eq(goalMilestones.id, id), eq(goalMilestones.userId, a.id))).limit(1);
  if (!row) throw new ApiError(404, "Milestone not found.");
  return row;
}
