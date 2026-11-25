"use client";
import { Flame, Plus, SlidersHorizontal, Target, Timer, BookMarked, Repeat, Trophy, Zap, CheckCircle2, ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HabitIcon } from "@/components/habit-icon";
import { useApp } from "@/components/providers";
import { NowPlayingWidget } from "@/components/spotify";
import { Button, Card, Checkbox, EmptyState, ErrorState, Modal, Progress, Ring, Skeleton, Switch, useUI } from "@/components/ui";
import { api, minutesLabel, useFetch } from "@/lib/client";
import { fmtLong, fmtShort, hourIn } from "@/lib/dates";
import { WIDGETS } from "@/lib/prefs";

type Dash = {
  today: string; score: number; dailyGoal: number; completedToday: number; remaining: number; overdue: number; openTotal: number;
  habits: { done: number; total: number; list: { id: string; name: string; icon: string; done: boolean }[] };
  challenge: { id: string; title: string; minutes: number; xp: number; difficulty: string; completedAt: string | null } | null;
  streak: { current: number; longest: number }; weeklyStreak: number; focusMinutes: number; weekFocusMinutes: number;
  week: { date: string; score: number; level: number }[]; weekTasks: number; weekHabits: number;
  upcoming: { id: string; title: string; dueDate: string; dueTime: string | null; priority: string }[];
  xp: number; level: { level: number; into: number; span: number };
  recent: { key: string; title: string; desc: string; xp: number }[];
};
const LABELS: Record<string, string> = { progress: "Today's progress", streak: "Streak & level", focus: "Focus time", challenge: "Daily challenge", habits: "Habits", reminders: "Upcoming reminders", weekly: "Weekly summary", achievements: "Recent achievements", music: "Spotify now playing" };

export default function DashboardPage() {
  const { user, prefs, savePrefs, t, lang } = useApp();
  const { run } = useUI();
  const { data, error, loading, reload } = useFetch<Dash>("/api/dashboard");
  const [custom, setCustom] = useState(false);
  const w = prefs.dashboard.widgets;
  const show = (k: string) => w[k] !== false;
  const hour = hourIn(user?.timezone);
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = user?.displayName.split(" ")[0] ?? "";

  const toggleHabit = async (id: string, done: boolean) => {
    await run(() => api(`/api/habits/${id}/log`, { body: { amount: done ? 0 : 1 } }));
    reload();
  };

  return (
    <div className="space-y-[var(--gap)]">
      <div className="glass dash-hero card-pad">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{data ? fmtLong(data.today, lang) : "\u00a0"}</p>
            <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight sm:text-3xl">{t(greet)}, <span className="accent-grad">{first}</span>.</h1>
            <p className="mt-1.5 text-sm text-muted">{data ? (data.remaining ? `${data.remaining} task${data.remaining > 1 ? "s" : ""} need your attention today.` : "You're all clear for today.") : "Loading your day…"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/tasks?new=1" className="glass-btn btn-primary"><Plus className="size-4" />{t("Create Task")}</Link>
            <Link href="/habits?new=1" className="glass-btn"><Repeat className="size-4" />{t("Add Habit")}</Link>
            <Link href="/focus" className="glass-btn"><Timer className="size-4" />{t("Start Focus")}</Link>
            <Link href="/vault?new=1" className="glass-btn"><BookMarked className="size-4" />{t("Create Note")}</Link>
            <Link href="/goals?new=1" className="glass-btn"><Target className="size-4" />{t("Add Goal")}</Link>
            <Button variant="ghost" size="icon" onClick={() => setCustom(true)} aria-label="Customize dashboard"><SlidersHorizontal className="size-4" /></Button>
          </div>
        </div>
      </div>

      {error && !data && <ErrorState message={error} retry={reload} />}
      {loading && !data && <div className="grid gap-[var(--gap)] md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48" />)}</div>}

      {data && (
        <>
          <div className="grid gap-[var(--gap)] md:grid-cols-2 lg:grid-cols-3">
            {show("progress") && (
              <Card>
                <h2 className="mb-4 text-sm font-medium text-muted">{t("Today's progress")}</h2>
                <div className="flex items-center gap-5">
                  <Ring value={(data.score / data.dailyGoal) * 100} size={104}>
                    <div><p className="text-2xl font-semibold tabular-nums">{data.score}</p><p className="text-[10px] text-faint">of {data.dailyGoal} pts</p></div>
                  </Ring>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold tabular-nums">{data.completedToday}</span> <span className="text-muted">{t("Completed tasks").toLowerCase()}</span></p>
                    <p><span className="font-semibold tabular-nums">{data.remaining}</span> <span className="text-muted">{t("Remaining").toLowerCase()} due</span></p>
                    {data.overdue > 0 && <p className="text-xs text-red-400">{data.overdue} overdue</p>}
                  </div>
                </div>
              </Card>
            )}
            {show("habits") && (
              <Card>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Habits")}</h2><span className="text-xs text-faint">{data.habits.done}/{data.habits.total} today</span></div>
                {data.habits.total === 0 ? <EmptyState icon={<Repeat className="size-5" />} title="No habits scheduled today" action={<Link href="/habits?new=1" className="glass-btn btn-sm">Add habit</Link>} /> : (
                  <>
                    <Progress value={data.habits.total ? (100 * data.habits.done) / data.habits.total : 0} className="mb-3" />
                    <ul className="space-y-2">
                      {data.habits.list.map((h) => (
                        <li key={h.id} className="flex items-center gap-3 text-sm">
                          <Checkbox checked={h.done} onChange={() => toggleHabit(h.id, h.done)} label={`Mark ${h.name} ${h.done ? "incomplete" : "complete"}`} />
                          <HabitIcon name={h.icon} className="size-4 text-muted" /> <span className={h.done ? "text-muted line-through" : ""}>{h.name}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-faint">Water, reading & learning habits complete from their trackers.</p>
                  </>
                )}
              </Card>
            )}
            {show("challenge") && (
              <Card className="flex flex-col">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Daily Challenge")}</h2><Zap className="size-4 text-accent" /></div>
                {data.challenge ? (
                  <>
                    <p className="text-lg font-semibold leading-snug">{data.challenge.title}</p>
                    <p className="mt-1 text-sm text-muted">{data.challenge.minutes} min · {data.challenge.difficulty} · +{data.challenge.xp} XP</p>
                    <div className="mt-auto pt-4">
                      {data.challenge.completedAt ? <p className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="size-4" /> Completed today</p> : <Link href="/challenge" className="glass-btn btn-primary btn-sm">Open challenge</Link>}
                    </div>
                  </>
                ) : null}
              </Card>
            )}
          </div>

          <div className="grid gap-[var(--gap)] md:grid-cols-2 lg:grid-cols-3">
            {show("streak") && (
              <Card>
                <h2 className="mb-3 text-sm font-medium text-muted">{t("Current streak")}</h2>
                <div className="flex items-end gap-2"><Flame className="mb-1 size-7 text-orange-400" /><span className="text-4xl font-semibold tabular-nums">{data.streak.current}</span><span className="mb-1.5 text-sm text-muted">day{data.streak.current === 1 ? "" : "s"}</span></div>
                <p className="mt-1 text-xs text-faint">Best {data.streak.longest} · {data.weeklyStreak} week streak</p>
                <div className="mt-4 flex items-center justify-between text-xs"><span className="font-medium">Level {data.level.level}</span><span className="text-faint">{data.level.into}/{data.level.span} XP</span></div>
                <Progress value={(100 * data.level.into) / data.level.span} className="mt-1.5" />
              </Card>
            )}
            {show("focus") && (
              <Card>
                <h2 className="mb-3 text-sm font-medium text-muted">{t("Focus time")}</h2>
                <p className="text-4xl font-semibold tabular-nums">{minutesLabel(data.focusMinutes)}</p>
                <p className="mt-1 text-xs text-faint">today · {minutesLabel(data.weekFocusMinutes)} this week</p>
                <Link href="/focus" className="glass-btn btn-sm mt-4"><Timer className="size-4" /> {t("Start Focus")}</Link>
              </Card>
            )}
            {show("weekly") && (
              <Card>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Weekly summary")}</h2><Link href="/review" className="text-xs text-accent">Review</Link></div>
                <div className="flex h-20 items-end gap-1.5" role="img" aria-label="Activity score by day this week">
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
                <p className="mt-3 text-xs text-muted">{data.weekTasks} tasks · {data.weekHabits} habits completed this week</p>
              </Card>
            )}
          </div>

          <div className="grid gap-[var(--gap)] lg:grid-cols-2">
            {show("reminders") && (
              <Card>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Upcoming reminders")}</h2><Link href="/tasks" className="text-xs text-accent">All tasks</Link></div>
                {data.upcoming.length === 0 ? <EmptyState icon={<Clock className="size-5" />} title="Nothing scheduled" text="Tasks with due dates will show up here." /> : (
                  <ul className="divide-y divide-[var(--border)]">
                    {data.upcoming.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="truncate">{u.title}</span>
                        <span className={`shrink-0 text-xs ${u.dueDate === data.today ? "text-amber-400" : "text-faint"}`}>{u.dueDate === data.today ? "Today" : fmtShort(u.dueDate, lang)}{u.dueTime ? ` · ${u.dueTime}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
            {show("achievements") && (
              <Card>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-muted">{t("Recent achievements")}</h2><Link href="/achievements" className="text-xs text-accent">All <ArrowUpRight className="inline size-3" /></Link></div>
                {data.recent.length === 0 ? <EmptyState icon={<Trophy className="size-5" />} title="No badges yet" text="Complete a task, habit or focus session to unlock your first." /> : (
                  <ul className="space-y-3">
                    {data.recent.map((r) => (
                      <li key={r.key} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-card text-accent"><Trophy className="size-5" /></span><span className="min-w-0"><span className="block text-sm font-medium">{r.title}</span><span className="block truncate text-xs text-muted">{r.desc}</span></span></li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
          {show("music") && <NowPlayingWidget />}
        </>
      )}

      <Modal open={custom} onClose={() => setCustom(false)} title="Customize dashboard">
        <p className="mb-3 text-sm text-muted">Choose which widgets appear. Saved to your account.</p>
        <ul className="space-y-1">
          {WIDGETS.map((k) => (
            <li key={k} className="flex items-center justify-between rounded-lg px-1 py-2 text-sm">
              <span>{LABELS[k]}</span>
              <Switch checked={show(k)} label={LABELS[k]} onChange={(v) => run(() => savePrefs({ dashboard: { widgets: { ...w, [k]: v }, order: prefs.dashboard.order, sizes: prefs.dashboard.sizes } }))} />
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
