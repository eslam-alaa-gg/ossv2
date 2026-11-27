import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { focusSessions } from "@/db/schema";
import { ApiError, body, handle, uuidParam } from "@/lib/server/api";
import { requireUser } from "@/lib/server/auth";
import { award, evaluateAchievements } from "@/lib/server/rewards";

export const POST = handle<{ id: string }>(async (req, { id }) => {
  const auth = await requireUser();
  const input = await body(req, z.object({
    action: z.enum(["complete", "end", "pause", "resume"]),
    activeSeconds: z.number().int().min(0).max(14400).optional(),
  }));
  const [session] = await db.select().from(focusSessions)
    .where(and(eq(focusSessions.id, uuidParam(id)), eq(focusSessions.userId, auth.id)))
    .limit(1);
  if (!session) throw new ApiError(404, "Session not found.");

  const now = new Date();
  const isRunning = session.status === "running";
  const isPaused = session.status === "paused";
  const activeSeconds = Math.min(
    session.plannedSeconds,
    session.actualSeconds + (isRunning
      ? Math.max(0, Math.floor((now.getTime() - (session.lastResumedAt ?? session.startedAt).getTime()) / 1000))
      : 0),
  );

  if (input.action === "pause") {
    if (!isRunning) throw new ApiError(409, "Only a running session can be paused.");
    const [updated] = await db.update(focusSessions)
      .set({ status: "paused", pausedAt: now, actualSeconds: activeSeconds })
      .where(and(eq(focusSessions.id, session.id), eq(focusSessions.status, "running")))
      .returning();
    if (!updated) throw new ApiError(409, "This session changed before it could be paused.");
    return { session: updated };
  }

  if (input.action === "resume") {
    if (!isPaused) throw new ApiError(409, "Only a paused session can be resumed.");
    const [updated] = await db.update(focusSessions)
      .set({ status: "running", lastResumedAt: now, pausedAt: null })
      .where(and(eq(focusSessions.id, session.id), eq(focusSessions.status, "paused")))
      .returning();
    if (!updated) throw new ApiError(409, "This session changed before it could be resumed.");
    return { session: updated };
  }

  if (!isRunning && !isPaused) throw new ApiError(409, "This session is already finished.");

  if (input.action === "complete") {
    if (isPaused || activeSeconds < session.plannedSeconds - 5) {
      throw new ApiError(400, "This session hasn't accumulated its full active duration yet.");
    }
    const [updated] = await db.update(focusSessions)
      .set({ status: "completed", endedAt: now, pausedAt: null, actualSeconds: session.plannedSeconds })
      .where(and(eq(focusSessions.id, session.id), eq(focusSessions.status, "running")))
      .returning();
    if (!updated) throw new ApiError(409, "This session is already finished.");
    let xp = 0;
    let unlocked: string[] = [];
    if ((session.mode === "focus" || session.mode === "custom") && session.plannedSeconds >= 300) {
      xp = await award(auth.id, "focus", session.id, Math.min(60, Math.floor(session.plannedSeconds / 60)), "Focus session");
      unlocked = await evaluateAchievements(auth.id, auth.tz, auth.user.dailyGoal);
    }
    return { xp, unlocked, session: updated };
  }

  const [updated] = await db.update(focusSessions)
    .set({ status: "ended", endedAt: now, pausedAt: null, actualSeconds: activeSeconds })
    .where(and(eq(focusSessions.id, session.id), eq(focusSessions.status, session.status)))
    .returning();
  if (!updated) throw new ApiError(409, "This session is already finished.");
  return { xp: 0, unlocked: [], session: updated };
});
