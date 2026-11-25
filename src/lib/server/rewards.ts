import "server-only";
import { and, eq, isNotNull, sum } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, focusSessions, goalMilestones, goals, habitLogs, notes, tasks, userAchievements, xpTransactions } from "@/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { activityByDay, computeStreaks } from "./stats";

export const XP_TASK: Record<string, number> = { low: 10, medium: 15, high: 20, urgent: 25 };
export const XP_HABIT = 10;
export const XP_MILESTONE = 30;
export const XP_GOAL = 100;

type Metric = "tasks" | "habits" | "challenges" | "focus" | "goals" | "milestones" | "notes" | "streak" | "xp";

export const ACHIEVEMENTS: { key: string; title: string; desc: string; icon: string; xp: number; target: number; metric: Metric }[] = [
  { key: "first_task", title: "First Step", desc: "Complete your first task.", icon: "check", xp: 20, target: 1, metric: "tasks" },
  { key: "task_10", title: "Getting Things Done", desc: "Complete 10 tasks.", icon: "list", xp: 40, target: 10, metric: "tasks" },
  { key: "task_50", title: "Momentum", desc: "Complete 50 tasks.", icon: "trophy", xp: 100, target: 50, metric: "tasks" },
  { key: "habit_7", title: "Building Rhythm", desc: "Complete 7 habit check-ins.", icon: "repeat", xp: 35, target: 7, metric: "habits" },
  { key: "streak_7", title: "One Week Strong", desc: "Reach a 7-day activity streak.", icon: "flame", xp: 75, target: 7, metric: "streak" },
  { key: "focus_5", title: "Deep Focus", desc: "Complete 5 focus sessions.", icon: "timer", xp: 50, target: 5, metric: "focus" },
  { key: "focus_25", title: "In The Zone", desc: "Complete 25 focus sessions.", icon: "brain", xp: 120, target: 25, metric: "focus" },
  { key: "first_goal", title: "Big Picture", desc: "Complete your first goal.", icon: "target", xp: 60, target: 1, metric: "goals" },
  { key: "challenge_10", title: "Challenge Accepted", desc: "Complete 10 daily challenges.", icon: "zap", xp: 60, target: 10, metric: "challenges" },
  { key: "milestone_10", title: "Milestone Maker", desc: "Complete 10 milestones.", icon: "calendar", xp: 60, target: 10, metric: "milestones" },
  { key: "notes_10", title: "Knowledge Keeper", desc: "Create 10 notes.", icon: "book", xp: 40, target: 10, metric: "notes" },
  { key: "xp_500", title: "Rising Star", desc: "Earn 500 XP.", icon: "star", xp: 75, target: 500, metric: "xp" },
];

export async function award(userId: string, source: string, sourceId: string, xp: number, label: string): Promise<number> {
  if (!Number.isFinite(xp) || xp <= 0) return 0;
  const inserted = await db
    .insert(xpTransactions)
    .values({ userId, source, sourceId, xp: Math.round(xp), label: label.slice(0, 160) })
    .onConflictDoNothing({ target: [xpTransactions.userId, xpTransactions.source, xpTransactions.sourceId] })
    .returning({ id: xpTransactions.id });
  return inserted.length ? Math.round(xp) : 0;
}

export async function metricsFor(userId: string, tz: string, dailyGoal: number) {
  const [taskRows, habitRows, challengeRows, focusRows, goalRows, milestoneRows, noteRows, xpRows] = await Promise.all([
    db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.status, "completed"))),
    db.select({ id: habitLogs.id }).from(habitLogs).where(and(eq(habitLogs.userId, userId), eq(habitLogs.completed, true))),
    db.select({ id: dailyChallenges.id }).from(dailyChallenges).where(and(eq(dailyChallenges.userId, userId), isNotNull(dailyChallenges.completedAt))),
    db.select({ id: focusSessions.id }).from(focusSessions).where(and(eq(focusSessions.userId, userId), eq(focusSessions.status, "completed"), eq(focusSessions.mode, "focus"))),
    db.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, userId), eq(goals.status, "completed"))),
    db.select({ id: goalMilestones.id }).from(goalMilestones).where(and(eq(goalMilestones.userId, userId), isNotNull(goalMilestones.completedAt))),
    db.select({ id: notes.id }).from(notes).where(eq(notes.userId, userId)),
    db.select({ total: sum(xpTransactions.xp) }).from(xpTransactions).where(eq(xpTransactions.userId, userId)),
  ]);
  const today = todayIn(tz);
  const activity = await activityByDay(userId, tz, addDays(today, -800), today, dailyGoal);
  const streak = computeStreaks(Object.values(activity).filter((d) => d.score > 0).map((d) => d.date), today).current;
  return {
    tasks: taskRows.length,
    habits: habitRows.length,
    challenges: challengeRows.length,
    focus: focusRows.length,
    goals: goalRows.length,
    milestones: milestoneRows.length,
    notes: noteRows.length,
    streak,
    xp: Number(xpRows[0]?.total ?? 0),
  };
}

export async function evaluateAchievements(userId: string, tz: string, dailyGoal: number): Promise<string[]> {
  const metrics = await metricsFor(userId, tz, dailyGoal);
  const existing = await db.select({ key: userAchievements.key }).from(userAchievements).where(eq(userAchievements.userId, userId));
  const known = new Set(existing.map((row) => row.key));
  const newlyUnlocked = ACHIEVEMENTS.filter((a) => !known.has(a.key) && metrics[a.metric] >= a.target);
  if (newlyUnlocked.length) {
    await db.insert(userAchievements).values(newlyUnlocked.map((a) => ({ userId, key: a.key }))).onConflictDoNothing();
  }
  return newlyUnlocked.map((a) => a.title);
}
