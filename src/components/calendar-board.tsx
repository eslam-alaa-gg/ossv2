"use client";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useFetch } from "@/lib/client";
import { addDays, addMonths, dow, fmtLong, fmtD, parseD, todayIn, weekStart } from "@/lib/dates";
import { useApp } from "./providers";
import { TaskModal, type Task } from "./task-form";
import { Button, Card, ErrorState, Segmented, Skeleton, cn } from "./ui";

type Cal = {
  tasks: Task[]; habits: { id: string; name: string; days: number[]; startDate: string }[]; habitLogs: { habitId: string; date: string }[];
  challenges: { id: string; date: string; title: string; completedAt: string | null }[]; milestones: { id: string; title: string; deadline: string; done: string | null; goal: string }[];
  activity: Record<string, { focusMinutes: number; focus: number; score: number; level: number }>;
};

export function CalendarBoard({ tasksOnly }: { tasksOnly?: boolean }) {
  const { user, lang } = useApp();
  const today = todayIn(user?.timezone);
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cur, setCur] = useState(today);
  const [modal, setModal] = useState<{ task?: Task | null; date?: string } | null>(null);

  const range = useMemo(() => {
    if (view === "day") return [cur, cur] as const;
    if (view === "week") return [weekStart(cur), addDays(weekStart(cur), 6)] as const;
    const first = cur.slice(0, 8) + "01";
    const s = weekStart(first);
    return [s, addDays(s, 41)] as const;
  }, [view, cur]);
  const { data, error, loading, reload } = useFetch<Cal>(`/api/calendar?from=${range[0]}&to=${range[1]}`);

  const days: string[] = useMemo(() => {
    const out: string[] = [];
    for (let d = range[0]; d <= range[1]; d = addDays(d, 1)) out.push(d);
    return out;
  }, [range]);
  const step = (n: number) => setCur(view === "month" ? addMonths(cur, n) : addDays(cur, view === "week" ? 7 * n : n));
  const title = view === "month" ? new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(parseD(cur)) : view === "week" ? `${new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", timeZone: "UTC" }).format(parseD(range[0]))} – ${new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", timeZone: "UTC" }).format(parseD(range[1]))}` : fmtLong(cur, lang);

  const itemsFor = (d: string) => {
    const items: { key: string; label: string; tone: string; task?: Task }[] = [];
    data?.tasks.filter((t) => t.dueDate === d).forEach((t) => items.push({ key: "t" + t.id, label: `${t.dueTime ? t.dueTime + " " : ""}${t.title}`, tone: t.status === "completed" ? "bg-emerald-500/20 text-emerald-300 line-through" : d < today ? "bg-red-500/20 text-red-300" : "bg-accent/20 text-fg", task: t }));
    if (!tasksOnly) {
      data?.milestones.filter((m) => m.deadline === d).forEach((m) => items.push({ key: "m" + m.id, label: `◆ ${m.title}`, tone: "bg-amber-500/20 text-amber-300" }));
      data?.challenges.filter((c) => c.date === d).forEach((c) => items.push({ key: "c" + c.id, label: `⚡ ${c.title}`, tone: c.completedAt ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300" }));
      const hl = data?.habitLogs.filter((l) => l.date === d).length ?? 0;
      if (hl) items.push({ key: "h" + d, label: `✓ ${hl} habit${hl > 1 ? "s" : ""}`, tone: "bg-card text-muted" });
      const f = data?.activity[d]?.focusMinutes;
      if (f) items.push({ key: "f" + d, label: `◷ ${f}m focus`, tone: "bg-card text-muted" });
    }
    return items;
  };
  const Item = ({ it }: { it: ReturnType<typeof itemsFor>[number] }) =>
    it.task ? <button onClick={() => setModal({ task: it.task })} className={cn("block w-full truncate rounded-md px-1.5 py-0.5 text-start text-[11px]", it.tone)}>{it.label}</button> : <div className={cn("truncate rounded-md px-1.5 py-0.5 text-[11px]", it.tone)}>{it.label}</div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
          <Button size="icon" onClick={() => step(1)} aria-label="Next"><ChevronRight className="size-4 rtl:rotate-180" /></Button>
          <Button size="sm" onClick={() => setCur(today)}>Today</Button>
          <h2 className="ms-2 text-lg font-semibold">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Segmented value={view} onChange={setView} label="Calendar view" options={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }]} />
          <Button variant="primary" size="sm" onClick={() => setModal({ date: view === "day" ? cur : today })}><Plus className="size-4" /> Task</Button>
        </div>
      </div>
      {error && !data ? <ErrorState message={error} retry={reload} /> : loading && !data ? <Skeleton className="h-96" /> : (
        <Card pad={false} className="overflow-hidden">
          {view !== "day" && (
            <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-medium text-faint">
              {days.slice(0, 7).map((d) => <div key={d} className="py-2">{new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(parseD(d))}</div>)}
            </div>
          )}
          {view === "day" ? (
            <div className="space-y-2 p-4">
              {itemsFor(cur).length === 0 && <p className="py-10 text-center text-sm text-muted">Nothing scheduled. Add a task for this day.</p>}
              {itemsFor(cur).map((it) => <Item key={it.key} it={it} />)}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const items = itemsFor(d);
                const out = view === "month" && d.slice(0, 7) !== cur.slice(0, 7);
                const max = view === "week" ? 12 : 3;
                return (
                  <div key={d} className={cn("group relative min-h-[84px] border-b border-s border-line p-1 sm:min-h-[108px] sm:p-1.5", view === "week" && "min-h-[260px]", out && "opacity-40")}>
                    <button onClick={() => setModal({ date: d })} className={cn("mb-1 grid size-6 place-items-center rounded-full text-xs", d === today ? "bg-accent font-semibold text-[var(--on-accent)]" : "text-muted hover:bg-card")} aria-label={`Add task on ${fmtD(parseD(d))}`}>{Number(d.slice(8))}</button>
                    <div className="space-y-0.5">
                      {items.slice(0, max).map((it) => <Item key={it.key} it={it} />)}
                      {items.length > max && <button onClick={() => { setCur(d); setView("day"); }} className="text-[10px] text-faint">+{items.length - max} more</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
      <p className="mt-3 text-xs text-faint">Dates follow your timezone ({user?.timezone}). Weeks start Monday. {dow(today) >= 0 ? "" : ""}</p>
      <TaskModal open={!!modal} onClose={() => setModal(null)} task={modal?.task} defaults={modal?.date ? { dueDate: modal.date } : undefined} onSaved={reload} />
    </div>
  );
}
