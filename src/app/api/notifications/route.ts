import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { generateNotifications } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  await generateNotifications(a);
  const items = await db.select().from(notifications).where(eq(notifications.userId, a.id)).orderBy(desc(notifications.createdAt)).limit(30);
  return { items, unread: items.filter((i) => !i.readAt).length };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const d = await body(req, z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }));
  const where = d.all ? and(eq(notifications.userId, a.id), isNull(notifications.readAt)) : and(eq(notifications.userId, a.id), eq(notifications.id, d.id ?? "00000000-0000-0000-0000-000000000000"));
  await db.update(notifications).set({ readAt: new Date() }).where(where);
  return { ok: true };
});
