import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { goals, habits, notes, tasks } from "@/db/schema";
import { handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const a = await requireUser();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/[%_]/g, "").slice(0, 60);
  if (q.length < 2) return { results: [] };
  const like = `%${q}%`;
  const [t, n, g, h] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(and(eq(tasks.userId, a.id), ilike(tasks.title, like))).orderBy(desc(tasks.createdAt)).limit(5),
    db.select({ id: notes.id, title: notes.title, content: notes.content }).from(notes).where(and(eq(notes.userId, a.id), or(ilike(notes.title, like), ilike(notes.content, like)))).limit(5),
    db.select({ id: goals.id, title: goals.title }).from(goals).where(and(eq(goals.userId, a.id), ilike(goals.title, like))).limit(5),
    db.select({ id: habits.id, title: habits.name }).from(habits).where(and(eq(habits.userId, a.id), ilike(habits.name, like))).limit(5),
  ]);
  return {
    results: [
      ...t.map((x) => ({ kind: "Task", title: x.title, href: "/tasks" })),
      ...g.map((x) => ({ kind: "Goal", title: x.title, href: "/goals" })),
      ...h.map((x) => ({ kind: "Habit", title: x.title, href: "/habits" })),
      ...n.map((x) => ({ kind: "Note", title: x.title || x.content.slice(0, 50), href: "/vault" })),
    ],
  };
});
