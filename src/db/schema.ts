import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ossv2 = pgSchema("ossv2");

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const userRef = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

/* ---------------------------------- identity --------------------------------- */
export const users = ossv2.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  hasPassword: boolean("has_password").notNull().default(true),
  googleAuthId: text("google_auth_id").unique(),
  displayName: text("display_name").notNull(),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
  dailyGoal: integer("daily_goal").notNull().default(5),
  emailVerified: boolean("email_verified").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  onboarded: boolean("onboarded").notNull().default(false),
  avatarVersion: integer("avatar_version"),
  preferences: jsonb("preferences").notNull().default({}),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const avatars = ossv2.table("avatars", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const focusBackgrounds = ossv2.table("focus_backgrounds", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const customFonts = ossv2.table("custom_fonts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const studySubjects = ossv2.table("study_subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userRef(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b7cff"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("study_subjects_user_idx").on(t.userId),
}));

export const flashcards = ossv2.table("flashcards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userRef(),
  subjectId: uuid("subject_id").references(() => studySubjects.id, { onDelete: "set null" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  dueAt: ts("due_at").notNull().defaultNow(),
  intervalDays: integer("interval_days").notNull().default(0),
  easeFactor: integer("ease_factor").notNull().default(2500),
  repetitions: integer("repetitions").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  lastReviewedAt: ts("last_reviewed_at"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => ({
  userDueIdx: index("flashcards_user_due_idx").on(t.userId, t.dueAt),
  subjectIdx: index("flashcards_subject_idx").on(t.subjectId),
}));

export const flashcardReviews = ossv2.table("flashcard_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userRef(),
  flashcardId: uuid("flashcard_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  rating: text("rating").notNull(),
  intervalBefore: integer("interval_before").notNull(),
  intervalAfter: integer("interval_after").notNull(),
  reviewedAt: createdAt(),
}, (t) => ({
  userReviewedIdx: index("flashcard_reviews_user_reviewed_idx").on(t.userId, t.reviewedAt),
}));


export const sessions = ossv2.table(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const authTokens = ossv2.table("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userRef(),
  type: text("type").notNull(), // reset | verify
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
}, (t) => [index("auth_tokens_user_idx").on(t.userId)]);

/* ----------------------------------- goals ----------------------------------- */
export const goals = ossv2.table(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: text("type").notNull().default("monthly"),
    category: text("category").notNull().default("Personal Growth"),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("active"), // active | completed | paused
    manualProgress: integer("manual_progress").notNull().default(0),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

export const goalMilestones = ossv2.table(
  "goal_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    userId: userRef(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    deadline: date("deadline"),
    completedAt: ts("completed_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("milestones_goal_idx").on(t.goalId), index("milestones_user_idx").on(t.userId)],
);

/* ----------------------------------- tasks ----------------------------------- */
export const tasks = ossv2.table(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("General"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("todo"), // todo | in_progress | completed | archived
    dueDate: date("due_date"),
    dueTime: text("due_time"),
    reminderMinutes: integer("reminder_minutes"),
    tags: text("tags").array().notNull().default([]),
    recurrence: text("recurrence").notNull().default("none"), // none | daily | weekly | monthly
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    milestoneId: uuid("milestone_id").references(() => goalMilestones.id, { onDelete: "set null" }),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("tasks_user_status_idx").on(t.userId, t.status), index("tasks_user_due_idx").on(t.userId, t.dueDate), index("tasks_goal_idx").on(t.goalId), index("tasks_milestone_idx").on(t.milestoneId)],
);

/* ---------------------------------- habits ----------------------------------- */
export const habits = ossv2.table(
  "habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("sparkles"),
    kind: text("kind").notNull().default("standard"), // standard | water | reading | learning
    days: integer("days").array().notNull().default([0, 1, 2, 3, 4, 5, 6]),
    target: integer("target").notNull().default(1),
    unit: text("unit").notNull().default(""),
    reminderTime: text("reminder_time"),
    startDate: date("start_date").notNull().defaultNow(),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("habits_user_idx").on(t.userId)],
);

export const habitLogs = ossv2.table(
  "habit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    amount: integer("amount").notNull().default(1),
    completed: boolean("completed").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("habit_logs_unique").on(t.habitId, t.date), index("habit_logs_user_date_idx").on(t.userId, t.date)],
);

export const waterLogs = ossv2.table(
  "water_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    date: date("date").notNull(),
    ml: integer("ml").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("water_user_date_idx").on(t.userId, t.date)],
);

export const readingLogs = ossv2.table(
  "reading_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    date: date("date").notNull(),
    book: text("book").notNull(),
    pages: integer("pages").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("reading_user_date_idx").on(t.userId, t.date)],
);

export const learningEntries = ossv2.table(
  "learning_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    date: date("date").notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("learning_user_date_idx").on(t.userId, t.date)],
);

/* -------------------------------- challenges --------------------------------- */
export const dailyChallenges = ossv2.table(
  "daily_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    date: date("date").notNull(),
    templateKey: text("template_key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    difficulty: text("difficulty").notNull().default("easy"),
    minutes: integer("minutes").notNull().default(10),
    xp: integer("xp").notNull().default(20),
    isCustom: boolean("is_custom").notNull().default(false),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("daily_challenges_unique").on(t.userId, t.date, t.templateKey)],
);

/* ----------------------------------- focus ----------------------------------- */
export const focusSessions = ossv2.table(
  "focus_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    mode: text("mode").notNull().default("focus"), // focus | short_break | long_break | custom
    plannedSeconds: integer("planned_seconds").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastResumedAt: ts("last_resumed_at"),
    pausedAt: ts("paused_at"),
    endedAt: ts("ended_at"),
    actualSeconds: integer("actual_seconds").notNull().default(0),
    status: text("status").notNull().default("running"), // running | completed | ended
  },
  (t) => [index("focus_user_idx").on(t.userId, t.startedAt), index("focus_task_idx").on(t.taskId)],
);

/* ------------------------------------ notes ---------------------------------- */
export const notes = ossv2.table(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    type: text("type").notNull().default("quick"),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    collection: text("collection").notNull().default(""),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("notes_user_idx").on(t.userId, t.updatedAt)],
);

export const journalEntries = ossv2.table(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    date: date("date").notNull(),
    mood: integer("mood"),
    answers: jsonb("answers").notNull().default({}),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("journal_unique").on(t.userId, t.date)],
);

export const wishlistItems = ossv2.table(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    url: text("url").notNull().default(""),
    acquiredAt: ts("acquired_at"),
    createdAt: createdAt(),
  },
  (t) => [index("wishlist_user_idx").on(t.userId)],
);

/* --------------------------------- gamification ------------------------------ */
export const userAchievements = ossv2.table(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    key: text("key").notNull(),
    unlockedAt: ts("unlocked_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_achievements_unique").on(t.userId, t.key)],
);

export const xpTransactions = ossv2.table(
  "xp_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    xp: integer("xp").notNull(),
    label: text("label").notNull().default(""),
    createdAt: createdAt(),
  },
  // one reward per verified source record: prevents duplicate claims
  (t) => [uniqueIndex("xp_unique_source").on(t.userId, t.source, t.sourceId)],
);

export const weeklyReviews = ossv2.table(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    weekStart: date("week_start").notNull(),
    reflections: jsonb("reflections").notNull().default({}),
    intentions: text("intentions").notNull().default(""),
    priorityGoalIds: jsonb("priority_goal_ids").notNull().default([]),
    priorityTaskIds: jsonb("priority_task_ids").notNull().default([]),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weekly_reviews_unique").on(t.userId, t.weekStart)],
);

/* ------------------------------- notifications ------------------------------- */
export const notifications = ossv2.table(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    dedupeKey: text("dedupe_key").notNull(),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("notifications_dedupe").on(t.userId, t.dedupeKey)],
);

export const pushSubscriptions = ossv2.table("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: userRef(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: createdAt(),
}, (t) => [index("push_subscriptions_user_idx").on(t.userId)]);

/* ---------------------------------- spotify ---------------------------------- */
export const spotifyConnections = ossv2.table("spotify_connections", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  expiresAt: ts("expires_at").notNull(),
  scope: text("scope").notNull().default(""),
  spotifyUserId: text("spotify_user_id").notNull().default(""),
  displayName: text("display_name").notNull().default(""),
  product: text("product").notNull().default(""),
  imageUrl: text("image_url"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* -------------------------- cross-device music bridge ------------------------- */
export const musicBridgeDevices = ossv2.table(
  "music_bridge_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    tokenHash: text("token_hash").notNull().unique(),
    platform: text("platform").notNull(), // android | windows
    deviceName: text("device_name").notNull().default("Device"),
    trackTitle: text("track_title"),
    artist: text("artist"),
    album: text("album"),
    artwork: text("artwork"),
    trackUrl: text("track_url"),
    appName: text("app_name").notNull().default("Spotify"),
    isPlaying: boolean("is_playing").notNull().default(false),
    positionMs: integer("position_ms").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("music_bridge_user_updated_idx").on(t.userId, t.updatedAt)],
);
