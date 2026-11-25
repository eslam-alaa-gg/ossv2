import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { wishlistItems } from "@/db/schema";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const a = await requireUser();
  return { items: await db.select().from(wishlistItems).where(eq(wishlistItems.userId, a.id)).orderBy(desc(wishlistItems.createdAt)).limit(200) };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const d = await body(req, z.object({ title: z.string().trim().min(1, "Title is required").max(120), note: z.string().max(500).default(""), url: z.string().url().max(300).refine((u) => /^https?:/.test(u), "Use an http(s) link").or(z.literal("")).default("") }));
  const [i] = await db.insert(wishlistItems).values({ ...d, userId: a.id }).returning();
  return { item: i };
});

// PATCH ?id=…  {acquired:boolean}   DELETE ?id=…
export const PATCH = handle(async (req) => {
  const a = await requireUser();
  const id = uuidParam(req.nextUrl.searchParams.get("id") ?? "");
  const d = await body(req, z.object({ acquired: z.boolean() }));
  const [i] = await db.update(wishlistItems).set({ acquiredAt: d.acquired ? new Date() : null }).where(and(eq(wishlistItems.id, id), eq(wishlistItems.userId, a.id))).returning();
  if (!i) throw new ApiError(404, "Item not found.");
  return { item: i };
});

export const DELETE = handle(async (req) => {
  const a = await requireUser();
  const id = uuidParam(req.nextUrl.searchParams.get("id") ?? "");
  await db.delete(wishlistItems).where(and(eq(wishlistItems.id, id), eq(wishlistItems.userId, a.id)));
  return { ok: true };
});
