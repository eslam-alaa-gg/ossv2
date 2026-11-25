"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { api, useFetch } from "@/lib/client";
import { Badge, Button, Field, Modal, useUI } from "./ui";

export type Task = {
  id: string; title: string; description: string; category: string; priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "completed" | "archived"; dueDate: string | null; dueTime: string | null; reminderMinutes: number | null;
  tags: string[]; recurrence: "none" | "daily" | "weekly" | "monthly"; goalId: string | null; milestoneId: string | null; completedAt: string | null; createdAt: string;
};
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const PRI_TONE = { low: "blue", medium: "accent", high: "amber", urgent: "red" } as const;
export const STATUS_LABEL = { todo: "To Do", in_progress: "In Progress", completed: "Completed", archived: "Archived" } as const;
export const CATEGORIES = ["General", "Work", "Personal", "Health", "Learning", "Finance", "Home", "Career", "Creativity"];

export function PriorityBadge({ p }: { p: Task["priority"] }) {
  const { t } = useApp();
  return <Badge tone={PRI_TONE[p]} className="capitalize">{t(p)}</Badge>;
}

const empty = { title: "", description: "", category: "General", priority: "medium", status: "todo", dueDate: "", dueTime: "", reminderMinutes: "", tags: "", recurrence: "none", goalId: "" };

export function TaskModal({ open, onClose, task, defaults, onSaved, onDelete }: { open: boolean; onClose: () => void; task?: Task | null; defaults?: Partial<typeof empty>; onSaved: () => void; onDelete?: (t: Task) => void }) {
  const { t } = useApp();
  const { run } = useUI();
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const goals = useFetch<{ goals: { id: string; title: string }[] }>(open ? "/api/goals" : null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF(task ? { title: task.title, description: task.description, category: task.category, priority: task.priority, status: task.status === "completed" ? "todo" : task.status, dueDate: task.dueDate ?? "", dueTime: task.dueTime ?? "", reminderMinutes: task.reminderMinutes === null ? "" : String(task.reminderMinutes), tags: task.tags.join(", "), recurrence: task.recurrence, goalId: task.goalId ?? "" } : { ...empty, ...defaults });
  }, [open, task, defaults]);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!f.title.trim()) return setErr(t("Title is required"));
    setBusy(true);
    const body = {
      title: f.title, description: f.description, category: f.category.trim() || "General", priority: f.priority, status: f.status,
      dueDate: f.dueDate || null, dueTime: f.dueTime || null, reminderMinutes: f.reminderMinutes === "" ? null : Number(f.reminderMinutes),
      tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10), recurrence: f.recurrence, goalId: f.goalId || null,
    };
    const ok = await run(() => (task ? api(`/api/tasks/${task.id}`, { method: "PATCH", body: task.status === "completed" ? { ...body, status: undefined } : body }) : api("/api/tasks", { body })), task ? t("Task updated") : t("Task created"));
    setBusy(false);
    if (ok) { onSaved(); onClose(); }
  }
  return (
    <Modal open={open} onClose={onClose} title={task ? t("Task details") : t("New task")} wide footer={<>
      {task && onDelete && <Button variant="danger" className="me-auto" onClick={() => onDelete(task)}>{t("Delete")}</Button>}
      <Button onClick={onClose}>{t("Cancel")}</Button><Button variant="primary" loading={busy} onClick={save}>{task ? t("Save changes") : t("Create task")}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Title")} error={err} className="sm:col-span-2"><input className="input" value={f.title} onChange={set("title")} maxLength={200} placeholder={t("What needs to be done?")} aria-label={t("Title")} /></Field>
        <Field label={t("Description")} className="sm:col-span-2"><textarea className="input min-h-20" value={f.description} onChange={set("description")} maxLength={5000} aria-label={t("Description")} /></Field>
        <Field label={t("Category")}><input className="input" list="cats" value={f.category} onChange={set("category")} maxLength={40} aria-label={t("Category")} /><datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} label={t(c)} />)}</datalist></Field>
        <Field label={t("Priority")}><select className="input" value={f.priority} onChange={set("priority")} aria-label={t("Priority")}>{PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{t(p)}</option>)}</select></Field>
        <Field label={t("Due date")}><input className="input" type="date" value={f.dueDate} onChange={set("dueDate")} aria-label={t("Due date")} /></Field>
        <Field label={t("Due time")}><input className="input" type="time" value={f.dueTime} onChange={set("dueTime")} aria-label={t("Due time")} /></Field>
        <Field label={t("Reminder")}><select className="input" value={f.reminderMinutes} onChange={set("reminderMinutes")} aria-label={t("Reminder")}><option value="">{t("None")}</option><option value="0">{t("At due time")}</option><option value="15">{t("15 minutes before")}</option><option value="60">{t("1 hour before")}</option><option value="1440">{t("1 day before")}</option></select></Field>
        <Field label={t("Repeat")}><select className="input" value={f.recurrence} onChange={set("recurrence")} aria-label={t("Repeat")}><option value="none">{t("Does not repeat")}</option><option value="daily">{t("Daily")}</option><option value="weekly">{t("Weekly")}</option><option value="monthly">{t("Monthly")}</option></select></Field>
        {task && <Field label={t("Status")}><select className="input" value={f.status} onChange={set("status")} aria-label={t("Status")}><option value="todo">{t("To Do")}</option><option value="in_progress">{t("In Progress")}</option><option value="archived">{t("Archived")}</option></select></Field>}
        <Field label={t("Tags")} hint={t("Comma separated")}><input className="input" value={f.tags} onChange={set("tags")} placeholder={t("deep-work, urgent")} aria-label={t("Tags")} /></Field>
        <Field label={t("Linked goal")} className="sm:col-span-2"><select className="input" value={f.goalId} onChange={set("goalId")} aria-label={t("Linked goal")}><option value="">{t("No goal")}</option>{goals.data?.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
        {task && <p className="text-xs text-faint sm:col-span-2">{t("Created")} {new Date(task.createdAt).toLocaleString()}{task.completedAt ? ` · ${t("Completed")} ${new Date(task.completedAt).toLocaleString()}` : ""}</p>}
      </div>
    </Modal>
  );
}
