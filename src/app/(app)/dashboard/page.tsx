"use client";
import { Flame, Plus, SlidersHorizontal, Target, Timer, BookMarked, Repeat, Trophy, Zap, CheckCircle2, ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { DashboardGrid } from "@/components/dashboard-grid";
import { HabitIcon } from "@/components/habit-icon";
import { useApp } from "@/components/providers";
import { NowPlayingWidget } from "@/components/spotify";
import { Button, Card, Checkbox, EmptyState, ErrorState, Modal, Progress, Ring, Skeleton, Switch, useUI } from "@/components/ui";
import { api, minutesLabel, useFetch } from "@/lib/client";
import { fmtLong, fmtShort, hourIn } from "@/lib/dates";
import { mergeHidden, resolveLayout, sizeToWidth, swapItem, widthToSize, breakpointFor, COLUMNS, type Breakpoint, type LayoutItem, type Size } from "@/lib/dashboard-layout";
import { useHabitsChanged } from "@/lib/habit-events";
import { DEFAULT_PREFS, WIDGETS, type Prefs } from "@/lib/prefs";

type Dash = {
  today: string; score: number; dailyGoal: number; completedToday: number; remaining: number; overdue: number; openTotal: number;
  habits: { done: number; total: number; list: { id: string; name: string; icon: string; target: number; done: boolean }[] };
  challenge: { id: string; title: string; minutes: number; xp: number; difficulty: string; completedAt: string | null } | null;
  streak: { current: number; longest: number }; weeklyStreak: number; focusMinutes: number; weekFocusMinutes: number;
  week: { date: string; score: number; level: number }[]; weekTasks: number; weekHabits: number;
  upcoming: { id: string; title: string; dueDate: string; dueTime: string | null; priority: string }[];
  xp: number; level: { level: number; into: number; span: number };
  recent: { key: string; title: string; desc: string; xp: number }[];
};
const LABELS: Record<string, string> = { progress: "Today's progress", streak: "Streak & level", focus: "Focus time", challenge: "Daily challenge", habits: "Habits", reminders: "Upcoming reminders", weekly: "Weekly summary", achievements: "Recent achievements", music: "Spotify now playing" };

type Layout = Prefs["dashboard"];

export default function DashboardPage() {
  const { user, prefs, savePrefs, t, lang } = useApp();
  const { run } = useUI();
  const { data, error, loading, reload } = useFetch<Dash>("/api/dashboard");
  useHabitsChanged(reload);
  const [custom, setCustom] = useState(false);
  const [bp, setBp] = useState<Breakpoint>("lg");
  // Changes show immediately; saves run one after another so an older response never overwrites a newer layout.
  const [pending, setPending] = useState<Layout | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(0);
  const dashboard = pending ?? prefs.dashboard;
  const { widgets: w, order, sizes } = dashboard;
  const layouts = dashboard.layouts ?? {};
  const saveDashboard = (next: Layout) => {
    const mine = ++latest.current;
    setPending(next);
    queue.current = queue.current.then(async () => {
      await run(async () => { await savePrefs({ dashboard: next }); return true; }, mine === latest.current ? t("Dashboard layout saved.") : undefined);
      if (mine === latest.current) setPending(null); // shows the server copy, or rolls back if saving failed
    });
  };
  const show = (k: string) => w[k] !== false;
  const visible = order.filter(show);
  const layoutFor = (at: Breakpoint) => resolveLayout(layouts[at], visible, sizes, at);
  const commitLayout = (at: Breakpoint, items: LayoutItem[]) => {
    const merged = mergeHidden(items, layouts[at]);
    // The wide layout also drives the default order used by screens that have no saved layout yet.
    const nextOrder = at === "lg" ? [...new Set([...merged.map((i) => i.id), ...order])] : order;
    saveDashboard({ ...dashboard, order: nextOrder, layouts: { ...layouts, [at]: merged } });
  };
  const openCustomize = () => {
    const grid = document.querySelector<HTMLElement>(".dash-grid");
    setBp((grid?.dataset.bp as Breakpoint | undefined) ?? breakpointFor(window.innerWidth));
    setCustom(true);
  };
  const current = layoutFor(bp);
  const moveWidget = (key: string, delta: -1 | 1) => commitLayout(bp, swapItem(current, key, delta, COLUMNS[bp]));
  const setSize = (key: string, size: Size) => {
    const width = sizeToWidth(size, bp);
    const items = current.map((i) => (i.id === key ? { ...i, w: width, x: Math.min(i.x, COLUMNS[bp] - width) } : i));
    saveDashboard({ ...dashboard, sizes: { ...sizes, [key]: size }, layouts: { ...layouts, [bp]: mergeHidden(items, layouts[bp]) } });
  };
  const resetLayout = () => {
    // Reset every breakpoint to a fresh, deterministic layout; never reuse stale saved positions.
    const order = [...WIDGETS];
    const sizes: Record<string, Size> = Object.fromEntries(WIDGETS.map((key) => [key, "standard" as const]));
    const layouts: Prefs["dashboard"]["layouts"] = {
      lg: resolveLayout(undefined, order.filter((key) => w[key] !== false), sizes, "lg"),
      md: resolveLayout(undefined, order.filter((key) => w[key] !== false), sizes, "md"),
      sm: resolveLayout(undefined, order.filter((key) => w[key] !== false), sizes, "sm"),
    };
    saveDashboard({ widgets: w, order, sizes, layouts });
  };
  // The list mirrors what is on screen; hidden widgets follow it.
  const listed = [...current.map((i) => i.id), ...order.filter((k) => !show(k))].filter((k) => (WIDGETS as readonly string[]).includes(k));
  const hour = hourIn(user?.timezone);
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = user?.displayName.split(" ")[0] ?? "";

  const toggleHabit = async (id: string, done: boolean, target: number) => {
    // Ticking a habit records its full target, so it never lowers progress already logged.
    await run(() => api(`/api/habits/${id}/log`, { body: { amount: done ? 0 : target } }));
    reload();
  };

  const renderWidget = (key: string) => {
    if (!data) return null;
    switch (key) {
      case "progress": return (
        <>
          <h2 className="mb-4 text-sm font-medium text-muted">{t("Today's progress")}</h2>
          <div className="flex items-center gap-5">
            <Ring value={(data.score / data.dailyGoal) * 100} size={104}>
              <div><p className="text-2xl font-semibold tabular-nums">{data.score}</p><p className="text-[10px] text-faint">{t("of")} {data.dailyGoal} {t("pts")}</p></div>
            </Ring>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold tabular-nums">{data.completedToday}</span> <span className="text-muted">{t("Completed tasks").toLowerCase()}</span></p>
              <p><span className="font-semibold tabular-nums">{data.remaining}</span> <span className="text-muted">{t("Remaining").toLowerCase()} {t("due")}</span></p>
              {data.overdue > 0 && <p className="text-xs text-red-400">{data.overdue} {t("overdue")}</p>}
            </div>
          </div>
        </>
      );
      case "habits": return (
        <>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Habits")}</h2><span className="text-xs text-faint">{data.habits.done}/{data.habits.total} {t("today")}</span></div>
          {data.habits.total === 0 ? <EmptyState icon={<Repeat className="size-5" />} title={t("No habits scheduled today")} action={<Link href="/habits?new=1" className="glass-btn btn-sm">{t("Add habit")}</Link>} /> : (
            <>
              <Progress value={data.habits.total ? (100 * data.habits.done) / data.habits.total : 0} className="mb-3" />
              <ul className="space-y-2">
                {data.habits.list.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={h.done} onChange={() => toggleHabit(h.id, h.done, h.target)} label={`${t("Mark")} ${t(h.name)} ${t(h.done ? "incomplete" : "complete")}`} />
                    <HabitIcon name={h.icon} className="size-4 text-muted" /> <span className={h.done ? "text-muted line-through" : ""}>{t(h.name)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-faint">{t("Water, reading & learning habits complete from their trackers.")}</p>
            </>
          )}
        </>
      );
      case "challenge": return (
        <>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Daily Challenge")}</h2><Zap className="size-4 text-accent" /></div>
          {data.challenge ? (
            <>
              <p className="text-lg font-semibold leading-snug">{t(data.challenge.title)}</p>
              <p className="mt-1 text-sm text-muted">{data.challenge.minutes} {t("min")} · {t(data.challenge.difficulty)} · +{data.challenge.xp} XP</p>
              <div className="pt-4">
                {data.challenge.completedAt ? <p className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="size-4" /> {t("Completed today")}</p> : <Link href="/challenge" className="glass-btn btn-primary btn-sm">{t("Open challenge")}</Link>}
              </div>
            </>
          ) : null}
        </>
      );
      case "streak": return (
        <>
          <h2 className="mb-3 text-sm font-medium text-muted">{t("Current streak")}</h2>
          <div className="flex items-end gap-2"><Flame className="mb-1 size-7 text-orange-400" /><span className="text-4xl font-semibold tabular-nums">{data.streak.current}</span><span className="mb-1.5 text-sm text-muted">{t(data.streak.current === 1 ? "day" : "days")}</span></div>
          <p className="mt-1 text-xs text-faint">{t("Best")} {data.streak.longest} · {data.weeklyStreak} {t("week streak")}</p>
          <div className="mt-4 flex items-center justify-between text-xs"><span className="font-medium">{t("Level")} {data.level.level}</span><span className="text-faint">{data.level.into}/{data.level.span} XP</span></div>
          <Progress value={(100 * data.level.into) / data.level.span} className="mt-1.5" />
        </>
      );
      case "focus": return (
        <>
          <h2 className="mb-3 text-sm font-medium text-muted">{t("Focus time")}</h2>
          <p className="text-4xl font-semibold tabular-nums">{minutesLabel(data.focusMinutes)}</p>
          <p className="mt-1 text-xs text-faint">{t("today")} · {minutesLabel(data.weekFocusMinutes)} {t("this week")}</p>
          <Link href="/focus" className="glass-btn btn-sm mt-4"><Timer className="size-4" /> {t("Start Focus")}</Link>
        </>
      );
      case "weekly": return (
        <>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Weekly summary")}</h2><Link href="/review" className="text-xs text-accent">{t("Review")}</Link></div>
          <div className="flex h-20 items-end gap-1.5" role="img" aria-label={t("Activity score by day this week")}>
            {data.week.map((d) => {
              const max = Math.max(data.dailyGoal, ...data.week.map((x) => x.score), 1);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${fmtShort(d.date, lang)}: ${d.score} pts`}>
                  <div className="w-full rounded-md bg-accent/70" style={{ height: `${Math.max(4, (d.score / max) * 100)}%`, opacity: d.score ? 1 : 0.2 }} />
                  <span className="text-[10px] text-faint">{new Intl.DateTimeFormat(lang, { weekday: "narrow", timeZone: "UTC" }).format(new Date(d.date + "T00:00:00Z"))}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">{data.weekTasks} {t("tasks")} · {data.weekHabits} {t("habits")} {t("completed this week")}</p>
        </>
      );
      case "reminders": return (
        <>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Upcoming reminders")}</h2><Link href="/tasks" className="text-xs text-accent">{t("All tasks")}</Link></div>
          {data.upcoming.length === 0 ? <EmptyState icon={<Clock className="size-5" />} title={t("Nothing scheduled")} text={t("Tasks with due dates will show up here.")} /> : (
            <ul className="divide-y divide-[var(--border)]">
              {data.upcoming.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="truncate">{u.title}</span>
                  <span className={`shrink-0 text-xs ${u.dueDate === data.today ? "text-amber-400" : "text-faint"}`}>{u.dueDate === data.today ? t("Today") : fmtShort(u.dueDate, lang)}{u.dueTime ? ` · ${u.dueTime}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      );
      case "achievements": return (
        <>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Recent achievements")}</h2><Link href="/achievements" className="text-xs text-accent">{t("All")} <ArrowUpRight className="inline size-3" /></Link></div>
          {data.recent.length === 0 ? <EmptyState icon={<Trophy className="size-5" />} title={t("No badges yet")} text={t("Complete a task, habit or focus session to unlock your first.")} /> : (
            <ul className="space-y-3">
              {data.recent.map((r) => (
                <li key={r.key} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-card text-accent"><Trophy className="size-5" /></span><span className="min-w-0"><span className="block text-sm font-medium">{t(r.title)}</span><span className="block truncate text-xs text-muted">{t(r.desc)}</span></span></li>
              ))}
            </ul>
          )}
        </>
      );
      case "music": return <NowPlayingWidget />;
      default: return null;
    }
  };

  return (
    <div className="space-y-[var(--gap)]">
      <div className="glass dash-hero card-pad">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{data ? fmtLong(data.today, lang) : "\u00a0"}</p>
            <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight sm:text-3xl">{t(greet)}, <span className="accent-grad">{first}</span>.</h1>
            <p className="mt-1.5 text-sm text-muted">{data ? (data.remaining ? `${data.remaining} ${t(data.remaining === 1 ? "task" : "tasks")} ${t("need your attention today.")}` : t("You're all clear for today.")) : t("Loading your day…")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/tasks?new=1" className="glass-btn btn-primary"><Plus className="size-4" />{t("Create Task")}</Link>
            <Link href="/habits?new=1" className="glass-btn"><Repeat className="size-4" />{t("Add Habit")}</Link>
            <Link href="/focus" className="glass-btn"><Timer className="size-4" />{t("Start Focus")}</Link>
            <Link href="/vault?new=1" className="glass-btn"><BookMarked className="size-4" />{t("Create Note")}</Link>
            <Link href="/goals?new=1" className="glass-btn"><Target className="size-4" />{t("Add Goal")}</Link>
            <Button variant="ghost" size="icon" onClick={openCustomize} aria-label={t("Customize dashboard")}><SlidersHorizontal className="size-4" /></Button>
          </div>
        </div>
      </div>

      {error && !data && <ErrorState message={error} retry={reload} />}
      {loading && !data && <div className="grid gap-[var(--gap)] md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48" />)}</div>}

      {data && (
        <DashboardGrid
          ids={visible}
          rtl={lang === "ar"}
          resolve={layoutFor}
          onCommit={commitLayout}
          render={renderWidget}
          labels={{ move: (key) => t("Move {widget}").replace("{widget}", t(LABELS[key])), resize: (key) => t("Resize {widget}").replace("{widget}", t(LABELS[key])) }}
        />
      )}

      <Modal open={custom} onClose={() => setCustom(false)} title={t("Customize dashboard")}>
        <p className="mb-3 text-sm text-muted">{t("Choose which widgets appear. Drag a widget by its handle to move it, and drag its corner to resize it.")}</p>
        <ul className="space-y-1">
          {listed.map((k) => {
            const item = current.find((i) => i.id === k);
            const at = current.findIndex((i) => i.id === k);
            const size = item ? widthToSize(item.w, bp) : sizes[k] ?? "standard";
            return (
              <li key={k} className="flex items-center justify-between rounded-lg px-1 py-2 text-sm">
                <span className="min-w-0 flex-1">{t(LABELS[k])}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={t("Move {widget} up").replace("{widget}", t(LABELS[k]))} onClick={() => moveWidget(k, -1)} disabled={at <= 0}>↑</Button>
                  <Button variant="ghost" size="icon" aria-label={t("Move {widget} down").replace("{widget}", t(LABELS[k]))} onClick={() => moveWidget(k, 1)} disabled={at < 0 || at === current.length - 1}>↓</Button>
                  {bp !== "sm" && (
                    <select aria-label={t("{widget} size").replace("{widget}", t(LABELS[k]))} value={size} disabled={!item} onChange={(e) => setSize(k, e.target.value as Size)} className="max-w-24 rounded-lg border border-line bg-[var(--input)] px-2 py-1.5 text-xs">
                      <option value="compact">{t("Small")}</option>
                      {bp === "lg" && <option value="standard">{t("Medium")}</option>}
                      <option value="wide">{t("Wide")}</option>
                      {size === "custom" && <option value="custom" disabled>{t("Custom")}</option>}
                    </select>
                  )}
                  <Switch checked={show(k)} label={t(LABELS[k])} onChange={(v) => saveDashboard({ ...dashboard, widgets: { ...w, [k]: v } })} />
                </div>
              </li>
            );
          })}
        </ul>
        <Button size="sm" className="mt-3" onClick={resetLayout}>{t("Reset layout")}</Button>
      </Modal>
    </div>
  );
}
