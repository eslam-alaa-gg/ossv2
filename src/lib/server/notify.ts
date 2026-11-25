import "server-only";
import * as webpush from "web-push";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, habitLogs, habits, notifications, pushSubscriptions, tasks } from "@/db/schema";
import { dow, todayIn } from "@/lib/dates";
import type { Authed } from "./auth";

type NotifyUser = Pick<Authed, "id" | "tz" | "prefs"> & { user?: Authed["user"] };

export function pushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function pushClientReady() {
  if (!pushConfigured()) return false;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    return true;
  } catch (error) {
    console.error("[push] invalid VAPID configuration", error);
    return false;
  }
}

export async function generateNotifications(a: NotifyUser) {
  if (!a.prefs.notifications.inApp && !a.prefs.notifications.push) return [];
  const today = todayIn(a.tz);
  const [openTasks, allHabits, completedHabits, challenges] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, priority: tasks.priority })
      .from(tasks).where(and(eq(tasks.userId, a.id), inArray(tasks.status, ["todo", "in_progress"]), lte(tasks.dueDate, today))).limit(40),
    db.select({ id: habits.id, name: habits.name, days: habits.days })
      .from(habits).where(and(eq(habits.userId, a.id), eq(habits.archived, false))),
    db.select({ habitId: habitLogs.habitId }).from(habitLogs)
      .where(and(eq(habitLogs.userId, a.id), eq(habitLogs.date, today), eq(habitLogs.completed, true))),
    db.select({ id: dailyChallenges.id, title: dailyChallenges.title, completedAt: dailyChallenges.completedAt })
      .from(dailyChallenges).where(and(eq(dailyChallenges.userId, a.id), eq(dailyChallenges.date, today))),
  ]);
  const done = new Set(completedHabits.map((x) => x.habitId));
  const candidates: (typeof notifications.$inferInsert)[] = [];
  for (const task of openTasks) {
    const overdue = !!task.dueDate && task.dueDate < today;
    candidates.push({
      userId: a.id,
      kind: overdue ? "task_overdue" : "task_due",
      title: overdue ? "Task overdue" : "Task due today",
      body: task.title,
      href: "/tasks",
      dedupeKey: `task:${task.id}:${today}`,
    });
  }
  for (const habit of allHabits) {
    if (habit.days.includes(dow(today)) && !done.has(habit.id)) {
      candidates.push({
        userId: a.id,
        kind: "habit_reminder",
        title: "Habit reminder",
        body: `Remember your habit: ${habit.name}`,
        href: "/habits",
        dedupeKey: `habit:${habit.id}:${today}`,
      });
    }
  }
  for (const challenge of challenges) {
    if (!challenge.completedAt) candidates.push({
      userId: a.id,
      kind: "challenge_reminder",
      title: "Daily challenge",
      body: challenge.title,
      href: "/challenge",
      dedupeKey: `challenge:${challenge.id}:${today}`,
    });
  }
  if (!candidates.length) return [];
  return db.insert(notifications).values(candidates).onConflictDoNothing().returning();
}

export async function sendPush(userId: string, notification: typeof notifications.$inferSelect) {
  if (!pushClientReady()) return 0;
  const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let delivered = 0;
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.href || "/dashboard",
    tag: notification.dedupeKey,
  });
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      delivered++;
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.id, sub.id), eq(pushSubscriptions.userId, userId)));
      } else {
        console.error("[push] delivery failed", status || "unknown");
      }
    }
  }
  return delivered;
}
