import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";

export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const d = await body(
    req,
    z
      .object({
        type: z.enum(["quick", "idea", "learned", "reflection", "reading", "project", "important"]),
        title: z.string().max(200),
        content: z.string().max(100000),
        collection: z.string().max(40),
        tags: z.array(z.string().trim().min(1).max(30)).max(15),
        pinned: z.boolean(),
        archived: z.boolean(),
        favorite: z.boolean(),
      })
      .partial(),
  );
  const [n] = await db.update(notes).set({ ...d, updatedAt: new Date() }).where(and(eq(notes.id, uuidParam(id)), eq(notes.userId, a.id))).returning();
  if (!n) throw new ApiError(404, "Note not found.");
  return { note: n };
});

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const a = await requireUser();
  const r = await db.delete(notes).where(and(eq(notes.id, uuidParam(id)), eq(notes.userId, a.id))).returning({ id: notes.id });
  if (!r.length) throw new ApiError(404, "Note not found.");
  return { ok: true };
});
