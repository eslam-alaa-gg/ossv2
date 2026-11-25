# LIFE OS — Your Life. Your Goals. Your Progress.

A premium personal operating system: tasks, habits, daily challenges, focus room, life goals, memory vault, achievements, weekly review, analytics, calendar, notifications, a **Spotify Music Hub**, a full **Theme Studio** (presets, accent, glass, gradients), a **Profile** system with avatar upload, and a **one-click Demo mode**.

## Stack & data isolation

- Next.js 16, React 19, TypeScript, PostgreSQL and Drizzle ORM.
- OSSv2 tables live in the dedicated PostgreSQL schema **ossv2** inside the connected Supabase database. The charity application's existing **public** schema is separate and untouched.
- The OSSv2 schema contains application profiles, sessions, goals, tasks, habits, trackers, achievements, notifications, notes, journal entries, Spotify connections and related records.
- Each application user has a stable OSSv2 user ID. Every personal record is linked to that ID, and authenticated API handlers derive the ID from the verified HttpOnly session cookie—not from request payloads. Queries and foreign-record mutations are scoped to the owner.
- The schema is private to the server-side PostgreSQL connection and is not exposed through the Supabase Data API. This app currently uses Drizzle with a server-side database connection; **Postgres RLS policies are not yet the enforcement mechanism**. Do not expose the ossv2 schema or grant Data API access to it without first migrating the app's database access to a per-user JWT/RLS context.
- Email/password accounts use scrypt password hashes and hashed random session tokens. Google sign-in uses Supabase Auth OAuth, then maps the verified Google identity to an OSSv2 profile. Google identity records live in the shared Supabase Auth service, while OSSv2 profile and progress records remain in the private ossv2 schema.
- A separate PostgreSQL database per user is intentionally not created. User data is isolated per owner within the application schema, which scales more safely than provisioning a database for every account.

## Setup

1. Copy .env.example to .env.local.
2. Set DATABASE_URL to the Supabase Postgres connection string (prefer the pooler connection string from the Supabase Connect dialog).
3. Set APP_SECRET to a long random secret. Never commit it or expose it in a NEXT_PUBLIC_ variable.
4. Install and run:

~~~bash
npm install
npm run dev
~~~

The initial schema and follow-up indexes are tracked under the drizzle directory. The Supabase database migrations have already been applied for the current OSSv2 setup.

### Google sign-in setup

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add this authorized redirect URI to the Google OAuth client:

   https://emheigmdvombyjggnzog.supabase.co/auth/v1/callback

3. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and enter the Google client ID and client secret. Do not put the Google client secret in GitHub or a NEXT_PUBLIC_ variable.
4. In Supabase Dashboard → Authentication → URL Configuration, set the Site URL to https://ossv2-vyn9.vercel.app and add these redirect URLs:
   - https://ossv2-vyn9.vercel.app/auth/callback
   - https://*-vyn9.vercel.app/auth/callback (Vercel previews)
   - http://localhost:3000/auth/callback

The Google button and callback are implemented in the app. Google sign-in will not complete until the Google provider credentials and redirect allow-list are configured in Supabase.

### Vercel deployment

The Vercel project ossv2 is connected to this repository. Add DATABASE_URL in that project's Environment Variables using the connection string from Supabase. Do not paste the database password into source control or chat. The public Supabase URL and publishable key are already configured in the OSSv2 Vercel project. APP_SECRET is stored as a sensitive Vercel variable.

### Optional integrations

- Spotify: set SPOTIFY_CLIENT_ID and optionally SPOTIFY_REDIRECT_URI. The callback is <origin>/api/spotify/callback. The Spotify PKCE flow is used; no client secret is required.
- Email: set RESEND_API_KEY and a verified RESEND_FROM_EMAIL.
- Browser push: generate VAPID keys and set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT; schedule GET /api/cron/notify with Authorization: Bearer $CRON_SECRET.
- Local build checks: npm run typecheck, npm run lint, and npm run build.

## Features & scoring

* **Heatmap scoring** (shown in the UI): task = 1, habit = 1, challenge = 2, full focus session = 2, milestone = 2. Levels are relative to your daily goal (low <⅓, medium <⅔, high <100%, goal achieved ≥100%). Only completed, verified rows count; opening the app never lights a day.
* **XP**: `xp_transactions` has a unique `(user, source, source_id)` index, so a record can pay once (restoring/re-completing a task does not pay again). Focus rewards require the server-observed wall-clock to cover the planned duration. No penalties for missed days.
* **Water / Reading / Learning** trackers drive their linked habits from real log rows.
* **Focus ambient sounds** are synthesised with the Web Audio API (no audio files), never autoplay.
* **Arabic/RTL**: layout is fully RTL-aware (logical CSS properties) and fonts include Arabic families; the string dictionary (`src/lib/i18n.ts`) translates navigation and key labels — remaining strings fall back to English.

## Spotify Music Hub

Authorization Code Flow with **PKCE**, `state` validated against an HttpOnly cookie bound to your user, tokens **AES-256-GCM encrypted** in `spotify_connections`, automatic refresh, revoked grants clean up the connection, 429 `Retry-After` honoured, no secrets/refresh tokens ever sent to the browser. Scopes (minimum): `user-read-playback-state user-read-currently-playing user-modify-playback-state user-read-recently-played user-read-private`.

1. Create an app at <https://developer.spotify.com/dashboard>.
2. Add the redirect URI shown on the Music Hub page (`<origin>/api/spotify/callback`; HTTPS, or `http://127.0.0.1:PORT` locally — Spotify rejects `localhost`).
3. Set `SPOTIFY_CLIENT_ID` (+ optional `SPOTIFY_REDIRECT_URI`) and restart. No client secret needed.

Playback control, seek and device transfer require **Spotify Premium** (Spotify API rule); free accounts see an explanation and an *Open in Spotify* action instead of controls. No lyrics are implemented. Album-art colours are extracted in the browser (via a host-allow-listed proxy) and drive a very faint background glow, which can be disabled.

## Demo mode

“Try Demo — Explore LIFE OS” calls `POST /api/auth/demo`, which creates a **fresh, private, seeded sandbox user per visitor** (random unusable password, no credentials exist to expose), signs them in through the normal session cookie, and shows a `DEMO MODE` banner. Concurrent visitors cannot affect each other; repeat clicks reuse the visitor's own session (no duplicates); sandboxes older than 6 h are purged; *Exit Demo* deletes the sandbox. Server-enforced restrictions: password change, account deletion, email actions, push, Spotify connection/control.

## Notifications

* **In-app**: generated from real tasks/habits/challenge (deduplicated, quiet hours respected) when you use the app.
* **Browser push**: subscription management, permission handling and delivery are implemented, but only work after you set VAPID keys (`npx web-push generate-vapid-keys`) **and** schedule `GET /api/cron/notify` with `Authorization: Bearer $CRON_SECRET`. Not claimed to work otherwise.
* **Email**: verification and reset emails via Resend when `RESEND_API_KEY` is set; without it no email is sent (the UI says so). Scheduled email reminders are not implemented.

## Deployment

1. Provision PostgreSQL; set `DATABASE_URL`, `APP_SECRET` (long random), optional keys from `.env.example`.
2. `npx drizzle-kit migrate` (or `push`), `npm run build`, `npm start` behind HTTPS (cookies become `Secure` when `x-forwarded-proto: https`).
3. Add a scheduler hitting `/api/cron/notify` every ~15 min if you want push.
4. Rotate `APP_SECRET` only together with re-connecting Spotify (tokens are encrypted with it).

## Known limitations
* In-memory rate limiter (per instance) — use a shared store when scaling horizontally.
* Calendar reminders are stored on tasks; delivery is via the notification pipeline above.
* The restored focus timer after a page reload is reconstructed from server start time (pause history is not persisted).
