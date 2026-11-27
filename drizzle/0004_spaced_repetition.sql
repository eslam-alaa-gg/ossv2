CREATE TABLE "ossv2"."flashcards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "ossv2"."users"("id") ON DELETE CASCADE,
  "front" text NOT NULL,
  "back" text NOT NULL,
  "due_at" timestamptz DEFAULT now() NOT NULL,
  "interval_days" integer DEFAULT 0 NOT NULL,
  "ease_factor" integer DEFAULT 2500 NOT NULL,
  "repetitions" integer DEFAULT 0 NOT NULL,
  "lapses" integer DEFAULT 0 NOT NULL,
  "last_reviewed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "flashcards_user_due_idx" ON "ossv2"."flashcards" USING btree ("user_id","due_at");
--> statement-breakpoint
CREATE TABLE "ossv2"."flashcard_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "ossv2"."users"("id") ON DELETE CASCADE,
  "flashcard_id" uuid NOT NULL REFERENCES "ossv2"."flashcards"("id") ON DELETE CASCADE,
  "rating" text NOT NULL,
  "interval_before" integer NOT NULL,
  "interval_after" integer NOT NULL,
  "reviewed_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "flashcard_reviews_user_reviewed_idx" ON "ossv2"."flashcard_reviews" USING btree ("user_id","reviewed_at");
--> statement-breakpoint
CREATE INDEX "flashcard_reviews_card_idx" ON "ossv2"."flashcard_reviews" USING btree ("flashcard_id","reviewed_at");
