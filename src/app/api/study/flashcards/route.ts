import { and, asc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { flashcards, studySubjects } from "@/db/schema";
import { ApiError, body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const GET = handle(async (request) => {
  const auth = await requireUser();
  const dueOnly = new URL(request.url).searchParams.get("due") === "1";
  const filters = dueOnly
    ? and(eq(flashcards.userId, auth.id), lte(flashcards.dueAt, new Date()))
    : eq(flashcards.userId, auth.id);
  const cards = await db.select({
    id: flashcards.id,
    subjectId: flashcards.subjectId,
    subjectName: studySubjects.name,
    front: flashcards.front,
    back: flashcards.back,
    dueAt: flashcards.dueAt,
    intervalDays: flashcards.intervalDays,
    repetitions: flashcards.repetitions,
    lapses: flashcards.lapses,
    createdAt: flashcards.createdAt,
  }).from(flashcards)
    .leftJoin(studySubjects, eq(flashcards.subjectId, studySubjects.id))
    .where(filters)
    .orderBy(asc(flashcards.dueAt));
  return { cards };
});

export const POST = handle(async (request) => {
  const auth = await requireUser();
  const input = await body(request, z.object({
    front: z.string().trim().min(1).max(4000),
    back: z.string().trim().min(1).max(8000),
    subjectId: z.string().uuid().nullable().optional(),
  }));
  if (input.subjectId) {
    const [subject] = await db.select({ id: studySubjects.id }).from(studySubjects)
      .where(and(eq(studySubjects.id, input.subjectId), eq(studySubjects.userId, auth.id))).limit(1);
    if (!subject) throw new ApiError(404, "Subject not found.");
  }
  const [card] = await db.insert(flashcards).values({
    userId: auth.id,
    subjectId: input.subjectId ?? null,
    front: input.front,
    back: input.back,
    dueAt: new Date(),
  }).returning();
  return { card };
});
