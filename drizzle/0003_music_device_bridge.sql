CREATE TABLE "ossv2"."music_bridge_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "ossv2"."users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "platform" text NOT NULL,
  "device_name" text DEFAULT 'Device' NOT NULL,
  "track_title" text,
  "artist" text,
  "album" text,
  "artwork" text,
  "track_url" text,
  "app_name" text DEFAULT 'Spotify' NOT NULL,
  "is_playing" boolean DEFAULT false NOT NULL,
  "position_ms" integer DEFAULT 0 NOT NULL,
  "duration_ms" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "music_bridge_user_updated_idx" ON "ossv2"."music_bridge_devices" USING btree ("user_id","updated_at");
