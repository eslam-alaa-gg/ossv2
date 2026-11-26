// Unit tests for the pure dashboard layout and habit progress logic.
// Usage: node --experimental-strip-types --test tests/logic.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { COLUMNS, MIN_H, MIN_W, breakpointFor, layoutsSchema, mergeHidden, moveItem, place, resizeItem, resolveLayout, swapItem } from "../src/lib/dashboard-layout.ts";
import { cappedAmount, displayAmounts, habitPercent, overallPercent, quickStep, wholePercent } from "../src/lib/habit-progress.ts";

const IDS = ["progress", "streak", "focus", "challenge", "habits", "reminders", "weekly", "achievements", "music"];
const sizes = Object.fromEntries(IDS.map((id) => [id, "standard"]));
let seed = 7;
const random = (n) => { seed = (seed * 48271) % 2147483647; return seed % n; };

function assertValid(items, heights, cols, label) {
  const { boxes } = place(items, heights, cols, 12);
  const list = Object.entries(boxes);
  assert.equal(list.length, items.length, `${label}: nothing lost or duplicated`);
  for (const [id, a] of list) {
    assert.ok(a.x >= 0 && a.x + a.w <= cols, `${label}: ${id} inside the grid`);
    for (const [other, b] of list) {
      if (other <= id) continue;
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `${label}: ${id} overlaps ${other}`);
    }
  }
}

test("breakpoints follow the available width", () => {
  assert.equal(breakpointFor(1100), "lg");
  assert.equal(breakpointFor(700), "md");
  assert.equal(breakpointFor(358), "sm");
});

test("default layout keeps saved order and sizes, deterministically", () => {
  const a = resolveLayout(undefined, IDS, sizes, "lg");
  assert.deepEqual(a.map((i) => i.id), IDS);
  assert.deepEqual(a.slice(0, 3).map((i) => [i.x, i.w]), [[0, 6], [6, 6], [0, 6]]);
  assert.deepEqual(resolveLayout(a, IDS, sizes, "lg"), a);
  assert.ok(resolveLayout(undefined, IDS, sizes, "sm").every((i) => i.x === 0 && i.w === 1));
});

test("columns pack independently: a tall neighbour leaves no gap under a short widget", () => {
  const items = [{ id: "a", x: 0, w: 6, h: null }, { id: "b", x: 6, w: 6, h: null }, { id: "c", x: 0, w: 6, h: null }];
  const { boxes } = place(items, { a: 100, b: 400, c: 120 }, 12, 12);
  assert.equal(boxes.c.y, 112);
});

test("a small hole above a wide widget is closed by stretching, a large one is left alone", () => {
  const items = [{ id: "a", x: 0, w: 6, h: null }, { id: "b", x: 6, w: 6, h: null }, { id: "c", x: 0, w: 12, h: null }];
  assert.equal(place(items, { a: 200, b: 260, c: 100 }, 12, 12).boxes.a.h, 260);
  assert.equal(place(items, { a: 100, b: 400, c: 100 }, 12, 12).boxes.a.h, 100);
  assert.equal(place([{ ...items[0], h: 200 }, items[1], items[2]], { b: 260, c: 100 }, 12, 12).boxes.a.h, 200, "a user-chosen height is never changed");
});

test("random layouts never overlap and survive random moves and resizes", () => {
  for (const bp of ["lg", "md", "sm"]) {
    const cols = COLUMNS[bp];
    let items = resolveLayout(undefined, IDS, sizes, bp);
    const heights = Object.fromEntries(IDS.map((id) => [id, 100 + random(300)]));
    for (let i = 0; i < 1500; i++) {
      const id = IDS[random(IDS.length)];
      const start = place(items, heights, cols, 12);
      const op = random(3);
      if (op === 0) items = moveItem(items, start, id, random(cols + 2) - 1, random(start.height + 200) - 50, cols);
      else if (op === 1) items = resizeItem(items, start, id, MIN_W[bp] + random(cols), random(4) ? MIN_H + random(500) : null, bp);
      else items = swapItem(items, id, random(2) ? 1 : -1, cols);
      assertValid(items, heights, cols, `${bp} step ${i}`);
      assert.ok(layoutsSchema.safeParse({ [bp]: items }).success, `${bp} step ${i}: saveable`);
    }
  }
});

test("dropping a widget where it already is moves nothing", () => {
  for (const bp of ["lg", "md", "sm"]) {
    const cols = COLUMNS[bp];
    let items = resolveLayout(undefined, IDS, sizes, bp);
    const heights = Object.fromEntries(IDS.map((id) => [id, 100 + random(300)]));
    for (let i = 0; i < 600; i++) {
      const start = place(items, heights, cols, 12);
      const id = IDS[random(IDS.length)];
      const same = moveItem(items, start, id, start.boxes[id].x, start.boxes[id].y, cols);
      assert.deepEqual(place(same, heights, cols, 12).boxes, start.boxes, `${bp} ${id} step ${i}`);
      items = resizeItem(items, start, IDS[random(IDS.length)], MIN_W[bp] + random(cols), null, bp);
    }
  }
});

test("moving: down a single column, across columns, and to the top", () => {
  const heights = { a: 100, b: 100, c: 100 };
  const one = ["a", "b", "c"].map((id) => ({ id, x: 0, w: 1, h: null }));
  const start = place(one, heights, 1, 12);
  assert.deepEqual(moveItem(one, start, "a", 0, 120, 1).map((i) => i.id), ["b", "a", "c"]);
  assert.deepEqual(moveItem(one, start, "c", 0, 0, 1).map((i) => i.id), ["c", "a", "b"]);
  const two = [{ id: "a", x: 0, w: 6, h: null }, { id: "b", x: 6, w: 6, h: null }];
  const moved = place(moveItem(two, place(two, heights, 12, 12), "a", 6, 0, 12), heights, 12, 12).boxes;
  assert.deepEqual([moved.a.x, moved.a.y, moved.b.x, moved.b.y], [6, 0, 6, 112]);
});

test("resizing keeps the widget in its row and pushes covered widgets underneath", () => {
  const heights = { a: 100, b: 100 };
  const two = [{ id: "a", x: 0, w: 6, h: null }, { id: "b", x: 6, w: 6, h: null }];
  const { boxes } = place(resizeItem(two, place(two, heights, 12, 12), "b", 12, null, "lg"), heights, 12, 12);
  assert.deepEqual([boxes.b.x, boxes.b.y, boxes.b.w, boxes.a.y], [0, 0, 12, 112]);
});

test("hidden widgets keep their saved place", () => {
  const saved = resolveLayout(undefined, IDS, sizes, "lg");
  const visible = saved.filter((i) => i.id !== "focus");
  assert.deepEqual(mergeHidden(visible, saved).map((i) => i.id), IDS);
});

test("progress is real, capped at the target, and 100% only when reached", () => {
  assert.equal(habitPercent(750, 2000), 37.5);
  assert.equal(wholePercent(habitPercent(1999, 2000)), 99);
  assert.equal(habitPercent(2500, 2000), 100);
  assert.equal(habitPercent(0, 20), 0);
  assert.equal(cappedAmount(25, 20), 20);
  assert.equal(wholePercent(overallPercent([100, 50, 0])), 50);
  assert.equal(wholePercent(overallPercent([100, 100, 100])), 100);
  assert.deepEqual(displayAmounts("water", 750, 2000), { amount: 3, target: 8 });
  assert.equal(quickStep("water", 1900, 2000), 100);
  assert.equal(quickStep("reading", 18, 20), 2);
  assert.equal(quickStep("learning", 1, 1), 0);
});
