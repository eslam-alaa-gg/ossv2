// Browser tests for the quick habit tracker, dashboard grid and Focus Room blur.
// Needs a running app and Playwright (not a project dependency):
//   npm install --no-save playwright && npx playwright install --with-deps chromium webkit
//   BASE_URL=http://127.0.0.1:3000 node tests/browser.mjs
// It creates throwaway accounts, so point it at a disposable database.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, devices, webkit } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const SHOTS = process.env.SHOTS_DIR || "screenshots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const consoleErrors = [];
let current = "setup";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function step(name, fn) {
  current = name;
  try { await fn(); results.push(`PASS ${name}`); console.log(`PASS ${name}`); }
  catch (e) { results.push(`FAIL ${name}`); console.log(`FAIL ${name}\n     ${String(e.stack || e).split("\n").slice(0, 8).join("\n     ")}`); process.exitCode = 1; }
}

const run = Math.random().toString(36).slice(2, 8);
let users = 0;
async function session(browser, options = {}) {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1300 }, ...options });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`[${current}] ${m.text()} ${m.location().url ?? ""}`); });
  page.on("pageerror", (e) => consoleErrors.push(`[${current}] pageerror: ${e.message}`));
  const api = async (method, url, data) => {
    const res = await context.request.fetch(url, { method, data });
    const json = await res.json().catch(() => ({}));
    assert.ok(res.ok(), `${method} ${url} -> ${res.status()} ${JSON.stringify(json)}`);
    return json;
  };
  const email = `ui_${run}_${++users}@test.local`;
  const password = "correct-horse-battery";
  await api("POST", "/api/auth/signup", { email, password, displayName: "Ui Tester", timezone: "Africa/Cairo" });
  await api("PATCH", "/api/me", { onboarded: true });
  return { context, page, api, email, password };
}

const habitsByKind = async (api) => Object.fromEntries((await api("GET", "/api/habits")).habits.map((h) => [h.kind, h]));
const panel = (page) => page.locator("#habit-quick-panel");
async function openPanel(page) {
  const trigger = page.getByRole("button", { name: /Habit quick tracker|متابعة العادات السريعة/ });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await panel(page).waitFor({ state: "detached" }); // let a closing panel finish
    await trigger.click();
  }
  await panel(page).locator("[data-habit]").first().waitFor();
  await pause(300);
}
const ring = (page, kind) => panel(page).locator(`[data-habit="${kind}"] button`);
const percent = async (page, kind) => Number(await panel(page).locator(`[data-habit="${kind}"]`).getAttribute("data-percent"));
const overall = async (page) => Number(await panel(page).getByTestId("habit-overall").getAttribute("aria-valuenow"));
async function expectPercent(page, kind, value) {
  await page.waitForFunction(([k, v]) => document.querySelector(`#habit-quick-panel [data-habit="${k}"]`)?.getAttribute("data-percent") === String(v), [kind, value], { timeout: 10000 })
    .catch(async () => assert.equal(await percent(page, kind), value, `${kind} percent`));
}
async function insideViewport(page, locator) {
  const box = await locator.boundingBox();
  const size = page.viewportSize();
  assert.ok(box, "visible");
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 0.5 && box.y + box.height <= size.height + 0.5, `outside viewport ${JSON.stringify(box)} in ${JSON.stringify(size)}`);
}
const noSidewaysScroll = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "page scrolls sideways");

const widgets = (page) => page.$$eval(".dash-item", (els) => els.map((e) => {
  const r = e.getBoundingClientRect();
  const content = e.querySelector(".dash-content");
  return { id: e.dataset.widget, x: Math.round(r.x), y: Math.round(r.y + window.scrollY), width: Math.round(r.width), height: Math.round(r.height), col: Number(e.dataset.x), span: Number(e.dataset.w), fixed: e.dataset.h, content: content.offsetHeight };
}));
const byId = (list) => Object.fromEntries(list.map((w) => [w.id, w]));
const geometry = (list) => list.map(({ id, x, y, width, height, fixed }) => ({ id, x, y, width, height, fixed })).sort((a, b) => a.id.localeCompare(b.id));
async function settle(page) {
  await page.locator(".dash-grid.dash-ready .dash-item").first().waitFor();
  let previous = "";
  for (let i = 0; i < 30; i++) {
    await pause(250);
    const next = JSON.stringify(await widgets(page));
    if (next === previous) return;
    previous = next;
  }
}
async function checkGrid(page, label) {
  const list = await widgets(page);
  const grid = await page.locator(".dash-grid").boundingBox();
  for (const a of list) {
    assert.ok(a.x >= grid.x - 1 && a.x + a.width <= grid.x + grid.width + 1, `${label}: ${a.id} leaves the grid`);
    if (a.fixed === "auto") assert.ok(a.content <= a.height + 1, `${label}: ${a.id} content clipped (${a.content} > ${a.height})`);
    for (const b of list) {
      if (a.id >= b.id) continue;
      const overlap = a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
      assert.ok(!overlap, `${label}: ${a.id} overlaps ${b.id}`);
    }
  }
  return list;
}
function saved(page) {
  const response = page.waitForResponse((r) => r.url().includes("/api/me/prefs") && r.request().method() === "PATCH" && r.ok());
  response.catch(() => {}); // reported by the step that awaits it
  return response;
}
async function center(locator) { const b = await locator.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function mouseDrag(page, from, to, during) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 25 });
  await pause(350);
  if (during) await during();
  await page.mouse.up();
}
async function touchDrag(cdp, from, to, during) {
  const send = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
  await send("touchStart", from);
  for (let i = 1; i <= 25; i++) { await send("touchMove", { x: from.x + ((to.x - from.x) * i) / 25, y: from.y + ((to.y - from.y) * i) / 25 }); await pause(16); }
  await pause(350);
  if (during) await during();
  await send("touchEnd");
}

/** A hard-edged checkerboard: sharp it has a very high contrast, blurred it flattens out. */
async function testImage(page, { width = 1200, height = 900, noisy = false } = {}) {
  const url = await page.evaluate(([w, h, n]) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d");
    if (n) {
      const data = x.createImageData(w, h);
      for (let i = 0; i < data.data.length; i += 4) { const p = i / 4; data.data[i] = (p % w) / w * 200 + Math.random() * 40; data.data[i + 1] = Math.floor(p / w) / h * 200 + Math.random() * 40; data.data[i + 2] = 120 + Math.random() * 40; data.data[i + 3] = 255; }
      x.putImageData(data, 0, 0);
    } else for (let i = 0; i < w; i += 16) for (let j = 0; j < h; j += 16) { x.fillStyle = (i + j) % 32 ? "#fff" : "#000"; x.fillRect(i, j, 16, 16); }
    return c.toDataURL("image/png");
  }, [width, height, noisy]);
  return { name: "background.png", mimeType: "image/png", buffer: Buffer.from(url.split(",")[1], "base64") };
}
async function contrast(page, clip) {
  const shot = (await page.screenshot({ clip, scale: "css" })).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const l = []; for (let i = 0; i < d.length; i += 4) l.push((d[i] + d[i + 1] + d[i + 2]) / 3);
    const mean = l.reduce((a, b) => a + b, 0) / l.length;
    return Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / l.length);
  }, shot);
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: "jpeg", quality: 55, scale: "css" });

async function focusChecks(page, label) {
  const image = page.getByTestId("focus-bg-image");
  const filter = () => image.last().evaluate((e) => getComputedStyle(e).filter);
  await page.goto("/focus");
  await page.waitForLoadState("networkidle");
  let original;
  await step(`${label}: uploading an image shows a blurred preview immediately`, async () => {
    await page.locator('input[type="file"]').setInputFiles(await testImage(page));
    await image.first().waitFor();
    assert.match(await filter(), /^blur\(\d+px\)$/);
    original = await page.evaluate(() => localStorage.getItem("ukiyo.focus.background"));
    assert.ok(original.startsWith("data:image/"));
  });
  const full = async () => {
    await page.getByRole("button", { name: "Fullscreen focus mode" }).click();
    await page.getByRole("button", { name: "Exit fullscreen focus" }).waitFor({ state: "visible" });
    await pause(700);
  };
  const exit = async () => {
    const exitButton = page.getByRole("button", { name: "Exit fullscreen focus" });
    if (await exitButton.isVisible().catch(() => false)) await exitButton.click();
    // The page can use native Fullscreen API or its in-page immersive fallback (notably iOS).
    await page.getByRole("button", { name: "Fullscreen focus mode" }).waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.fullscreenElement, { timeout: 5000 });
  };
  const clip = { x: 4, y: 4, width: 70, height: 70 };
  await step(`${label}: full-screen focus blurs the image only, not the controls`, async () => {
    await full();
    try {
      assert.equal(await filter(), "blur(14px)");
      const filtered = await page.getByRole("timer").evaluate((e) => { const out = []; for (let n = e; n; n = n.parentElement) { const f = getComputedStyle(n).filter; if (f !== "none") out.push(f); } return out; });
      assert.deepEqual(filtered, []);
      const size = page.viewportSize();
      const box = await image.last().boundingBox();
      assert.ok(box.x <= 0 && box.y <= 0 && box.x + box.width >= size.width - 1 && box.y + box.height >= size.height - 1, `image does not cover the screen ${JSON.stringify(box)}`);
      const c = await contrast(page, clip);
      assert.ok(c < 20, `blurred background still has contrast ${c}`);
      await shot(page, `${label}-focus-blur-on`);
    } finally {
      await exit();
    }
  });
  await step(`${label}: switching blur off shows the sharp original, which is unchanged`, async () => {
    await page.getByRole("switch", { name: "Blur background" }).click();
    await full();
    try {
      assert.equal(await filter(), "none");
      const c = await contrast(page, clip);
      assert.ok(c > 40, `sharp background has low contrast ${c}`);
      await shot(page, `${label}-focus-blur-off`);
      assert.equal(await page.evaluate(() => localStorage.getItem("ukiyo.focus.background")), original);
    } finally {
      await exit();
    }
  });
  await step(`${label}: blur setting and strength survive a refresh`, async () => {
    const stored = page.waitForResponse((r) => r.url().includes("/api/me/prefs") && r.ok() && r.request().postData()?.includes('"blurAmount":30'));
    stored.catch(() => {});
    await page.getByRole("switch", { name: "Blur background" }).click();
    await page.getByRole("slider", { name: "Blur strength" }).fill("30");
    await stored;
    await page.reload();
    await page.waitForLoadState("networkidle");
    await image.first().waitFor();
    assert.equal(await page.getByRole("switch", { name: "Blur background" }).getAttribute("aria-checked"), "true");
    await full();
    try {
      assert.equal(await filter(), "blur(30px)");
    } finally {
      await exit();
    }
  });
  await step(`${label}: a setting changed just before leaving the page is still saved`, async () => {
    await page.getByRole("slider", { name: "Blur strength" }).fill("22");
    await page.locator('a[href="/habits"]').first().evaluate((a) => a.click());
    await page.waitForURL("**/habits");
    await pause(1200);
    await page.goto("/focus");
    await image.first().waitFor();
    assert.equal(await page.getByRole("slider", { name: "Blur strength" }).inputValue(), "22");
  });
  await step(`${label}: a large photo is compressed under 400 KB and removal works`, async () => {
    await page.locator('input[type="file"]').setInputFiles(await testImage(page, { width: 2400, height: 1800, noisy: true }));
    await page.waitForFunction((old) => localStorage.getItem("ukiyo.focus.background") !== old, original, { timeout: 30000 })
      .catch(async () => { throw new Error(`upload failed: ${await page.getByRole("status").allInnerTexts()}`); });
    const bytes = await page.evaluate(() => Math.floor((localStorage.getItem("ukiyo.focus.background").split(",")[1].length * 3) / 4));
    assert.ok(bytes <= 400 * 1024 + 2, `${bytes} bytes`);
    assert.match(await filter(), /blur\(/);
    await shot(page, `${label}-focus-card`);
    await page.getByRole("button", { name: "Remove background" }).click();
    assert.equal(await image.count(), 0);
  });
}

/* ================================ desktop ================================ */
const browser = await chromium.launch();
const desk = await session(browser);
{
  const { page, api, context } = desk;
  await page.goto("/dashboard");
  await settle(page);

  await step("water menu: opens with three habits inside the viewport, closes with Escape and outside click", async () => {
    await openPanel(page);
    assert.deepEqual(await panel(page).locator("[data-habit]").evaluateAll((els) => els.map((e) => e.dataset.habit)), ["reading", "water", "learning"]);
    for (const name of ["Read Books", "Drink Water", "Learn Something New"]) assert.ok((await panel(page).innerText()).includes(name), name);
    await insideViewport(page, panel(page));
    assert.match(await panel(page).evaluate((e) => getComputedStyle(e).backdropFilter), /blur/);
    assert.equal(await overall(page), 0);
    await shot(page, "desktop-panel-empty");
    await page.keyboard.press("Escape"); await panel(page).waitFor({ state: "detached" });
    await panel(page).waitFor({ state: "hidden" });
    await openPanel(page);
    await page.mouse.click(1300, 900);
    await panel(page).waitFor({ state: "hidden" });
  });

  await step("missing habits are created through the normal habit system", async () => {
    assert.deepEqual(await habitsByKind(api), {});
    await openPanel(page);
    for (const kind of ["reading", "water", "learning"]) {
      await ring(page, kind).click();
      await panel(page).locator(`[data-habit="${kind}"]`).getByText("Not added yet").waitFor({ state: "detached" });
    }
    const h = await habitsByKind(api);
    assert.deepEqual([h.reading.target, h.water.target, h.learning.target], [20, 2000, 1]);
    assert.deepEqual([h.reading.todayAmount, h.water.todayAmount, h.learning.todayAmount], [0, 0, 0]);
  });

  await step("each ring records a real entry and updates its own and the overall percentage", async () => {
    await ring(page, "water").click();
    await expectPercent(page, "water", 12);
    await ring(page, "reading").click();
    await expectPercent(page, "reading", 25);
    await ring(page, "learning").click();
    await expectPercent(page, "learning", 100);
    assert.equal(await overall(page), 45);
    assert.equal(await panel(page).getByTestId("habit-complete").count(), 1);
    const t = await api("GET", "/api/trackers");
    assert.deepEqual([t.water.total, t.reading.todayPages, t.learning.todayCount], [250, 5, 1]);
    const h = await habitsByKind(api);
    assert.deepEqual([h.water.todayAmount, h.reading.todayAmount, h.learning.todayAmount, h.learning.todayDone], [250, 5, 1, true]);
    assert.match(await panel(page).locator(".habit-ring").first().evaluate((e) => getComputedStyle(e).transitionProperty), /stroke-dashoffset/);
    await shot(page, "desktop-panel-progress");
  });

  await step("progress survives a reload and matches the Habits page", async () => {
    await page.reload();
    await openPanel(page);
    assert.deepEqual([await percent(page, "water"), await percent(page, "reading"), await percent(page, "learning"), await overall(page)], [12, 25, 100, 45]);
    await page.goto("/habits");
    await page.getByText("1/8 cups today", { exact: false }).waitFor();
    await page.getByText("5/20 pages today", { exact: false }).waitFor();
    await page.getByText("1/1 entry today", { exact: false }).waitFor();
  });

  await step("the Habits page and the quick tracker update each other without reloading", async () => {
    await openPanel(page);
    await ring(page, "water").click();
    await expectPercent(page, "water", 25);
    await page.getByText("2/8 cups today", { exact: false }).waitFor();
    await page.keyboard.press("Escape"); await panel(page).waitFor({ state: "detached" });
    await page.getByRole("tab", { name: "Water" }).click();
    await page.getByRole("button", { name: "+1 cup", exact: true }).click();
    await openPanel(page);
    await expectPercent(page, "water", 37);
    await page.keyboard.press("Escape"); await panel(page).waitFor({ state: "detached" });
  });

  await step("progress stops at the target, including parallel taps", async () => {
    await openPanel(page);
    for (const value of [50, 75, 100]) { await ring(page, "reading").click(); await expectPercent(page, "reading", value); }
    await ring(page, "reading").click({ force: true });
    await ring(page, "learning").click({ force: true });
    await Promise.all(Array.from({ length: 20 }, () => api("POST", "/api/trackers/water", { ml: 250, cap: true })));
    await page.reload();
    await openPanel(page);
    assert.deepEqual([await percent(page, "water"), await percent(page, "reading"), await percent(page, "learning"), await overall(page)], [100, 100, 100, 100]);
    assert.equal(await panel(page).getByTestId("habit-complete").count(), 3);
    const t = await api("GET", "/api/trackers");
    assert.deepEqual([t.water.total, t.reading.todayPages, t.learning.todayCount], [2000, 20, 1]);
    await shot(page, "desktop-panel-complete");
    await page.goto("/habits?tab=water");
    assert.ok(await page.getByRole("button", { name: "+1 cup", exact: true }).isDisabled());
  });

  await step("changing the water goal or removing an entry recalculates everywhere", async () => {
    await api("PATCH", "/api/me/prefs", { waterGoal: 2500 });
    let h = await habitsByKind(api);
    assert.deepEqual([h.water.target, h.water.todayAmount, h.water.todayDone], [2500, 2000, false]);
    assert.equal((await api("GET", "/api/dashboard")).habits.done, 2);
    await page.goto("/habits");
    await page.getByText("8/10 cups today", { exact: false }).waitFor();
    await openPanel(page);
    await expectPercent(page, "water", 80);
    const entry = (await api("GET", "/api/trackers")).water.entries[0];
    await api("DELETE", `/api/trackers/water?id=${entry.id}`);
    await page.reload();
    await openPanel(page);
    h = await habitsByKind(api);
    assert.equal(await percent(page, "water"), Math.floor((h.water.todayAmount / 2500) * 100));
    assert.ok(h.water.todayAmount < 2000);
  });

  await step("progress persists after signing out and back in", async () => {
    const before = await habitsByKind(api);
    await api("POST", "/api/auth/logout", {});
    await api("POST", "/api/auth/login", { email: desk.email, password: desk.password });
    const after = await habitsByKind(api);
    for (const k of ["water", "reading", "learning"]) assert.equal(after[k].todayAmount, before[k].todayAmount, k);
  });

  await step("standard habits are capped at their target and re-evaluated when it changes", async () => {
    const { habit } = await api("POST", "/api/habits", { name: "Pushups", target: 3 });
    assert.deepEqual(await api("POST", `/api/habits/${habit.id}/log`, { amount: 10 }).then((r) => [r.amount, r.completed]), [3, true]);
    await api("PATCH", `/api/habits/${habit.id}`, { name: "Pushups", target: 5 });
    const h = (await api("GET", "/api/habits")).habits.find((x) => x.id === habit.id);
    assert.deepEqual([h.todayAmount, h.todayDone], [3, false]);
  });

  await step("entries logged before a habit exists count once it is created", async () => {
    const other = await session(browser);
    await other.api("POST", "/api/trackers/water", { ml: 500 });
    await other.api("POST", "/api/habits", { name: "Drink Water", icon: "droplets", kind: "water", target: 2000, unit: "ml" });
    assert.equal((await habitsByKind(other.api)).water.todayAmount, 500);
    await other.context.close();
  });

  /* ------------------------------ dashboard ------------------------------ */
  await page.goto("/dashboard");
  await settle(page);
  await step("dashboard: widgets are placed without overlap", async () => {
    const list = await checkGrid(page, "initial");
    assert.equal(list.length, 9);
    assert.equal(await page.locator(".dash-grid").getAttribute("data-bp"), "lg");
    await shot(page, "desktop-dashboard-default");
  });

  await step("dashboard: mouse drag shows the drop position, moves the widget and persists", async () => {
    const grid = await page.locator(".dash-grid").boundingBox();
    const before = byId(await widgets(page));
    const handle = await center(page.locator('[data-widget="focus"] .dash-handle'));
    const response = saved(page);
    await mouseDrag(page, handle, { x: grid.x + before.focus.width / 2, y: grid.y + 6 }, async () => {
      assert.ok(await page.getByTestId("dash-placeholder").isVisible(), "placeholder");
      await shot(page, "desktop-dashboard-dragging");
    });
    await response; await settle(page);
    const after = byId(await checkGrid(page, "after drag"));
    assert.deepEqual([after.focus.col, after.focus.y], [0, Math.min(...Object.values(after).map((w) => w.y))]);
    assert.equal(await page.getByTestId("dash-placeholder").count(), 0);
    const expected = geometry(Object.values(after));
    await page.reload(); await settle(page);
    assert.deepEqual(geometry(await widgets(page)), expected);
  });

  await step("dashboard: a widget can be dragged by its body to the other column", async () => {
    const before = byId(await widgets(page));
    const widget = before.focus;
    const from = { x: widget.x + widget.width - 40, y: widget.y + 45 };
    const response = saved(page);
    await mouseDrag(page, from, { x: from.x + widget.width + 12, y: from.y });
    await response; await settle(page);
    assert.equal(byId(await checkGrid(page, "after body drag")).focus.col, 6);
  });

  await step("dashboard: dropping in place and pressing Escape change nothing", async () => {
    const expected = geometry(await widgets(page));
    let writes = 0;
    const count = (r) => { if (r.method() === "PATCH" && r.url().includes("/api/me/prefs")) writes++; };
    page.on("request", count);
    const from = await center(page.locator('[data-widget="habits"] .dash-handle'));
    await mouseDrag(page, from, { x: from.x + 8, y: from.y + 6 });
    await settle(page);
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + 500, from.y + 400, { steps: 10 });
    await page.keyboard.press("Escape"); await panel(page).waitFor({ state: "detached" }); await page.mouse.up();
    await settle(page);
    page.off("request", count);
    assert.equal(writes, 0);
    assert.deepEqual(geometry(await widgets(page)), expected);
  });

  await step("dashboard: resizing wider and taller persists, and shrinking works", async () => {
    let list = byId(await widgets(page));
    let from = await center(page.locator('[data-widget="habits"] .dash-resize'));
    let response = saved(page);
    await mouseDrag(page, from, { x: from.x + 900, y: from.y + 150 }, () => shot(page, "desktop-dashboard-resizing"));
    await response; await settle(page);
    let after = byId(await checkGrid(page, "grown"));
    assert.equal(after.habits.span, 12);
    assert.ok(after.habits.height >= list.habits.height + 100, `height ${after.habits.height}`);
    const expected = geometry(Object.values(after));
    await page.reload(); await settle(page);
    assert.deepEqual(geometry(await widgets(page)), expected);

    from = await center(page.locator('[data-widget="habits"] .dash-resize'));
    list = byId(await widgets(page));
    response = saved(page);
    const column = list.habits.width / 12;
    await mouseDrag(page, from, { x: from.x - column * 8, y: from.y - (list.habits.height - 140) });
    await response; await settle(page);
    after = byId(await checkGrid(page, "shrunk"));
    assert.ok(after.habits.span >= 3 && after.habits.span <= 5, `span ${after.habits.span}`);
    assert.equal(after.habits.height, 140);
    await shot(page, "desktop-dashboard-resized");
  });

  await step("dashboard: double-clicking the corner restores automatic height", async () => {
    const response = saved(page);
    await page.locator('[data-widget="habits"] .dash-resize').dblclick();
    await response; await settle(page);
    assert.equal(byId(await checkGrid(page, "auto")).habits.fixed, "auto");
  });

  await step("dashboard: keyboard can move and resize", async () => {
    const before = byId(await widgets(page)).habits.span;
    await page.locator('[data-widget="habits"] .dash-resize').focus();
    let response = saved(page);
    await page.keyboard.press("ArrowRight");
    await response; await settle(page);
    assert.equal(byId(await checkGrid(page, "keyboard")).habits.span, before + 1);
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("dash-resize")), true, "focus kept");
  });

  await step("dashboard: hide, show, resize, reorder and reset from the customize dialog", async () => {
    const before = geometry(await widgets(page));
    await page.getByRole("button", { name: "Customize dashboard" }).click();
    const dialog = page.getByRole("dialog", { name: "Customize dashboard" });
    let response = saved(page); await dialog.getByRole("switch", { name: "Streak & level" }).click(); await response;
    await settle(page);
    assert.equal(await page.locator('[data-widget="streak"]').count(), 0);
    response = saved(page); await dialog.getByRole("switch", { name: "Streak & level" }).click(); await response;
    await settle(page);
    assert.deepEqual(geometry(await widgets(page)), before, "re-shown widget returns to its place");
    response = saved(page); await dialog.getByRole("combobox", { name: "Weekly summary size" }).selectOption("wide"); await response;
    await settle(page);
    assert.equal(byId(await checkGrid(page, "select")).weekly.span, 12);
    response = saved(page); await dialog.getByRole("button", { name: "Move Weekly summary up" }).click(); await response;
    await settle(page); await checkGrid(page, "move up");
    response = saved(page); await dialog.getByRole("button", { name: "Reset layout" }).click(); await response;
    await settle(page);
    const reset = byId(await checkGrid(page, "reset"));
    assert.ok(Object.values(reset).every((w) => w.span === 6 && w.fixed === "auto"));
    await page.keyboard.press("Escape"); await panel(page).waitFor({ state: "detached" });
  });

  await step("dashboard: controls inside widgets still work", async () => {
    await page.locator('[data-widget="habits"]').getByRole("checkbox", { name: /Pushups/ }).click();
    await page.locator('[data-widget="habits"] [role="checkbox"][aria-checked="true"][aria-label*="Pushups"]').waitFor();
    const pushups = (await api("GET", "/api/habits")).habits.find((h) => h.name === "Pushups");
    assert.deepEqual([pushups.todayAmount, pushups.todayDone], [5, true]);
    await page.locator('[data-widget="focus"]').getByRole("link", { name: "Start Focus" }).click();
    await page.waitForURL("**/focus");
  });

  await focusChecks(page, "desktop");

  await step("every main page renders without a crash", async () => {
    for (const path of ["/dashboard", "/tasks", "/habits", "/challenge", "/focus", "/goals", "/vault", "/achievements", "/review", "/calendar", "/analytics", "/music", "/music-bridge", "/themes", "/settings", "/profile"]) {
      const res = await page.goto(path);
      assert.equal(res.status(), 200, path);
      await page.waitForLoadState("networkidle");
      await page.locator("#main").waitFor();
      assert.ok(!(await page.locator("body").innerText()).includes("Application error"), path);
    }
  });

  await step("Arabic: panel stays on screen and the grid mirrors, drag included", async () => {
    await api("PATCH", "/api/me", { language: "ar" });
    await page.goto("/dashboard"); await settle(page);
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    const list = byId(await checkGrid(page, "rtl"));
    assert.ok(list.progress.x > list.streak.x, "first column is on the right");
    await openPanel(page); await insideViewport(page, panel(page)); await shot(page, "desktop-arabic-panel"); await page.keyboard.press("Escape"); await panel(page).waitFor({ state: "detached" });
    const response = saved(page);
    const from = await center(page.locator('[data-widget="progress"] .dash-handle'));
    await mouseDrag(page, from, { x: from.x - list.progress.width - 12, y: from.y });
    await response; await settle(page);
    assert.equal(byId(await checkGrid(page, "rtl drag")).progress.col, 6);
    await shot(page, "desktop-arabic-dashboard");
    await api("PATCH", "/api/me", { language: "en" });
  });

  await step("light theme panel renders", async () => {
    const theme = (await api("GET", "/api/me")).prefs.theme;
    await api("PATCH", "/api/me/prefs", { theme: { ...theme, mode: "light" } });
    await page.goto("/dashboard"); await settle(page); await openPanel(page); await shot(page, "desktop-light-panel");
  });
  await context.close();
}

/* ================================ tablet ================================= */
await step("tablet: two-column layout without overlap", async () => {
  const { page, context } = await session(browser, { viewport: { width: 820, height: 1180 }, hasTouch: true });
  await page.goto("/dashboard"); await settle(page);
  assert.equal(await page.locator(".dash-grid").getAttribute("data-bp"), "md");
  await checkGrid(page, "tablet"); await noSidewaysScroll(page); await openPanel(page); await insideViewport(page, panel(page)); await shot(page, "tablet-panel");
  await context.close();
});

/* ============================= mobile (touch) ============================ */
{
  const { page, context, api } = await session(browser, { ...devices["Pixel 7"] });
  // Optionally behave like phones without element full screen (the app then uses its in-page immersive mode).
  if (process.env.MOBILE_NO_FULLSCREEN) await context.addInitScript(() => { delete Element.prototype.requestFullscreen; });
  const cdp = await context.newCDPSession(page);
  await page.goto("/dashboard"); await settle(page);

  await step("mobile: panel fits narrow screens and taps record progress", async () => {
    for (const width of [320, 360, 412]) {
      await page.setViewportSize({ width, height: 740 });
      await openPanel(page); await insideViewport(page, panel(page)); await noSidewaysScroll(page);
      if (width === 320) await shot(page, "mobile-320-panel");
      await page.keyboard.press("Escape"); await panel(page).waitFor({ state: "detached" }); await panel(page).waitFor({ state: "hidden" });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await openPanel(page);
    for (const kind of ["reading", "water", "learning"]) {
      await ring(page, kind).tap();
      await panel(page).locator(`[data-habit="${kind}"]`).getByText("Not added yet").waitFor({ state: "detached" });
      await ring(page, kind).tap();
    }
    await expectPercent(page, "water", 12); await expectPercent(page, "reading", 25); await expectPercent(page, "learning", 100);
    await shot(page, "mobile-panel");
    await page.touchscreen.tap(12, 780);
    await panel(page).waitFor({ state: "hidden" });
    assert.equal((await habitsByKind(api)).water.todayAmount, 250);
  });

  await step("mobile: single column without overlap or sideways scroll", async () => {
    await page.reload(); await settle(page);
    assert.equal(await page.locator(".dash-grid").getAttribute("data-bp"), "sm");
    await checkGrid(page, "mobile"); await noSidewaysScroll(page); await shot(page, "mobile-dashboard");
  });

  await step("mobile: swiping over a widget scrolls the page and moves nothing", async () => {
    await page.evaluate(() => window.scrollTo(0, 0)); await settle(page);
    const expected = geometry(await widgets(page));
    const box = await page.locator('[data-widget="progress"]').boundingBox();
    const from = { x: box.x + 60, y: Math.min(box.y + box.height - 20, 700) };
    await touchDrag(cdp, from, { x: from.x, y: from.y - 350 });
    await pause(600);
    assert.ok(await page.evaluate(() => window.scrollY) > 50, "page scrolled");
    assert.deepEqual(geometry(await widgets(page)), expected);
  });

  await step("mobile: touch drag reorders widgets and persists", async () => {
    const order = async () => (await widgets(page)).sort((a, b) => a.y - b.y).map((w) => w.id);
    const before = await order();
    const [first, second] = before;
    const align = () => page.evaluate((id) => { const r = document.querySelector(`[data-widget="${id}"]`).getBoundingClientRect(); window.scrollBy({ top: r.top - 130, behavior: "instant" }); }, first);
    await align(); await pause(300);
    const target = await page.locator(`[data-widget="${first}"]`).boundingBox();
    const from = await center(page.locator(`[data-widget="${second}"] .dash-handle`));
    const response = saved(page);
    await touchDrag(cdp, from, { x: from.x, y: Math.max(100, target.y + 20) }, async () => {
      assert.ok(await page.getByTestId("dash-placeholder").isVisible()); await shot(page, "mobile-dashboard-dragging");
    });
    await response; await settle(page); await checkGrid(page, "touch drag");
    assert.deepEqual((await order()).slice(0, 2), [second, first]);
    await page.reload(); await settle(page);
    assert.deepEqual((await order()).slice(0, 2), [second, first]);
  });

  await step("mobile: dragging near the screen edge scrolls the page", async () => {
    await page.evaluate(() => window.scrollTo(0, 0)); await settle(page);
    const first = (await widgets(page)).sort((a, b) => a.y - b.y)[0].id;
    await page.locator(`[data-widget="${first}"] .dash-handle`).evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await pause(300);
    const start = await page.evaluate(() => window.scrollY);
    const from = await center(page.locator(`[data-widget="${first}"] .dash-handle`));
    await touchDrag(cdp, from, { x: from.x, y: 835 }, () => pause(900));
    await settle(page); await checkGrid(page, "autoscroll");
    assert.ok(await page.evaluate(() => window.scrollY) > start + 100, "auto-scrolled");
  });

  await step("mobile: touch resize changes height and persists without touching the desktop layout", async () => {
    const target = (await widgets(page)).sort((a, b) => a.y - b.y)[0];
    const handle = page.locator(`[data-widget="${target.id}"] .dash-resize`);
    await handle.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await pause(300);
    let from = await center(handle);
    let response = saved(page);
    await touchDrag(cdp, from, { x: from.x, y: from.y + 140 });
    await response; await settle(page);
    const grown = byId(await checkGrid(page, "touch grow"))[target.id];
    assert.ok(grown.height >= target.height + 100, `${target.height} -> ${grown.height}`);
    await page.reload(); await settle(page);
    assert.equal(byId(await widgets(page))[target.id].height, grown.height);
    await handle.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await pause(300);
    from = await center(handle); response = saved(page);
    await touchDrag(cdp, from, { x: from.x, y: from.y - 120 });
    await response; await settle(page);
    assert.ok(byId(await checkGrid(page, "touch shrink"))[target.id].height < grown.height - 80);
    const layouts = (await api("GET", "/api/me")).prefs.dashboard.layouts;
    assert.ok(layouts.sm?.length === 9 && !layouts.lg && !layouts.md);
  });

  await focusChecks(page, "mobile");
  await context.close();
}
await browser.close();

/* =============================== iOS engine ============================== */
{
  const safari = await webkit.launch();
  const { page, context } = await session(safari, { ...devices["iPhone 13"] });
  await page.goto("/dashboard"); await settle(page);
  await step("iPhone (WebKit): panel and dashboard fit the screen", async () => {
    await checkGrid(page, "webkit"); await noSidewaysScroll(page); await openPanel(page); await insideViewport(page, panel(page)); await noSidewaysScroll(page);
    await ring(page, "water").tap(); await panel(page).locator('[data-habit="water"]').getByText("Not added yet").waitFor({ state: "detached" });
    await ring(page, "water").tap(); await expectPercent(page, "water", 12); await shot(page, "iphone-panel");
  });
  await focusChecks(page, "iphone");
  await context.close();
  await safari.close();
}

console.log("\n==== summary ====");
console.log(results.join("\n"));
console.log(`${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed`);
console.log(`\n==== browser console errors (${consoleErrors.length}) ====`);
console.log([...new Set(consoleErrors)].join("\n") || "none");
