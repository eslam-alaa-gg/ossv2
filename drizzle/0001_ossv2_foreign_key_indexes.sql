CREATE INDEX "auth_tokens_user_idx" ON "ossv2"."auth_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "focus_task_idx" ON "ossv2"."focus_sessions" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "ossv2"."push_subscriptions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "tasks_goal_idx" ON "ossv2"."tasks" USING btree ("goal_id");
--> statement-breakpoint
CREATE INDEX "tasks_milestone_idx" ON "ossv2"."tasks" USING btree ("milestone_id");
