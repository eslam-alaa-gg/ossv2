import "server-only";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, focusSessions, goalMilestones, habitLogs, tasks } from "@/db/schema";
import { addDays, todayIn } from "@/lib/dates";

export const SCORE = { task: 1, habit: 1, challenge: 2, focus: 2, milestone: 2 } as const;

export type ActivityDay = {
  date: string;
  tasks: number;
  habits: number;
  challenges: number;
  focus: number;
  focusMinutes: number;
  milestones: number;
  score: number;
  level: number;
};

export function emptyDay(date: string): ActivityDay {
  return { date, tasks: 0, habits: 0, challenges: 0, focus: 0, focusMinutes: 0, milestones: 0, score: 0, level: 0 };
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

function levelFor(score: number, goal: number) {
  if (score <= 0) return 0;
  if (score < goal / 3) return 1;
  if (score < (goal * 2) / 3) return 2;
  if (score < goal) return 3;
  return 4;
}

/** Aggregates only completed, server-recorded activity into the user's local calendar days. */
export async function activityByDay(userId: string, tz: string, from: string, to: string, dailyGoal: number): Promise<Record<string, ActivityDay>> {
  const result: Record<string, ActivityDay> = {};
  for (let d = from, i = 0; d <= to && i <= 800; d = addDays(d, 1), i++) result[d] = emptyDay(d);

  const [taskRows, habitRows, challengeRows, focusRows, milestoneRows] = await Promise.all([
    db.select({ completedAt: tasks.completedAt }).from(tasks).where(and(eq(tasks.userId, userId), isNotNull(tasks.completedAt))),
    db.select({ date: habitLogs.date }).from(habitLogs).where(and(eq(habitLogs.userId, userId), eq(habitLogs.completed, true), gte(habitLogs.date, from), lte(habitLogs.date, to))),
    db.select({ completedAt: dailyChallenges.completedAt }).from(dailyChallenges).where(and(eq(dailyChallenges.userId, userId), isNotNull(dailyChallenges.completedAt))),
    db.select({ startedAt: focusSessions.startedAt, actualSeconds: focusSessions.actualSeconds, mode: focusSessions.mode, status: focusSessions.status }).from(focusSessions).where(and(eq(focusSessions.userId, userId), eq(focusSessions.status, "completed"))),
    db.select({ completedAt: goalMilestones.completedAt }).from(goalMilestones).where(and(eq(goalMilestones.userId, userId), isNotNull(goalMilestones.completedAt))),
  ]);

  for (const row of taskRows) {
    if (!row.completedAt) continue;
    const date = todayIn(tz, row.completedAt);
    if (inRange(date, from, to)) result[date].tasks++;
  }
  for (const row of habitRows) {
    if (result[row.date]) result[row.date].habits++;
  }
  for (const row of challengeRows) {
    if (!row.completedAt) continue;
    const date = todayIn(tz, row.completedAt);
    if (inRange(date, from, to)) result[date].challenges++;
  }
  for (const row of focusRows) {
    if (row.mode !== "focus" && row.mode !== "custom") continue;
    const date = todayIn(tz, row.startedAt);
    if (!inRange(date, from, to)) continue;
    result[date].focus++;
    result[date].focusMinutes += Math.floor(row.actualSeconds / 60);
  }
  for (const row of milestoneRows) {
    if (!row.completedAt) continue;
    const date = todayIn(tz, row.completedAt);
    if (inRange(date, from, to)) result[date].milestones++;
  }

  for (const day of Object.values(result)) {
    day.score = day.tasks * SCORE.task + day.habits * SCORE.habit + day.challenges * SCORE.challenge + day.focus * SCORE.focus + day.milestones * SCORE.milestone;
    day.level = levelFor(day.score, Math.max(1, dailyGoal));
  }
  return result;
}

export function computeStreaks(activeDates: string[], today: string) {
  const set = new Set(activeDates);
  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev = "";
  for (const date of sorted) {
    run = prev && addDays(prev, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = date;
  }
  return { current, longest };
}

/** Counts consecutive scheduled habit days, ignoring days on which the habit is not scheduled. */
export function habitStreaks(done: Set<string>, days: number[], today: string, startDate: string) {
  const scheduled = new Set(days);
  let current = 0;
  for (let i = 0; i < 800; i++) {
    const date = addDays(today, -i);
    if (date < startDate) break;
    if (!scheduled.has(new Date(date + "T00:00:00Z").getUTCDay())) continue;
    if (!done.has(date)) break;
    current++;
  }
  let longest = 0;
  let run = 0;
  for (let date = startDate, i = 0; date <= today && i < 800; date = addDays(date, 1), i++) {
    if (!scheduled.has(new Date(date + "T00:00:00Z").getUTCDay())) continue;
    if (done.has(date)) {
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  return { current, longest };
}
