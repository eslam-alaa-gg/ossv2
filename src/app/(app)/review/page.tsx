"use client";
import { ChevronLeft, ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, Checkbox, ErrorState, Field, ListSkeleton, PageHeader, cn, useUI } from "@/components/ui";
import { api, minutesLabel, useFetch } from "@/lib/client";
import { addDays, fmtShort, parseD } from "@/lib/dates";

type R = {
  weekStart: string; weekEnd: string; isCurrent: boolean; days: { date: string; score: number }[]; tasks: number; habits: number; challenges: number; focusMinutes: number; milestonesDone: number; score: number; incomplete: number;
  prev: { tasks: number; habits: number; challenges: number; focusMinutes: number; score: number };
  highlights: { productiveDay: { date: string; score: number } | null; habit: { name: string; c: number } | null; achievement: { title: string; xp: number } | null; task: { title: string; priority: string } | null; milestones: string[] };
  goalProgress: { id: string; title: string; progress: number }[]; saved: { reflections: Record<string, string>; intentions: string; priorityGoalIds: string[]; priorityTaskIds: string[] } | null;
  history: { weekStart: string; reflections: Record<string, string>; intentions: string }[]; planning: { goals: { id: string; title: string }[]; tasks: { id: string; title: string; priority: string; dueDate: string | null }[] };
};
const PROMPTS = [["well", "What went well?"], ["learned", "What did I learn?"], ["challenged", "What challenged me?"], ["improve", "What should I improve?"], ["proud", "What am I proud of?"]] as const;

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const { t } = useApp();
  const d = cur - prev;
  const I = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
  return <span className={cn("flex items-center gap-1 text-xs", d > 0 ? "text-emerald-400" : d < 0 ? "text-amber-400" : "text-faint")}><I className="size-3.5" />{d === 0 ? t("same as last week") : `${d > 0 ? "+" : ""}${d} ${t("vs last week")}`}</span>;
}

export default function ReviewPage() {
  const { lang, t } = useApp();
  const { run } = useUI();
  const [week, setWeek] = useState<string | null>(null);
  const { data, error, reload } = useFetch<R>(`/api/review${week ? `?week=${week}` : ""}`);
  const [refl, setRefl] = useState<Record<string, string>>({});
  const [intent, setIntent] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  useEffect(() => { if (data) { setRefl(data.saved?.reflections ?? {}); setIntent(data.saved?.intentions ?? ""); setGoals(data.saved?.priorityGoalIds ?? []); setTasks(data.saved?.priorityTaskIds ?? []); } }, [data]);
  if (error && !data) return <><PageHeader title={t("Weekly Review")} /><ErrorState message={error} retry={reload} /></>;
  if (!data) return <><PageHeader title={t("Weekly Review")} /><ListSkeleton /></>;
  const max = Math.max(1, ...data.days.map((d) => d.score));
  const toggle = (arr: string[], set: (a: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const hasData = data.score > 0 || data.incomplete > 0;
  const range = `${fmtShort(data.weekStart, lang)} – ${fmtShort(data.weekEnd, lang)}`;
  return (
    <>
      <PageHeader title={t("Weekly Review")} subtitle={t("Real numbers from your week, then a moment to reflect and plan.")} actions={<div className="flex items-center gap-2"><Button size="icon" aria-label={t("Previous week")} onClick={() => setWeek(addDays(data.weekStart, -7))}><ChevronLeft className="size-4 rtl:rotate-180" /></Button><span className="min-w-36 text-center text-sm font-medium">{range}{data.isCurrent ? ` (${t("this week")})` : ""}</span><Button size="icon" aria-label={t("Next week")} disabled={data.isCurrent} onClick={() => setWeek(addDays(data.weekStart, 7))}><ChevronRight className="size-4 rtl:rotate-180" /></Button></div>} />
      <div className="grid grid-cols-2 gap-[var(--gap)] lg:grid-cols-5">
        {[["Tasks completed", data.tasks, data.prev.tasks, String(data.tasks)], ["Habits completed", data.habits, data.prev.habits, String(data.habits)], ["Focus", data.focusMinutes, data.prev.focusMinutes, minutesLabel(data.focusMinutes)], ["Challenges", data.challenges, data.prev.challenges, String(data.challenges)], ["Activity score", data.score, data.prev.score, String(data.score)]].map(([l, c, p, v]) => <Card key={String(l)}><p className="text-xs text-muted">{t(String(l))}</p><p className="my-1 text-2xl font-semibold tabular-nums">{v}</p><Delta cur={c as number} prev={p as number} /></Card>)}
      </div>
      <div className="mt-[var(--gap)] grid gap-[var(--gap)] lg:grid-cols-3">
        <Card className="lg:col-span-2"><h2 className="mb-1 text-sm font-medium text-muted">{t("Productivity trend")}</h2><p className="mb-3 text-xs text-faint">{data.incomplete} {t(data.incomplete === 1 ? "task" : "tasks")} {t("due this week still open")} · {data.milestonesDone} {t(data.milestonesDone === 1 ? "milestone" : "milestones")} {t("reached")}</p>
          <div className="flex h-36 items-end gap-2" role="img" aria-label={t("Daily score for the week")}>{data.days.map((d) => <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5" title={`${fmtShort(d.date, lang)}: ${d.score} {t("pts")}`}><span className="text-[11px] tabular-nums text-faint">{d.score || ""}</span><div className="w-full rounded-lg bg-accent/75" style={{ height: `${Math.max(4, (d.score / max) * 100)}%`, opacity: d.score ? 1 : 0.2 }} /><span className="text-[11px] text-muted">{new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(parseD(d.date))}</span></div>)}</div></Card>
        <Card><h2 className="mb-3 text-sm font-medium text-muted">{t("Highlights")}</h2>
          {!hasData ? <p className="text-sm text-muted">{t("No recorded activity for this week.")}</p> : <ul className="space-y-3 text-sm">
            {data.highlights.productiveDay && <li><span className="block text-xs text-faint">{t("Most productive day")}</span>{new Intl.DateTimeFormat(lang, { weekday: "long", timeZone: "UTC" }).format(parseD(data.highlights.productiveDay.date))} · {data.highlights.productiveDay.score} {t("pts")}</li>}
            {data.highlights.habit && <li><span className="block text-xs text-faint">{t("Most consistent habit")}</span>{data.highlights.habit.name} · {data.highlights.habit.c}×</li>}
            {data.highlights.achievement && <li><span className="block text-xs text-faint">{t("Biggest achievement")}</span>{t(data.highlights.achievement.title)}</li>}
            {data.highlights.task && <li><span className="block text-xs text-faint">{t("Important task completed")}</span>{data.highlights.task.title} <Badge className="capitalize">{t(data.highlights.task.priority)}</Badge></li>}
            {data.highlights.milestones.length > 0 && <li><span className="block text-xs text-faint">{t("Milestones reached")}</span>{data.highlights.milestones.join(", ")}</li>}
            {!data.highlights.productiveDay && !data.highlights.habit && !data.highlights.task && <li className="text-muted">{t("Nothing to highlight yet.")}</li>}
          </ul>}</Card>
      </div>
      <div className="mt-[var(--gap)] grid gap-[var(--gap)] lg:grid-cols-2">
        <Card><h2 className="mb-4 font-semibold">{t("Reflect")}</h2><div className="space-y-4">{PROMPTS.map(([k, q]) => <Field key={k} label={t(q)}><textarea className="input min-h-20" value={refl[k] ?? ""} onChange={(e) => setRefl({ ...refl, [k]: e.target.value })} maxLength={3000} aria-label={t(q)} placeholder={t("Optional")} /></Field>)}</div></Card>
        <Card><h2 className="mb-4 font-semibold">{t("Plan next week")}</h2>
          <Field label={t("Weekly intentions")}><textarea className="input min-h-20" value={intent} onChange={(e) => setIntent(e.target.value)} maxLength={3000} aria-label={t("Weekly intentions")} placeholder={t("What matters most next week?")} /></Field>
          <p className="mb-2 mt-4 text-xs font-medium text-muted">{t("Priority goals")}</p>
          {data.planning.goals.length === 0 ? <p className="text-sm text-faint">{t("No active goals.")}</p> : <ul className="space-y-2">{data.planning.goals.map((g) => <li key={g.id} className="flex items-center gap-3 text-sm"><Checkbox checked={goals.includes(g.id)} onChange={() => toggle(goals, setGoals, g.id)} label={g.title} />{g.title}</li>)}</ul>}
          <p className="mb-2 mt-4 text-xs font-medium text-muted">{t("Important tasks")}</p>
          {data.planning.tasks.length === 0 ? <p className="text-sm text-faint">{t("No open tasks.")}</p> : <ul className="max-h-48 space-y-2 overflow-y-auto">{data.planning.tasks.map((t) => <li key={t.id} className="flex items-center gap-3 text-sm"><Checkbox checked={tasks.includes(t.id)} onChange={() => toggle(tasks, setTasks, t.id)} label={t.title} /><span className="truncate">{t.title}</span><Badge className="ms-auto capitalize">{t.priority}</Badge></li>)}</ul>}
          <Button variant="primary" className="mt-5 w-full" onClick={async () => { if (await run(() => api("/api/review", { method: "PUT", body: { weekStart: data.weekStart, reflections: Object.fromEntries(Object.entries(refl).filter(([, v]) => v.trim())), intentions: intent, priorityGoalIds: goals, priorityTaskIds: tasks } }), "Review saved")) reload(); }}>{t("Save review")}</Button>
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">{t("Previous reviews")}</h2>
      {data.history.length === 0 ? <Card className="text-sm text-muted">{t("Saved reviews will be listed here so you can look back.")}</Card> : <div className="grid gap-[var(--gap)] md:grid-cols-2">{data.history.map((h) => <Card key={h.weekStart} hover className="cursor-pointer" onClick={() => setWeek(h.weekStart)}><p className="text-sm font-medium">{t("Week of")} {fmtShort(h.weekStart, lang)}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{Object.values(h.reflections).find(Boolean) || h.intentions || t("No text")}</p></Card>)}</div>}
    </>
  );
}
