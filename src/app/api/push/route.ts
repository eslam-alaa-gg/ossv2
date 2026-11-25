import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { ApiError, body, handle } from "@/lib/server/api";
import { assertNotDemo, requireUser } from "@/lib/server/auth";
import { pushConfigured, sendPush } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  const subs = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, a.id));
  return { configured: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY ?? null, subscribed: subs.length };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  assertNotDemo(a, "Browser push notifications");
  if (!pushConfigured()) throw new ApiError(503, "Push isn't configured on this server (VAPID keys missing).");
  const d = await body(req, z.object({ test: z.boolean().optional(), subscription: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(100) }) }).optional() }));
  if (d.subscription) {
    await db
      .insert(pushSubscriptions)
      .values({ userId: a.id, endpoint: d.subscription.endpoint, p256dh: d.subscription.keys.p256dh, auth: d.subscription.keys.auth })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: a.id, p256dh: d.subscription.keys.p256dh, auth: d.subscription.keys.auth } });
  }
  if (d.test) {
    const sent = await sendPush(a.id, { title: "LIFE OS", body: translate(a.user.language === "ar" ? "ar" : "en", "Push notifications are working."), href: "/dashboard" });
    if (!sent) throw new ApiError(502, "No push was delivered. Re-enable notifications and try again.");
    return { sent };
  }
  return { ok: true };
});

export const DELETE = handle(async (req) => {
  const a = await requireUser();
  const d = await body(req, z.object({ endpoint: z.string().url().max(1000) }));
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, a.id), eq(pushSubscriptions.endpoint, d.endpoint)));
  return { ok: true };
});
