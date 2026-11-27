// End-to-end API tests: auth, cross-user isolation (IDOR), reward validation, profile.
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
const A = new Client(), B = new Client(), anon = new Client();
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
  for (const p of ["/api/me", "/api/tasks", "/api/habits", "/api/goals", "/api/notes", "/api/journal", "/api/focus", "/api/dashboard", "/api/analytics", "/api/export", "/api/notifications", "/api/me/avatar"]) {
    assert.equal((await anon.req("GET", p)).status, 401, p);
  }
});
await test("protected pages redirect to /login", async () => {
  const r = await anon.req("GET", "/dashboard", undefined, true);
  assert.ok([307, 308].includes(r.status), `status ${r.status}`);
  assert.match(r.headers.get("location") ?? "", /\/login/);
});
await test("login page renders standard email sign-in without demo mode", async () => {
  const r = await anon.req("GET", "/login");
  assert.equal(r.status, 200);
  assert.match(r.text, /Welcome back/);
  assert.match(r.text, /you@example\.com/);
  assert.match(r.text, /Sign In/);
  assert.doesNotMatch(r.text, /Try Demo|explore without an account/i);
});

await test("A creates task, note, goal, milestone, habit", async () => {
  taskA = (await A.req("POST", "/api/tasks", { title: "Secret task A", priority: "high" })).json.task;
  noteA = (await A.req("POST", "/api/notes", { title: "Private note A", content: "top secret" })).json.note;
  goalA = (await A.req("POST", "/api/goals", { title: "Goal A" })).json.goal;
  msA = (await A.req("POST", `/api/goals/${goalA.id}/milestones`, { title: "MS A" })).json.milestone;
  habitA = (await A.req("POST", "/api/habits", { name: "Habit A" })).json.habit;
  assert.ok(taskA?.id && noteA?.id && goalA?.id && msA?.id && habitA?.id);
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
  const bn = (await B.req("GET", "/api/analytics")).json;
  assert.ok(bn.heatmap.length > 0, "heatmap contains the calendar days for the selected year");
  assert.ok(bn.heatmap.every((d) => d.score === 0 && d.tasks === 0 && d.habits === 0 && d.challenges === 0 && d.focus === 0 && d.focusMinutes === 0 && d.milestones === 0), "B has no activity in any heatmap day");
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
