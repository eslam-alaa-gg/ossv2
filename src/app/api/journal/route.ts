import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  const entries = await db.select().from(journalEntries).where(eq(journalEntries.userId, a.id)).orderBy(desc(journalEntries.date)).limit(60);
  return { entries, today: todayIn(a.tz) };
});

export const PUT = handle(async (req) => {
  const a = await requireUser();
  const d = await body(
    req,
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      mood: z.number().int().min(1).max(5).nullable(),
      answers: z.record(z.enum(["accomplished", "learned", "improve", "grateful", "tomorrow"]), z.string().max(3000)),
    }),
  );
  const [e] = await db
    .insert(journalEntries)
    .values({ userId: a.id, date: d.date, mood: d.mood, answers: d.answers })
    .onConflictDoUpdate({ target: [journalEntries.userId, journalEntries.date], set: { mood: d.mood, answers: d.answers, updatedAt: new Date() } })
    .returning();
  return { entry: e };
});
