import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";
import { ApiError, handle } from "@/lib/server/api";
import { parsePrefs } from "@/lib/prefs";
import { safeTz } from "@/lib/dates";
import { generateNotifications, pushConfigured, sendPush } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

// Call from a scheduler (Vercel Cron, GitHub Actions, cron-job.org…) with `Authorization: Bearer $CRON_SECRET`.
export const GET = handle(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "CRON_SECRET is not configured.");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new ApiError(401, "Unauthorized.");
  const subs = await db.selectDistinct({ userId: pushSubscriptions.userId }).from(pushSubscriptions);
  if (!subs.length) return { users: 0, created: 0, pushed: 0, pushConfigured: pushConfigured() };
  const us = await db.select().from(users).where(inArray(users.id, subs.map((s) => s.userId)));
  let created = 0, pushed = 0;
  for (const u of us) {
    if (u.isDemo) continue;
    const prefs = parsePrefs(u.preferences);
    const made = await generateNotifications({ user: u, id: u.id, tz: safeTz(u.timezone), prefs });
    created += made.length;
    if (prefs.notifications.push) for (const n of made) pushed += await sendPush(u.id, n);
  }
  void eq;
  return { users: us.length, created, pushed, pushConfigured: pushConfigured() };
});
