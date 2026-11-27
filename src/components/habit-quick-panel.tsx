"use client";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Droplets, Lightbulb, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/client";
import { useHabitsChanged } from "@/lib/habit-events";
import { displayAmounts, habitPercent, overallPercent, quickStep, wholePercent, type TrackerKind } from "@/lib/habit-progress";
import { PREDEFINED_HABITS_CLIENT } from "@/lib/habit-templates";
import { useApp } from "./providers";
import { ErrorState, cn, useUI } from "./ui";

type Habit = { id: string; name: string; kind: string; target: number; todayAmount: number; unit: string };
type Data = { habits: Habit[]; lastBook: string };

const MAIN: { kind: TrackerKind; icon: typeof BookOpen }[] = [
  { kind: "reading", icon: BookOpen },
  { kind: "water", icon: Droplets },
  { kind: "learning", icon: Lightbulb },
];
const template = (kind: TrackerKind) => PREDEFINED_HABITS_CLIENT.find((h) => h.kind === kind)!;
const DONE = "#34d399";

function ProgressRing({ percent, size, stroke, done, children }: { percent: number; size: number; stroke: number; done: boolean; children: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={done ? DONE : "var(--accent)"} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} opacity={percent > 0 ? 1 : 0} className="habit-ring" />
      </svg>
      <span className="relative grid place-items-center">{children}</span>
    </span>
  );
}

export function HabitQuickPanel() {
  const { t, lang } = useApp();
  const { run, toast } = useUI();
  const path = usePathname();
  // The panel remembers which page opened it, so navigating anywhere closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === path;
  const close = useCallback(() => setOpenedOn(null), []);
  const [mounted, setMounted] = useState(false); // the portal only exists after hydration
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<TrackerKind | null>(null);
  const [position, setPosition] = useState({ top: 64, left: 8, width: 340, maxHeight: 480 });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const locked = useRef(false);

  const load = useCallback(async () => {
    const mine = ++sequence.current;
    try {
      const [h, tr] = await Promise.all([
        api<{ habits: Habit[] }>("/api/habits"),
        api<{ reading: { entries: { book: string }[] } }>("/api/trackers"),
      ]);
      if (mine !== sequence.current) return;
      setData({ habits: h.habits, lastBook: tr.reading.entries[0]?.book ?? "" });
      setFailed(false);
    } catch {
      if (mine === sequence.current) setFailed(true);
    }
  }, []);
  useHabitsChanged(() => { if (open) void load(); });

  /** Anchors the panel under the button and keeps it inside the viewport in both text directions. */
  const reposition = useCallback(() => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const viewport = document.documentElement.clientWidth;
    const width = Math.min(340, viewport - 16);
    const preferred = document.documentElement.dir === "rtl" ? rect.right - width : rect.left;
    const top = rect.bottom + 10;
    setPosition({ top, width, left: Math.max(8, Math.min(preferred, viewport - width - 8)), maxHeight: Math.max(220, window.innerHeight - top - 8) });
  }, []);

  useEffect(() => {
    if (!open) return;
    // Next frame: fetch fresh data, and re-anchor once a language switch has flipped the page.
    const frame = requestAnimationFrame(() => { reposition(); void load(); });
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close();
    };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition);
    };
  }, [open, load, reposition, close, lang]);

  const rows = MAIN.map((main) => {
    const habit = data?.habits.find((h) => h.kind === main.kind);
    const amount = habit?.todayAmount ?? 0;
    const target = habit?.target ?? 0;
    const percent = habit ? habitPercent(amount, target) : 0;
    return { ...main, habit, amount, target, percent, done: !!habit && amount >= target, name: habit?.name ?? template(main.kind).name };
  });
  const overall = overallPercent(rows.map((r) => r.percent));
  const doneCount = rows.filter((r) => r.done).length;

  const press = async (row: (typeof rows)[number]) => {
    if (locked.current || !data || row.done) return;
    locked.current = true;
    setBusy(row.kind);
    try {
      if (!row.habit) {
        // Uses the normal habit creation endpoint; anything already logged today counts straight away.
        const h = template(row.kind);
        await run(() => api("/api/habits", { body: { name: h.name, icon: h.icon, kind: h.kind, target: h.target, unit: h.unit, description: h.description } }), t("Habit added"));
      } else {
        const step = quickStep(row.kind, row.amount, row.target);
        const body =
          row.kind === "water" ? { ml: Math.max(50, step), cap: true }
          : row.kind === "reading" ? { book: data.lastBook || t("Quick log"), pages: step, cap: true }
          : { title: t("Quick check-in"), explanation: "", cap: true };
        const result = await run(() => api<{ logged: number }>(`/api/trackers/${row.kind}`, { body }));
        if (result && row.amount + result.logged >= row.target) toast("success", t("Habit complete"));
      }
      await load();
    } finally {
      locked.current = false;
      setBusy(null);
    }
  };

  const action = (row: (typeof rows)[number]) => {
    if (!row.habit) return t("Add");
    if (row.done) return t("Done");
    const step = quickStep(row.kind, row.amount, row.target);
    if (row.kind === "water") return `+${Number((step / 250).toFixed(1))} ${t(step === 250 ? "cup" : "cups")}`;
    return `+${step} ${t(row.kind === "reading" ? "pages" : "entry")}`;
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => { setMounted(true); reposition(); setOpenedOn(open ? null : path); }}
        className="header-icon-btn grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-transparent text-current transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        aria-label={t("Habit quick tracker")}
        title={t("Habit quick tracker")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="habit-quick-panel"
      >
        <Droplets className="size-[22px] stroke-[2.1]" aria-hidden="true" />
      </button>
      {/* Portalled to <body>: the header's own backdrop filter would otherwise trap and clip the glass panel. */}
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panel}
              id="habit-quick-panel"
              role="dialog"
              aria-label={t("Quick habit tracker")}
              initial={{ opacity: 0, y: -7, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="habit-glass fixed z-[75] overflow-y-auto p-3"
              style={position}
            >
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-sm font-semibold">{t("Quick habit tracker")}</p>
                  <p className="text-[11px] text-muted">{t("Your daily targets")}</p>
                </div>
                <button type="button" onClick={() => { close(); button.current?.focus(); }} aria-label={t("Close")} className="rounded-lg p-1.5 text-muted hover:bg-card"><X className="size-4" /></button>
              </div>
              {!data ? (
                failed ? <div className="py-3"><ErrorState message="Could not load habit progress." retry={() => void load()} /></div>
                : <p className="flex items-center justify-center gap-2 py-12 text-xs text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> {t("Loading…")}</p>
              ) : (
                <>
                  {failed && <p role="alert" className="mt-2 text-center text-[11px] text-amber-400">{t("Could not load habit progress.")}</p>}
                  <div className="my-3 flex justify-center" role="progressbar" aria-label={t("Overall progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={wholePercent(overall)} data-testid="habit-overall">
                    <ProgressRing percent={overall} size={104} stroke={8} done={doneCount === rows.length}>
                      <span className="text-center">
                        <span className="block text-2xl font-semibold tabular-nums leading-none" dir="ltr">{wholePercent(overall)}%</span>
                        <span className="mt-1 block text-[10px] text-muted">{doneCount}/{rows.length} {t("Done")}</span>
                      </span>
                    </ProgressRing>
                  </div>
                  <ul className="grid grid-cols-3 gap-1">
                    {rows.map((row) => {
                      const shown = displayAmounts(row.kind, row.amount, row.target);
                      const percent = wholePercent(row.percent);
                      return (
                        <li key={row.kind} className="flex min-w-0 flex-col items-center gap-1 text-center" data-habit={row.kind} data-percent={percent}>
                          <button
                            type="button"
                            onClick={() => void press(row)}
                            aria-disabled={row.done || !!busy}
                            aria-label={`${t(row.name)}: ${percent}% — ${action(row)}`}
                            title={action(row)}
                            className={cn("relative rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", row.done ? "cursor-default" : "hover:scale-105 active:scale-95")}
                          >
                            <ProgressRing percent={row.percent} size={64} stroke={5} done={row.done}>
                              {busy === row.kind ? <Loader2 className="size-6 animate-spin text-accent" aria-hidden /> : <row.icon className={cn("size-6", row.done ? "text-emerald-400" : "")} aria-hidden />}
                            </ProgressRing>
                            {row.done && <span className="absolute -end-0.5 -top-0.5 grid size-5 place-items-center rounded-full text-black" style={{ background: DONE }} data-testid="habit-complete"><Check className="size-3.5" strokeWidth={3} aria-hidden /></span>}
                            {!row.habit && <span className="absolute -end-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-accent text-[var(--on-accent)]"><Plus className="size-3.5" aria-hidden /></span>}
                          </button>
                          <span className="line-clamp-2 min-h-[2.4em] text-[11px] font-medium leading-tight">{t(row.name)}</span>
                          <span className="text-sm font-semibold tabular-nums" dir="ltr">{percent}%</span>
                          <span className="text-[10px] tabular-nums text-muted">{row.habit ? `${shown.amount}/${shown.target} ${t(row.kind === "water" ? "cups" : row.habit.unit)}` : t("Not added yet")}</span>
                          <span className={cn("chip whitespace-nowrap", row.done && "!text-emerald-400")} aria-hidden>{action(row)}</span>
                          <Link href={`/habits?tab=${row.kind}`} onClick={close} className="text-[10px] text-muted underline underline-offset-2 hover:text-fg">{t("Details")}</Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <div className="mt-2 border-t border-line pt-2">
                <Link href="/habits" onClick={close} className="block rounded-lg py-1.5 text-center text-xs text-muted transition-colors hover:bg-card hover:text-fg">{t("Open all habits")}</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
