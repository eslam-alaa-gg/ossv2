import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, goalMilestones, goals, habitLogs, habits, tasks } from "@/db/schema";
import { diffDays, isDateStr } from "@/lib/dates";
import { ApiError, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { activityByDay } from "@/lib/server/stats";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const a = await requireUser();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isDateStr(from) || !isDateStr(to) || diffDays(to, from) < 0 || diffDays(to, from) > 62) throw new ApiError(400, "Invalid date range.");
  const t = await db.select().from(tasks).where(and(eq(tasks.userId, a.id), ne(tasks.status, "archived"), gte(tasks.dueDate, from), lte(tasks.dueDate, to)));
  const hs = await db.select().from(habits).where(and(eq(habits.userId, a.id), eq(habits.archived, false)));
  const hl = await db.select().from(habitLogs).where(and(eq(habitLogs.userId, a.id), eq(habitLogs.completed, true), gte(habitLogs.date, from), lte(habitLogs.date, to)));
  const ch = await db.select().from(dailyChallenges).where(and(eq(dailyChallenges.userId, a.id), gte(dailyChallenges.date, from), lte(dailyChallenges.date, to)));
  const ms = await db
    .select({ id: goalMilestones.id, title: goalMilestones.title, deadline: goalMilestones.deadline, done: goalMilestones.completedAt, goal: goals.title })
    .from(goalMilestones)
    .innerJoin(goals, eq(goals.id, goalMilestones.goalId))
    .where(and(eq(goalMilestones.userId, a.id), gte(goalMilestones.deadline, from), lte(goalMilestones.deadline, to)));
  const act = await activityByDay(a.id, a.tz, from, to, a.user.dailyGoal);
  return { tasks: t, habits: hs.map((h) => ({ id: h.id, name: h.name, days: h.days, startDate: h.startDate })), habitLogs: hl.map((l) => ({ habitId: l.habitId, date: l.date })), challenges: ch, milestones: ms, activity: act };
});
