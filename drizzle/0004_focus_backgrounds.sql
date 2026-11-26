CREATE TABLE "ossv2"."focus_backgrounds" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "mime" text NOT NULL,
  "data" bytea NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "focus_backgrounds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ossv2"."users"("id") ON DELETE cascade
);
