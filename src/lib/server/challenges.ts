import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import type { Authed } from "./auth";

export type ChallengeTemplate = { key: string; title: string; description: string; difficulty: "easy" | "medium" | "hard"; minutes: number; xp: number };
export const XP_BY_DIFFICULTY = { easy: 20, medium: 35, hard: 60 } as const;

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  { key: "read15", title: "Read for 15 minutes", description: "Pick up a book (not a screen feed) and read without interruption.", difficulty: "easy", minutes: 15, xp: 20 },
  { key: "learn", title: "Learn something new", description: "Pick a topic you know little about and learn one new fact. Write it down.", difficulty: "easy", minutes: 10, xp: 20 },
  { key: "organize", title: "Organize your workspace", description: "Clear your desk, close stale tabs, and prepare tomorrow's setup.", difficulty: "easy", minutes: 15, xp: 20 },
  { key: "important", title: "Complete an important task", description: "Finish the one task that would make today feel like a win.", difficulty: "medium", minutes: 45, xp: 35 },
  { key: "skill", title: "Practice a useful skill", description: "Spend focused time on deliberate practice of a skill you're building.", difficulty: "medium", minutes: 30, xp: 35 },
  { key: "reflect", title: "Write a short reflection", description: "Write a few sentences about your day: what worked, what didn't.", difficulty: "easy", minutes: 10, xp: 20 },
  { key: "deepwork", title: "One deep-work block", description: "Complete a 60-minute focus session on your hardest problem.", difficulty: "hard", minutes: 60, xp: 60 },
  { key: "walk", title: "Take a 20-minute walk", description: "Step away from screens and take a walk — no phone scrolling.", difficulty: "easy", minutes: 20, xp: 20 },
  { key: "plan", title: "Plan tomorrow tonight", description: "List your top 3 priorities for tomorrow and schedule them.", difficulty: "medium", minutes: 15, xp: 35 },
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Ensures exactly one assigned (non-custom) challenge exists for today. */
export async function ensureTodayChallenge(a: Authed) {
  const date = todayIn(a.tz);
  const t = CHALLENGE_TEMPLATES[hash(a.id + date) % CHALLENGE_TEMPLATES.length];
  await db
    .insert(dailyChallenges)
    .values({ userId: a.id, date, templateKey: t.key, title: t.title, description: t.description, difficulty: t.difficulty, minutes: t.minutes, xp: t.xp })
    .onConflictDoNothing();
  return date;
}

export async function todaysChallenges(a: Authed) {
  const date = await ensureTodayChallenge(a);
  return db.select().from(dailyChallenges).where(and(eq(dailyChallenges.userId, a.id), eq(dailyChallenges.date, date)));
}
