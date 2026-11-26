"use client";

import { BookOpen, Brain, CalendarDays, Check, Clock3, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Segmented, useUI } from "@/components/ui";
import { api, useFetch } from "@/lib/client";
import { queueOfflineAction, readOfflineSnapshot, saveOfflineSnapshot } from "@/lib/offline-db";

type Subject = { id: string; name: string; color: string };
type Flashcard = { id: string; subjectId: string | null; subjectName: string | null; front: string; back: string; dueAt: string; intervalDays: number; repetitions: number; lapses: number };
type StudyTask = { id: string; title: string; description: string; category: string; priority: string; status: string; dueDate: string; tags: string[] };

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function StudyPage() {
  const { t, lang, user } = useApp();
  const { run, toast, confirm } = useUI();
  const [tab, setTab] = useState("plan");
  const subjects = useFetch<{ subjects: Subject[] }>("/api/study/subjects");
  const cards = useFetch<{ cards: Flashcard[] }>("/api/study/flashcards");
  const due = useFetch<{ cards: Flashcard[] }>("/api/study/flashcards?due=1");
  const tasks = useFetch<{ tasks: StudyTask[] }>("/api/tasks");
  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState("#8b7cff");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(localDate());
  const [taskSubject, setTaskSubject] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      if (navigator.onLine) return;
      const [cachedSubjects, cachedCards, cachedDue, cachedTasks] = await Promise.all([
        readOfflineSnapshot<{ subjects: Subject[] }>(user.id, "study-subjects"),
        readOfflineSnapshot<{ cards: Flashcard[] }>(user.id, "study-flashcards"),
        readOfflineSnapshot<{ cards: Flashcard[] }>(user.id, "study-due"),
        readOfflineSnapshot<{ tasks: StudyTask[] }>(user.id, "study-tasks"),
      ]);
      if (cancelled) return;
      if (!subjects.data && cachedSubjects) subjects.setData(cachedSubjects);
      if (!cards.data && cachedCards) cards.setData(cachedCards);
      if (!due.data && cachedDue) due.setData(cachedDue);
      if (!tasks.data && cachedTasks) tasks.setData(cachedTasks);
    })();
    const refreshAfterSync = () => { void Promise.all([subjects.reload(), cards.reload(), due.reload(), tasks.reload()]); };
    window.addEventListener("ukiyo:offline-sync", refreshAfterSync);
    return () => { cancelled = true; window.removeEventListener("ukiyo:offline-sync", refreshAfterSync); };
  }, [user?.id]);

  useEffect(() => { if (user?.id && subjects.data) void saveOfflineSnapshot(user.id, "study-subjects", subjects.data); }, [user?.id, subjects.data]);
  useEffect(() => { if (user?.id && cards.data) void saveOfflineSnapshot(user.id, "study-flashcards", cards.data); }, [user?.id, cards.data]);
  useEffect(() => { if (user?.id && due.data) void saveOfflineSnapshot(user.id, "study-due", due.data); }, [user?.id, due.data]);
  useEffect(() => { if (user?.id && tasks.data) void saveOfflineSnapshot(user.id, "study-tasks", tasks.data); }, [user?.id, tasks.data]);

  async function saveAction(path: string, body: Record<string, unknown> | undefined, success: string, method: "POST" | "DELETE" = "POST"): Promise<"queued" | "sent" | null> {
    if (!user?.id) return null;
    if (!navigator.onLine) {
      const queued = await queueOfflineAction(user.id, path, method, body);
      if (!queued) { toast("info", t("Offline save is unavailable on this device.")); return null; }
      toast("info", t("Saved offline. It will sync when you're online."));
      return "queued";
    }
    try {
      await api(path, { method, ...(body ? { body } : {}) });
      toast("success", success);
      return "sent";
    } catch (error) {
      if (!navigator.onLine) {
        const queued = await queueOfflineAction(user.id, path, method, body);
        if (queued) { toast("info", t("Saved offline. It will sync when you're online.")); return "queued"; }
      }
      toast("info", error instanceof Error ? error.message : t("Something went wrong."));
      return null;
    }
  }

  const studyTasks = useMemo(() => (tasks.data?.tasks ?? [])
    .filter((task) => task.category.toLowerCase() === "study" || task.tags?.includes("study"))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [tasks.data]);
  const currentCard = due.data?.cards?.[0] ?? null;

  async function addSubject(event: FormEvent) {
    event.preventDefault();
    if (!subjectName.trim()) return;
    const name = subjectName.trim();
    const action = await saveAction("/api/study/subjects", { name, color: subjectColor }, t("Subject added"));
    if (action === "sent") await subjects.reload();
    if (action === "queued") {
      const localSubject = { id: `local-${crypto.randomUUID()}`, name, color: subjectColor };
      subjects.setData({ subjects: [...(subjects.data?.subjects ?? []), localSubject] });
    }
    if (action) setSubjectName("");
  }

  async function addCard(event: FormEvent) {
    event.preventDefault();
    if (!front.trim() || !back.trim()) return;
    const selectedSubject = subjects.data?.subjects.find((subject) => subject.id === subjectId);
    const safeSubjectId = subjectId.startsWith("local-") ? null : subjectId || null;
    const cardFront = front.trim();
    const cardBack = back.trim();
    const action = await saveAction("/api/study/flashcards", { front: cardFront, back: cardBack, subjectId: safeSubjectId }, t("Flashcard added"));
    if (action === "sent") await Promise.all([cards.reload(), due.reload()]);
    if (action === "queued") {
      const localCard: Flashcard = { id: `local-${crypto.randomUUID()}`, subjectId: safeSubjectId, subjectName: selectedSubject?.name ?? null, front: cardFront, back: cardBack, dueAt: new Date().toISOString(), intervalDays: 0, repetitions: 0, lapses: 0 };
      cards.setData({ cards: [localCard, ...(cards.data?.cards ?? [])] });
      due.setData({ cards: [localCard, ...(due.data?.cards ?? [])] });
    }
    if (action) { setFront(""); setBack(""); }
  }

  async function deleteCard(card: Flashcard) {
    if (!(await confirm(t("Delete this flashcard?"), t("Delete")))) return;
    const action = await saveAction(`/api/study/flashcards/${card.id}`, undefined, t("Flashcard deleted"), "DELETE");
    if (action === "sent") await Promise.all([cards.reload(), due.reload()]);
    if (action === "queued") {
      cards.setData({ cards: (cards.data?.cards ?? []).filter((item) => item.id !== card.id) });
      due.setData({ cards: (due.data?.cards ?? []).filter((item) => item.id !== card.id) });
    }
  }

  async function addStudyTask(event: FormEvent) {
    event.preventDefault();
    if (!taskTitle.trim() || !taskDate) return;
    const subject = subjects.data?.subjects.find((item) => item.id === taskSubject);
    const body = {
      title: taskTitle.trim(),
      description: subject ? `Study subject: ${subject.name}` : "",
      category: "Study",
      priority: "medium",
      status: "todo",
      dueDate: taskDate,
      dueTime: null,
      reminderMinutes: null,
      tags: ["study", ...(subject ? [subject.name.slice(0, 30)] : [])],
      recurrence: "none",
      goalId: null,
      milestoneId: null,
    };
    const action = await saveAction("/api/tasks", body, t("Study task planned"));
    if (action === "sent") await tasks.reload();
    if (action === "queued") {
      const localTask: StudyTask = { id: `local-${crypto.randomUUID()}`, title: body.title, description: body.description, category: "Study", priority: "medium", status: "todo", dueDate: taskDate, tags: body.tags };
      tasks.setData({ tasks: [localTask, ...(tasks.data?.tasks ?? [])] });
    }
    if (action) setTaskTitle("");
  }

  async function review(rating: "again" | "hard" | "good" | "easy") {
    if (!currentCard || reviewing) return;
    setReviewing(true);
    try {
      const action = await saveAction(`/api/study/flashcards/${currentCard.id}/review`, { rating }, t("Review saved"));
      if (action === "sent") await Promise.all([cards.reload(), due.reload()]);
      if (action === "queued") {
        const intervalDays = rating === "again" ? 0 : rating === "hard" ? 1 : rating === "good" ? 1 : 4;
        const dueAt = new Date(Date.now() + (rating === "again" ? 10 * 60 * 1000 : intervalDays * 86400000)).toISOString();
        cards.setData({ cards: (cards.data?.cards ?? []).map((card) => card.id === currentCard.id ? { ...card, dueAt, intervalDays, repetitions: rating === "again" ? 0 : card.repetitions + 1 } : card) });
        due.setData({ cards: (due.data?.cards ?? []).filter((card) => card.id !== currentCard.id) });
      }
      if (action) setRevealed(false);
    } finally { setReviewing(false); }
  }

  const tabs = [
    { value: "plan", label: t("Study plan") },
    { value: "subjects", label: t("Subjects") },
    { value: "cards", label: t("Flashcards") },
    { value: "review", label: t("Review due") },
  ];

  return (
    <>
      <PageHeader title={t("Study Planner")} subtitle={t("Plan focused study time, organize subjects and review what you learn.")} actions={<Badge>{due.data?.cards.length ?? 0} {t("due cards")}</Badge>} />
      <Segmented value={tab} onChange={setTab} label={t("Study sections")} options={tabs} />
      <div className="mt-[var(--gap)]">
        {tab === "plan" && <div className="grid gap-[var(--gap)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{t("Upcoming study tasks")}</h2><p className="mt-1 text-xs text-muted">{t("Study tasks also appear in your main Tasks list.")}</p></div><CalendarDays className="size-5 text-muted" /></div>
            {tasks.loading ? <p className="py-6 text-center text-sm text-muted">{t("Loading…")}</p> : studyTasks.length ? <ul className="space-y-2">{studyTasks.map((task) => <li key={task.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><BookOpen className="size-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.title}</p><p className="text-xs text-muted">{task.dueDate} · {t(task.status)}</p></div>
              <Badge tone={task.priority === "urgent" ? "red" : undefined}>{t(task.priority)}</Badge>
              <Link href={`/focus?task=${task.id}`} className="glass-btn btn-sm">{t("Focus")}</Link>
            </li>)}</ul> : <EmptyState icon={<CalendarDays className="size-5" />} title={t("No study tasks yet")} description={t("Add a study task to build your plan.")} />}
          </Card>
          <Card className="space-y-4">
            <h2 className="font-semibold">{t("Plan a study task")}</h2>
            <form onSubmit={addStudyTask} className="space-y-3">
              <Field label={t("Task title")}><input className="input" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={200} placeholder={t("e.g. Review chemistry chapter 3")} required /></Field>
              <Field label={t("Subject")}><select className="input" value={taskSubject} onChange={(event) => setTaskSubject(event.target.value)}><option value="">{t("General study")}</option>{(subjects.data?.subjects ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field>
              <Field label={t("Due date")}><input className="input" type="date" min={localDate()} value={taskDate} onChange={(event) => setTaskDate(event.target.value)} required /></Field>
              <Button type="submit" variant="primary" disabled={!taskTitle.trim()}><Plus className="size-4" /> {t("Add to study plan")}</Button>
            </form>
            <p className="text-xs text-muted">{t("Use the Focus Room to work through each planned task.")} <Link href="/focus" className="text-accent underline">{t("Open Focus")}</Link></p>
          </Card>
        </div>}

        {tab === "subjects" && <div className="grid gap-[var(--gap)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <Card className="space-y-3"><h2 className="font-semibold">{t("Your subjects")}</h2>
            {(subjects.data?.subjects ?? []).length ? <div className="grid gap-2 sm:grid-cols-2">{subjects.data!.subjects.map((subject) => <div key={subject.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3"><span className="size-3 rounded-full" style={{ background: subject.color }} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{subject.name}</span><Badge>{cards.data?.cards.filter((card) => card.subjectId === subject.id).length ?? 0} {t("cards")}</Badge></div>)}</div> : <EmptyState icon={<BookOpen className="size-5" />} title={t("No subjects yet")} description={t("Add subjects such as Chemistry, Physics or History.")} />}
          </Card>
          <Card><h2 className="mb-3 font-semibold">{t("Add a subject")}</h2><form onSubmit={addSubject} className="space-y-3"><Field label={t("Subject name")}><input className="input" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} maxLength={60} placeholder={t("e.g. Chemistry")} required /></Field><Field label={t("Color")}><input type="color" value={subjectColor} onChange={(event) => setSubjectColor(event.target.value)} aria-label={t("Subject color")} /></Field><Button type="submit" variant="primary" disabled={!subjectName.trim()}><Plus className="size-4" /> {t("Add subject")}</Button></form></Card>
        </div>}

        {tab === "cards" && <div className="grid gap-[var(--gap)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
          <Card className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">{t("Your flashcards")}</h2><Badge>{cards.data?.cards.length ?? 0} {t("total")}</Badge></div>
            {(cards.data?.cards ?? []).length ? <ul className="space-y-2">{cards.data!.cards.map((card) => <li key={card.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{card.front}</p><p className="truncate text-xs text-muted">{card.subjectName ?? t("General")} · {t("Due")} {new Date(card.dueAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</p></div><Badge>{card.intervalDays}d</Badge><Button size="icon" variant="ghost" aria-label={t("Delete flashcard")} onClick={() => void deleteCard(card)}><Trash2 className="size-4" /></Button></li>)}</ul> : <EmptyState icon={<Brain className="size-5" />} title={t("No flashcards yet")} description={t("Create your first question and answer card.")} />}
          </Card>
          <Card className="space-y-3"><h2 className="font-semibold">{t("Create a flashcard")}</h2><form onSubmit={addCard} className="space-y-3"><Field label={t("Question / front")}><textarea className="input min-h-24" value={front} onChange={(event) => setFront(event.target.value)} maxLength={4000} required /></Field><Field label={t("Answer / back")}><textarea className="input min-h-24" value={back} onChange={(event) => setBack(event.target.value)} maxLength={8000} required /></Field><Field label={t("Subject")}><select className="input" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">{t("General")}</option>{(subjects.data?.subjects ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field><Button type="submit" variant="primary" disabled={!front.trim() || !back.trim()}><Plus className="size-4" /> {t("Create flashcard")}</Button></form></Card>
        </div>}

        {tab === "review" && <Card className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{t("Spaced repetition review")}</h2><p className="mt-1 text-xs text-muted">{t("Rate how well you recalled the answer. Your next review date adjusts automatically.")}</p></div><Badge>{due.data?.cards.length ?? 0} {t("due")}</Badge></div>
          {due.loading ? <p className="py-8 text-center text-sm text-muted">{t("Loading…")}</p> : !currentCard ? <EmptyState icon={<Sparkles className="size-6" />} title={t("You're all caught up")} description={t("New cards and future reviews will appear here when they're due.")} /> : <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-card p-6 text-center sm:p-10"><p className="mb-3 text-xs uppercase tracking-[.18em] text-muted">{currentCard.subjectName ?? t("General")}</p><p className="whitespace-pre-wrap text-lg font-semibold">{currentCard.front}</p>{revealed && <div className="mt-6 border-t border-line pt-5"><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{currentCard.back}</p></div>}</div>
            {!revealed ? <Button variant="primary" className="w-full" onClick={() => setRevealed(true)}>{t("Show answer")}</Button> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="danger" disabled={reviewing} onClick={() => void review("again")}>{t("Again")}<span className="block text-[10px] opacity-70">10 min</span></Button>
              <Button disabled={reviewing} onClick={() => void review("hard")}>{t("Hard")}<span className="block text-[10px] opacity-70">1+ day</span></Button>
              <Button variant="primary" disabled={reviewing} onClick={() => void review("good")}>{t("Good")}<span className="block text-[10px] opacity-70">1 / 6+ days</span></Button>
              <Button variant="glass" disabled={reviewing} onClick={() => void review("easy")}>{t("Easy")}<span className="block text-[10px] opacity-70">4+ days</span></Button>
            </div>}
          </div>}
          <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted"><span><Clock3 className="mr-1 inline size-3.5" />{t("Reviews are scheduled automatically")}</span><Link href="/analytics" className="text-accent underline">{t("View analytics")}</Link></div>
        </Card>}
      </div>
    </>
  );
}
