import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { handle } from "@/lib/server/api";
import { publicUser, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Exports ONLY the signed-in user's own data (every query is filtered by the session user id).
export const GET = handle(async () => {
  const a = await requireUser();
  const own = <T extends { userId: unknown }>(t: T) => t;
  void own;
  const data = {
    exportedAt: new Date().toISOString(),
    profile: publicUser(a.user),
    preferences: a.prefs,
    tasks: await db.select().from(s.tasks).where(eq(s.tasks.userId, a.id)),
    habits: await db.select().from(s.habits).where(eq(s.habits.userId, a.id)),
    habitLogs: await db.select().from(s.habitLogs).where(eq(s.habitLogs.userId, a.id)),
    waterLogs: await db.select().from(s.waterLogs).where(eq(s.waterLogs.userId, a.id)),
    readingLogs: await db.select().from(s.readingLogs).where(eq(s.readingLogs.userId, a.id)),
    learningEntries: await db.select().from(s.learningEntries).where(eq(s.learningEntries.userId, a.id)),
    challenges: await db.select().from(s.dailyChallenges).where(eq(s.dailyChallenges.userId, a.id)),
    goals: await db.select().from(s.goals).where(eq(s.goals.userId, a.id)),
    milestones: await db.select().from(s.goalMilestones).where(eq(s.goalMilestones.userId, a.id)),
    focusSessions: await db.select().from(s.focusSessions).where(eq(s.focusSessions.userId, a.id)),
    notes: await db.select().from(s.notes).where(eq(s.notes.userId, a.id)),
    journal: await db.select().from(s.journalEntries).where(eq(s.journalEntries.userId, a.id)),
    wishlist: await db.select().from(s.wishlistItems).where(eq(s.wishlistItems.userId, a.id)),
    achievements: await db.select().from(s.userAchievements).where(eq(s.userAchievements.userId, a.id)),
    xp: await db.select().from(s.xpTransactions).where(eq(s.xpTransactions.userId, a.id)),
    weeklyReviews: await db.select().from(s.weeklyReviews).where(eq(s.weeklyReviews.userId, a.id)),
  };
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="life-os-export.json"' } });
});
