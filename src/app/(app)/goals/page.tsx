"use client";
import { Check, ExternalLink, Gift, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Field, ListSkeleton, Modal, PageHeader, Progress, Segmented, cn, useUI } from "@/components/ui";
import { api, useFetch } from "@/lib/client";
import { fmtShort, todayIn } from "@/lib/dates";

type Milestone = { id: string; title: string; description: string; deadline: string | null; completedAt: string | null; tasks: { id: string; title: string; status: string }[] };
type Goal = { id: string; title: string; description: string; type: string; category: string; startDate: string | null; targetDate: string | null; priority: string; status: string; manualProgress: number; progress: number; milestones: Milestone[]; tasks: { id: string; title: string; status: string }[]; tasksDone: number };
type Wish = { id: string; title: string; note: string; url: string; acquiredAt: string | null };
const TYPES = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly", long_term: "Long-term" };
const CATS = ["Personal Growth", "Learning", "Health", "Career", "Creativity", "Lifestyle", "Other"];

function Journey({ g }: { g: Goal }) {
  const ms = g.milestones;
  if (!ms.length) return <p className="text-xs text-faint">Add milestones to visualise the journey.</p>;
  return (
    <div className="relative flex items-start justify-between gap-1 overflow-x-auto pb-1" aria-label="Goal journey">
      <div className="absolute inset-x-3 top-[11px] h-0.5 bg-[var(--input)]"><div className="h-full bg-accent transition-all duration-700" style={{ width: `${g.progress}%` }} /></div>
      {ms.map((m) => (
        <div key={m.id} className="relative z-10 flex min-w-[64px] flex-1 flex-col items-center gap-1.5 text-center">
          <span className={cn("grid size-6 place-items-center rounded-full border-2", m.completedAt ? "border-accent bg-accent text-[var(--on-accent)]" : "border-[var(--border-strong)] bg-[var(--bg)]")}>{m.completedAt && <Check className="size-3.5" />}</span>
          <span className={cn("line-clamp-2 text-[11px] leading-tight", m.completedAt ? "text-fg" : "text-muted")}>{m.title}</span>
        </div>
      ))}
    </div>
  );
}

function Inner() {
  const { user, lang } = useApp();
  const { run, toast, confirm } = useUI();
  const sp = useSearchParams();
  const { data, error, loading, reload } = useFetch<{ goals: Goal[] }>("/api/goals");
  const wish = useFetch<{ items: Wish[] }>("/api/wishlist");
  const [tab, setTab] = useState("dashboard");
  const [edit, setEdit] = useState<Goal | "new" | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  useEffect(() => { if (sp.get("new") === "1") setEdit("new"); }, [sp]);
  const today = todayIn(user?.timezone);
  const goals = data?.goals ?? [];
  const active = goals.filter((g) => g.status !== "completed");
  const done = goals.filter((g) => g.status === "completed");
  const cur = goals.find((g) => g.id === detail) ?? null;

  const GoalCard = ({ g }: { g: Goal }) => (
    <Card hover className="cursor-pointer" onClick={() => setDetail(g.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setDetail(g.id)} aria-label={`Open goal ${g.title}`}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5"><Badge tone="accent">{g.category}</Badge><Badge>{TYPES[g.type as keyof typeof TYPES]}</Badge>{g.status === "paused" && <Badge tone="amber">Paused</Badge>}{g.status === "completed" && <Badge tone="green">Completed</Badge>}</div>
      <h3 className="font-semibold leading-snug">{g.title}</h3>
      {g.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{g.description}</p>}
      <div className="mt-4 flex items-center gap-3"><Progress value={g.progress} className="flex-1" /><span className="text-sm font-medium tabular-nums">{g.progress}%</span></div>
      <p className="mt-2 text-xs text-faint">{g.milestones.filter((m) => m.completedAt).length}/{g.milestones.length} milestones{g.targetDate ? ` · target ${fmtShort(g.targetDate, lang)}` : ""}</p>
    </Card>
  );

  async function saveMilestone(goalId: string, title: string, deadline: string) {
    if (await run(() => api(`/api/goals/${goalId}/milestones`, { body: { title, deadline: deadline || null } }))) reload();
  }
  async function toggleMs(m: Milestone) {
    const r = await run(() => api<{ xp: number; unlocked: string[] }>(`/api/milestones/${m.id}`, { method: "PATCH", body: { completed: !m.completedAt } }));
    if (r?.xp) toast("success", `Milestone reached · +${r.xp} XP`);
    r?.unlocked.forEach((u) => toast("success", `🏆 ${u}`));
    reload();
  }

  return (
    <>
      <PageHeader title="Life Goals" subtitle="Progress is calculated from real milestones — never guessed." actions={<Button variant="primary" onClick={() => setEdit("new")}><Plus className="size-4" /> New goal</Button>} />
      <div className="mb-5"><Segmented value={tab} onChange={setTab} label="Goal views" options={[{ value: "dashboard", label: "Dashboard" }, { value: "timeline", label: "Timeline" }, { value: "progress", label: "Progress" }, { value: "milestones", label: "Milestones" }, { value: "completed", label: `Completed${done.length ? ` (${done.length})` : ""}` }, { value: "wishlist", label: "Wishlist" }]} /></div>

      {tab !== "wishlist" && (error && !data ? <ErrorState message={error} retry={reload} /> : loading && !data ? <ListSkeleton /> : null)}
      {tab === "dashboard" && data && (active.length === 0 ? <EmptyState icon={<Target className="size-6" />} title="Set your first goal" text="Break something meaningful into milestones and watch the journey fill in." action={<Button variant="primary" onClick={() => setEdit("new")}>New goal</Button>} /> : <div className="grid gap-[var(--gap)] md:grid-cols-2 xl:grid-cols-3">{active.map((g) => <GoalCard key={g.id} g={g} />)}</div>)}
      {tab === "timeline" && data && (
        <div className="relative space-y-4 ps-6 before:absolute before:inset-y-2 before:start-[7px] before:w-px before:bg-[var(--border-strong)]">
          {[...goals].sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999")).map((g) => (
            <div key={g.id} className="relative"><span className={cn("absolute -start-6 top-4 size-3.5 rounded-full border-2", g.status === "completed" ? "border-accent bg-accent" : "border-[var(--border-strong)] bg-[var(--bg)]")} />
              <Card hover onClick={() => setDetail(g.id)} className="cursor-pointer"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{g.title}</p><p className="text-xs text-faint">{g.targetDate ? `${g.targetDate < today && g.status !== "completed" ? "Was due " : "Target "}${fmtShort(g.targetDate, lang)}` : "No target date"} · {g.category}</p></div><span className="text-sm font-semibold tabular-nums">{g.progress}%</span></div><div className="mt-4"><Journey g={g} /></div></Card></div>
          ))}
          {!goals.length && <EmptyState icon={<Target className="size-6" />} title="No goals on the timeline" />}
        </div>
      )}
      {tab === "progress" && data && (goals.length === 0 ? <EmptyState icon={<Target className="size-6" />} title="No goals yet" /> : <div className="space-y-3">{goals.map((g) => <Card key={g.id}><div className="mb-2 flex items-center justify-between"><p className="font-medium">{g.title}</p><span className="text-sm tabular-nums">{g.progress}%</span></div><Progress value={g.progress} /><div className="mt-4"><Journey g={g} /></div></Card>)}</div>)}
      {tab === "milestones" && data && (() => {
        const all = active.flatMap((g) => g.milestones.map((m) => ({ ...m, goal: g.title }))).sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
        return all.length === 0 ? <EmptyState icon={<Check className="size-6" />} title="No milestones yet" text="Open a goal and add the first step." /> : (
          <Card pad={false}><ul className="divide-y divide-[var(--border)]">{all.map((m) => <li key={m.id} className="flex items-center gap-3 px-4 py-3"><Checkbox checked={!!m.completedAt} onChange={() => toggleMs(m)} label={`Toggle ${m.title}`} /><span className="min-w-0 flex-1"><span className={cn("block truncate text-sm", m.completedAt && "text-muted line-through")}>{m.title}</span><span className="text-xs text-faint">{m.goal}</span></span>{m.deadline && <Badge tone={m.deadline < today && !m.completedAt ? "red" : undefined}>{fmtShort(m.deadline, lang)}</Badge>}</li>)}</ul></Card>
        );
      })()}
      {tab === "completed" && data && (done.length === 0 ? <EmptyState icon={<Check className="size-6" />} title="No completed goals yet" text="Finished goals are celebrated here." /> : <div className="grid gap-[var(--gap)] md:grid-cols-2 xl:grid-cols-3">{done.map((g) => <GoalCard key={g.id} g={g} />)}</div>)}
      {tab === "wishlist" && <Wishlist wish={wish} />}

      <GoalModal goal={edit} onClose={() => setEdit(null)} onSaved={reload} />
      <Modal open={!!cur} onClose={() => setDetail(null)} title={cur?.title ?? "Goal"} wide footer={cur && <>
        <Button variant="danger" className="me-auto" onClick={async () => { if (await confirm(`Delete goal “${cur.title}” and its milestones?`, "Delete") && (await run(() => api(`/api/goals/${cur.id}`, { method: "DELETE" }), "Goal deleted"))) { setDetail(null); reload(); } }}>Delete</Button>
        <Button onClick={() => { setEdit(cur); setDetail(null); }}><Pencil className="size-4" /> Edit</Button>
        {cur.status === "completed" ? <Button onClick={async () => { await run(() => api(`/api/goals/${cur.id}`, { method: "PATCH", body: { status: "active" } })); reload(); }}>Reopen</Button> : <Button variant="primary" onClick={async () => { const r = await run(() => api<{ xp: number }>(`/api/goals/${cur.id}`, { method: "PATCH", body: { status: "completed" } })); if (r) { toast("success", r.xp ? `Goal completed · +${r.xp} XP 🎉` : "Goal completed"); reload(); } }}>Mark goal completed</Button>}</>}>
        {cur && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-1.5"><Badge tone="accent">{cur.category}</Badge><Badge>{TYPES[cur.type as keyof typeof TYPES]}</Badge><Badge className="capitalize">{cur.priority} priority</Badge>{cur.targetDate && <Badge>Target {fmtShort(cur.targetDate, lang)}</Badge>}</div>
            {cur.description && <p className="text-sm text-muted">{cur.description}</p>}
            <div><div className="mb-1.5 flex justify-between text-sm"><span>Progress</span><span className="tabular-nums">{cur.progress}%</span></div><Progress value={cur.progress} />{cur.milestones.length === 0 && <p className="mt-1 text-xs text-faint">No milestones — progress uses your manual value ({cur.manualProgress}%). Add milestones for automatic tracking.</p>}</div>
            <Journey g={cur} />
            <div>
              <h3 className="mb-2 text-sm font-medium">Milestones</h3>
              <ul className="space-y-1">{cur.milestones.map((m) => <li key={m.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5"><Checkbox checked={!!m.completedAt} onChange={() => toggleMs(m)} label={`Toggle ${m.title}`} /><span className={cn("flex-1 text-sm", m.completedAt && "text-muted line-through")}>{m.title}{m.deadline && <span className="ms-2 text-xs text-faint">{fmtShort(m.deadline, lang)}</span>}</span><Button variant="ghost" size="icon" aria-label="Delete milestone" onClick={async () => { if (await run(() => api(`/api/milestones/${m.id}`, { method: "DELETE" }))) reload(); }}><Trash2 className="size-3.5" /></Button></li>)}</ul>
              <MilestoneAdd onAdd={(t, d) => saveMilestone(cur.id, t, d)} />
            </div>
            <div><h3 className="mb-2 text-sm font-medium">Linked tasks ({cur.tasksDone}/{cur.tasks.length} done)</h3>{cur.tasks.length === 0 ? <p className="text-xs text-faint">Link tasks from the task editor (“Linked goal”).</p> : <ul className="space-y-1 text-sm">{cur.tasks.map((t) => <li key={t.id} className={cn(t.status === "completed" && "text-muted line-through")}>• {t.title}</li>)}</ul>}</div>
          </div>
        )}
      </Modal>
    </>
  );
}

function MilestoneAdd({ onAdd }: { onAdd: (t: string, d: string) => void }) {
  const [t, setT] = useState("");
  const [d, setD] = useState("");
  return (
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t.trim(), d); setT(""); setD(""); } }}>
      <input className="input min-w-40 flex-1" placeholder="Add a milestone…" value={t} onChange={(e) => setT(e.target.value)} maxLength={160} aria-label="Milestone name" />
      <input className="input w-auto" type="date" value={d} onChange={(e) => setD(e.target.value)} aria-label="Milestone deadline" />
      <Button type="submit" disabled={!t.trim()}><Plus className="size-4" /> Add</Button>
    </form>
  );
}

function GoalModal({ goal, onClose, onSaved }: { goal: Goal | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { run } = useUI();
  const g = goal && goal !== "new" ? goal : null;
  const [f, setF] = useState({ title: "", description: "", type: "monthly", category: "Personal Growth", startDate: "", targetDate: "", priority: "medium", manualProgress: 0 });
  useEffect(() => { if (goal) setF(g ? { title: g.title, description: g.description, type: g.type, category: g.category, startDate: g.startDate ?? "", targetDate: g.targetDate ?? "", priority: g.priority, manualProgress: g.manualProgress } : { title: "", description: "", type: "monthly", category: "Personal Growth", startDate: "", targetDate: "", priority: "medium", manualProgress: 0 }); }, [goal, g]);
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={!!goal} onClose={onClose} title={g ? "Edit goal" : "New goal"} wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.title.trim()} onClick={async () => { const body = { ...f, startDate: f.startDate || null, targetDate: f.targetDate || null, manualProgress: Number(f.manualProgress) }; if (await run(() => (g ? api(`/api/goals/${g.id}`, { method: "PATCH", body }) : api("/api/goals", { body })), g ? "Goal updated" : "Goal created")) { onSaved(); onClose(); } }}>{g ? "Save" : "Create goal"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><input className="input" value={f.title} onChange={s("title")} maxLength={160} aria-label="Goal title" /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea className="input min-h-20" value={f.description} onChange={s("description")} maxLength={2000} aria-label="Description" /></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={s("type")} aria-label="Type">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={s("category")} aria-label="Category">{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Start date"><input className="input" type="date" value={f.startDate} onChange={s("startDate")} aria-label="Start date" /></Field>
        <Field label="Target date"><input className="input" type="date" value={f.targetDate} onChange={s("targetDate")} aria-label="Target date" /></Field>
        <Field label="Priority"><select className="input" value={f.priority} onChange={s("priority")} aria-label="Priority">{["low", "medium", "high", "urgent"].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label={`Manual progress (${f.manualProgress}%)`} hint="Used only while the goal has no milestones"><input type="range" min={0} max={100} value={f.manualProgress} onChange={s("manualProgress")} aria-label="Manual progress" /></Field>
      </div>
    </Modal>
  );
}

function Wishlist({ wish }: { wish: ReturnType<typeof useFetch<{ items: Wish[] }>> }) {
  const { run } = useUI();
  const [f, setF] = useState({ title: "", note: "", url: "" });
  return (
    <div className="grid gap-[var(--gap)] md:grid-cols-[320px_1fr]">
      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium"><Gift className="size-4 text-accent" /> Add to wishlist</h3>
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api("/api/wishlist", { body: f }), "Added")) { setF({ title: "", note: "", url: "" }); wish.reload(); } }}>
          <Field label="What do you want?"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={120} aria-label="Wish title" /></Field>
          <Field label="Note"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} aria-label="Note" /></Field>
          <Field label="Link (optional)"><input className="input" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" aria-label="Link" /></Field>
          <Button type="submit" variant="primary" className="w-full">Add</Button>
        </form>
      </Card>
      <div>{wish.error ? <ErrorState message={wish.error} retry={wish.reload} /> : !wish.data ? <ListSkeleton rows={3} /> : wish.data.items.length === 0 ? <EmptyState icon={<Gift className="size-6" />} title="Your wishlist is empty" text="Things you'd love to own, learn or experience." /> : (
        <Card pad={false}><ul className="divide-y divide-[var(--border)]">{wish.data.items.map((w) => <li key={w.id} className="flex items-center gap-3 px-4 py-3"><Checkbox checked={!!w.acquiredAt} label={`Mark ${w.title} as acquired`} onChange={async (v) => { await run(() => api(`/api/wishlist?id=${w.id}`, { method: "PATCH", body: { acquired: v } })); wish.reload(); }} /><span className="min-w-0 flex-1"><span className={cn("block truncate text-sm", w.acquiredAt && "text-muted line-through")}>{w.title}</span>{w.note && <span className="block truncate text-xs text-faint">{w.note}</span>}</span>{w.url && <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" aria-label="Open link" className="glass-btn btn-icon btn-ghost"><ExternalLink className="size-4" /></a>}<Button variant="ghost" size="icon" aria-label="Delete" onClick={async () => { await run(() => api(`/api/wishlist?id=${w.id}`, { method: "DELETE" })); wish.reload(); }}><Trash2 className="size-4" /></Button></li>)}</ul></Card>
      )}</div>
    </div>
  );
}

export default function GoalsPage() {
  return <Suspense><Inner /></Suspense>;
}
