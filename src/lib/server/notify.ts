import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, habits, habitLogs, notifications, pushSubscriptions, tasks } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import type { Authed, DbUser } from "./auth";
import type { Prefs } from "@/lib/prefs";

type NotifyContext = Authed | { user: DbUser; id: string; tz: string; prefs: Prefs };
type PushMessage = { title: string; body: string; href?: string };

export function pushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function inQuietHours(now: string, start: string, end: string) {
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

export async function generateNotifications(context: NotifyContext) {
  const { id, tz, prefs } = context;
  if (!prefs.notifications.inApp) return [];
  const today = todayIn(tz);
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  if (inQuietHours(now, prefs.notifications.quietStart, prefs.notifications.quietEnd)) return [];

  const [dueTasks, challengeRows, activeHabits, todayLogs] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(and(eq(tasks.userId, id), eq(tasks.dueDate, today), inArray(tasks.status, ["todo", "in_progress"]))),
    db.select({ id: dailyChallenges.id, title: dailyChallenges.title, completedAt: dailyChallenges.completedAt }).from(dailyChallenges).where(and(eq(dailyChallenges.userId, id), eq(dailyChallenges.date, today), eq(dailyChallenges.isCustom, false))),
    db.select({ id: habits.id, name: habits.name, days: habits.days, reminderTime: habits.reminderTime }).from(habits).where(and(eq(habits.userId, id), eq(habits.archived, false))),
    db.select({ habitId: habitLogs.habitId }).from(habitLogs).where(and(eq(habitLogs.userId, id), eq(habitLogs.date, today), eq(habitLogs.completed, true))),
  ]);

  const candidates: { kind: string; title: string; body: string; href: string; dedupeKey: string }[] = dueTasks.map((t) => ({
    kind: "task_due", title: "Task due today", body: t.title, href: "/tasks", dedupeKey: "task-due:" + t.id + ":" + today,
  }));
  const challenge = challengeRows.find((c) => !c.completedAt);
  if (challenge) candidates.push({ kind: "challenge", title: "Your daily challenge is waiting", body: challenge.title, href: "/challenge", dedupeKey: "challenge:" + challenge.id });

  const completed = new Set(todayLogs.map((l) => l.habitId));
  const weekday = new Date(today + "T00:00:00Z").getUTCDay();
  for (const habit of activeHabits) {
    if (completed.has(habit.id) || !habit.days.includes(weekday)) continue;
    if (habit.reminderTime && now < habit.reminderTime) continue;
    candidates.push({ kind: "habit", title: "Habit reminder", body: habit.name, href: "/habits", dedupeKey: "habit:" + habit.id + ":" + today });
  }

  if (!candidates.length) return [];
  return db.insert(notifications).values(candidates.map((c) => ({ userId: id, ...c }))).onConflictDoNothing().returning();
}

export async function sendPush(userId: string, message: PushMessage): Promise<number> {
  if (!pushConfigured()) return 0;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
        title: message.title,
        body: message.body,
        url: message.href ?? "/dashboard",
      }));
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.id, sub.id), eq(pushSubscriptions.userId, userId)));
      else console.error("[push] Delivery failed:", error);
    }
  }
  return sent;
}
