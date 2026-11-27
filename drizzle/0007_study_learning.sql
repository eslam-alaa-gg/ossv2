CREATE TABLE "ossv2"."study_subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "ossv2"."users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "color" text DEFAULT '#8b7cff' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "study_subjects_user_idx" ON "ossv2"."study_subjects" ("user_id");

CREATE TABLE "ossv2"."flashcards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "ossv2"."users"("id") ON DELETE cascade,
  "subject_id" uuid REFERENCES "ossv2"."study_subjects"("id") ON DELETE set null,
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
CREATE INDEX "flashcards_user_due_idx" ON "ossv2"."flashcards" ("user_id", "due_at");
CREATE INDEX "flashcards_subject_idx" ON "ossv2"."flashcards" ("subject_id");

CREATE TABLE "ossv2"."flashcard_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "ossv2"."users"("id") ON DELETE cascade,
  "flashcard_id" uuid NOT NULL REFERENCES "ossv2"."flashcards"("id") ON DELETE cascade,
  "rating" text NOT NULL,
  "interval_before" integer NOT NULL,
  "interval_after" integer NOT NULL,
  "reviewed_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "flashcard_reviews_user_reviewed_idx" ON "ossv2"."flashcard_reviews" ("user_id", "reviewed_at");
