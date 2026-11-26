import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";
import { award, evaluateAchievements, XP_HABIT } from "./rewards";
import type { Authed } from "./auth";

/** Upsert a habit log; reward only the first time that habit/day is completed. */
export async function setHabitAmount(a: Authed, habit: typeof habits.$inferSelect, date: string, amount: number) {
  // Progress is capped at the target. Tracker entries (water, pages, learning) keep their real values.
  amount = Math.max(0, Math.min(100000, habit.target, Math.round(amount)));
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

/** Today's real tracker total for each special habit kind. */
export async function trackerProgress(userId: string, kind: "water" | "reading" | "learning", date: string, exec: Pick<typeof db, "execute"> = db) {
  const query =
    kind === "water" ? sql`select coalesce(sum(ml),0)::int v from ossv2.water_logs where user_id=${userId} and date=${date}::date`
    : kind === "reading" ? sql`select coalesce(sum(pages),0)::int v from ossv2.reading_logs where user_id=${userId} and date=${date}::date`
    : sql`select count(*)::int v from ossv2.learning_entries where user_id=${userId} and date=${date}::date`;
  return Number((await exec.execute(query)).rows[0].v);
}

/** Water / reading / learning trackers drive their linked habits from real log rows. */
export async function syncSpecialHabit(a: Authed, kind: "water" | "reading" | "learning", date: string) {
  const hs = await db.select().from(habits).where(and(eq(habits.userId, a.id), eq(habits.kind, kind), eq(habits.archived, false)));
  if (!hs.length) return;
  const progress = await trackerProgress(a.id, kind, date);
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
  { key: "yoga", name: "Yoga", icon: "flower-2", kind: "standard", target: 1, unit: "", description: "Take a mindful movement break." },
  { key: "cycle", name: "Cycling", icon: "bike", kind: "standard", target: 1, unit: "", description: "Go for a bike ride." },
  { key: "journal", name: "Write in Journal", icon: "notebook-pen", kind: "standard", target: 1, unit: "", description: "Write a short journal entry." },
  { key: "plan", name: "Plan the Day", icon: "calendar-check", kind: "standard", target: 1, unit: "", description: "Choose a few priorities for today." },
  { key: "study", name: "Study Session", icon: "graduation-cap", kind: "standard", target: 1, unit: "", description: "Complete a focused study session." },
  { key: "review", name: "Review Notes", icon: "notebook-tabs", kind: "standard", target: 1, unit: "", description: "Review your notes." },
  { key: "language", name: "Practice a Language", icon: "languages", kind: "standard", target: 1, unit: "", description: "Practise a language skill." },
  { key: "tidy", name: "Tidy Workspace", icon: "clipboard-check", kind: "standard", target: 1, unit: "", description: "Reset your desk or study space." },
  { key: "gratitude", name: "Gratitude Journal", icon: "heart-handshake", kind: "standard", target: 1, unit: "", description: "Write down something you appreciate." },
] as const;
