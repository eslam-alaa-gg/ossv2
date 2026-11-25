import "server-only";
import { randomBytes, randomUUID } from "crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyChallenges, focusSessions, goalMilestones, goals, habitLogs, habits, journalEntries, learningEntries, notes, readingLogs, tasks, users, waterLogs,
  wishlistItems, xpTransactions,
} from "@/db/schema";
import { addDays, safeTz, todayIn } from "@/lib/dates";
import { DEFAULT_PREFS } from "@/lib/prefs";
import { hashPassword } from "./auth";
import { evaluateAchievements, XP_GOAL, XP_HABIT, XP_MILESTONE, XP_TASK } from "./rewards";

const DAY = 86400000;

/** Each visitor gets a private, ephemeral demo workspace — so concurrent visitors never affect each other. */
export async function cleanupDemoUsers() {
  await db.delete(users).where(and(eq(users.isDemo, true), lt(users.createdAt, new Date(Date.now() - 6 * 3600000))));
}

export async function createDemoUser(tzIn?: string) {
  const tz = safeTz(tzIn);
  const today = todayIn(tz);
  const now = Date.now();
  const ago = (d: number, h = 10) => new Date(now - d * DAY - (24 - h) * 3600000 + 0);
  const [u] = await db
    .insert(users)
    .values({
      email: `demo-${randomUUID()}@demo.lifeos.invalid`,
      passwordHash: hashPassword(randomBytes(24).toString("hex")), // random, never disclosed
      displayName: "Demo Explorer",
      timezone: tz,
      isDemo: true,
      onboarded: true,
      emailVerified: true,
      dailyGoal: 5,
      preferences: DEFAULT_PREFS,
    })
    .returning();
  const uid = u.id;
  const xp: { userId: string; source: string; sourceId: string; xp: number; label: string }[] = [];

  /* goals + milestones */
  const gl = await db
    .insert(goals)
    .values([
      { userId: uid, title: "Run a half marathon", description: "Build up to 21 km with a steady training plan.", type: "yearly", category: "Health", startDate: addDays(today, -60), targetDate: addDays(today, 120), priority: "high" },
      { userId: uid, title: "Learn conversational Spanish", description: "Hold a 10-minute conversation without switching to English.", type: "long_term", category: "Learning", startDate: addDays(today, -30), targetDate: addDays(today, 200), priority: "medium" },
      { userId: uid, title: "Launch my portfolio site", description: "Design, build and publish a portfolio with 3 case studies.", type: "monthly", category: "Career", startDate: addDays(today, -40), targetDate: addDays(today, -5), priority: "high", status: "completed", completedAt: ago(5) },
    ])
    .returning();
  const ms = (g: number, title: string, deadline: number, done: number | null, order: number) => ({
    goalId: gl[g].id, userId: uid, title, deadline: addDays(today, deadline), completedAt: done === null ? null : ago(done), sortOrder: order,
  });
  const mrows = await db
    .insert(goalMilestones)
    .values([
      ms(0, "Run 5 km without stopping", -30, 28, 0), ms(0, "Run 10 km", 10, 6, 1), ms(0, "Run 15 km", 60, null, 2), ms(0, "Race day", 120, null, 3),
      ms(1, "Finish beginner course", -5, 12, 0), ms(1, "Weekly tutor session x4", 30, null, 1), ms(1, "First 10-minute conversation", 150, null, 2),
      ms(2, "Pick a design direction", -30, 33, 0), ms(2, "Build the site", -15, 18, 1), ms(2, "Publish and share", -5, 5, 2),
    ])
    .returning();
  mrows.filter((m) => m.completedAt).forEach((m) => xp.push({ userId: uid, source: "milestone", sourceId: m.id, xp: XP_MILESTONE, label: `Milestone: ${m.title}` }));
  xp.push({ userId: uid, source: "goal", sourceId: gl[2].id, xp: XP_GOAL, label: `Goal: ${gl[2].title}` });

  /* tasks */
  const doneTitles: [string, string, string][] = [
    ["Review quarterly budget", "Finance", "high"], ["Book dentist appointment", "Personal", "low"], ["Draft project proposal", "Work", "high"], ["Reply to pending emails", "Work", "medium"],
    ["Plan weekend trip", "Personal", "low"], ["Update résumé", "Career", "medium"], ["Grocery shopping", "Home", "low"], ["Finish chapter 4 notes", "Learning", "medium"],
    ["Prepare team presentation", "Work", "urgent"], ["Renew car insurance", "Finance", "high"], ["Clean up photo library", "Personal", "low"], ["Call mom", "Personal", "medium"],
    ["Fix landing page bug", "Work", "urgent"], ["Meal prep for the week", "Health", "medium"], ["Read research paper", "Learning", "medium"], ["Set up backup drive", "Home", "low"],
    ["Write blog post outline", "Creativity", "medium"], ["Pay utility bills", "Finance", "high"], ["Organize desk", "Home", "low"], ["Sprint retrospective notes", "Work", "medium"],
    ["Schedule 1:1s", "Work", "low"], ["Learn keyboard shortcuts", "Learning", "low"], ["Declutter wardrobe", "Home", "low"], ["Outline portfolio case study", "Career", "high"],
  ];
  const offsets = [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 6, 7, 8, 9, 11, 12, 14, 16, 19, 22, 27, 33, 40];
  const doneRows = await db
    .insert(tasks)
    .values(doneTitles.map(([title, category, priority], i) => ({ userId: uid, title, category, priority, status: "completed", completedAt: ago(offsets[i], 9 + (i % 9)), dueDate: addDays(today, -offsets[i]), tags: i % 3 === 0 ? ["focus"] : [] })))
    .returning();
  doneRows.forEach((t) => xp.push({ userId: uid, source: "task", sourceId: t.id, xp: XP_TASK[t.priority] ?? 15, label: `Task: ${t.title}` }));
  await db.insert(tasks).values([
    { userId: uid, title: "Finalize Q3 roadmap", description: "Align priorities with the team and publish the roadmap doc.", category: "Work", priority: "urgent", status: "in_progress", dueDate: addDays(today, 0), dueTime: "17:00", tags: ["planning"] },
    { userId: uid, title: "Submit expense report", category: "Finance", priority: "high", status: "todo", dueDate: addDays(today, -2), tags: [] },
    { userId: uid, title: "Morning long run (10 km)", category: "Health", priority: "medium", status: "todo", dueDate: addDays(today, 1), recurrence: "weekly", goalId: gl[0].id, milestoneId: mrows[1].id, tags: ["running"] },
    { userId: uid, title: "Spanish tutor session", category: "Learning", priority: "medium", status: "todo", dueDate: addDays(today, 2), dueTime: "18:30", goalId: gl[1].id, tags: ["spanish"] },
    { userId: uid, title: "Design review with Sam", category: "Work", priority: "high", status: "todo", dueDate: addDays(today, 3), tags: [] },
    { userId: uid, title: "Buy birthday gift", category: "Personal", priority: "low", status: "todo", dueDate: addDays(today, 5), tags: [] },
    { userId: uid, title: "Research standing desks", category: "Home", priority: "low", status: "todo", tags: ["shopping"] },
    { userId: uid, title: "Write monthly newsletter", category: "Creativity", priority: "medium", status: "in_progress", dueDate: addDays(today, 7), tags: ["writing"] },
  ]);

  /* habits */
  const hrows = await db
    .insert(habits)
    .values([
      { userId: uid, name: "Drink Water", icon: "droplets", kind: "water", target: 2000, unit: "ml", startDate: addDays(today, -45) },
      { userId: uid, name: "Read Books", icon: "book-open", kind: "reading", target: 20, unit: "pages", startDate: addDays(today, -45) },
      { userId: uid, name: "Learn Something New", icon: "lightbulb", kind: "learning", target: 1, unit: "entry", startDate: addDays(today, -45) },
      { userId: uid, name: "Exercise", icon: "dumbbell", days: [1, 3, 5, 6], startDate: addDays(today, -45) },
      { userId: uid, name: "Meditation", icon: "flower-2", startDate: addDays(today, -45), reminderTime: "07:30" },
      { userId: uid, name: "Walk", icon: "footprints", startDate: addDays(today, -45) },
    ])
    .returning();
  const logs: (typeof habitLogs.$inferInsert)[] = [];
  const water: (typeof waterLogs.$inferInsert)[] = [];
  const reading: (typeof readingLogs.$inferInsert)[] = [];
  const learning: (typeof learningEntries.$inferInsert)[] = [];
  const topics = ["How compound interest works", "The Feynman technique", "Spanish: ser vs estar", "Why sleep spindles matter", "Pomodoro vs flowtime"];
  const books = ["Atomic Habits", "Deep Work", "The Pragmatic Programmer"];
  for (let d = 0; d < 45; d++) {
    const date = addDays(today, -d);
    const dw = new Date(date + "T00:00:00Z").getUTCDay();
    hrows.forEach((h, hi) => {
      if (!h.days.includes(dw)) return;
      const hit = (d * 7 + hi * 3) % 10 < 7 && !(d === 0 && hi > 2);
      if (!hit) return;
      logs.push({ userId: uid, habitId: h.id, date, amount: h.kind === "water" ? 2000 : h.kind === "reading" ? 24 : 1, completed: true });
      xp.push({ userId: uid, source: "habit", sourceId: `${h.id}:${date}`, xp: XP_HABIT, label: `Habit: ${h.name}` });
      if (h.kind === "water") water.push({ userId: uid, date, ml: 1000 }, { userId: uid, date, ml: 1000 });
      if (h.kind === "reading") reading.push({ userId: uid, date, book: books[Math.floor(d / 15) % 3], pages: 24 });
      if (h.kind === "learning") learning.push({ userId: uid, date, title: topics[d % topics.length], explanation: "A quick insight I noted down and want to remember." });
    });
  }
  await db.insert(habitLogs).values(logs);
  await db.insert(waterLogs).values(water);
  await db.insert(readingLogs).values(reading);
  await db.insert(learningEntries).values(learning);

  /* challenges history */
  const ch = [
    ["read15", "Read for 15 minutes", "easy", 15, 20], ["learn", "Learn something new", "easy", 10, 20], ["important", "Complete an important task", "medium", 45, 35],
    ["reflect", "Write a short reflection", "easy", 10, 20], ["skill", "Practice a useful skill", "medium", 30, 35], ["walk", "Take a 20-minute walk", "easy", 20, 20],
  ] as const;
  const crow = await db
    .insert(dailyChallenges)
    .values(ch.map((c, i) => ({ userId: uid, date: addDays(today, -(i + 1)), templateKey: c[0], title: c[1], difficulty: c[2], minutes: c[3], xp: c[4], completedAt: i === 3 ? null : ago(i + 1, 19) })))
    .returning();
  crow.filter((c) => c.completedAt).forEach((c) => xp.push({ userId: uid, source: "challenge", sourceId: c.id, xp: c.xp, label: `Challenge: ${c.title}` }));

  /* focus sessions */
  const fs = [0, 0, 1, 1, 2, 3, 3, 4, 6, 7, 7, 9, 10, 13].map((d, i) => {
    const mins = i % 5 === 4 ? 45 : 25;
    const start = new Date(now - d * DAY - (3 + (i % 5)) * 3600000);
    return { userId: uid, mode: "focus", plannedSeconds: mins * 60, startedAt: start, endedAt: new Date(start.getTime() + mins * 60000), actualSeconds: mins * 60, status: "completed" };
  });
  const frows = await db.insert(focusSessions).values(fs).returning();
  frows.forEach((f) => xp.push({ userId: uid, source: "focus", sourceId: f.id, xp: Math.floor(f.actualSeconds / 60), label: "Focus session" }));

  /* notes, journal, wishlist */
  await db.insert(notes).values([
    { userId: uid, type: "idea", title: "App idea: reading streak widget", content: "## Idea\n- Show a tiny widget with **pages read this week**\n- Celebrate streaks gently\n\n- [ ] Sketch layout\n- [ ] Validate with 3 friends", tags: ["ideas", "product"], pinned: true, collection: "Projects" },
    { userId: uid, type: "learned", title: "How spaced repetition works", content: "Reviewing material at **increasing intervals** beats cramming.\n\n1. Learn it\n2. Review after 1 day\n3. Review after 3 days\n4. Review after 1 week", tags: ["learning"], favorite: true },
    { userId: uid, type: "reading", title: "Deep Work — key takeaways", content: "# Deep Work\n- Schedule deep work blocks\n- Embrace boredom\n- Quit social media *selectively*", tags: ["books"], collection: "Reading" },
    { userId: uid, type: "reflection", title: "Weekly reflection", content: "This week I stayed consistent with morning routines. Biggest win: shipped the portfolio.", tags: ["reflection"] },
    { userId: uid, type: "important", title: "Wi-Fi & house info", content: "Router admin: see password manager.\nTrash pickup: **Tuesday**", tags: ["home"] },
  ]);
  await db.insert(journalEntries).values([
    { userId: uid, date: addDays(today, -1), mood: 4, answers: { accomplished: "Finished the design review prep and a 10 km run.", learned: "Short breaks improve my afternoon focus.", grateful: "A quiet morning and good coffee." } },
    { userId: uid, date: addDays(today, -2), mood: 3, answers: { improve: "Start deep work earlier.", tomorrow: "Plan roadmap, run, Spanish practice." } },
  ]);
  await db.insert(wishlistItems).values([
    { userId: uid, title: "Noise-cancelling headphones", note: "For deep work sessions." },
    { userId: uid, title: "Trip to Lisbon", note: "Spring, 5 days." },
    { userId: uid, title: "Mechanical keyboard", note: "Quiet switches." },
  ]);

  /* verified XP + achievements, derived from the seeded records above */
  for (let i = 0; i < xp.length; i += 200) await db.insert(xpTransactions).values(xp.slice(i, i + 200)).onConflictDoNothing();
  await evaluateAchievements(uid, tz, 5);
  return u;
}
