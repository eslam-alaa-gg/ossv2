import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { learningEntries, readingLogs, waterLogs } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { syncSpecialHabit } from "@/lib/server/habits";

type Kind = "water" | "reading" | "learning";
const kinds = ["water", "reading", "learning"];

export const POST = handle<{ kind: string }>(async (req, { kind }) => {
  const a = await requireUser();
  if (!kinds.includes(kind)) throw new ApiError(404, "Not found.");
  const date = todayIn(a.tz);
  if (kind === "water") {
    const d = await body(req, z.object({ ml: z.number().int().min(50).max(3000) }));
    await db.insert(waterLogs).values({ userId: a.id, date, ml: d.ml });
  } else if (kind === "reading") {
    const d = await body(req, z.object({ book: z.string().trim().min(1, "Book name is required").max(120), pages: z.number().int().min(1).max(2000) }));
    await db.insert(readingLogs).values({ userId: a.id, date, book: d.book, pages: d.pages });
  } else {
    const d = await body(req, z.object({ title: z.string().trim().min(1, "Title is required").max(120), explanation: z.string().max(1000).default("") }));
    await db.insert(learningEntries).values({ userId: a.id, date, title: d.title, explanation: d.explanation });
  }
  await syncSpecialHabit(a, kind as Kind, date);
  return { ok: true };
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
