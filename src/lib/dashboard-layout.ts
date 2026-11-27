import { z } from "zod";

/**
 * Dashboard layout engine (pure, DOM-free).
 *
 * A layout is an ordered list of { id, x, w, h } on a column grid. Order is the vertical priority:
 * each widget keeps its column and settles directly under whatever precedes it in those columns,
 * so widgets can never overlap and rows never force empty space onto shorter neighbours.
 */
export type Breakpoint = "lg" | "md" | "sm";
export type LayoutItem = { id: string; x: number; w: number; h: number | null };
export type Layouts = Partial<Record<Breakpoint, LayoutItem[]>>;
export type Size = "compact" | "standard" | "wide";
export type Box = { x: number; w: number; y: number; h: number };
export type Placement = { boxes: Record<string, Box>; height: number };

export const COLUMNS: Record<Breakpoint, number> = { lg: 12, md: 6, sm: 1 };
export const MIN_W: Record<Breakpoint, number> = { lg: 3, md: 3, sm: 1 };
export const MIN_H = 96;
export const MAX_H = 1600;
export const H_STEP = 10;
export const FALLBACK_H = 180;
/** An auto-height widget grows by at most this much to close a hole above the widget below it. */
export const MAX_STRETCH = 96;

const itemSchema = z.object({
  id: z.string().max(40),
  x: z.number().int().min(0).max(11),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(MIN_H).max(MAX_H).nullable(),
});
const listSchema = z.array(itemSchema).max(30);
export const layoutsSchema = z.object({ lg: listSchema.optional(), md: listSchema.optional(), sm: listSchema.optional() });

export function breakpointFor(width: number): Breakpoint {
  return width >= 860 ? "lg" : width >= 560 ? "md" : "sm";
}

export function sizeToWidth(size: Size | undefined, bp: Breakpoint) {
  const cols = COLUMNS[bp];
  if (bp === "sm") return cols;
  if (size === "wide") return cols;
  if (size === "compact") return 3;
  return 6;
}

export function widthToSize(w: number, bp: Breakpoint): Size | "custom" {
  if (bp === "sm") return "wide";
  if (w >= COLUMNS[bp]) return "wide";
  if (w === 6) return "standard";
  if (w === 3) return "compact";
  return "custom";
}

function clampItem(item: LayoutItem, bp: Breakpoint): LayoutItem {
  const cols = COLUMNS[bp];
  const w = Math.max(MIN_W[bp], Math.min(cols, Math.round(item.w)));
  const x = Math.max(0, Math.min(cols - w, Math.round(item.x)));
  const h = item.h === null ? null : clampHeight(item.h);
  return { id: item.id, x, w, h };
}

export function clampHeight(h: number) {
  return Math.max(MIN_H, Math.min(MAX_H, Math.round(h / H_STEP) * H_STEP));
}

/**
 * The layout to show for `ids` at a breakpoint: the saved one when present (new widgets appended),
 * otherwise a deterministic left-to-right flow built from the saved order and sizes.
 */
export function resolveLayout(saved: LayoutItem[] | undefined, order: readonly string[], sizes: Record<string, Size>, bp: Breakpoint): LayoutItem[] {
  const out: LayoutItem[] = [];
  const seen = new Set<string>();
  for (const item of saved ?? []) {
    if (!order.includes(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(clampItem(item, bp));
  }
  let cursor = 0;
  for (const id of order) {
    if (seen.has(id)) continue;
    const w = sizeToWidth(sizes[id], bp);
    if (cursor + w > COLUMNS[bp]) cursor = 0;
    out.push({ id, x: cursor, w, h: null });
    cursor += w;
  }
  return out;
}

export function place(items: LayoutItem[], natural: Record<string, number>, cols: number, gap: number, stretch = true): Placement {
  const bottoms = new Array<number>(cols).fill(0);
  const boxes: Record<string, Box> = {};
  for (const item of items) {
    const w = Math.min(cols, item.w);
    const x = Math.min(cols - w, item.x);
    const h = item.h ?? natural[item.id] ?? FALLBACK_H;
    let y = 0;
    for (let c = x; c < x + w; c++) y = Math.max(y, bottoms[c]);
    boxes[item.id] = { x, w, y, h };
    for (let c = x; c < x + w; c++) bottoms[c] = y + h + gap;
  }
  if (stretch) {
    for (const item of items) {
      if (item.h !== null) continue;
      const box = boxes[item.id];
      let limit = Number.POSITIVE_INFINITY;
      for (let c = box.x; c < box.x + box.w; c++) {
        let next = Number.POSITIVE_INFINITY;
        for (const other of Object.values(boxes)) {
          if (other !== box && other.y > box.y && other.x <= c && c < other.x + other.w) next = Math.min(next, other.y);
        }
        // A column with nothing underneath means this widget ends that column: leave its height alone.
        if (next === Number.POSITIVE_INFINITY) { limit = Number.POSITIVE_INFINITY; break; }
        limit = Math.min(limit, next);
      }
      const slack = limit - gap - (box.y + box.h);
      if (Number.isFinite(slack) && slack > 0 && slack <= MAX_STRETCH) box.h += slack;
    }
  }
  const height = Math.max(0, ...Object.values(boxes).map((b) => b.y + b.h));
  return { boxes, height };
}

const sharesColumns = (a: { x: number; w: number }, b: { x: number; w: number }) => a.x < b.x + b.w && b.x < a.x + a.w;

function sortedOthers(items: LayoutItem[], id: string, boxes: Record<string, Box>) {
  return items.filter((i) => i.id !== id).sort((a, b) => boxes[a.id].y - boxes[b.id].y || boxes[a.id].x - boxes[b.id].x);
}

/**
 * Drop widget `id` with its left edge at column `x` and its top edge at `top` pixels.
 * `start` is the geometry when the gesture began; all other widgets keep their columns and relative order.
 */
export function moveItem(items: LayoutItem[], start: Placement, id: string, x: number, top: number, cols: number): LayoutItem[] {
  const moving = items.find((i) => i.id === id);
  if (!moving) return items;
  const from = start.boxes[id];
  const target = { ...moving, x: Math.max(0, Math.min(cols - moving.w, x)) };
  const others = sortedOthers(items, id, start.boxes);
  let index = others.length;
  for (let i = 0; i < others.length; i++) {
    const box = start.boxes[others[i].id];
    if (!sharesColumns(target, box)) continue;
    const middle = box.y + box.h / 2;
    // Widgets that started underneath are passed with the dragged bottom edge, the rest with its top edge.
    const startedBelow = box.y > from.y && sharesColumns(from, box);
    const goesBefore = startedBelow ? top + from.h <= middle : top < middle;
    if (goesBefore) { index = i; break; }
  }
  return [...others.slice(0, index), target, ...others.slice(index)];
}

/** Resize a widget in place: it keeps its row, and widgets it now covers move underneath it. */
export function resizeItem(items: LayoutItem[], start: Placement, id: string, w: number, h: number | null, bp: Breakpoint): LayoutItem[] {
  const current = items.find((i) => i.id === id);
  if (!current) return items;
  const next = clampItem({ ...current, w, h }, bp);
  const others = sortedOthers(items, id, start.boxes);
  const top = start.boxes[id].y;
  const found = others.findIndex((o) => start.boxes[o.id].y >= top);
  const index = found < 0 ? others.length : found;
  return [...others.slice(0, index), next, ...others.slice(index)];
}

/** Keyboard and menu reordering: swap places with the neighbouring widget in the list. */
export function swapItem(items: LayoutItem[], id: string, delta: -1 | 1, cols: number): LayoutItem[] {
  const from = items.findIndex((i) => i.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return items;
  const a = items[from];
  const b = items[to];
  const fit = (item: LayoutItem, x: number) => ({ ...item, x: Math.max(0, Math.min(cols - item.w, x)) });
  const next = [...items];
  next[to] = fit(a, b.x);
  next[from] = fit(b, a.x);
  return next;
}

/** Saves a layout of the visible widgets without forgetting where the hidden ones were. */
export function mergeHidden(visible: LayoutItem[], saved: LayoutItem[] | undefined): LayoutItem[] {
  const shown = new Set(visible.map((i) => i.id));
  const out = [...visible];
  (saved ?? []).forEach((item, index) => { if (!shown.has(item.id)) out.splice(Math.min(index, out.length), 0, item); });
  return out;
}
