import "server-only";
import { and, desc, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, habitLogs, habits, tasks, xpTransactions } from "@/db/schema";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import type { Authed } from "./auth";
import { todaysChallenges } from "./challenges";
import { activityByDay, computeStreaks } from "./stats";

export async function weeklyStreak(activeDates: string[], today: string): Promise<number> {
  const activeWeeks = new Set(activeDates.map((d) => weekStart(d)));
  let cursor = weekStart(today);
  if (!activeWeeks.has(cursor)) cursor = addDays(cursor, -7);
  let count = 0;
  for (let i = 0; i < 520 && activeWeeks.has(cursor); i++, cursor = addDays(cursor, -7)) count++;
  return count;
}

export async function recentXp(a: Authed, limit = 10) {
  return db.select({ id: xpTransactions.id, xp: xpTransactions.xp, label: xpTransactions.label, createdAt: xpTransactions.createdAt })
    .from(xpTransactions)
    .where(eq(xpTransactions.userId, a.id))
    .orderBy(desc(xpTransactions.createdAt))
    .limit(Math.max(1, Math.min(100, limit)));
}

export async function dashboardData(a: Authed) {
  const today = todayIn(a.tz);
  const weekStartDate = addDays(today, -6);
  const todayChallenges = await todaysChallenges(a);
  const [allTasks, allHabits, todayLogs, xpTotal, weekActivity] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, a.id)).orderBy(desc(tasks.createdAt)).limit(1500),
    db.select().from(habits).where(and(eq(habits.userId, a.id), eq(habits.archived, false))).orderBy(desc(habits.createdAt)),
    db.select().from(habitLogs).where(and(eq(habitLogs.userId, a.id), eq(habitLogs.date, today), eq(habitLogs.completed, true))),
    db.select({ total: sum(xpTransactions.xp) }).from(xpTransactions).where(eq(xpTransactions.userId, a.id)),
    activityByDay(a.id, a.tz, weekStartDate, today, a.user.dailyGoal),
  ]);

  const doneTasks = allTasks.filter((t) => t.status === "completed" && t.completedAt && todayIn(a.tz, t.completedAt) === today);
  const openTasks = allTasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const dueToday = openTasks.filter((t) => t.dueDate === today);
  const overdue = openTasks.filter((t) => !!t.dueDate && t.dueDate < today).length;
  const upcoming = openTasks.filter((t) => !!t.dueDate && t.dueDate >= today).sort((x, y) => (x.dueDate ?? "").localeCompare(y.dueDate ?? "") || (x.dueTime ?? "").localeCompare(y.dueTime ?? "")).slice(0, 8);
  const doneHabitIds = new Set(todayLogs.map((l) => l.habitId));
  const activityDays = Object.values(weekActivity);
  const score = weekActivity[today]?.score ?? 0;
  const allActivity = await activityByDay(a.id, a.tz, addDays(today, -800), today, a.user.dailyGoal);
  const activeDates = Object.values(allActivity).filter((d) => d.score > 0).map((d) => d.date);
  const streak = computeStreaks(activeDates, today);
  const xp = Number(xpTotal[0]?.total ?? 0);
  const level = Math.floor(xp / 100) + 1;
  const into = xp % 100;
  const weekFocusMinutes = activityDays.reduce((n, d) => n + d.focusMinutes, 0);
  const focusMinutes = weekActivity[today]?.focusMinutes ?? 0;
  const weekTasks = activityDays.reduce((n, d) => n + d.tasks, 0);
  const weekHabits = activityDays.reduce((n, d) => n + d.habits, 0);
  const recent = await recentXp(a, 5);

  return {
    today,
    score,
    dailyGoal: a.user.dailyGoal,
    completedToday: doneTasks.length,
    remaining: dueToday.length,
    overdue,
    openTotal: openTasks.length,
    habits: { done: doneHabitIds.size, total: allHabits.length, list: allHabits.slice(0, 8).map((h) => ({ id: h.id, name: h.name, icon: h.icon, done: doneHabitIds.has(h.id) })) },
    challenge: todayChallenges.filter((c) => !c.isCustom).map((c) => ({ id: c.id, title: c.title, minutes: c.minutes, xp: c.xp, difficulty: c.difficulty, completedAt: c.completedAt?.toISOString() ?? null }))[0] ?? null,
    streak,
    weeklyStreak: await weeklyStreak(activeDates, today),
    focusMinutes,
    weekFocusMinutes,
    week: activityDays.map((d) => ({ date: d.date, score: d.score, level: d.level })),
    weekTasks,
    weekHabits,
    upcoming: upcoming.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate!, dueTime: t.dueTime, priority: t.priority })),
    xp,
    level: { level, into, span: 100 },
    recent: recent.map((r) => ({ key: r.id, title: r.label, desc: "Verified activity", xp: r.xp })),
  };
}
