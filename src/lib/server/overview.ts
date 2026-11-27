import "server-only";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, focusSessions, goals, habitLogs, habits, tasks, userAchievements, xpTransactions } from "@/db/schema";
import { addDays, dow, todayIn, weekStart } from "@/lib/dates";
import type { Authed } from "./auth";
import { todaysChallenges } from "./challenges";
import { activityByDay, computeStreaks } from "./stats";
import { ACHIEVEMENTS } from "./rewards";

export function weeklyStreak(activeDays: string[], today: string) {
 const active = new Set(activeDays);
 let weeks = 0;
 let start = weekStart(today);
 for (let i=0;i<104;i++) {
  let hit=false;
  for(let d=0;d<7;d++) if(active.has(addDays(start,d))) hit=true;
  if(!hit) break;
  weeks++; start=addDays(start,-7);
 }
 return weeks;
}
export async function recentXp(a: Authed, limit=20) {
 return db.select().from(xpTransactions).where(eq(xpTransactions.userId,a.id)).orderBy(desc(xpTransactions.createdAt)).limit(limit);
}
export async function dashboardData(a: Authed) {
 const today=todayIn(a.tz), ws=weekStart(today), we=addDays(ws,6);
 const [todayTasks, openTasks, overdueTasks, upcoming, hs, logs, challenge, act, xpRows, achRows, totalXpRows, allActivity] = await Promise.all([
  db.select().from(tasks).where(and(eq(tasks.userId,a.id),eq(tasks.status,"completed"),gte(tasks.completedAt,new Date(addDays(today,-1)+"T00:00:00Z")),lte(tasks.completedAt,new Date(addDays(today,1)+"T23:59:59.999Z")))),
  db.select().from(tasks).where(and(eq(tasks.userId,a.id),sql`${tasks.status} in ('todo','in_progress')`)),
  db.select({id:tasks.id}).from(tasks).where(and(eq(tasks.userId,a.id),sql`${tasks.status} in ('todo','in_progress')`,lte(tasks.dueDate,addDays(today,-1)))),
  db.select({id:tasks.id,title:tasks.title,dueDate:tasks.dueDate,dueTime:tasks.dueTime,priority:tasks.priority}).from(tasks).where(and(eq(tasks.userId,a.id),sql`${tasks.status} in ('todo','in_progress')`,gte(tasks.dueDate,today),lte(tasks.dueDate,addDays(today,7)))).orderBy(tasks.dueDate).limit(8),
  db.select().from(habits).where(and(eq(habits.userId,a.id),eq(habits.archived,false))),
  db.select().from(habitLogs).where(and(eq(habitLogs.userId,a.id),eq(habitLogs.date,today),eq(habitLogs.completed,true))),
  todaysChallenges(a),
  activityByDay(a.id,a.tz,ws,today,a.user.dailyGoal),
  db.select().from(xpTransactions).where(eq(xpTransactions.userId,a.id)).orderBy(desc(xpTransactions.createdAt)).limit(5),
  db.select().from(userAchievements).where(eq(userAchievements.userId,a.id)).orderBy(desc(userAchievements.unlockedAt)).limit(5),
  db.execute(sql`select coalesce(sum(xp),0)::int total from ossv2.xp_transactions where user_id=${a.id}`),
  activityByDay(a.id,a.tz,addDays(today,-400),today,a.user.dailyGoal),
 ]);
 const scheduled=hs.filter(h=>h.days.includes(dow(today)));
 const doneIds=new Set(logs.map(l=>l.habitId));
 const habitsDone=scheduled.filter(h=>doneIds.has(h.id));
 const score=act[today]?.score??0;
 const week=Array.from({length:7},(_,i)=>{const date=addDays(ws,i);const d=act[date];return {date,score:d?.score??0,level:d?.level??0};});
 const activeDays=Object.values(allActivity).filter(d=>d.score>0).map(d=>d.date);
 const streak=computeStreaks(activeDays,today);
 const totalXp=Number((totalXpRows.rows[0] as {total:number}|undefined)?.total??0);
 const level=Math.floor(totalXp/100)+1, span=100, into=totalXp%span;
 const recent=achRows.map(row=>{const a=ACHIEVEMENTS.find(x=>x.key===row.key);return a?{key:a.key,title:a.title,desc:a.desc,xp:a.xp}:{key:row.key,title:row.key,desc:"Achievement unlocked",xp:0};});
 const challengeToday=challenge[0]??null;
 const weekValues=Object.values(act);
 return {
  today,score,dailyGoal:a.user.dailyGoal,completedToday:todayTasks.filter(t=>t.completedAt && todayIn(a.tz,t.completedAt)===today).length,remaining:openTasks.filter(t=>t.dueDate===today).length,overdue:overdueTasks.length,openTotal:openTasks.length,
  habits:{done:habitsDone.length,total:scheduled.length,list:scheduled.map(h=>({id:h.id,name:h.name,icon:h.icon,target:h.target,done:doneIds.has(h.id)}))},
  challenge:challengeToday?{id:challengeToday.id,title:challengeToday.title,minutes:challengeToday.minutes,xp:challengeToday.xp,difficulty:challengeToday.difficulty,completedAt:challengeToday.completedAt?.toISOString()??null}:null,
  streak,weeklyStreak:weeklyStreak(activeDays,today),focusMinutes:act[today]?.focusMinutes??0,weekFocusMinutes:weekValues.reduce((s,d)=>s+d.focusMinutes,0),
  week,weekTasks:weekValues.reduce((s,d)=>s+d.tasks,0),weekHabits:weekValues.reduce((s,d)=>s+d.habits,0),
  upcoming:upcoming.filter(t=>t.dueDate).map(t=>({...t,dueDate:t.dueDate!})),
  xp:totalXp,level:{level,into,span},recent,
 };
}
