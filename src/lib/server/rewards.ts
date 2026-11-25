import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, focusSessions, goals, habitLogs, tasks, userAchievements, xpTransactions } from "@/db/schema";
import { addDays, todayIn } from "@/lib/dates";
import { activityByDay, computeStreaks } from "./stats";

export const XP_TASK: Record<string, number> = { low: 10, medium: 15, high: 20, urgent: 25 };
export const XP_HABIT = 5, XP_GOAL = 50, XP_MILESTONE = 20;
export const ACHIEVEMENTS = [
 { key:"first_task", title:"First Step", desc:"Complete your first task.", metric:"tasks", target:1, xp:10 },
 { key:"task_10", title:"Getting Things Done", desc:"Complete 10 tasks.", metric:"tasks", target:10, xp:25 },
 { key:"task_50", title:"Task Master", desc:"Complete 50 tasks.", metric:"tasks", target:50, xp:75 },
 { key:"habit_7", title:"Building a Routine", desc:"Complete 7 habit check-ins.", metric:"habits", target:7, xp:25 },
 { key:"habit_30", title:"Consistency", desc:"Complete 30 habit check-ins.", metric:"habits", target:30, xp:75 },
 { key:"focus_5", title:"Deep Focus", desc:"Finish 5 focus sessions.", metric:"focus", target:5, xp:30 },
 { key:"goal_1", title:"Goal Setter", desc:"Complete a goal.", metric:"goals", target:1, xp:30 },
 { key:"challenge_5", title:"Challenge Accepted", desc:"Complete 5 daily challenges.", metric:"challenges", target:5, xp:30 },
 { key:"streak_7", title:"One Week Strong", desc:"Reach a 7-day activity streak.", metric:"streak", target:7, xp:50 },
] as const;

export async function award(userId: string, source: string, sourceId: string, xp: number, label: string) {
 const [row] = await db.insert(xpTransactions).values({ userId, source, sourceId, xp, label }).onConflictDoNothing().returning({ id: xpTransactions.id });
 return row ? xp : 0;
}
export async function metricsFor(userId: string, tz: string, dailyGoal: number) {
 const [taskCount, habitCount, focusCount, goalCount, challengeCount] = await Promise.all([
  db.select({ n: count() }).from(tasks).where(and(eq(tasks.userId,userId),eq(tasks.status,"completed"))),
  db.select({ n: count() }).from(habitLogs).where(and(eq(habitLogs.userId,userId),eq(habitLogs.completed,true))),
  db.select({ n: count() }).from(focusSessions).where(and(eq(focusSessions.userId,userId),eq(focusSessions.status,"completed"),sql`${focusSessions.mode} in ('focus','custom')`)),
  db.select({ n: count() }).from(goals).where(and(eq(goals.userId,userId),eq(goals.status,"completed"))),
  db.select({ n: count() }).from(dailyChallenges).where(and(eq(dailyChallenges.userId,userId),sql`${dailyChallenges.completedAt} is not null`)),
 ]);
 const today = todayIn(tz);
 const days = await activityByDay(userId,tz,addDays(today,-400),today,dailyGoal);
 const streak = computeStreaks(Object.values(days).filter(d=>d.score>0).map(d=>d.date),today);
 return { tasks:Number(taskCount[0]?.n??0), habits:Number(habitCount[0]?.n??0), focus:Number(focusCount[0]?.n??0), goals:Number(goalCount[0]?.n??0), challenges:Number(challengeCount[0]?.n??0), streak:streak.longest };
}
export async function evaluateAchievements(userId: string, tz: string, dailyGoal: number) {
 const metrics = await metricsFor(userId,tz,dailyGoal);
 const existing = await db.select({key:userAchievements.key}).from(userAchievements).where(eq(userAchievements.userId,userId));
 const owned = new Set(existing.map(x=>x.key));
 const unlocked:string[]=[];
 for (const a of ACHIEVEMENTS) {
  if (metrics[a.metric] >= a.target && !owned.has(a.key)) {
   const [row] = await db.insert(userAchievements).values({userId,key:a.key}).onConflictDoNothing().returning({key:userAchievements.key});
   if (row) { unlocked.push(a.key); await award(userId,"achievement",a.key,a.xp,`Achievement: ${a.title}`); }
  }
 }
 return unlocked;
}
