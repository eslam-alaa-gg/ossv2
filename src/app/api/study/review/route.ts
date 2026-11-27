import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { flashcards, flashcardReviews } from "@/db/schema";
import { ApiError, body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const POST = handle(async (request) => {
  const auth = await requireUser();
  const { cardId, rating } = await body(request, z.object({
    cardId: z.string().uuid(),
    rating: z.enum(["again", "hard", "good", "easy"]),
  }));

  const result = await db.transaction(async (tx) => {
    // Lock the card before reading its schedule so simultaneous reviews cannot
    // both calculate from the same stale repetitions/interval values.
    const [card] = await tx.select().from(flashcards)
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, auth.id)))
      .limit(1)
      .for("update");
    if (!card) throw new ApiError(404, "Flashcard not found.");

    const now = new Date();
    if (card.dueAt.getTime() > now.getTime()) {
      throw new ApiError(409, "This flashcard has already been reviewed and is not due yet.");
    }

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
    const [updated] = await tx.update(flashcards).set({
      dueAt, intervalDays, easeFactor, repetitions, lapses, lastReviewedAt: now, updatedAt: now,
    }).where(and(eq(flashcards.id, card.id), eq(flashcards.userId, auth.id))).returning();
    await tx.insert(flashcardReviews).values({
      userId: auth.id, flashcardId: card.id, rating, intervalBefore: before, intervalAfter: intervalDays, reviewedAt: now,
    });
    return { card: updated, rating, intervalDays, dueAt };
  });

  return result;
});
