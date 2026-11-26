import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { goalMilestones, goals, habitLogs, habits, learningEntries } from "@/db/schema";
import { addDays, diffDays, dow, todayIn, weekStart } from "@/lib/dates";
import { handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { weeklyStreak } from "@/lib/server/overview";
import { SCORE, activityByDay, computeStreaks, emptyDay } from "@/lib/server/stats";

export const dynamic = "force-dynamic";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const GET = handle(async (req) => {
  const a = await requireUser();
  const today = todayIn(a.tz);
  const y = Number(req.nextUrl.searchParams.get("year")) || Number(today.slice(0, 4));
  const year = Math.min(Math.max(y, 2000), Number(today.slice(0, 4)) + 1);
  const goal = a.user.dailyGoal;
  const yearAct = await activityByDay(a.id, a.tz, `${year}-01-01`, `${year}-12-31`, goal);
  const recent = await activityByDay(a.id, a.tz, addDays(today, -400), today, goal);
  const [learningYearRows, learningRecentRows] = await Promise.all([
    db.select({ date: learningEntries.date }).from(learningEntries).where(and(eq(learningEntries.userId, a.id), gte(learningEntries.date, `${year}-01-01`), lte(learningEntries.date, `${year}-12-31`))),
    db.select({ date: learningEntries.date }).from(learningEntries).where(and(eq(learningEntries.userId, a.id), gte(learningEntries.date, addDays(today, -29)), lte(learningEntries.date, today))),
  ]);
  const learningByDay = new Map<string, number>();
  for (const entry of learningRecentRows) learningByDay.set(String(entry.date), (learningByDay.get(String(entry.date)) ?? 0) + 1);
  const get = (d: string) => recent[d] ?? emptyDay(d);
  const activeAll = Object.values(recent).filter((d) => d.score > 0).map((d) => d.date);
  const streak = computeStreaks(activeAll, today);
  const yr = Object.values(yearAct);
  const sum = (k: "tasks" | "habits" | "challenges" | "focus" | "focusMinutes" | "score") => yr.reduce((s, d) => s + d[k], 0);
  const best = [...yr].sort((x, z) => z.score - x.score)[0];
  const trend = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(today, i - 29);
    return { date: d, score: get(d).score, tasks: get(d).tasks, habits: get(d).habits, focusMinutes: get(d).focusMinutes, learningEntries: learningByDay.get(d) ?? 0 };
  });
  const ws = weekStart(today);
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const s = addDays(ws, (i - 11) * 7);
    let score = 0, tasks = 0, focus = 0;
    for (let j = 0; j < 7; j++) { const d = get(addDays(s, j)); score += d.score; tasks += d.tasks; focus += d.focusMinutes; }
    return { week: s, score, tasks, focusMinutes: focus };
  });
  const months = Array.from({ length: 12 }, (_, m) => {
    const p = `${year}-${String(m + 1).padStart(2, "0")}`;
    const days = yr.filter((d) => d.date.startsWith(p));
    return { month: p, score: days.reduce((s, d) => s + d.score, 0), tasks: days.reduce((s, d) => s + d.tasks, 0), learningEntries: learningYearRows.filter((entry) => String(entry.date).startsWith(p)).length };
  });
  const hs = await db.select().from(habits).where(and(eq(habits.userId, a.id), eq(habits.archived, false)));
  const logs = await db.select().from(habitLogs).where(and(eq(habitLogs.userId, a.id), eq(habitLogs.completed, true), gte(habitLogs.date, addDays(today, -29))));
  const habitConsistency = hs.map((h) => {
    const start = h.startDate > addDays(today, -29) ? h.startDate : addDays(today, -29);
    let sched = 0;
    for (let d = start; d <= today; d = addDays(d, 1)) if (h.days.includes(dow(d))) sched++;
    const done = logs.filter((l) => l.habitId === h.id).length;
    return { name: h.name, done, scheduled: sched, pct: sched ? Math.min(100, Math.round((100 * done) / sched)) : 0 };
  });
  const gs = await db.select().from(goals).where(eq(goals.userId, a.id));
  const ms = await db.select().from(goalMilestones).where(eq(goalMilestones.userId, a.id));
  const goalProgress = gs.filter((g) => g.status !== "paused").map((g) => {
    const m = ms.filter((x) => x.goalId === g.id);
    return { title: g.title, status: g.status, progress: m.length ? Math.round((100 * m.filter((x) => x.completedAt).length) / m.length) : g.status === "completed" ? 100 : g.manualProgress };
  });
  // honest insights: only when enough real data exists
  const insights: string[] = [];
  const act30 = trend.filter((d) => d.score > 0);
  const firstDay = activeAll.sort()[0];
  if (!firstDay || diffDays(today, firstDay) < 6 || activeAll.length < 5) insights.push("Not enough activity yet for trends — insights appear once you have at least 5 active days across a week.");
  else {
    const byDow = Array.from({ length: 7 }, () => ({ s: 0, n: 0 }));
    for (const d of activeAll) { const k = dow(d); byDow[k].s += get(d).score; byDow[k].n++; }
    const bestDow = byDow.map((v, i) => ({ i, avg: v.n ? v.s / v.n : 0, n: v.n })).filter((v) => v.n >= 2).sort((p, q) => q.avg - p.avg)[0];
    if (bestDow) insights.push(`Your highest average activity is on ${DAYS[bestDow.i]}s (${bestDow.avg.toFixed(1)} points, from ${bestDow.n} active days).`);
    const last = weeks[11].score, prevW = weeks[10].score;
    if (prevW > 0) insights.push(`This week's score is ${last >= prevW ? "up" : "down"} ${Math.abs(Math.round(((last - prevW) / prevW) * 100))}% vs last week (${last} vs ${prevW} points).`);
    insights.push(`You were active on ${act30.length} of the last 30 days.`);
    const top = [...habitConsistency].sort((p, q) => q.pct - p.pct)[0];
    if (top && top.scheduled >= 3) insights.push(`Most consistent habit (30 days): ${top.name} at ${top.pct}%.`);
  }
  return {
    year,
    today,
    dailyGoal: goal,
    scoring: SCORE,
    heatmap: yr.map((d) => ({ date: d.date, score: d.score, level: d.level, tasks: d.tasks, habits: d.habits, challenges: d.challenges, focus: d.focus, focusMinutes: d.focusMinutes, milestones: d.milestones })),
    annual: { activeDays: yr.filter((d) => d.score > 0).length, score: sum("score"), tasks: sum("tasks"), habits: sum("habits"), challenges: sum("challenges"), focusMinutes: sum("focusMinutes"), learningEntries: learningYearRows.length, bestDay: best && best.score > 0 ? { date: best.date, score: best.score } : null, goalDays: yr.filter((d) => d.level === 4).length },
    streak: { ...streak, weekly: weeklyStreak(activeAll, today) },
    today30: { daily: get(today).score, weekly: weeks[11].score, monthly: trend.reduce((s, d) => s + d.score, 0) },
    trend,
    weeks,
    months,
    habitConsistency,
    goalProgress,
    goalsCompleted: gs.filter((g) => g.status === "completed").length,
    goalsTotal: gs.length,
    insights,
  };
});
