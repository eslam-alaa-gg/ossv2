"use client";
import { useEffect, useState } from "react";
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
  return <Badge tone={PRI_TONE[p]} className="capitalize">{p}</Badge>;
}

const empty = { title: "", description: "", category: "General", priority: "medium", status: "todo", dueDate: "", dueTime: "", reminderMinutes: "", tags: "", recurrence: "none", goalId: "" };

export function TaskModal({ open, onClose, task, defaults, onSaved, onDelete }: { open: boolean; onClose: () => void; task?: Task | null; defaults?: Partial<typeof empty>; onSaved: () => void; onDelete?: (t: Task) => void }) {
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
    if (!f.title.trim()) return setErr("Title is required");
    setBusy(true);
    const body = {
      title: f.title, description: f.description, category: f.category.trim() || "General", priority: f.priority, status: f.status,
      dueDate: f.dueDate || null, dueTime: f.dueTime || null, reminderMinutes: f.reminderMinutes === "" ? null : Number(f.reminderMinutes),
      tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10), recurrence: f.recurrence, goalId: f.goalId || null,
    };
    const ok = await run(() => (task ? api(`/api/tasks/${task.id}`, { method: "PATCH", body: task.status === "completed" ? { ...body, status: undefined } : body }) : api("/api/tasks", { body })), task ? "Task updated" : "Task created");
    setBusy(false);
    if (ok) { onSaved(); onClose(); }
  }
  return (
    <Modal open={open} onClose={onClose} title={task ? "Task details" : "New task"} wide footer={<>
      {task && onDelete && <Button variant="danger" className="me-auto" onClick={() => onDelete(task)}>Delete</Button>}
      <Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>{task ? "Save changes" : "Create task"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={err} className="sm:col-span-2"><input className="input" value={f.title} onChange={set("title")} maxLength={200} placeholder="What needs to be done?" aria-label="Title" /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea className="input min-h-20" value={f.description} onChange={set("description")} maxLength={5000} aria-label="Description" /></Field>
        <Field label="Category"><input className="input" list="cats" value={f.category} onChange={set("category")} maxLength={40} aria-label="Category" /><datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Priority"><select className="input" value={f.priority} onChange={set("priority")} aria-label="Priority">{PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p[0].toUpperCase() + p.slice(1)}</option>)}</select></Field>
        <Field label="Due date"><input className="input" type="date" value={f.dueDate} onChange={set("dueDate")} aria-label="Due date" /></Field>
        <Field label="Due time"><input className="input" type="time" value={f.dueTime} onChange={set("dueTime")} aria-label="Due time" /></Field>
        <Field label="Reminder"><select className="input" value={f.reminderMinutes} onChange={set("reminderMinutes")} aria-label="Reminder"><option value="">None</option><option value="0">At due time</option><option value="15">15 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></Field>
        <Field label="Repeat"><select className="input" value={f.recurrence} onChange={set("recurrence")} aria-label="Repeat"><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field>
        {task && <Field label="Status"><select className="input" value={f.status} onChange={set("status")} aria-label="Status"><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="archived">Archived</option></select></Field>}
        <Field label="Tags" hint="Comma separated"><input className="input" value={f.tags} onChange={set("tags")} placeholder="deep-work, urgent" aria-label="Tags" /></Field>
        <Field label="Linked goal" className="sm:col-span-2"><select className="input" value={f.goalId} onChange={set("goalId")} aria-label="Linked goal"><option value="">No goal</option>{goals.data?.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
        {task && <p className="text-xs text-faint sm:col-span-2">Created {new Date(task.createdAt).toLocaleString()}{task.completedAt ? ` · Completed ${new Date(task.completedAt).toLocaleString()}` : ""}</p>}
      </div>
    </Modal>
  );
}
