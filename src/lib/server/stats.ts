import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, focusSessions, goalMilestones, habitLogs, tasks } from "@/db/schema";
import { addDays, todayIn, dow } from "@/lib/dates";

export const SCORE = { task: 1, habit: 1, challenge: 2, focus: 2, milestone: 2 } as const;
export type ActivityDay = { date: string; tasks: number; habits: number; challenges: number; focus: number; milestones: number; focusMinutes: number; score: number; level: number };
export function emptyDay(date: string): ActivityDay { return { date, tasks: 0, habits: 0, challenges: 0, focus: 0, milestones: 0, focusMinutes: 0, score: 0, level: 0 }; }
function finish(d: ActivityDay, goal: number) {
  d.score = d.tasks * SCORE.task + d.habits * SCORE.habit + d.challenges * SCORE.challenge + d.focus * SCORE.focus + d.milestones * SCORE.milestone;
  d.level = d.score >= goal ? 4 : d.score >= goal * (2 / 3) ? 3 : d.score >= goal / 3 ? 2 : d.score > 0 ? 1 : 0;
  return d;
}
export async function activityByDay(userId: string, tz: string, from: string, to: string, dailyGoal: number) {
  const days: Record<string, ActivityDay> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) days[d] = emptyDay(d);
  const [taskRows, habitRows, challengeRows, focusRows, milestoneRows] = await Promise.all([
    db.select({ completedAt: tasks.completedAt }).from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.status, "completed"), gte(tasks.completedAt, new Date(from + "T00:00:00Z")), lte(tasks.completedAt, new Date(to + "T23:59:59.999Z")))),
    db.select({ date: habitLogs.date }).from(habitLogs).where(and(eq(habitLogs.userId, userId), eq(habitLogs.completed, true), gte(habitLogs.date, from), lte(habitLogs.date, to))),
    db.select({ completedAt: dailyChallenges.completedAt }).from(dailyChallenges).where(and(eq(dailyChallenges.userId, userId), gte(dailyChallenges.completedAt, new Date(from + "T00:00:00Z")), lte(dailyChallenges.completedAt, new Date(to + "T23:59:59.999Z")))),
    db.select({ endedAt: focusSessions.endedAt, actualSeconds: focusSessions.actualSeconds, mode: focusSessions.mode }).from(focusSessions).where(and(eq(focusSessions.userId, userId), eq(focusSessions.status, "completed"), gte(focusSessions.endedAt, new Date(from + "T00:00:00Z")), lte(focusSessions.endedAt, new Date(to + "T23:59:59.999Z")))),
    db.select({ completedAt: goalMilestones.completedAt }).from(goalMilestones).where(and(eq(goalMilestones.userId, userId), gte(goalMilestones.completedAt, new Date(from + "T00:00:00Z")), lte(goalMilestones.completedAt, new Date(to + "T23:59:59.999Z")))),
  ]);
  for (const r of taskRows) if (r.completedAt) { const k = todayIn(tz, r.completedAt); if (days[k]) days[k].tasks++; }
  for (const r of habitRows) { const k = String(r.date); if (days[k]) days[k].habits++; }
  for (const r of challengeRows) if (r.completedAt) { const k = todayIn(tz, r.completedAt); if (days[k]) days[k].challenges++; }
  for (const r of focusRows) if (r.endedAt && (r.mode === "focus" || r.mode === "custom")) { const k = todayIn(tz, r.endedAt); if (days[k]) { days[k].focus++; days[k].focusMinutes += Math.floor(r.actualSeconds / 60); } }
  for (const r of milestoneRows) if (r.completedAt) { const k = todayIn(tz, r.completedAt); if (days[k]) days[k].milestones++; }
  for (const d of Object.values(days)) finish(d, dailyGoal);
  return days;
}
export function computeStreaks(activeDays: string[], today: string) {
  const set = new Set(activeDays);
  let current = 0;
  for (let d = set.has(today) ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) current++;
  let longest = 0, run = 0, prev = "";
  for (const d of [...set].sort()) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; longest = Math.max(longest, run); prev = d; }
  return { current, longest };
}
export function habitStreaks(done: Set<string>, days: number[], today: string, startDate: string) {
  const scheduled = (d: string) => days.includes(dow(d));
  let current = 0;
  for (let d = today; d >= startDate; d = addDays(d, -1)) {
    if (!scheduled(d)) continue;
    if (!done.has(d)) break;
    current++;
  }
  let longest = 0, run = 0;
  for (let d = startDate; d <= today; d = addDays(d, 1)) {
    if (!scheduled(d)) continue;
    run = done.has(d) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { current, longest };
}
