"use client";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Heatmap, type HeatDay } from "@/components/heatmap";
import { useApp } from "@/components/providers";
import { Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { minutesLabel, useFetch } from "@/lib/client";
import { fmtShort } from "@/lib/dates";
import { chartColors } from "@/lib/theme";

type A = {
  year: number; today: string; dailyGoal: number; heatmap: HeatDay[];
  annual: { activeDays: number; score: number; tasks: number; habits: number; challenges: number; focusMinutes: number; bestDay: { date: string; score: number } | null; goalDays: number };
  streak: { current: number; longest: number; weekly: number }; today30: { daily: number; weekly: number; monthly: number };
  trend: { date: string; score: number; tasks: number; habits: number; focusMinutes: number }[]; weeks: { week: string; score: number; tasks: number; focusMinutes: number }[];
  months: { month: string; score: number; tasks: number }[]; habitConsistency: { name: string; done: number; scheduled: number; pct: number }[];
  goalProgress: { title: string; status: string; progress: number }[]; goalsCompleted: number; goalsTotal: number; insights: string[];
};
const tip = { contentStyle: { background: "var(--pop)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12, color: "var(--fg)" }, cursor: { fill: "rgba(128,128,150,.12)" }, labelStyle: { color: "var(--muted)" } };
const axis = { stroke: "var(--faint)", fontSize: 11, tickLine: false, axisLine: false } as const;

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <Card><p className="text-xs text-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>{sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}</Card>;
}

export default function AnalyticsPage() {
  const { theme, lang, t } = useApp();
  const [year, setYear] = useState<number | null>(null);
  const { data, error, reload } = useFetch<A>(`/api/analytics${year ? `?year=${year}` : ""}`);
  const colors = chartColors(theme);
  const c1 = colors[0], c2 = colors[1] ?? colors[0], c3 = colors[2] ?? colors[0];
  if (error && !data) return <><PageHeader title={t("Analytics")} /><ErrorState message={error} retry={reload} /></>;
  if (!data) return <><PageHeader title={t("Analytics")} /><div className="grid gap-4 md:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="mt-4 h-64" /></>;
  const empty = data.annual.activeDays === 0 && data.trend.every((d) => d.score === 0);
  return (
    <>
      <PageHeader title={t("Analytics")} subtitle={t("Everything here is computed from your completed records.")} />
      <div className="grid grid-cols-2 gap-[var(--gap)] lg:grid-cols-4">
        <Stat label={t("Today's score")} value={data.today30.daily} sub={`goal ${data.dailyGoal} pts`} />
        <Stat label={t("This week")} value={data.today30.weekly} sub="points" />
        <Stat label={t("Last 30 days")} value={data.today30.monthly} sub="points" />
        <Stat label={t("Streak")} value={`${data.streak.current}d`} sub={`longest ${data.streak.longest}d · ${data.streak.weekly}w weekly`} />
        <Stat label={`Tasks in ${data.year}`} value={data.annual.tasks} />
        <Stat label={t("Challenges")} value={data.annual.challenges} sub={`in ${data.year}`} />
        <Stat label={t("Focus time")} value={minutesLabel(data.annual.focusMinutes)} sub={`in ${data.year}`} />
        <Stat label={t("Goals completed")} value={`${data.goalsCompleted}/${data.goalsTotal}`} />
      </div>

      <Card className="mt-[var(--gap)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">{t("Contribution heatmap")}</h2><p className="text-xs text-muted">{data.annual.activeDays} active days · {data.annual.goalDays} days at goal · {data.annual.score} points{data.annual.bestDay ? ` · best day ${fmtShort(data.annual.bestDay.date, lang)} (${data.annual.bestDay.score})` : ""}</p></div>
          <div className="flex items-center gap-2"><Button size="icon" aria-label={t("Previous year")} onClick={() => setYear(data.year - 1)}><ChevronLeft className="size-4 rtl:rotate-180" /></Button><span className="w-12 text-center text-sm font-medium tabular-nums">{data.year}</span><Button size="icon" aria-label={t("Next year")} disabled={data.year >= Number(data.today.slice(0, 4))} onClick={() => setYear(data.year + 1)}><ChevronRight className="size-4 rtl:rotate-180" /></Button></div>
        </div>
        <Heatmap year={data.year} days={data.heatmap} today={data.today} goal={data.dailyGoal} />
      </Card>

      <Card className="mt-[var(--gap)]">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Lightbulb className="size-4 text-accent" /> {t("Insights")}</h2>
        <ul className="space-y-1.5 text-sm text-muted">{data.insights.map((i) => <li key={i}>• {i}</li>)}</ul>
      </Card>

      {empty && <p className="mt-4 text-center text-sm text-muted">No completed activity yet — charts will populate as you finish tasks, habits, challenges and focus sessions.</p>}
      <div className="mt-[var(--gap)] grid gap-[var(--gap)] lg:grid-cols-2">
        <Card><h3 className="mb-3 text-sm font-medium text-muted">Productivity trend (30 days)</h3>
          <div className="h-56"><ResponsiveContainer><AreaChart data={data.trend} margin={{ left: -20, right: 4 }}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c1} stopOpacity={0.45} /><stop offset="100%" stopColor={c1} stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="date" tickFormatter={(d: string) => fmtShort(d, lang)} {...axis} interval={6} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} labelFormatter={(d) => fmtShort(String(d), lang)} formatter={(v) => [`${v} pts`, "Score"]} /><Area type="monotone" dataKey="score" stroke={c1} strokeWidth={2} fill="url(#g1)" /></AreaChart></ResponsiveContainer></div></Card>
        <Card><h3 className="mb-3 text-sm font-medium text-muted">Task completion (12 weeks)</h3>
          <div className="h-56"><ResponsiveContainer><BarChart data={data.weeks} margin={{ left: -20, right: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="week" tickFormatter={(d: string) => fmtShort(d, lang)} {...axis} interval={2} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} labelFormatter={(d) => `Week of ${fmtShort(String(d), lang)}`} formatter={(v) => [v, "Tasks"]} /><Bar dataKey="tasks" fill={c2} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><h3 className="mb-3 text-sm font-medium text-muted">Focus time (minutes / day)</h3>
          <div className="h-56"><ResponsiveContainer><BarChart data={data.trend} margin={{ left: -20, right: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="date" tickFormatter={(d: string) => fmtShort(d, lang)} {...axis} interval={6} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} labelFormatter={(d) => fmtShort(String(d), lang)} formatter={(v) => [`${v} min`, "Focus"]} /><Bar dataKey="focusMinutes" fill={c3} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><h3 className="mb-3 text-sm font-medium text-muted">Habit consistency (last 30 days)</h3>
          {data.habitConsistency.length === 0 ? <p className="py-16 text-center text-sm text-muted">{t("Add habits to see consistency.")}</p> : <div className="h-56"><ResponsiveContainer><BarChart data={data.habitConsistency} layout="vertical" margin={{ left: 10, right: 12 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" {...axis} /><YAxis type="category" dataKey="name" width={110} {...axis} /><Tooltip {...tip} formatter={(v, _n, p) => [`${v}% (${p.payload.done}/${p.payload.scheduled} days)`, "Consistency"]} /><Bar dataKey="pct" fill={c1} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>}</Card>
        <Card className="lg:col-span-2"><h3 className="mb-3 text-sm font-medium text-muted">{t("Goal progress")}</h3>
          {data.goalProgress.length === 0 ? <p className="py-10 text-center text-sm text-muted">{t("No goals yet.")}</p> : <div style={{ height: Math.max(140, data.goalProgress.length * 38) }}><ResponsiveContainer><BarChart data={data.goalProgress} layout="vertical" margin={{ left: 10, right: 12 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" {...axis} /><YAxis type="category" dataKey="title" width={150} {...axis} /><Tooltip {...tip} formatter={(v) => [`${v}%`, "Progress"]} /><Bar dataKey="progress" fill={c2} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>}</Card>
      </div>
    </>
  );
}
