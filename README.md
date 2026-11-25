# LIFE OS — Your Life. Your Goals. Your Progress.

A premium personal operating system: tasks, habits, daily challenges, focus room, life goals, memory vault, achievements, weekly review, analytics, calendar, notifications, a **Spotify Music Hub**, a full **Theme Studio** (presets, accent, glass, gradients), a **Profile** system with avatar upload, and a **one-click Demo mode**.

## Stack & an honest note about Supabase

The product brief names Supabase. This repository runs on **Next.js 16 (App Router) + PostgreSQL via Drizzle ORM** and has no Supabase project available, so the equivalent capabilities were implemented natively and **nothing is claimed to be Supabase**:

| Brief (Supabase) | What is implemented here |
| --- | --- |
| Supabase Auth | Own auth: scrypt password hashes, random session tokens stored **hashed** in `sessions`, `HttpOnly` + `SameSite=Lax` (+`Secure` on HTTPS) cookie, reset/verify tokens, rate limiting |
| RLS (`auth.uid()`) | **Application-layer authorization**: the user id is *only* taken from the verified session (never the request); every query is filtered by it; every foreign id (goal/task/milestone/…) is ownership-checked. Cross-user isolation is covered by `tests/e2e.mjs`. *Postgres RLS is not enabled* (single DB role). If you move to Supabase, port these tables and add `auth.uid() = user_id` policies. |
| Storage | Avatars are validated (magic bytes, ≤1.5 MB, JPG/PNG/WebP), compressed client-side to 512 px, stored in the `avatars` table and served **only to their owner** from `/api/me/avatar` |
| Edge Functions / scheduling | `GET /api/cron/notify` (Bearer `CRON_SECRET`) for any external scheduler |
| Transactional email | Resend REST API when `RESEND_API_KEY` is set |

Libraries: React 19, Tailwind 4, Framer Motion, Recharts, Lucide, Zod, date-fns (installed), web-push. Notes use a safe in-house Markdown renderer (HTML is escaped first) with a formatting toolbar instead of a heavy editor dependency.

## Setup

```bash
cp .env.example .env        # fill in what you need
npm install
npx drizzle-kit push        # apply schema (SQL migration also in ./drizzle)
npm run build && npm start  # or: npm run dev
```
`DATABASE_URL` and (recommended) `APP_SECRET` are required. Everything else is optional and degrades honestly (the UI says what is not configured).

### Tests
```bash
npm run build && PORT=3100 npm start &       # in one shell
BASE_URL=http://127.0.0.1:3100 node tests/e2e.mjs
```
28 checks: registration/login/logout/session persistence, protected routes, **cross-user isolation (list + IDOR by id)**, client-supplied `user_id` ignored, CSRF, duplicate-reward prevention (tasks, habits, challenges), focus-session server validation, heatmap uses verified records only, per-user preferences, profile + avatar isolation, demo mode (auth, seeding, restrictions, isolation between visitors, exit), account deletion.

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
