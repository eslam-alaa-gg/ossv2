import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { flashcards, flashcardReviews } from "@/db/schema";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const POST = handle<{ id: string }>(async (request, { id }) => {
  const auth = await requireUser();
  const { rating } = await body(request, z.object({ rating: z.enum(["again", "hard", "good", "easy"]) }));
  const [card] = await db.select().from(flashcards)
    .where(and(eq(flashcards.id, uuidParam(id)), eq(flashcards.userId, auth.id))).limit(1);
  if (!card) throw new ApiError(404, "Flashcard not found.");

  const now = new Date();
  const before = card.intervalDays;
  let intervalDays = before;
  let easeFactor = card.easeFactor;
  let repetitions = card.repetitions + 1;
  let lapses = card.lapses;

  if (rating === "again") {
    intervalDays = 0;
    easeFactor = Math.max(1300, easeFactor - 200);
    repetitions = 0;
    lapses += 1;
  } else if (rating === "hard") {
    intervalDays = Math.max(1, Math.round((before || 1) * 1.2));
    easeFactor = Math.max(1300, easeFactor - 150);
  } else if (rating === "good") {
    intervalDays = card.repetitions === 0 ? 1 : card.repetitions === 1 ? 6 : Math.max(1, Math.round(before * easeFactor / 1000));
  } else {
    intervalDays = card.repetitions === 0 ? 4 : Math.max(2, Math.round((before || 1) * easeFactor / 1000 * 1.3));
    easeFactor = Math.min(3000, easeFactor + 150);
  }

  const dueAt = new Date(now.getTime() + (rating === "again" ? 10 * 60 * 1000 : intervalDays * 86400000));
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx.update(flashcards).set({
      dueAt, intervalDays, easeFactor, repetitions, lapses, lastReviewedAt: now, updatedAt: now,
    }).where(and(eq(flashcards.id, card.id), eq(flashcards.userId, auth.id))).returning();
    await tx.insert(flashcardReviews).values({
      userId: auth.id, flashcardId: card.id, rating, intervalBefore: before, intervalAfter: intervalDays, reviewedAt: now,
    });
    return updated;
  });
  return { card: result, rating, intervalDays, dueAt };
});
