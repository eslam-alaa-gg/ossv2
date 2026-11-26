"use client";
import { BookOpen, Droplets, Flame, Lightbulb, Minus, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { HabitIcon } from "@/components/habit-icon";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Field, ListSkeleton, Modal, PageHeader, Progress, Ring, Segmented, cn, useUI } from "@/components/ui";
import { api, useFetch } from "@/lib/client";
import { addDays, fmtShort } from "@/lib/dates";
import { HABIT_ICONS, PREDEFINED_HABITS_CLIENT } from "@/lib/habit-templates";

type Habit = { id: string; name: string; description: string; icon: string; kind: "standard" | "water" | "reading" | "learning"; days: number[]; target: number; unit: string; reminderTime: string | null; todayAmount: number; todayDone: boolean; current: number; longest: number; history: string[]; total: number };
type Trackers = {
  today: string;
  water: { goal: number; total: number; entries: { id: string; ml: number; createdAt: string }[]; days: { d: string; v: number }[] };
  reading: { target: number; todayPages: number; entries: { id: string; date: string; book: string; pages: number }[]; days: { d: string; v: number }[] };
  learning: { target: number; todayCount: number; entries: { id: string; date: string; title: string; explanation: string }[] };
};
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function Bars({ days, today, max, unit }: { days: { d: string; v: number }[]; today: string; max: number; unit: string }) {
  const map = new Map(days.map((x) => [x.d, x.v]));
  const list = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  return (
    <div className="flex h-24 items-end gap-1" role="img" aria-label={`Last 14 days (${unit})`}>
      {list.map((d) => { const v = map.get(d) ?? 0; return <div key={d} title={`${fmtShort(d)}: ${v} ${unit}`} className="flex-1 rounded-md bg-accent/70" style={{ height: `${Math.max(4, Math.min(100, (v / max) * 100))}%`, opacity: v ? 1 : 0.18 }} />; })}
    </div>
  );
}

function Inner() {
  const { prefs, savePrefs, lang, t } = useApp();
  const { run, toast, confirm } = useUI();
  const sp = useSearchParams();
  const dayLabels = lang === "ar" ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : DAYS;
  const habits = useFetch<{ habits: Habit[]; today: string }>("/api/habits");
  const trackers = useFetch<Trackers>("/api/trackers");
  const [tab, setTab] = useState("habits");
  const [modal, setModal] = useState<{ habit?: Habit } | null>(null);
  useEffect(() => { if (sp.get("new") === "1") setModal({}); const requestedTab = sp.get("tab"); if (requestedTab === "reading" || requestedTab === "learning" || requestedTab === "water" || requestedTab === "habits") setTab(requestedTab); }, [sp]);
  const reloadAll = () => { habits.reload(); trackers.reload(); };

  async function log(h: Habit, amount: number) {
    const r = await run(() => api<{ completed: boolean; xp: number }>(`/api/habits/${h.id}/log`, { body: { amount: Math.max(0, amount) } }));
    if (!r) return;
    if (r.completed && r.xp) toast("success", `${t("Habit complete")} · +${r.xp} XP`);
    await habits.reload();
  }
  async function remove(h: Habit) {
    if (!(await confirm(t("Delete “{title}” and all its history?").replace("{title}", t(h.name)), t("Delete")))) return;
    if (await run(() => api(`/api/habits/${h.id}`, { method: "DELETE" }), t("Habit deleted"))) reloadAll();
  }

  return (
    <>
      <PageHeader title={t("Habits")} subtitle={t("Small, consistent actions. General wellness tracking — not medical advice.")} actions={<Button variant="primary" onClick={() => setModal({})}><Plus className="size-4" /> {t("Add habit")}</Button>} />
      <div className="mb-5"><Segmented value={tab} onChange={setTab} label={t("Habit sections")} options={[{ value: "habits", label: t("My habits") }, { value: "water", label: t("Water") }, { value: "reading", label: t("Reading") }, { value: "learning", label: t("Learning") }]} /></div>

      {tab === "habits" && (habits.error && !habits.data ? <ErrorState message={habits.error} retry={habits.reload} /> : !habits.data ? <ListSkeleton /> : habits.data.habits.length === 0 ? (
        <EmptyState icon={<Repeat className="size-6" />} title={t("Build your first habit")} text={t("Pick a ready-made habit like Drink Water or Meditation, or create your own.")} action={<Button variant="primary" onClick={() => setModal({})}>{t("Add habit")}</Button>} />
      ) : (
        <div className="grid gap-[var(--gap)] md:grid-cols-2">
          {habits.data.habits.map((h) => {
            const special = h.kind !== "standard";
            const pct = Math.min(100, (100 * h.todayAmount) / h.target);
            const displayAmount = h.kind === "water" ? Number((h.todayAmount / 250).toFixed(1)) : h.todayAmount;
            const displayTarget = h.kind === "water" ? Math.ceil(h.target / 250) : h.target;
            const displayUnit = h.kind === "water" ? t("cups") : t(h.unit);
            return (
              <Card key={h.id} hover>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-accent"><HabitIcon name={h.icon} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate font-medium">{t(h.name)}</p>{special && <Badge>{t("auto")}</Badge>}</div>
                    <p className="truncate text-xs text-muted">{h.description ? t(h.description) : h.days.length === 7 ? t("Every day") : h.days.map((d) => dayLabels[d]).join(" ")}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setModal({ habit: h })} aria-label={t("Edit {title}").replace("{title}", h.name)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(h)} aria-label={t("Delete {title}").replace("{title}", h.name)}><Trash2 className="size-4" /></Button>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  {special ? (
                    <button onClick={() => setTab(h.kind === "water" ? "water" : h.kind === "reading" ? "reading" : "learning")} className="flex-1 text-start"><Progress value={pct} /><p className="mt-1.5 text-xs text-muted">{displayAmount}/{displayTarget} {displayUnit} {t("today — open tracker")}</p>{h.todayAmount < h.target && <p className="mt-1 text-[11px] text-faint">{t("Goal not reached yet.")}</p>}</button>
                  ) : h.target > 1 ? (
                    <div className="flex flex-1 items-center gap-2"><Button size="icon" onClick={() => log(h, h.todayAmount - 1)} aria-label={t("Decrease")}><Minus className="size-4" /></Button><div className="flex-1"><Progress value={pct} /><p className="mt-1.5 text-xs text-muted">{h.todayAmount}/{h.target} {h.unit}</p>{h.todayAmount < h.target && <p className="mt-1 text-[11px] text-faint">{t("Goal not reached yet.")}</p>}</div><Button size="icon" onClick={() => log(h, h.todayAmount + 1)} aria-label={t("Increase")}><Plus className="size-4" /></Button></div>
                  ) : (
                    <div className="flex flex-1 items-center gap-3 text-sm"><Checkbox checked={h.todayDone} onChange={(v) => void log(h, v ? 1 : 0)} label={`${t("Mark")} ${t(h.name)} ${t(h.todayDone ? "incomplete" : "done")} ${t("today")}`} /><div><p>{t(h.todayDone ? "Done today" : h.days.includes(new Date(habits.data!.today + "T00:00:00Z").getUTCDay()) ? "Mark as done" : "Not scheduled today")}</p>{!h.todayDone && <p className="mt-0.5 text-[11px] text-faint">{t("Goal not reached yet.")}</p>}</div></div>
                  )}
                  <div className="flex items-center gap-1 text-sm font-medium"><Flame className="size-4 text-orange-400" />{h.current}<span className="text-xs font-normal text-faint">/ {t("best")} {h.longest}</span></div>
                </div>
                <div className="mt-4 flex gap-[3px]" aria-label={t("Last 28 days")}>
                  {Array.from({ length: 28 }, (_, i) => addDays(habits.data!.today, i - 27)).map((d) => <span key={d} title={fmtShort(d)} className={cn("hm flex-1", h.history.includes(d) && "hm-3")} style={{ height: 14 }} />)}
                </div>
              </Card>
            );
          })}
        </div>
      ))}

      {tab === "water" && trackers.data && (
        <div className="grid gap-[var(--gap)] md:grid-cols-2">
          <Card className="flex flex-col items-center gap-4">
            <Ring value={Math.min(100, (100 * trackers.data.water.total) / trackers.data.water.goal)} size={170} stroke={11}><div><Droplets className="mx-auto mb-1 size-5 text-accent" /><p className="text-2xl font-semibold tabular-nums">{Number((trackers.data.water.total / 250).toFixed(1))}</p><p className="text-xs text-faint">{t("of")} {Math.ceil(trackers.data.water.goal / 250)} {t("cups")}</p></div></Ring>
            {trackers.data.water.total < trackers.data.water.goal && <p className="text-xs text-faint">{t("Goal not reached yet.")}</p>}
            <div className="flex flex-wrap justify-center gap-2">{[1, 2, 3].map((cups) => <Button key={cups} onClick={async () => { await run(() => api("/api/trackers/water", { body: { ml: cups * 250 } })); reloadAll(); }}>+{cups} {t(cups === 1 ? "cup" : "cups")}</Button>)}</div>
            <div className="flex w-full items-end gap-2"><Field label={t("Daily goal (cups)")} className="flex-1"><input className="input" type="number" min={2} max={10} step={1} defaultValue={Math.min(10, Math.ceil(prefs.waterGoal / 250))} onBlur={async (e) => { const cups = Number(e.target.value); const v = cups * 250; if (v !== prefs.waterGoal && Number.isInteger(cups) && cups >= 2 && cups <= 10) { await run(() => savePrefs({ waterGoal: v }), t("Water goal updated")); reloadAll(); } }} aria-label={t("Daily water goal")} /></Field></div><div className="mt-2 flex flex-wrap gap-2">{[5, 8, 10].map((cups) => <Button key={cups} size="sm" variant="glass" onClick={async () => { await run(() => savePrefs({ waterGoal: cups * 250 }), t("Water goal updated")); reloadAll(); }}>{cups} {t("cups")}</Button>)}</div>
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-medium text-muted">{t("Last 14 days")}</h3>
            <Bars days={trackers.data.water.days.map((d) => ({ ...d, v: Number((d.v / 250).toFixed(1)) }))} today={trackers.data.today} max={Math.max(Math.ceil(trackers.data.water.goal / 250), ...trackers.data.water.days.map((d) => Math.floor(d.v / 250)))} unit={t("cups")} />
            <h3 className="mb-2 mt-5 text-sm font-medium text-muted">{t("Today's intake")}</h3>
            {trackers.data.water.entries.length === 0 ? <p className="text-sm text-muted">{t("No water logged yet today.")}</p> : <ul className="space-y-1.5">{trackers.data.water.entries.map((w) => <li key={w.id} className="flex items-center justify-between text-sm"><span>{Number((w.ml / 250).toFixed(1))} {t("cups")} <span className="text-xs text-faint">· {new Date(w.createdAt).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en", { hour: "2-digit", minute: "2-digit" })}</span></span><Button variant="ghost" size="icon" aria-label={t("Remove entry")} onClick={async () => { await run(() => api(`/api/trackers/water?id=${w.id}`, { method: "DELETE" })); reloadAll(); }}><Trash2 className="size-3.5" /></Button></li>)}</ul>}
          </Card>
        </div>
      )}
      {tab === "reading" && trackers.data && <ReadingTab tracker={trackers.data} reload={reloadAll} />}
      {tab === "learning" && trackers.data && <LearningTab tracker={trackers.data} reload={reloadAll} />}
      {tab !== "habits" && !trackers.data && (trackers.error ? <ErrorState message={trackers.error} retry={trackers.reload} /> : <ListSkeleton />)}
      <HabitModal open={!!modal} habit={modal?.habit} onClose={() => setModal(null)} onSaved={reloadAll} existing={habits.data?.habits ?? []} />
    </>
  );
}

function ReadingTab({ tracker, reload }: { tracker: Trackers; reload: () => void }) {
  const { t } = useApp();
  const { run } = useUI();
  const [book, setBook] = useState("");
  const [pages, setPages] = useState("");
  return (
    <div className="grid gap-[var(--gap)] md:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center gap-3"><BookOpen className="size-5 text-accent" /><div className="flex-1"><p className="font-medium">{t("Today")}: {tracker.reading.todayPages} / {tracker.reading.target} {t("pages")}</p><Progress value={(100 * tracker.reading.todayPages) / tracker.reading.target} className="mt-2" />{tracker.reading.todayPages < tracker.reading.target && <p className="mt-1 text-xs text-faint">{t("Goal not reached yet.")}</p>}</div></div>
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api("/api/trackers/reading", { body: { book, pages: Number(pages) } }), t("Reading logged"))) { setPages(""); reload(); } }}>
          <Field label={t("Book name")}><input className="input" value={book} onChange={(e) => setBook(e.target.value)} maxLength={120} required aria-label={t("Book name")} list="books" /><datalist id="books">{[...new Set(tracker.reading.entries.map((e) => e.book))].map((b) => <option key={b} value={b} />)}</datalist></Field>
          <Field label={t("Pages read")}><input className="input" type="number" min={1} max={2000} value={pages} onChange={(e) => setPages(e.target.value)} required aria-label={t("Pages read")} /></Field>
          <Button type="submit" variant="primary" className="w-full">{t("Log reading")}</Button>
        </form>
        <h3 className="mb-2 mt-5 text-sm font-medium text-muted">{t("Last 14 days")}</h3>
        <Bars days={tracker.reading.days} today={tracker.today} max={Math.max(tracker.reading.target, ...tracker.reading.days.map((d) => d.v))} unit="pages" />
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-medium text-muted">{t("Reading history")}</h3>
        {tracker.reading.entries.length === 0 ? <EmptyState icon={<BookOpen className="size-5" />} title={t("No reading yet")} text={t("Log your first session to start a history.")} /> : <ul className="divide-y divide-[var(--border)]">{tracker.reading.entries.map((r) => <li key={r.id} className="flex items-center justify-between py-2.5 text-sm"><span className="min-w-0"><span className="block truncate">{r.book}</span><span className="text-xs text-faint">{fmtShort(r.date)} · {r.pages} {t("pages")}</span></span><Button variant="ghost" size="icon" aria-label={t("Remove entry")} onClick={async () => { await run(() => api(`/api/trackers/reading?id=${r.id}`, { method: "DELETE" })); reload(); }}><Trash2 className="size-3.5" /></Button></li>)}</ul>}
      </Card>
    </div>
  );
}

function LearningTab({ tracker, reload }: { tracker: Trackers; reload: () => void }) {
  const { t } = useApp();
  const { run } = useUI();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  return (
    <div className="grid gap-[var(--gap)] md:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center gap-2"><Lightbulb className="size-5 text-accent" /><div className="flex-1"><p className="font-medium">{t("What did you learn?")}</p><p className="text-xs text-muted">{tracker.learning.todayCount}/{tracker.learning.target} {t("entries today")}</p><Progress value={(100 * tracker.learning.todayCount) / tracker.learning.target} className="mt-2" /></div></div>
        {tracker.learning.todayCount < tracker.learning.target && <p className="mb-3 text-xs text-faint">{t("Goal not reached yet.")}</p>}
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api("/api/trackers/learning", { body: { title, explanation: text } }), t("Learning saved"))) { setTitle(""); setText(""); reload(); } }}>
          <Field label={t("New knowledge")}><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required aria-label={t("New knowledge")} /></Field>
          <Field label={t("Short explanation")}><textarea className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} aria-label={t("Explanation")} /></Field>
          <Button type="submit" variant="primary" className="w-full">{t("Save entry")}</Button>
        </form>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-medium text-muted">{t("Learning log")}</h3>
        {tracker.learning.entries.length === 0 ? <EmptyState icon={<Lightbulb className="size-5" />} title={t("Nothing recorded yet")} /> : <ul className="space-y-3">{tracker.learning.entries.map((l) => <li key={l.id} className="rounded-xl border border-line bg-card p-3 text-sm"><div className="flex items-start justify-between gap-2"><p className="font-medium">{l.title}</p><Button variant="ghost" size="icon" aria-label={t("Remove entry")} onClick={async () => { await run(() => api(`/api/trackers/learning?id=${l.id}`, { method: "DELETE" })); reload(); }}><Trash2 className="size-3.5" /></Button></div>{l.explanation && <p className="mt-1 text-muted">{l.explanation}</p>}<p className="mt-1 text-xs text-faint">{fmtShort(l.date)}</p></li>)}</ul>}
      </Card>
    </div>
  );
}

function HabitModal({ open, habit, onClose, onSaved, existing }: { open: boolean; habit?: Habit; onClose: () => void; onSaved: () => void; existing: Habit[] }) {
  const { t, lang } = useApp();
  const { run } = useUI();
  const [f, setF] = useState({ name: "", description: "", icon: "sparkles", days: [0, 1, 2, 3, 4, 5, 6], target: 1, unit: "", reminderTime: "" });
  const [kind, setKind] = useState<"standard" | "water" | "reading" | "learning">("standard");
  useEffect(() => { if (open) { setKind(habit?.kind ?? "standard"); setF(habit ? { name: habit.name, description: habit.description, icon: habit.icon, days: habit.days, target: habit.target, unit: habit.unit, reminderTime: habit.reminderTime ?? "" } : { name: "", description: "", icon: "sparkles", days: [0, 1, 2, 3, 4, 5, 6], target: 1, unit: "", reminderTime: "" }); } }, [open, habit]);
  const save = async () => {
    const body = { ...f, reminderTime: f.reminderTime || null, kind };
    const ok = await run(() => (habit ? api(`/api/habits/${habit.id}`, { method: "PATCH", body: { ...f, reminderTime: f.reminderTime || null } }) : api("/api/habits", { body })), habit ? t("Habit updated") : t("Habit added"));
    if (ok) { onSaved(); onClose(); }
  };
  const have = new Set(existing.map((e) => e.name));
  return (
    <Modal open={open} onClose={onClose} title={t(habit ? "Edit habit" : "Add habit")} wide footer={<><Button onClick={onClose}>{t("Cancel")}</Button><Button variant="primary" onClick={save} disabled={!f.name.trim()}>{habit ? t("Save") : t("Add habit")}</Button></>}>
      {!habit && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-muted">{t("Quick add")}</p>
          <div className="flex flex-wrap gap-2">{PREDEFINED_HABITS_CLIENT.map((h) => <button key={h.key} type="button" disabled={have.has(h.name)} onClick={() => { setKind(h.kind); setF({ ...f, name: h.name, description: h.description, icon: h.icon, target: h.target, unit: h.unit }); }} className="chip disabled:opacity-40"><HabitIcon name={h.icon} className="size-3.5" />{t(h.name)}</button>)}</div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Name")} className="sm:col-span-2"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} aria-label={t("Habit name")} /></Field>
        <Field label={t("Description")} className="sm:col-span-2"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} aria-label={t("Description")} /></Field>
        <Field label={t("Icon")}><div className="flex flex-wrap gap-1.5">{HABIT_ICONS.map((i) => <button key={i} type="button" aria-label={i} aria-pressed={f.icon === i} onClick={() => setF({ ...f, icon: i })} className={cn("grid size-9 place-items-center rounded-lg border", f.icon === i ? "border-accent bg-accent/15" : "border-line")}><HabitIcon name={i} className="size-4" /></button>)}</div></Field>
        <Field label={t("Schedule")}><div className="flex gap-1.5">{DAYS.map((d, i) => <button key={i} type="button" aria-pressed={f.days.includes(i)} aria-label={t(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i])} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort() })} className={cn("size-9 rounded-full border text-xs font-medium", f.days.includes(i) ? "border-transparent bg-accent text-[var(--on-accent)]" : "border-line text-muted")}>{lang === "ar" ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"][i] : d}</button>)}</div></Field>
        <Field label={kind === "water" ? t("Daily goal (cups)") : `${t("Daily target")}${kind !== "standard" ? ` (${t("Set by tracker")})` : ""}`}><input className="input" type="number" min={1} value={kind === "water" ? Math.ceil(f.target / 250) : f.target} disabled={kind === "water"} onChange={(e) => setF({ ...f, target: Math.max(1, Number(e.target.value)) })} aria-label={t("Daily target")} /></Field>
        <Field label={t("Unit")}><input className="input" value={kind === "water" ? t("cups") : f.unit} disabled={kind === "water"} onChange={(e) => setF({ ...f, unit: e.target.value })} maxLength={20} placeholder={t("e.g. glasses")} aria-label={t("Unit")} /></Field>
        <Field label={t("Reminder time")} hint={t("Used for in-app reminders")}><input className="input" type="time" value={f.reminderTime} onChange={(e) => setF({ ...f, reminderTime: e.target.value })} aria-label={t("Reminder time")} /></Field>
      </div>
    </Modal>
  );
}

export default function HabitsPage() {
  return <Suspense><Inner /></Suspense>;
}
