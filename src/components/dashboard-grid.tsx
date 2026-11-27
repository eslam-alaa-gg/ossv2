"use client";
import { GripHorizontal } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { COLUMNS, H_STEP, breakpointFor, clampHeight, moveItem, place, resizeItem, swapItem, type Breakpoint, type LayoutItem, type Placement } from "@/lib/dashboard-layout";
import { cn } from "./ui";

const GAP = 12;
const GAP_ACTIVE = 8;
const DRAG_THRESHOLD = 5;
const INTERACTIVE = "a,button,input,select,textarea,label,summary,[role='button'],[role='checkbox'],[role='switch']";

type Gesture = {
  type: "move" | "resize"; id: string; pointerId: number; startX: number; startY: number; x: number; y: number;
  offsetX: number; offsetY: number; items: LayoutItem[]; natural: Record<string, number>; start: Placement; bp: Breakpoint; width: number; active: boolean;
};
type Live = { type: "move" | "resize"; id: string; items: LayoutItem[]; left: number; top: number; startHeight: number };
/** Vertical pointer travel needed before a resize also fixes the height. */
const HEIGHT_INTENT = 20;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function DashboardGrid({ ids, rtl, resolve, onCommit, render, labels }: {
  ids: string[];
  rtl: boolean;
  resolve: (bp: Breakpoint) => LayoutItem[];
  onCommit: (bp: Breakpoint, items: LayoutItem[]) => void;
  render: (id: string) => ReactNode;
  labels: { move: (id: string) => string; resize: (id: string) => string };
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const liveRef = useRef<Live | null>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const observer = useRef<ResizeObserver | null>(null);

  const bp = breakpointFor(width || 1000);
  const cols = COLUMNS[bp];
  const items = resolve(bp);
  const gap = live ? GAP_ACTIVE : GAP;
  const shown = live?.items ?? items;
  const placement = place(shown, heights, cols, gap);
  const column = width ? (width - gap * (cols - 1)) / cols : 0;
  const pixelWidth = (w: number) => w * column + (w - 1) * gap;
  const pixelLeft = (x: number, w: number) => (rtl ? width - x * (column + gap) - pixelWidth(w) : x * (column + gap));

  const measure = useCallback(() => {
    if (root.current) setWidth(root.current.offsetWidth);
    setHeights((previous) => {
      const next: Record<string, number> = {};
      let changed = false;
      nodes.current.forEach((node, id) => {
        next[id] = node.offsetHeight + 2; // + frame border
        if (next[id] !== previous[id]) changed = true;
      });
      return changed || Object.keys(previous).length !== Object.keys(next).length ? next : previous;
    });
  }, []);

  useIsoLayoutEffect(() => {
    observer.current = new ResizeObserver(() => measure());
    if (root.current) observer.current.observe(root.current);
    nodes.current.forEach((node) => observer.current!.observe(node));
    measure();
    const frame = requestAnimationFrame(() => setReady(true));
    return () => { cancelAnimationFrame(frame); observer.current?.disconnect(); observer.current = null; };
  }, [measure]);

  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const id = node.dataset.content!;
    nodes.current.set(id, node);
    observer.current?.observe(node);
    return () => { observer.current?.unobserve(node); nodes.current.delete(id); };
  }, []);

  const commit = useRef(onCommit);
  useEffect(() => { commit.current = onCommit; });

  /* ---------------------------- pointer gestures ---------------------------- */
  const update = useCallback(() => {
    const g = gesture.current;
    const el = root.current;
    if (!g || !el || !g.active) return;
    const rect = el.getBoundingClientRect();
    const isRtl = document.documentElement.dir === "rtl";
    const columns = COLUMNS[g.bp];
    const col = (g.width - GAP * (columns - 1)) / columns;
    const item = g.items.find((i) => i.id === g.id)!;
    const box = g.start.boxes[g.id];
    let next: Live;
    if (g.type === "move") {
      const left = g.x - rect.left - g.offsetX;
      const top = g.y - rect.top - g.offsetY;
      const itemWidth = box.w * col + (box.w - 1) * GAP;
      const logical = isRtl ? g.width - left - itemWidth : left;
      const x = Math.round(logical / (col + GAP));
      next = { type: "move", id: g.id, left, top, startHeight: g.start.height, items: moveItem(g.items, g.start, g.id, x, top, columns) };
    } else {
      // Distance travelled in page coordinates, so auto-scrolling keeps growing the widget.
      const dx = (g.x - g.startX) * (isRtl ? -1 : 1);
      const dy = g.y - rect.top - g.offsetY;
      const startWidth = box.w * col + (box.w - 1) * GAP;
      const w = Math.round((startWidth + dx + GAP) / (col + GAP));
      const h = Math.abs(dy) < HEIGHT_INTENT ? item.h : clampHeight(box.h + dy);
      next = { type: "resize", id: g.id, left: 0, top: 0, startHeight: g.start.height, items: resizeItem(g.items, g.start, g.id, w, h, g.bp) };
    }
    liveRef.current = next;
    setLive(next);
  }, []);

  const finish = useCallback((apply: boolean) => {
    const g = gesture.current;
    const result = liveRef.current;
    gesture.current = null;
    liveRef.current = null;
    setLive(null);
    document.documentElement.classList.remove("dash-gesture");
    // A gesture that leaves every widget where it began is not a layout change.
    if (apply && g?.active && result && changesLayout(g.items, result.items, g.natural, COLUMNS[g.bp])) commit.current(g.bp, result.items);
  }, []);

  useEffect(() => {
    let frame = 0;
    const autoScroll = () => {
      frame = 0;
      const g = gesture.current;
      if (!g?.active) return;
      const top = 90, bottom = window.innerHeight - 80;
      const speed = g.y < top ? -Math.min(18, (top - g.y) / 3) : g.y > bottom ? Math.min(18, (g.y - bottom) / 3) : 0;
      if (speed) {
        const before = window.scrollY;
        window.scrollBy({ top: speed, behavior: "instant" });
        if (window.scrollY !== before) update();
      }
      frame = requestAnimationFrame(autoScroll);
    };
    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.pointerId) return;
      g.x = e.clientX;
      g.y = e.clientY;
      if (!g.active) {
        if (Math.hypot(g.x - g.startX, g.y - g.startY) < DRAG_THRESHOLD) return;
        g.active = true;
        document.documentElement.classList.add("dash-gesture");
        window.getSelection()?.removeAllRanges();
      }
      e.preventDefault();
      update();
      if (!frame) frame = requestAnimationFrame(autoScroll);
    };
    const onUp = (e: PointerEvent) => { if (gesture.current?.pointerId === e.pointerId) finish(true); };
    const onCancel = (e: PointerEvent) => { if (gesture.current?.pointerId === e.pointerId) finish(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && gesture.current) finish(false); };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", update);
      document.documentElement.classList.remove("dash-gesture");
    };
  }, [finish, update]);

  const begin = (type: "move" | "resize", id: string, e: ReactPointerEvent) => {
    if (gesture.current || !root.current || !width || e.button !== 0) return;
    const rect = root.current.getBoundingClientRect();
    const start = place(items, heights, cols, GAP);
    const box = start.boxes[id];
    const isRtl = document.documentElement.dir === "rtl";
    const left = isRtl ? width - box.x * ((width - GAP * (cols - 1)) / cols + GAP) - (box.w * ((width - GAP * (cols - 1)) / cols) + (box.w - 1) * GAP) : box.x * ((width - GAP * (cols - 1)) / cols + GAP);
    e.preventDefault();
    gesture.current = {
      type, id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
      offsetX: e.clientX - rect.left - left,
      // move: grab point inside the widget · resize: pointer position relative to the grid at the start
      offsetY: type === "move" ? e.clientY - rect.top - box.y : e.clientY - rect.top,
      items, natural: heights, start, bp, width, active: false,
    };
  };

  const onFrameDown = (id: string, e: ReactPointerEvent) => {
    // Mouse users can drag a widget from any empty part of it; touch uses the handle so the page still scrolls.
    const el = e.target as Element;
    if (e.pointerType !== "mouse" || el.closest(INTERACTIVE)) return;
    if (el.classList.contains("dash-scroll") && el.scrollHeight > el.clientHeight) return; // its scrollbar
    begin("move", id, e);
  };

  const commitFromKey = (next: LayoutItem[], control: HTMLElement) => {
    commit.current(bp, next);
    requestAnimationFrame(() => control.focus()); // reordering can move the focused node in the DOM
  };

  const onMoveKey = (id: string, e: ReactKeyboardEvent<HTMLElement>) => {
    const box = placement.boxes[id];
    const item = items.find((i) => i.id === id)!;
    let next: LayoutItem[] | null = null;
    if (e.key === "ArrowUp") next = swapItem(items, id, -1, cols);
    else if (e.key === "ArrowDown") next = swapItem(items, id, 1, cols);
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const step = (e.key === "ArrowRight") !== rtl ? 1 : -1;
      next = moveItem(items, placement, id, box.x + step, box.y, cols);
      if (next.find((i) => i.id === id)!.x === item.x) next = null;
    }
    if (!next) return;
    e.preventDefault();
    commitFromKey(next, e.currentTarget);
  };

  const onResizeKey = (id: string, e: ReactKeyboardEvent<HTMLElement>) => {
    const box = placement.boxes[id];
    const item = items.find((i) => i.id === id)!;
    const grow = (e.key === "ArrowRight") !== rtl ? 1 : -1;
    let next: LayoutItem[] | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") next = resizeItem(items, placement, id, item.w + grow, item.h, bp);
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") next = resizeItem(items, placement, id, item.w, clampHeight(box.h + (e.key === "ArrowDown" ? 20 : -20)), bp);
    else if (e.key === "Enter") next = resizeItem(items, placement, id, item.w, null, bp);
    if (!next) return;
    e.preventDefault();
    commitFromKey(next, e.currentTarget);
  };

  // Keep DOM (and therefore tab / reading order) equal to the saved visual order; it never changes mid-gesture.
  const order = items.map((i) => i.id).filter((id) => ids.includes(id));
  const target = live ? placement.boxes[live.id] : null;
  const floatingBottom = live?.type === "move" ? live.top + (target?.h ?? 0) : 0;

  return (
    <div ref={root} className={cn("dashboard-layout dash-grid", ready && "dash-ready", live && "dash-active")} data-bp={bp} style={{ height: Math.max(placement.height, floatingBottom, live?.startHeight ?? 0), visibility: width ? undefined : "hidden" }}>
      {live?.type === "move" && target && <div className="dash-placeholder" data-testid="dash-placeholder" aria-hidden style={{ width: pixelWidth(target.w), height: target.h, transform: `translate3d(${pixelLeft(target.x, target.w)}px, ${target.y}px, 0)` }} />}
      {order.map((id) => {
        const box = placement.boxes[id];
        const active = live?.id === id;
        const floating = active && live!.type === "move";
        const left = floating ? live!.left : pixelLeft(box.x, box.w);
        const top = floating ? live!.top : box.y;
        const fixed = shown.find((i) => i.id === id)?.h ?? null;
        return (
          <div key={id} data-widget={id} data-x={box.x} data-w={box.w} data-h={fixed ?? "auto"} className={cn("dash-item", `dashboard-widget-${id}`, active && "dash-item-active", floating && "dash-item-floating")} style={{ width: column ? pixelWidth(box.w) : "100%", height: box.h, transform: `translate3d(${left}px, ${top}px, 0)` }}>
            <div className="glass dash-frame" onPointerDown={(e) => onFrameDown(id, e)}>
              <div className={cn("dash-scroll", fixed !== null && "dash-scroll-fixed")}>
                <div ref={contentRef} data-content={id} className="dash-content card-pad">{render(id)}</div>
              </div>
            </div>
            <button type="button" className="dash-handle" aria-label={labels.move(id)} title={labels.move(id)} onPointerDown={(e) => begin("move", id, e)} onKeyDown={(e) => onMoveKey(id, e)} onContextMenu={(e) => e.preventDefault()}>
              <GripHorizontal className="size-4" aria-hidden />
            </button>
            <button type="button" className="dash-resize" aria-label={labels.resize(id)} title={labels.resize(id)} onPointerDown={(e) => begin("resize", id, e)} onKeyDown={(e) => onResizeKey(id, e)} onDoubleClick={() => commit.current(bp, resizeItem(items, placement, id, shown.find((i) => i.id === id)!.w, null, bp))} onContextMenu={(e) => e.preventDefault()}>
              <svg viewBox="0 0 12 12" aria-hidden><path d="M11 3 3 11M11 7.5 7.5 11" /></svg>
            </button>
            {active && live!.type === "resize" && <span className="dash-size-badge" aria-hidden>{box.w}/{cols} · {Math.round(box.h)}px</span>}
          </div>
        );
      })}
    </div>
  );
}

function changesLayout(before: LayoutItem[], after: LayoutItem[], natural: Record<string, number>, cols: number) {
  const a = place(before, natural, cols, GAP, false).boxes;
  const b = place(after, natural, cols, GAP, false).boxes;
  return after.some((item) => {
    const old = before.find((i) => i.id === item.id);
    return !old || old.w !== item.w || old.h !== item.h || a[item.id].x !== b[item.id].x || a[item.id].y !== b[item.id].y;
  });
}
