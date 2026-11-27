ALTER TABLE "ossv2"."focus_sessions"
  ADD COLUMN "last_resumed_at" timestamptz,
  ADD COLUMN "paused_at" timestamptz;
