import { z } from "zod";

const date = z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable();
const time = z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/).nullable();

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().max(4000).default(""),
  category: z.string().trim().min(1).max(60).default("General"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "in_progress", "completed", "archived"]).default("todo"),
  dueDate: date.default(null),
  dueTime: time.default(null),
  reminderMinutes: z.number().int().min(0).max(10080).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  goalId: z.string().uuid().nullable().default(null),
  milestoneId: z.string().uuid().nullable().default(null),
});

export const goalFields = {
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().max(2000).default(""),
  type: z.enum(["daily", "weekly", "monthly", "yearly", "long_term"]).default("monthly"),
  category: z.string().trim().min(1).max(60).default("Personal Growth"),
  startDate: date.default(null),
  targetDate: date.default(null),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  manualProgress: z.number().int().min(0).max(100).default(0),
};

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().max(1000).default(""),
  icon: z.string().trim().min(1).max(40).default("sparkles"),
  kind: z.enum(["standard", "water", "reading", "learning"]).default("standard"),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  target: z.number().int().min(1).max(100000).default(1),
  unit: z.string().max(20).default(""),
  reminderTime: time.default(null),
  archived: z.boolean().default(false),
});
