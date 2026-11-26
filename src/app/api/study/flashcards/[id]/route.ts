import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { flashcards, studySubjects } from "@/db/schema";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const PATCH = handle<{ id: string }>(async (request, { id }) => {
  const auth = await requireUser();
  const input = await body(request, z.object({
    front: z.string().trim().min(1).max(4000).optional(),
    back: z.string().trim().min(1).max(8000).optional(),
    subjectId: z.string().uuid().nullable().optional(),
  }).refine((value) => value.front !== undefined || value.back !== undefined || value.subjectId !== undefined, "Provide at least one field to update."));
  if (input.subjectId) {
    const [subject] = await db.select({ id: studySubjects.id }).from(studySubjects)
      .where(and(eq(studySubjects.id, input.subjectId), eq(studySubjects.userId, auth.id))).limit(1);
    if (!subject) throw new ApiError(404, "Subject not found.");
  }
  const [card] = await db.update(flashcards).set({
    ...(input.front !== undefined ? { front: input.front } : {}),
    ...(input.back !== undefined ? { back: input.back } : {}),
    ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
    updatedAt: new Date(),
  }).where(and(eq(flashcards.id, uuidParam(id)), eq(flashcards.userId, auth.id))).returning();
  if (!card) throw new ApiError(404, "Flashcard not found.");
  return { card };
});

export const DELETE = handle<{ id: string }>(async (_request, { id }) => {
  const auth = await requireUser();
  const [card] = await db.delete(flashcards)
    .where(and(eq(flashcards.id, uuidParam(id)), eq(flashcards.userId, auth.id))).returning({ id: flashcards.id });
  if (!card) throw new ApiError(404, "Flashcard not found.");
  return { deleted: true };
});
