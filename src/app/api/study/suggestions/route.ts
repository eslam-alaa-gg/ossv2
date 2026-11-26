import { and, asc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { dailyStudySuggestionDecisions, flashcards, studySubjects, tasks } from "@/db/schema";
import { body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { todayIn, weekStart } from "@/lib/dates";
import { activityByDay } from "@/lib/server/stats";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const auth = await requireUser();
  const today = todayIn(auth.tz);
  const [taskRows, dueCards, decisions, activity] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, auth.id)),
    db.select({ id: flashcards.id, subjectId: flashcards.subjectId, subjectName: studySubjects.name })
      .from(flashcards)
      .leftJoin(studySubjects, and(eq(flashcards.subjectId, studySubjects.id), eq(studySubjects.userId, auth.id)))
      .where(and(eq(flashcards.userId, auth.id), lte(flashcards.dueAt, new Date())))
      .orderBy(asc(flashcards.dueAt))
      .limit(500),
    db.select().from(dailyStudySuggestionDecisions)
      .where(and(eq(dailyStudySuggestionDecisions.userId, auth.id), eq(dailyStudySuggestionDecisions.date, today))),
    activityByDay(auth.id, auth.tz, weekStart(today), today, auth.user.dailyGoal),
  ]);
  const focusMinutesThisWeek = Object.values(activity).reduce((sum, day) => sum + day.focusMinutes, 0);

  const decisionMap = new Map(decisions.map((item) => [item.suggestionKey, item.status]));
  const openTasks = taskRows
    .filter((task) => task.status !== "completed" && task.status !== "archived")
    .filter((task) => task.category.toLowerCase() === "study" || task.tags.includes("study"))
    .sort((a, b) => {
      const priority = (value: string) => ((({ urgent: 4, high: 3, medium: 2, low: 1 }) as Record<string, number>)[value] ?? 0);
      const urgency = (value: string | null) => value ? Math.max(-30, 14 - Math.round((new Date(value + "T12:00:00Z").getTime() - Date.now()) / 86400000)) : -50;
      return priority(b.priority) * 10 + urgency(b.dueDate) - (priority(a.priority) * 10 + urgency(a.dueDate));
    });

  const suggestions: Array<{ key: string; kind: "task" | "review"; title: string; description: string; minutes: number; taskId?: string; subjectId?: string | null; count?: number; status: string | null }> = [];
  const nextTask = openTasks[0];
  if (nextTask) {
    const isOverdue = !!nextTask.dueDate && nextTask.dueDate < today;
    const isDueToday = nextTask.dueDate === today;
    suggestions.push({
      key: "task:" + nextTask.id,
      kind: "task",
      title: nextTask.title,
      description: isOverdue ? "Overdue — make this your first study block." : isDueToday ? "Due today — a focused session will help you make progress." : nextTask.priority === "urgent" || nextTask.priority === "high" ? "High priority — give this task a focused block." : "Your next open study task, based on priority and deadline.",
      minutes: focusMinutesThisWeek < 60 ? 30 : focusMinutesThisWeek > 300 ? 20 : nextTask.priority === "urgent" || nextTask.priority === "high" ? 30 : 25,
      taskId: nextTask.id,
      status: decisionMap.get("task:" + nextTask.id) ?? null,
    });
  }

  const subjectGroups = new Map<string, { subjectId: string | null; subjectName: string | null; count: number }>();
  for (const card of dueCards) {
    const key = card.subjectId ?? "general";
    const group = subjectGroups.get(key) ?? { subjectId: card.subjectId, subjectName: card.subjectName, count: 0 };
    group.count += 1;
    subjectGroups.set(key, group);
  }
  const reviewGroup = [...subjectGroups.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (reviewGroup) {
    const key = "review:" + reviewGroup[0];
    suggestions.push({
      key,
      kind: "review",
      title: reviewGroup[1].subjectName ? "Review " + reviewGroup[1].subjectName : "Clear your general review queue",
      description: reviewGroup[1].count + " card" + (reviewGroup[1].count === 1 ? "" : "s") + " due. A short recall session will keep your reviews on track.",
      minutes: Math.min(focusMinutesThisWeek > 300 ? 15 : 25, Math.max(10, reviewGroup[1].count * 2)),
      subjectId: reviewGroup[1].subjectId,
      count: reviewGroup[1].count,
      status: decisionMap.get(key) ?? null,
    });
  }

  return { date: today, focusMinutesThisWeek, suggestions };
});

export const POST = handle(async (request) => {
  const auth = await requireUser();
  const input = await body(request, z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    suggestionKey: z.string().trim().min(1).max(120),
    status: z.enum(["accepted", "dismissed"]),
  }));
  const today = todayIn(auth.tz);
  if (input.date !== today) {
    return { ok: false, error: "This daily suggestion has expired. Refresh your study plan." };
  }
  const [decision] = await db.insert(dailyStudySuggestionDecisions).values({
    userId: auth.id,
    date: today,
    suggestionKey: input.suggestionKey,
    status: input.status,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [dailyStudySuggestionDecisions.userId, dailyStudySuggestionDecisions.date, dailyStudySuggestionDecisions.suggestionKey],
    set: { status: input.status, updatedAt: new Date() },
  }).returning();
  return { ok: true, decision };
});
