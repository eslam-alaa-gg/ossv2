import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";
import { award, evaluateAchievements, XP_HABIT } from "./rewards";
import type { Authed } from "./auth";

/** Upsert a habit log; reward only the first time that habit/day is completed. */
export async function setHabitAmount(a: Authed, habit: typeof habits.$inferSelect, date: string, amount: number) {
  amount = Math.max(0, Math.min(100000, Math.round(amount)));
  if (amount === 0) {
    await db.delete(habitLogs).where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.userId, a.id), eq(habitLogs.date, date)));
    return { amount: 0, completed: false, xp: 0 };
  }
  const completed = amount >= habit.target;
  await db
    .insert(habitLogs)
    .values({ userId: a.id, habitId: habit.id, date, amount, completed })
    .onConflictDoUpdate({ target: [habitLogs.habitId, habitLogs.date], set: { amount, completed } });
  let xp = 0;
  if (completed) {
    xp = await award(a.id, "habit", `${habit.id}:${date}`, XP_HABIT, `Habit: ${habit.name}`);
    await evaluateAchievements(a.id, a.tz, a.user.dailyGoal);
  }
  return { amount, completed, xp };
}

/** Water / reading / learning trackers drive their linked habits from real log rows. */
export async function syncSpecialHabit(a: Authed, kind: "water" | "reading" | "learning", date: string) {
  const hs = await db.select().from(habits).where(and(eq(habits.userId, a.id), eq(habits.kind, kind), eq(habits.archived, false)));
  if (!hs.length) return;
  let progress = 0;
  if (kind === "water") progress = Number((await db.execute(sql`select coalesce(sum(ml),0)::int v from ossv2.water_logs where user_id=${a.id} and date=${date}::date`)).rows[0].v);
  if (kind === "reading") progress = Number((await db.execute(sql`select coalesce(sum(pages),0)::int v from ossv2.reading_logs where user_id=${a.id} and date=${date}::date`)).rows[0].v);
  if (kind === "learning") progress = Number((await db.execute(sql`select count(*)::int v from ossv2.learning_entries where user_id=${a.id} and date=${date}::date`)).rows[0].v);
  for (const h of hs) {
    const eff = kind === "water" ? { ...h, target: a.prefs.waterGoal } : h;
    await setHabitAmount(a, eff, date, progress);
  }
}

export const PREDEFINED_HABITS = [
  { key: "water", name: "Drink Water", icon: "droplets", kind: "water", target: 2000, unit: "ml", description: "Stay hydrated through the day." },
  { key: "read", name: "Read Books", icon: "book-open", kind: "reading", target: 20, unit: "pages", description: "Read a little every day." },
  { key: "learn", name: "Learn Something New", icon: "lightbulb", kind: "learning", target: 1, unit: "entry", description: "Record one thing you learned." },
  { key: "exercise", name: "Exercise", icon: "dumbbell", kind: "standard", target: 1, unit: "", description: "Move your body." },
  { key: "walk", name: "Walk", icon: "footprints", kind: "standard", target: 1, unit: "", description: "Get outside for a walk." },
  { key: "stretch", name: "Stretch", icon: "move", kind: "standard", target: 1, unit: "", description: "A few minutes of stretching." },
  { key: "meditate", name: "Meditation", icon: "flower-2", kind: "standard", target: 1, unit: "", description: "A quiet moment of mindfulness." },
  { key: "sleep", name: "Sleep Routine", icon: "moon", kind: "standard", target: 1, unit: "", description: "Wind down and sleep on schedule." },
  { key: "skill", name: "Practice a Skill", icon: "palette", kind: "standard", target: 1, unit: "", description: "Deliberate practice of something you're building." },
  { key: "screen", name: "Reduce Screen Time", icon: "smartphone", kind: "standard", target: 1, unit: "", description: "Stay under your screen-time intention." },
] as const;
