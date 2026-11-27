import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { studySubjects } from "@/db/schema";
import { body, handle } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const GET = handle(async () => {
  const auth = await requireUser();
  const subjects = await db.select().from(studySubjects).where(eq(studySubjects.userId, auth.id)).orderBy(asc(studySubjects.name));
  return { subjects };
});

export const POST = handle(async (request) => {
  const auth = await requireUser();
  const input = await body(request, z.object({
    name: z.string().trim().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8b7cff"),
  }));
  const [subject] = await db.insert(studySubjects).values({ userId: auth.id, name: input.name, color: input.color }).returning();
  return { subject };
});
