CREATE TABLE "ossv2"."custom_fonts" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "mime" text NOT NULL,
  "data" bytea NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "custom_fonts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ossv2"."users"("id") ON DELETE cascade
);
