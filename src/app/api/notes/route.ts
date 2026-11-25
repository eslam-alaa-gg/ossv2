import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { evaluateAchievements } from "@/lib/server/rewards";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const a = await requireUser();
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim().replace(/[%_]/g, "");
  const where = [eq(notes.userId, a.id)];
  if (q) where.push(or(ilike(notes.title, `%${q}%`), ilike(notes.content, `%${q}%`), sql`exists (select 1 from unnest(${notes.tags}) t where t ilike ${`%${q}%`})`)!);
  const rows = await db
    .select()
    .from(notes)
    .where(and(...where))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt))
    .limit(500);
  return { notes: rows };
});

export const POST = handle(async (req) => {
  const a = await requireUser();
  const d = await body(
    req,
    z.object({
      type: z.enum(["quick", "idea", "learned", "reflection", "reading", "project", "important"]).default("quick"),
      title: z.string().max(200).default(""),
      content: z.string().max(100000).default(""),
      collection: z.string().max(40).default(""),
      tags: z.array(z.string().trim().min(1).max(30)).max(15).default([]),
    }),
  );
  const [n] = await db.insert(notes).values({ ...d, userId: a.id }).returning();
  await evaluateAchievements(a.id, a.tz, a.user.dailyGoal);
  return { note: n };
});
