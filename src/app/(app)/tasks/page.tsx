"use client";
import { Archive, CalendarClock, CheckSquare, Plus, Repeat2, RotateCcw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CalendarBoard } from "@/components/calendar-board";
import { useApp } from "@/components/providers";
import { PriorityBadge, STATUS_LABEL, TaskModal, type Task } from "@/components/task-form";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, ListSkeleton, PageHeader, Segmented, cn, useUI } from "@/components/ui";
import { api, useFetch } from "@/lib/client";
import { queueOfflineAction, readOfflineSnapshot, saveOfflineSnapshot } from "@/lib/offline-db";
import { fmtShort, todayIn } from "@/lib/dates";

const PRI = { low: 1, medium: 2, high: 3, urgent: 4 };
type View = "list" | "board" | "calendar";

function Inner() {
  const { user, lang, t } = useApp();
  const { run, toast, confirm } = useUI();
  const sp = useSearchParams();
  const { data, error, loading, reload, setData } = useFetch<{ tasks: Task[] }>("/api/tasks");
  const [view, setView] = useState<View>("list");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [cat, setCat] = useState("all");
  const [pri, setPri] = useState("all");
  const [sort, setSort] = useState("due");
  const [modal, setModal] = useState<{ task?: Task | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const today = todayIn(user?.timezone);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    if (!navigator.onLine) void readOfflineSnapshot<{ tasks: Task[] }>(user.id, "tasks").then((cached) => {
      if (!cancelled && !data && cached) setData(cached);
    });
    const onSync = () => { void reload(); };
    window.addEventListener("ukiyo:offline-sync", onSync);
    return () => { cancelled = true; window.removeEventListener("ukiyo:offline-sync", onSync); };
  }, [user?.id]);
  useEffect(() => { if (user?.id && data) void saveOfflineSnapshot(user.id, "tasks", data); }, [user?.id, data]);
  useEffect(() => {
    if (!user?.id || !error || data) return;
    let cancelled = false;
    void readOfflineSnapshot<{ tasks: Task[] }>(user.id, "tasks").then((cached) => { if (!cancelled && cached) setData(cached); });
    return () => { cancelled = true; };
  }, [user?.id, error, data]);
  useEffect(() => { if (sp.get("new") === "1") setModal({}); }, [sp]);

  const tasks = data?.tasks ?? [];
  const cats = useMemo(() => [...new Set(tasks.map((t) => t.category))].sort(), [tasks]);
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return tasks
      .filter((t) => (status === "all" ? true : status === "active" ? t.status === "todo" || t.status === "in_progress" : t.status === status))
      .filter((t) => (cat === "all" || t.category === cat) && (pri === "all" || t.priority === pri))
      .filter((t) => !ql || t.title.toLowerCase().includes(ql) || t.description.toLowerCase().includes(ql) || t.tags.some((x) => x.toLowerCase().includes(ql)))
      .sort((a, b) => sort === "priority" ? PRI[b.priority] - PRI[a.priority] : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : sort === "title" ? a.title.localeCompare(b.title) : (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || PRI[b.priority] - PRI[a.priority]);
  }, [tasks, q, status, cat, pri, sort]);

  async function patch(task: Task, body: Partial<Task>, msg?: string) {
    if (!navigator.onLine && user?.id) {
      const queued = await queueOfflineAction(user.id, `/api/tasks/${task.id}`, "PATCH", body as Record<string, unknown>);
      if (!queued) { toast("info", t("Offline save is unavailable on this device.")); return; }
      setData((d) => d && { tasks: d.tasks.map((item) => item.id === task.id ? { ...item, ...body } : item) });
      toast("info", t("Saved offline. It will sync when you're online."));
      return;
    }
    const r = await run(() => api<{ task: Task; xp: number; unlocked: string[] }>(`/api/tasks/${task.id}`, { method: "PATCH", body }), msg);
    if (!r) return;
    setData((d) => d && { tasks: d.tasks.map((x) => (x.id === task.id ? r.task : x)) });
    if (r.xp) toast("success", `${t("Task completed")} · +${r.xp} XP`);
    r.unlocked?.forEach((u) => toast("success", `${t("Achievement unlocked")}: ${t(u)}`));
    if (body.status === "completed") reload();
  }
  async function del(task: Task) {
    if (!(await confirm(t("Delete {title} permanently?").replace("{title}", task.title), t("Delete")))) return;
    if (!navigator.onLine && user?.id) {
      const queued = await queueOfflineAction(user.id, `/api/tasks/${task.id}`, "DELETE");
      if (!queued) { toast("info", t("Offline save is unavailable on this device.")); return; }
      setData((d) => d && { tasks: d.tasks.filter((item) => item.id !== task.id) });
      setModal(null);
      toast("info", t("Saved offline. It will sync when you're online."));
      return;
    }
    if (await run(() => api(`/api/tasks/${task.id}`, { method: "DELETE" }), t("Task deleted"))) { setModal(null); reload(); }
  }

  const Row = ({ task }: { task: Task }) => {
    const overdue = !!task.dueDate && task.dueDate < today && task.status !== "completed" && task.status !== "archived";
    const done = task.status === "completed";
    return (
      <div className="glass card-hover flex items-center gap-3 px-4 py-3" style={{ borderRadius: "var(--radius-sm)" }}>
        <Checkbox checked={done} label={`${t(done ? "Restore" : "Complete")} ${task.title}`} onChange={(v) => patch(task, { status: v ? "completed" : "todo" })} disabled={task.status === "archived"} />
        <button onClick={() => setModal({ task })} className="min-w-0 flex-1 text-start">
          <p className={cn("truncate text-sm font-medium", done && "text-muted line-through")}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PriorityBadge p={task.priority} />
            <Badge>{t(task.category)}</Badge>
            {task.status === "in_progress" && <Badge tone="blue">{t("In progress")}</Badge>}
            {task.dueDate && <Badge tone={overdue ? "red" : task.dueDate === today ? "amber" : undefined}><CalendarClock className="size-3" />{overdue ? `${t("Overdue")} · ` : ""}{task.dueDate === today ? t("Today") : fmtShort(task.dueDate, lang)}{task.dueTime ? ` ${task.dueTime}` : ""}</Badge>}
            {task.recurrence !== "none" && <Badge><Repeat2 className="size-3" />{t(task.recurrence)}</Badge>}
            {task.tags.map((x) => <Badge key={x}>#{x}</Badge>)}
          </div>
        </button>
        {task.status === "archived" ? <Button size="sm" onClick={() => patch(task, { status: "todo" }, t("Task restored"))}><RotateCcw className="size-3.5" /> {t("Restore")}</Button> : <Button variant="ghost" size="icon" aria-label={t("Archive task")} onClick={() => patch(task, { status: "archived" }, t("Task archived"))}><Archive className="size-4" /></Button>}
      </div>
    );
  };

  const cols: { key: Task["status"]; label: string }[] = [{ key: "todo", label: t("To Do") }, { key: "in_progress", label: t("In Progress") }, { key: "completed", label: t("Completed") }];
  return (
    <>
      <PageHeader title={t("Tasks")} subtitle={`${tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length} ${t("open")} · ${tasks.filter((t) => t.status === "completed").length} ${t("completed")}`} actions={<Button variant="primary" onClick={() => setModal({})}><Plus className="size-4" /> {t("New task")}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={setView} label={t("View")} options={[{ value: "list", label: t("List") }, { value: "board", label: t("Board") }, { value: "calendar", label: t("Calendar") }]} />
        {view !== "calendar" && (
          <>
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" /><input className="input ps-9" placeholder={t("Search tasks…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Search tasks")} /></div>
            {view === "list" && <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("Status filter")}><option value="active">{t("Active")}</option><option value="all">{t("All")}</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select>}
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t("Category filter")}><option value="all">{t("All categories")}</option>{cats.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select>
            <select className="input w-auto" value={pri} onChange={(e) => setPri(e.target.value)} aria-label={t("Priority filter")}><option value="all">{t("Any priority")}</option>{["urgent", "high", "medium", "low"].map((p) => <option key={p} value={p}>{t(p)}</option>)}</select>
            <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t("Sort")}><option value="due">{t("Sort: due date")}</option><option value="priority">{t("Sort: priority")}</option><option value="created">{t("Sort: newest")}</option><option value="title">{t("Sort: title")}</option></select>
          </>
        )}
      </div>

      {view === "calendar" ? <CalendarBoard tasksOnly /> : error && !data ? <ErrorState message={error} retry={reload} /> : loading && !data ? <ListSkeleton /> : view === "list" ? (
        list.length === 0 ? <EmptyState icon={<CheckSquare className="size-6" />} title={t(tasks.length ? "No tasks match your filters" : "No tasks yet")} text={t(tasks.length ? "Try clearing the search or filters." : "Capture your first task — it only takes a few seconds.")} action={!tasks.length && <Button variant="primary" onClick={() => setModal({})}>{t("Create task")}</Button>} /> : <div className="space-y-2.5">{list.map((t) => <Row key={t.id} task={t} />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {cols.map((c) => {
            const items = list.filter((t) => t.status === c.key).slice(0, c.key === "completed" ? 20 : 200);
            return (
              <div key={c.key} onDragOver={(e) => e.preventDefault()} onDrop={() => { const t = tasks.find((x) => x.id === dragId); setDragId(null); if (t && t.status !== c.key) patch(t, { status: c.key }); }} className="glass min-h-48 p-3" aria-label={`${c.label} column`}>
                <div className="mb-3 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">{c.label}</h3><span className="chip">{items.length}</span></div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <div key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} className={cn("cursor-grab rounded-xl border border-line bg-card p-3 active:cursor-grabbing", dragId === t.id && "opacity-40")}>
                      <button onClick={() => setModal({ task: t })} className="block w-full text-start"><p className={cn("text-sm font-medium", c.key === "completed" && "text-muted line-through")}>{t.title}</p></button>
                      <div className="mt-2 flex flex-wrap gap-1"><PriorityBadge p={t.priority} />{t.dueDate && <Badge tone={t.dueDate < today && c.key !== "completed" ? "red" : undefined}>{fmtShort(t.dueDate, lang)}</Badge>}</div>
                      <div className="mt-2 flex gap-1 md:hidden">{cols.filter((x) => x.key !== c.key).map((x) => <button key={x.key} onClick={() => patch(t, { status: x.key })} className="chip">→ {x.label}</button>)}</div>
                    </div>
                  ))}
                  {!items.length && <p className="py-6 text-center text-xs text-faint">{t("Drop tasks here")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <TaskModal open={!!modal} onClose={() => setModal(null)} task={modal?.task} onSaved={reload} onDelete={del} />
    </>
  );
}
export default function TasksPage() {
  return <Suspense><Inner /></Suspense>;
}
