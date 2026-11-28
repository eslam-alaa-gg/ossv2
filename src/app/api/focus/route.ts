import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { focusSessions, tasks } from "@/db/schema";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { ownTask } from "@/lib/server/own";
import { activityByDay } from "@/lib/server/stats";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  const today = todayIn(a.tz);
  const ws = weekStart(today);
  const act = await activityByDay(a.id, a.tz, ws, today, a.user.dailyGoal);
  const todayMin = act[today]?.focusMinutes ?? 0;
  const weekMin = Object.values(act).reduce((s, d) => s + d.focusMinutes, 0);
  const sessions = await db
    .select({ s: focusSessions, taskTitle: tasks.title })
    .from(focusSessions)
    .leftJoin(tasks, eq(tasks.id, focusSessions.taskId))
    .where(and(eq(focusSessions.userId, a.id), sql`${focusSessions.status} not in ('running', 'paused')`))
    .orderBy(desc(focusSessions.startedAt))
    .limit(15);
  const [running] = await db.select().from(focusSessions).where(and(eq(focusSessions.userId, a.id), inArray(focusSessions.status, ["running", "paused"]))).limit(1);
  const total = (await db.execute(sql`select count(*)::int c from ossv2.focus_sessions where user_id=${a.id} and status='completed' and mode in ('focus','custom')`)).rows[0] as { c: number };
  const pending = await db.select({ id: tasks.id, title: tasks.title, priority: tasks.priority }).from(tasks).where(and(eq(tasks.userId, a.id), sql`${tasks.status} in ('todo','in_progress')`)).limit(100);
  void addDays;
  return {
    todayMinutes: todayMin,
    weekMinutes: weekMin,
    totalSessions: total.c,
    sessions: sessions.map((r) => ({ ...r.s, taskTitle: r.taskTitle })),
    running: running ? { ...running, serverNow: Date.now() } : null,
    tasks: pending,
  };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const d = await body(req, z.object({ mode: z.enum(["focus", "short_break", "long_break", "custom"]), minutes: z.number().int().min(1).max(10080), taskId: z.string().uuid().nullable().default(null) }));
  if (d.taskId) await ownTask(a, d.taskId);
  // Serialize session starts per user and keep closing the previous session
  // plus creating the replacement atomic. This prevents concurrent starts from
  // leaving multiple active sessions or closing the old one if insertion fails.
  const session = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${a.id}))`);
    await tx.update(focusSessions)
      .set({ status: "ended", endedAt: new Date(), actualSeconds: 0 })
      .where(and(eq(focusSessions.userId, a.id), inArray(focusSessions.status, ["running", "paused"])));
    const [created] = await tx.insert(focusSessions).values({
      userId: a.id,
      mode: d.mode,
      taskId: d.taskId,
      plannedSeconds: d.minutes * 60,
    }).returning();
    return created;
  });
  return { session, serverNow: Date.now() };
});
