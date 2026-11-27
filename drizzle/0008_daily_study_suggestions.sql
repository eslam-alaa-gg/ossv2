CREATE TABLE "ossv2"."daily_study_suggestion_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "ossv2"."users"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "suggestion_key" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "daily_study_suggestion_decisions_unique" ON "ossv2"."daily_study_suggestion_decisions" ("user_id", "date", "suggestion_key");
CREATE INDEX "daily_study_suggestion_decisions_user_date_idx" ON "ossv2"."daily_study_suggestion_decisions" ("user_id", "date");
