ALTER TABLE "ossv2"."water_logs" ADD COLUMN "client_action_id" uuid;
ALTER TABLE "ossv2"."reading_logs" ADD COLUMN "client_action_id" uuid;
ALTER TABLE "ossv2"."learning_entries" ADD COLUMN "client_action_id" uuid;

CREATE UNIQUE INDEX "water_logs_user_action_unique" ON "ossv2"."water_logs" ("user_id", "client_action_id");
CREATE UNIQUE INDEX "reading_logs_user_action_unique" ON "ossv2"."reading_logs" ("user_id", "client_action_id");
CREATE UNIQUE INDEX "learning_entries_user_action_unique" ON "ossv2"."learning_entries" ("user_id", "client_action_id");
