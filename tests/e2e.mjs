// End-to-end API tests: auth, cross-user isolation (IDOR), reward validation, demo mode, profile.
// Usage: BASE_URL=http://127.0.0.1:3000 node tests/e2e.mjs
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
let passed = 0;
const results = [];

class Client {
  jar = {};
  async req(method, path, body, raw) {
    const headers = {};
    if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const cookie = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = c.split(";");
      const [k, v] = pair.split("=");
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(attrs.join(";")) || v === "") delete this.jar[k.trim()];
      else this.jar[k.trim()] = v;
      this.lastCookieAttrs = attrs.join(";");
    }
    if (raw) return res;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  }
}

async function test(name, fn) {
  try { await fn(); passed++; results.push(`  ✓ ${name}`); } catch (e) { results.push(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

const rnd = () => Math.random().toString(36).slice(2, 10);
const A = new Client(), B = new Client(), anon = new Client(), D = new Client();
const emailA = `a_${rnd()}@test.local`, emailB = `b_${rnd()}@test.local`, pw = "correct-horse-battery";
let taskA, noteA, goalA, habitA, msA;

console.log(`LIFE OS e2e against ${BASE}`);

await test("signup A and B", async () => {
  for (const [c, e, n] of [[A, emailA, "Alice Test"], [B, emailB, "Bob Test"]]) {
    const r = await c.req("POST", "/api/auth/signup", { email: e, password: pw, displayName: n, timezone: "UTC" });
    assert.equal(r.status, 200, r.text);
    assert.ok(c.jar.lifeos_session, "session cookie set");
  }
});
await test("session cookie is HttpOnly + SameSite", async () => {
  const c = new Client();
  const r = await c.req("POST", "/api/auth/login", { email: emailA, password: pw }, true);
  const sc = r.headers.getSetCookie().find((x) => x.startsWith("lifeos_session"));
  assert.match(sc, /HttpOnly/i); assert.match(sc, /SameSite=lax/i);
});
await test("duplicate email rejected, weak password rejected, wrong password rejected", async () => {
  assert.equal((await anon.req("POST", "/api/auth/signup", { email: emailA, password: pw, displayName: "Dup Dup" })).status, 409);
  assert.equal((await anon.req("POST", "/api/auth/signup", { email: `x_${rnd()}@t.local`, password: "short", displayName: "Short" })).status, 400);
  assert.equal((await anon.req("POST", "/api/auth/login", { email: emailA, password: "wrong-password" })).status, 401);
});
await test("protected API routes require auth (401)", async () => {
  for (const p of ["/api/me", "/api/tasks", "/api/habits", "/api/goals", "/api/notes", "/api/journal", "/api/focus", "/api/dashboard", "/api/analytics", "/api/export", "/api/notifications", "/api/me/avatar", "/api/youtube/search?q=lofi"]) {
    assert.equal((await anon.req("GET", p)).status, 401, p);
  }
});
await test("protected pages redirect to /login", async () => {
  const r = await anon.req("GET", "/dashboard", undefined, true);
  assert.ok([307, 308].includes(r.status), `status ${r.status}`);
  assert.match(r.headers.get("location") ?? "", /\/login/);
});
await test("login page renders the current Google and email sign-in options", async () => {
  const r = await anon.req("GET", "/login");
  assert.equal(r.status, 200);
  assert.match(r.text, /Continue with Google/);
  assert.match(r.text, /Sign In/);
  assert.match(r.text, /Create an account/);
});

await test("A creates task, note, goal, milestone, habit", async () => {
  taskA = (await A.req("POST", "/api/tasks", { title: "Secret task A", priority: "high" })).json.task;
  noteA = (await A.req("POST", "/api/notes", { title: "Private note A", content: "top secret" })).json.note;
  goalA = (await A.req("POST", "/api/goals", { title: "Goal A" })).json.goal;
  msA = (await A.req("POST", `/api/goals/${goalA.id}/milestones`, { title: "MS A" })).json.milestone;
  habitA = (await A.req("POST", "/api/habits", { name: "Habit A", reminderTime: "08:15" })).json.habit;
  assert.ok(taskA?.id && noteA?.id && goalA?.id && msA?.id && habitA?.id);
  assert.equal(habitA.reminderTime, "08:15", "valid reminder times are accepted");
});
await test("B cannot list A's records", async () => {
  const t = (await B.req("GET", "/api/tasks")).json.tasks, n = (await B.req("GET", "/api/notes")).json.notes, g = (await B.req("GET", "/api/goals")).json.goals, h = (await B.req("GET", "/api/habits")).json.habits;
  assert.equal(t.length + n.length + g.length + h.length, 0);
  const exp = (await B.req("GET", "/api/export")).text;
  assert.ok(!exp.includes("Secret task A") && !exp.includes("top secret"));
  const s = (await B.req("GET", "/api/search?q=Secret")).json.results;
  assert.equal(s.length, 0);
});
await test("B cannot read/modify/delete A's records by id (IDOR → 404)", async () => {
  assert.equal((await B.req("PATCH", `/api/tasks/${taskA.id}`, { title: "hacked" })).status, 404);
  assert.equal((await B.req("DELETE", `/api/tasks/${taskA.id}`)).status, 404);
  assert.equal((await B.req("PATCH", `/api/notes/${noteA.id}`, { content: "hacked" })).status, 404);
  assert.equal((await B.req("DELETE", `/api/notes/${noteA.id}`)).status, 404);
  assert.equal((await B.req("PATCH", `/api/goals/${goalA.id}`, { title: "hacked" })).status, 404);
  assert.equal((await B.req("PATCH", `/api/milestones/${msA.id}`, { completed: true })).status, 404);
  assert.equal((await B.req("POST", `/api/goals/${goalA.id}/milestones`, { title: "x" })).status, 404);
  assert.equal((await B.req("POST", `/api/habits/${habitA.id}/log`, { amount: 1 })).status, 404);
  assert.equal((await B.req("PATCH", `/api/habits/${habitA.id}`, { name: "hacked" })).status, 404);
  const aTasks = (await A.req("GET", "/api/tasks")).json.tasks;
  assert.equal(aTasks[0].title, "Secret task A");
});
await test("B cannot link own task to A's goal or focus A's task", async () => {
  assert.equal((await B.req("POST", "/api/tasks", { title: "x", goalId: goalA.id })).status, 404);
  assert.equal((await B.req("POST", "/api/focus", { mode: "focus", minutes: 25, taskId: taskA.id })).status, 404);
});
await test("client-supplied user_id is ignored", async () => {
  const r = await B.req("POST", "/api/tasks", { title: "B task", userId: (await A.req("GET", "/api/me")).json.user.id });
  assert.equal(r.status, 200);
  assert.equal((await A.req("GET", "/api/tasks")).json.tasks.some((t) => t.title === "B task"), false);
});

await test("task completion pays XP once (no double-claim, restore/recomplete)", async () => {
  const r1 = await A.req("PATCH", `/api/tasks/${taskA.id}`, { status: "completed" });
  assert.equal(r1.json.xp, 20);
  await A.req("PATCH", `/api/tasks/${taskA.id}`, { status: "todo" });
  const r2 = await A.req("PATCH", `/api/tasks/${taskA.id}`, { status: "completed" });
  assert.equal(r2.json.xp, 0);
  const ach = (await A.req("GET", "/api/achievements")).json;
  assert.ok(ach.achievements.find((a) => a.key === "first_task").unlockedAt);
  const taskXp = ach.xpHistory.filter((x) => x.label.startsWith("Task:"));
  assert.equal(taskXp.length, 1);
});
await test("daily challenge: single claim, server validated", async () => {
  const ch = (await A.req("GET", "/api/challenges")).json.today[0];
  const a = await A.req("POST", `/api/challenges/${ch.id}/complete`, {});
  assert.equal(a.status, 200); assert.equal(a.json.xp, ch.xp);
  assert.equal((await A.req("POST", `/api/challenges/${ch.id}/complete`, {})).status, 409);
  assert.equal((await B.req("POST", `/api/challenges/${ch.id}/complete`, {})).status, 404);
});
await test("focus: cannot complete before duration elapsed; early end gives no XP", async () => {
  const s = (await A.req("POST", "/api/focus", { mode: "focus", minutes: 25 })).json.session;
  const c = await A.req("POST", `/api/focus/${s.id}`, { action: "complete" });
  assert.equal(c.status, 400);
  assert.equal((await B.req("POST", `/api/focus/${s.id}`, { action: "end" })).status, 404);
  const e = await A.req("POST", `/api/focus/${s.id}`, { action: "end", activeSeconds: 14000 });
  assert.equal(e.json.xp, 0); assert.ok(e.json.session.actualSeconds <= 5);
});
await test("habit completion rewards once per day; heatmap counts verified records", async () => {
  const a = await A.req("POST", `/api/habits/${habitA.id}/log`, { amount: 1 });
  assert.equal(a.json.xp, 5);
  assert.equal((await A.req("POST", `/api/habits/${habitA.id}/log`, { amount: 1 })).json.xp, 0);
  const an = (await A.req("GET", "/api/analytics")).json;
  const today = an.heatmap.find((d) => d.date === an.today);
  assert.ok(today.tasks >= 1 && today.habits >= 1 && today.challenges >= 1);
  assert.ok(today.score > 0 && today.level >= 1 && today.level <= 4, "verified activity maps to a visible heatmap intensity");
  const bn = (await B.req("GET", "/api/analytics")).json;
  assert.ok(bn.heatmap.length > 0, "the heatmap returns a complete date range");
  assert.ok(bn.heatmap.every((day) => day.score === 0 && day.tasks === 0 && day.habits === 0 && day.challenges === 0 && day.focusMinutes === 0), "B has no recorded activity in any heatmap day");
});
await test("opening the app does not create activity (B stays at zero)", async () => {
  await B.req("GET", "/api/dashboard");
  const d = (await B.req("GET", "/api/dashboard")).json;
  assert.equal(d.score, 0); assert.equal(d.streak.current, 0);
});

await test("preferences are per-user and validated", async () => {
  const bad = await A.req("PATCH", "/api/me/prefs", { theme: { accent: "red" } });
  assert.equal(bad.status, 400);
  const cur = (await A.req("GET", "/api/me")).json.prefs.theme;
  const ok = await A.req("PATCH", "/api/me/prefs", { theme: { ...cur, preset: "aurora", accent: "#2dd4bf", targets: { ...cur.targets, buttons: true }, gradient: { ...cur.gradient, animated: true } } });
  assert.equal(ok.status, 200);
  assert.equal((await A.req("GET", "/api/me")).json.prefs.theme.accent, "#2dd4bf");
  assert.equal((await B.req("GET", "/api/me")).json.prefs.theme.accent, "#8b7cff", "B unaffected");
  assert.equal((await A.req("PATCH", "/api/me/prefs", { bogus: 1 })).status, 400);
});
await test("profile: name validation, trim, email unchanged", async () => {
  assert.equal((await A.req("PATCH", "/api/me", { displayName: " " })).status, 400);
  assert.equal((await A.req("PATCH", "/api/me", { displayName: "x" })).status, 400);
  const r = await A.req("PATCH", "/api/me", { displayName: "  Alice   Renamed  " });
  assert.equal(r.json.user.displayName, "Alice Renamed"); assert.equal(r.json.user.email, emailA);
  assert.equal((await B.req("GET", "/api/me")).json.user.displayName, "Bob Test");
});
await test("avatar: validates type/size, per-user, replace + remove", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const fd = () => { const f = new FormData(); f.append("file", new Blob([png], { type: "image/png" }), "a.png"); return f; };
  const bad = new FormData(); bad.append("file", new Blob(["<svg onload=alert(1)>"], { type: "image/png" }), "x.png");
  assert.equal((await A.req("POST", "/api/me/avatar", bad)).status, 400);
  const up = await A.req("POST", "/api/me/avatar", fd());
  assert.equal(up.status, 200); assert.equal(up.json.avatarVersion, 1);
  const get = await A.req("GET", "/api/me/avatar", undefined, true);
  assert.equal(get.status, 200); assert.equal(get.headers.get("content-type"), "image/png");
  assert.equal((await B.req("GET", "/api/me/avatar")).status, 404, "B never sees A's avatar");
  assert.equal((await A.req("POST", "/api/me/avatar", fd())).json.avatarVersion, 2);
  assert.equal((await A.req("DELETE", "/api/me/avatar")).json.avatarVersion, null);
  assert.equal((await A.req("GET", "/api/me/avatar")).status, 404);
});
await test("CSRF: cross-origin mutation blocked", async () => {
  const res = await fetch(BASE + "/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example", Cookie: `lifeos_session=${A.jar.lifeos_session}` }, body: JSON.stringify({ title: "csrf" }) });
  assert.equal(res.status, 403);
});
await test("Spotify routes: auth required, status reflects config", async () => {
  assert.equal((await anon.req("GET", "/api/spotify/status")).status, 401);
  const s = await A.req("GET", "/api/spotify/status");
  assert.equal(s.status, 200); assert.equal(s.json.connected, false);
  assert.equal((await A.req("GET", "/api/spotify/now-playing")).status, 401); // not connected -> typed error, no fake data
  assert.equal((await A.req("GET", "/api/spotify/art?url=https://evil.example/x.png")).status, 400);
  const cb = await A.req("GET", "/api/spotify/callback?code=x&state=y", undefined, true);
  assert.match(cb.headers.get("location") ?? "", /error=invalid_state/);
});


/* ---------------- study & daily suggestions ---------------- */
await test("study subjects and flashcards are account-scoped", async () => {
  const subject = (await A.req("POST", "/api/study/subjects", { name: "Study isolation subject", color: "#8b7cff" })).json.subject;
  assert.ok(subject?.id);
  const first = (await A.req("POST", "/api/study/flashcards", { front: "What is spaced repetition?", back: "Reviewing at increasing intervals.", subjectId: subject.id })).json.card;
  const second = (await A.req("POST", "/api/study/flashcards", { front: "Second due card", back: "A due review." })).json.card;
  assert.ok(first?.id && second?.id);
  assert.equal((await B.req("GET", "/api/study/subjects")).json.subjects.length, 0);
  assert.equal((await B.req("GET", "/api/study/flashcards")).json.cards.length, 0);
  assert.equal((await B.req("POST", "/api/study/review", { cardId: first.id, rating: "good" })).status, 404);
  assert.equal((await B.req("POST", "/api/study/flashcards", { front: "Cross-user", back: "Must reject", subjectId: subject.id })).status, 404);
});

await test("spaced repetition review updates schedule and history atomically", async () => {
  const cards = (await A.req("GET", "/api/study/flashcards?due=1")).json.cards;
  const card = cards.find((item) => item.front === "What is spaced repetition?");
  assert.ok(card?.id);
  const reviewed = await A.req("POST", "/api/study/review", { cardId: card.id, rating: "good" });
  assert.equal(reviewed.status, 200, reviewed.text);
  assert.equal(reviewed.json.intervalDays, 1);
  assert.equal(reviewed.json.card.repetitions, 1);
  assert.ok(new Date(reviewed.json.dueAt).getTime() > Date.now());
  const dueAgain = (await A.req("GET", "/api/study/flashcards?due=1")).json.cards;
  assert.equal(dueAgain.some((item) => item.id === card.id), false);
  assert.equal((await B.req("POST", "/api/study/review", { cardId: card.id, rating: "easy" })).status, 404);
});

await test("daily study suggestions rank study work and persist accept/dismiss decisions", async () => {
  const initial = await A.req("GET", "/api/study/suggestions");
  assert.equal(initial.status, 200);
  assert.ok(initial.json.date);
  const taskResponse = await A.req("POST", "/api/tasks", {
    title: "Daily suggestion study task",
    category: "Study",
    priority: "high",
    status: "todo",
    dueDate: initial.json.date,
    dueTime: "09:30",
    tags: ["study"],
  });
  assert.equal(taskResponse.status, 200, taskResponse.text);
  const task = taskResponse.json.task;
  assert.ok(task?.id, "study task should be created before checking its suggestion");
  const plan = (await A.req("GET", "/api/study/suggestions")).json;
  const taskSuggestion = plan.suggestions.find((item) => item.taskId === task.id);
  const reviewSuggestion = plan.suggestions.find((item) => item.kind === "review");
  assert.ok(taskSuggestion, "open study task should be suggested");
  assert.ok(reviewSuggestion, "due flashcards should produce a review suggestion");
  assert.ok(taskSuggestion.minutes >= 1 && taskSuggestion.minutes <= 240);
  const accepted = await A.req("POST", "/api/study/suggestions", {
    date: plan.date, suggestionKey: taskSuggestion.key, status: "accepted",
  });
  assert.equal(accepted.status, 200, accepted.text);
  assert.equal(accepted.json.ok, true);
  const dismissed = await A.req("POST", "/api/study/suggestions", {
    date: plan.date, suggestionKey: reviewSuggestion.key, status: "dismissed",
  });
  assert.equal(dismissed.json.ok, true);
  const refreshed = (await A.req("GET", "/api/study/suggestions")).json;
  assert.equal(refreshed.suggestions.find((item) => item.key === taskSuggestion.key).status, "accepted");
  assert.equal(refreshed.suggestions.find((item) => item.key === reviewSuggestion.key).status, "dismissed");
  assert.equal((await B.req("GET", "/api/study/suggestions")).json.suggestions.length, 0);
  const expired = await A.req("POST", "/api/study/suggestions", {
    date: "2000-01-01", suggestionKey: taskSuggestion.key, status: "accepted",
  });
  assert.equal(expired.status, 409);
  assert.equal((await A.req("POST", "/api/study/suggestions", {
    date: plan.date, suggestionKey: taskSuggestion.key, status: "invalid",
  })).status, 400);
});


await test("water, reading and learning trackers persist per user and update linked habit progress", async () => {
  const waterHabit = (await A.req("POST", "/api/habits", { name: "Water tracker test", kind: "water", target: 2000 })).json.habit;
  const readingHabit = (await A.req("POST", "/api/habits", { name: "Reading tracker test", kind: "reading", target: 15 })).json.habit;
  const learningHabit = (await A.req("POST", "/api/habits", { name: "Learning tracker test", kind: "learning", target: 2 })).json.habit;
  assert.ok(waterHabit?.id && readingHabit?.id && learningHabit?.id);

  await A.req("POST", "/api/trackers/water", { ml: 500 });
  const reading = (await A.req("POST", "/api/trackers/reading", { book: "Test book", pages: 5 })).json;
  const learning = (await A.req("POST", "/api/trackers/learning", { title: "Test concept", explanation: "A short explanation." })).json;
  assert.ok(reading.ok && learning.ok);

  const tracker = (await A.req("GET", "/api/trackers")).json;
  assert.equal(tracker.water.total, 500);
  assert.equal(tracker.reading.todayPages, 5);
  assert.equal(tracker.learning.todayCount, 1);
  const mine = (await A.req("GET", "/api/habits")).json.habits;
  assert.equal(mine.find((h) => h.id === waterHabit.id).todayAmount, 500);
  assert.equal(mine.find((h) => h.id === readingHabit.id).todayAmount, 5);
  assert.equal(mine.find((h) => h.id === learningHabit.id).todayAmount, 1);

  const other = (await B.req("GET", "/api/trackers")).json;
  assert.equal(other.water.total, 0);
  assert.equal(other.reading.entries.length, 0);
  assert.equal(other.learning.entries.length, 0);
  assert.ok(tracker.reading.entries[0]?.id);
  assert.equal((await B.req("DELETE", `/api/trackers/reading?id=${tracker.reading.entries[0].id}`)).status, 404);
});

await test("tracker retries with the same clientActionId never duplicate persisted entries", async () => {
  const actionId = "d6c8a4f0-91a7-4d3b-9b31-2c6f1a7e5d40";
  const before = (await A.req("GET", "/api/trackers")).json;
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await A.req("POST", "/api/trackers/water", { ml: 250, clientActionId: actionId })).status, 200);
    assert.equal((await A.req("POST", "/api/trackers/reading", { book: "Idempotent book", pages: 3, clientActionId: actionId })).status, 200);
    assert.equal((await A.req("POST", "/api/trackers/learning", { title: "Idempotent concept", explanation: "", clientActionId: actionId })).status, 200);
  }
  const after = (await A.req("GET", "/api/trackers")).json;
  assert.equal(after.water.total - before.water.total, 250);
  assert.equal(after.reading.todayPages - before.reading.todayPages, 3);
  assert.equal(after.learning.todayCount - before.learning.todayCount, 1);
});


await test("focus pause and resume preserve active time and enforce session ownership", async () => {
  const session = (await A.req("POST", "/api/focus", { mode: "focus", minutes: 5 })).json.session;
  assert.ok(session?.id);
  const paused = await A.req("POST", `/api/focus/${session.id}`, { action: "pause" });
  assert.equal(paused.status, 200, paused.text);
  assert.equal(paused.json.session.status, "paused");
  assert.equal((await A.req("POST", `/api/focus/${session.id}`, { action: "complete" })).status, 400);
  assert.equal((await B.req("POST", `/api/focus/${session.id}`, { action: "resume" })).status, 404);
  const resumed = await A.req("POST", `/api/focus/${session.id}`, { action: "resume" });
  assert.equal(resumed.status, 200, resumed.text);
  assert.equal(resumed.json.session.status, "running");
  const ended = await A.req("POST", `/api/focus/${session.id}`, { action: "end" });
  assert.equal(ended.status, 200);
  assert.equal(ended.json.xp, 0);
  assert.ok(ended.json.session.actualSeconds <= 5);
});

await test("Focus background and custom font uploads are validated and private per account", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const imageForm = new FormData();
  imageForm.append("file", new Blob([png], { type: "image/png" }), "focus.png");
  const uploadedImage = await A.req("POST", "/api/me/focus-background", imageForm);
  assert.equal(uploadedImage.status, 200, uploadedImage.text);
  const image = await A.req("GET", "/api/me/focus-background", undefined, true);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal((await B.req("GET", "/api/me/focus-background")).status, 404);
  const invalidImage = new FormData();
  invalidImage.append("file", new Blob(["not an image"], { type: "image/png" }), "bad.png");
  assert.equal((await A.req("POST", "/api/me/focus-background", invalidImage)).status, 400);
  assert.equal((await A.req("DELETE", "/api/me/focus-background", {})).status, 200);

  const fontForm = new FormData();
  fontForm.append("file", new Blob([Buffer.from("wOF2test-font-signature")], { type: "font/woff2" }), "custom.woff2");
  const uploadedFont = await A.req("POST", "/api/me/font", fontForm);
  assert.equal(uploadedFont.status, 200, uploadedFont.text);
  const meta = await A.req("GET", "/api/me/font?meta=1");
  assert.equal(meta.status, 200);
  assert.equal(meta.json.mime, "font/woff2");
  const font = await A.req("GET", "/api/me/font", undefined, true);
  assert.equal(font.status, 200);
  assert.equal(font.headers.get("content-type"), "font/woff2");
  assert.equal((await B.req("GET", "/api/me/font?meta=1")).status, 404);
  assert.equal((await A.req("DELETE", "/api/me/font", {})).status, 200);
});


await test("Music Detection pairing, now-playing updates and device revocation are isolated", async () => {
  const paired = await A.req("POST", "/api/music-bridge/pair", { platform: "android", deviceName: "Android Test Device" });
  assert.equal(paired.status, 200, paired.text);
  assert.ok(paired.json.device?.id && paired.json.token);
  const deviceId = paired.json.device.id;
  const token = paired.json.token;
  assert.equal((await B.req("GET", "/api/music-bridge/devices")).json.devices.length, 0);

  const pushed = await fetch(BASE + "/api/music-bridge/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Bridge test track", artist: "Test artist", album: "Test album",
      appName: "Test player", isPlaying: true, positionMs: 12000, durationMs: 180000,
    }),
  });
  assert.equal(pushed.status, 200, await pushed.text());
  const now = await A.req("GET", "/api/music-bridge/now-playing");
  assert.equal(now.json.idle, false);
  assert.equal(now.json.track.title, "Bridge test track");
  assert.equal(now.json.track.artist, "Test artist");
  assert.equal(now.json.progressMs, 12000);
  assert.equal((await B.req("GET", "/api/music-bridge/now-playing")).json.idle, true);

  assert.equal((await A.req("POST", "/api/music-bridge/revoke", { deviceId })).status, 200);
  const revoked = await fetch(BASE + "/api/music-bridge/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Should be rejected" }),
  });
  assert.equal(revoked.status, 401);
  assert.equal((await A.req("GET", "/api/music-bridge/devices")).json.devices.length, 0);
});

/* ---------------- current authentication surface ---------------- */
await test("legacy demo sign-in endpoint is not exposed", async () => {
  assert.equal((await anon.req("POST", "/api/auth/demo", { timezone: "UTC" })).status, 404);
});

/* ---------------- logout / persistence / regular auth still works ---------------- */
await test("logout, login again, preferences & profile persisted", async () => {
  assert.equal((await A.req("POST", "/api/auth/logout", {})).status, 200);
  assert.equal((await A.req("GET", "/api/me")).status, 401);
  assert.equal((await A.req("POST", "/api/auth/login", { email: emailA, password: pw })).status, 200);
  const me = (await A.req("GET", "/api/me")).json;
  assert.equal(me.user.displayName, "Alice Renamed"); assert.equal(me.prefs.theme.preset, "aurora");
});
await test("password reset flow: generic response, invalid token rejected", async () => {
  const r = await anon.req("POST", "/api/auth/forgot", { email: "nobody@test.local" });
  assert.equal(r.status, 200);
  assert.equal((await anon.req("POST", "/api/auth/reset", { token: "x".repeat(40), password: "new-password-123" })).status, 400);
});
await test("account deletion removes data (cascade)", async () => {
  assert.equal((await B.req("DELETE", "/api/me/account", { password: "nope-nope" })).status, 400);
  assert.equal((await B.req("DELETE", "/api/me/account", { password: pw })).status, 200);
  assert.equal((await B.req("GET", "/api/me")).status, 401);
  assert.equal((await anon.req("POST", "/api/auth/login", { email: emailB, password: pw })).status, 401);
});

console.log(results.join("\n"));
console.log(`\n${passed}/${results.length} passed`);
