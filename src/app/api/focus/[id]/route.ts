import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { focusSessions } from "@/db/schema";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { award, evaluateAchievements } from "@/lib/server/rewards";

export const POST = handle<{ id: string }>(async (req, { id }) => {
  const a = await requireUser();
  const d = await body(req, z.object({ action: z.enum(["complete", "end"]), activeSeconds: z.number().int().min(0).max(14400).default(0) }));
  const [s] = await db.select().from(focusSessions).where(and(eq(focusSessions.id, uuidParam(id)), eq(focusSessions.userId, a.id))).limit(1);
  if (!s) throw new ApiError(404, "Session not found.");
  if (s.status !== "running") throw new ApiError(409, "This session is already finished.");
  const wall = Math.floor((Date.now() - s.startedAt.getTime()) / 1000);
  if (d.action === "complete") {
    // server-side validation: wall-clock time must cover the planned duration — no fabricated sessions
    if (wall < s.plannedSeconds - 5) throw new ApiError(400, "This session hasn't run for its full duration yet.");
    const r = await db
      .update(focusSessions)
      .set({ status: "completed", endedAt: new Date(), actualSeconds: s.plannedSeconds })
      .where(and(eq(focusSessions.id, s.id), eq(focusSessions.status, "running")))
      .returning();
    if (!r.length) throw new ApiError(409, "This session is already finished.");
    let xp = 0;
    let unlocked: string[] = [];
    if ((s.mode === "focus" || s.mode === "custom") && s.plannedSeconds >= 300) {
      xp = await award(a.id, "focus", s.id, Math.min(60, Math.floor(s.plannedSeconds / 60)), "Focus session");
      unlocked = await evaluateAchievements(a.id, a.tz, a.user.dailyGoal);
    }
    return { xp, unlocked, session: r[0] };
  }
  const actual = Math.min(d.activeSeconds, wall, s.plannedSeconds);
  const [r] = await db.update(focusSessions).set({ status: "ended", endedAt: new Date(), actualSeconds: actual }).where(and(eq(focusSessions.id, s.id), eq(focusSessions.status, "running"))).returning();
  return { xp: 0, unlocked: [], session: r };
});
