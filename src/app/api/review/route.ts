import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { goalMilestones, goals, tasks, userAchievements, weeklyReviews } from "@/db/schema";
import { addDays, isDateStr, todayIn, weekStart } from "@/lib/dates";
import { body, handle } from "@/lib/server/api";
import { requireUser, type Authed } from "@/lib/server/auth";
import { ACHIEVEMENTS } from "@/lib/server/rewards";
import { activityByDay } from "@/lib/server/stats";

export const dynamic = "force-dynamic";
const PRI: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

async function stats(a: Authed, ws: string) {
  const we = addDays(ws, 6);
  const act = await activityByDay(a.id, a.tz, ws, we, a.user.dailyGoal);
  const days = Array.from({ length: 7 }, (_, i) => act[addDays(ws, i)] ?? { date: addDays(ws, i), tasks: 0, habits: 0, challenges: 0, focus: 0, milestones: 0, focusMinutes: 0, score: 0, level: 0 });
  const sum = (k: "tasks" | "habits" | "challenges" | "focusMinutes" | "score" | "milestones") => days.reduce((s, d) => s + d[k], 0);
  return { weekStart: ws, weekEnd: we, days, tasks: sum("tasks"), habits: sum("habits"), challenges: sum("challenges"), focusMinutes: sum("focusMinutes"), milestonesDone: sum("milestones"), score: sum("score") };
}

export const GET = handle(async (req) => {
  const a = await requireUser();
  const today = todayIn(a.tz);
  const p = req.nextUrl.searchParams.get("week");
  const ws = weekStart(isDateStr(p) ? p : today);
  const we = addDays(ws, 6);
  const cur = await stats(a, ws);
  const prev = await stats(a, addDays(ws, -7));
  const incomplete = (await db.execute(sql`select count(*)::int c from ossv2.tasks where user_id=${a.id} and due_date between ${ws}::date and ${we}::date and status in ('todo','in_progress')`)).rows[0] as { c: number };
  const habitRows = (await db.execute(sql`select h.name, count(*)::int c from ossv2.habit_logs l join ossv2.habits h on h.id=l.habit_id where l.user_id=${a.id} and l.completed and l.date between ${ws}::date and ${we}::date group by h.name order by c desc limit 1`)).rows as { name: string; c: number }[];
  const inWeek = (d: Date | null) => {
    if (!d) return false;
    const s = todayIn(a.tz, d);
    return s >= ws && s <= we;
  };
  const done = (await db.select().from(tasks).where(and(eq(tasks.userId, a.id), sql`completed_at >= (${ws}::date - 1) and completed_at < (${we}::date + 2)`))).filter((t) => inWeek(t.completedAt));
  const important = done.sort((x, y) => PRI[y.priority] - PRI[x.priority])[0] ?? null;
  const ach = (await db.select().from(userAchievements).where(eq(userAchievements.userId, a.id))).filter((u) => inWeek(u.unlockedAt)).map((u) => ACHIEVEMENTS.find((x) => x.key === u.key)).filter(Boolean).sort((x, y) => y!.xp - x!.xp);
  const ms = (await db.select().from(goalMilestones).where(and(eq(goalMilestones.userId, a.id), sql`completed_at is not null`))).filter((m) => inWeek(m.completedAt));
  const best = [...cur.days].sort((x, y) => y.score - x.score)[0];
  const active = await db.select().from(goals).where(and(eq(goals.userId, a.id), eq(goals.status, "active")));
  const allMs = await db.select().from(goalMilestones).where(eq(goalMilestones.userId, a.id));
  const goalProg = active.map((g) => {
    const m = allMs.filter((x) => x.goalId === g.id);
    return { id: g.id, title: g.title, progress: m.length ? Math.round((100 * m.filter((x) => x.completedAt).length) / m.length) : g.manualProgress };
  });
  const [saved] = await db.select().from(weeklyReviews).where(and(eq(weeklyReviews.userId, a.id), eq(weeklyReviews.weekStart, ws))).limit(1);
  const history = await db.select({ weekStart: weeklyReviews.weekStart, reflections: weeklyReviews.reflections, intentions: weeklyReviews.intentions }).from(weeklyReviews).where(eq(weeklyReviews.userId, a.id)).orderBy(desc(weeklyReviews.weekStart)).limit(20);
  const nextTasks = await db.select({ id: tasks.id, title: tasks.title, priority: tasks.priority, dueDate: tasks.dueDate }).from(tasks).where(and(eq(tasks.userId, a.id), inArray(tasks.status, ["todo", "in_progress"]))).limit(60);
  return {
    ...cur,
    prev: { tasks: prev.tasks, habits: prev.habits, challenges: prev.challenges, focusMinutes: prev.focusMinutes, score: prev.score },
    incomplete: incomplete.c,
    highlights: {
      productiveDay: best && best.score > 0 ? { date: best.date, score: best.score } : null,
      habit: habitRows[0] ?? null,
      achievement: ach[0] ? { title: ach[0]!.title, xp: ach[0]!.xp } : null,
      task: important ? { title: important.title, priority: important.priority } : null,
      milestones: ms.map((m) => m.title),
    },
    goalProgress: goalProg,
    saved: saved ?? null,
    history,
    planning: { goals: goalProg, tasks: nextTasks },
    isCurrent: ws === weekStart(today),
  };
});

export const PUT = handle(async (req) => {
  const a = await requireUser();
  const d = await body(
    req,
    z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reflections: z.record(z.enum(["well", "learned", "challenged", "improve", "proud"]), z.string().max(3000)),
      intentions: z.string().max(3000).default(""),
      priorityGoalIds: z.array(z.string().uuid()).max(10).default([]),
      priorityTaskIds: z.array(z.string().uuid()).max(20).default([]),
    }),
  );
  const ws = weekStart(d.weekStart);
  // only keep ids the user actually owns
  const g = d.priorityGoalIds.length ? await db.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, a.id), inArray(goals.id, d.priorityGoalIds))) : [];
  const t = d.priorityTaskIds.length ? await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, a.id), inArray(tasks.id, d.priorityTaskIds))) : [];
  const vals = { reflections: d.reflections, intentions: d.intentions, priorityGoalIds: g.map((x) => x.id), priorityTaskIds: t.map((x) => x.id), updatedAt: new Date() };
  const [r] = await db.insert(weeklyReviews).values({ userId: a.id, weekStart: ws, ...vals }).onConflictDoUpdate({ target: [weeklyReviews.userId, weeklyReviews.weekStart], set: vals }).returning();
  return { review: r };
});
