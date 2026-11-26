import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { habits, learningEntries, readingLogs, waterLogs } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { syncSpecialHabit, trackerProgress } from "@/lib/server/habits";

type Kind = "water" | "reading" | "learning";
const kinds = ["water", "reading", "learning"];

const entrySchemas = {
  water: z.object({ ml: z.number().int().min(50).max(3000), cap: z.boolean().default(false) }),
  reading: z.object({ book: z.string().trim().min(1, "Book name is required").max(120), pages: z.number().int().min(1).max(2000), cap: z.boolean().default(false) }),
  learning: z.object({ title: z.string().trim().min(1, "Title is required").max(120), explanation: z.string().max(1000).default(""), cap: z.boolean().default(false) }),
};

export const POST = handle<{ kind: string }>(async (req, { kind }) => {
  const a = await requireUser();
  if (!kinds.includes(kind)) throw new ApiError(404, "Not found.");
  const k = kind as Kind;
  const date = todayIn(a.tz);
  const d = await body(req, entrySchemas[k]);
  const logged = await db.transaction(async (tx) => {
    let room = Number.POSITIVE_INFINITY;
    if (d.cap) {
      // Serialise capped writes per user and tracker so rapid or parallel taps cannot overshoot the target.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${a.id}:${k}:${date}`}))`);
      let target = a.prefs.waterGoal;
      if (k !== "water") {
        const [h] = await tx.select({ target: habits.target }).from(habits).where(and(eq(habits.userId, a.id), eq(habits.kind, k), eq(habits.archived, false))).limit(1);
        target = h?.target ?? (k === "reading" ? 20 : 1);
      }
      room = target - (await trackerProgress(a.id, k, date, tx));
      if (room <= 0) return 0;
    }
    if ("ml" in d) {
      const ml = Math.min(d.ml, room);
      await tx.insert(waterLogs).values({ userId: a.id, date, ml });
      return ml;
    }
    if ("pages" in d) {
      const pages = Math.min(d.pages, room);
      await tx.insert(readingLogs).values({ userId: a.id, date, book: d.book, pages });
      return pages;
    }
    await tx.insert(learningEntries).values({ userId: a.id, date, title: d.title, explanation: d.explanation });
    return 1;
  });
  if (logged) await syncSpecialHabit(a, k, date);
  return { ok: true, logged };
});

export const DELETE = handle<{ kind: string }>(async (req, { kind }) => {
  const a = await requireUser();
  const id = uuidParam(req.nextUrl.searchParams.get("id") ?? "");
  let date: string | undefined;
  if (kind === "water") {
    const r = await db.delete(waterLogs).where(and(eq(waterLogs.id, id), eq(waterLogs.userId, a.id))).returning();
    date = r[0]?.date;
  } else if (kind === "reading") {
    const r = await db.delete(readingLogs).where(and(eq(readingLogs.id, id), eq(readingLogs.userId, a.id))).returning();
    date = r[0]?.date;
  } else if (kind === "learning") {
    const r = await db.delete(learningEntries).where(and(eq(learningEntries.id, id), eq(learningEntries.userId, a.id))).returning();
    date = r[0]?.date;
  } else throw new ApiError(404, "Not found.");
  if (!date) throw new ApiError(404, "Entry not found.");
  await syncSpecialHabit(a, kind as Kind, date);
  return { ok: true };
});
