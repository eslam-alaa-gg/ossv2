"use client";
import { CheckCircle2, Clock, Plus, Zap } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, ErrorState, Field, ListSkeleton, Modal, PageHeader, useUI } from "@/components/ui";
import { api, useFetch } from "@/lib/client";
import { fmtShort } from "@/lib/dates";

type Ch = { id: string; date: string; title: string; description: string; difficulty: string; minutes: number; xp: number; isCustom: boolean; completedAt: string | null };
const TONE = { easy: "green", medium: "amber", hard: "red" } as const;

export default function ChallengePage() {
  const { prefs } = useApp();
  const { run, toast } = useUI();
  const { data, error, reload } = useFetch<{ today: Ch[]; history: Ch[]; completedTotal: number }>("/api/challenges");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", difficulty: "easy", minutes: 15 });
  const [busy, setBusy] = useState<string | null>(null);

  async function complete(c: Ch) {
    setBusy(c.id);
    const r = await run(() => api<{ xp: number; unlocked: string[] }>(`/api/challenges/${c.id}/complete`, { method: "POST", body: {} }));
    setBusy(null);
    if (r) { toast("success", `Challenge complete · +${r.xp} XP`); r.unlocked.forEach((u) => toast("success", `🏆 ${u}`)); reload(); }
  }
  const main = data?.today.filter((c) => !c.isCustom) ?? [];
  const custom = data?.today.filter((c) => c.isCustom) ?? [];
  const Item = ({ c, hero }: { c: Ch; hero?: boolean }) => (
    <Card className={hero ? "relative overflow-hidden" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-2"><Badge tone={TONE[c.difficulty as keyof typeof TONE]} className="capitalize">{c.difficulty}</Badge><Badge><Clock className="size-3" />{c.minutes} min</Badge><Badge tone="accent">+{c.xp} XP</Badge>{c.isCustom && <Badge>custom</Badge>}</div>
          <h3 className={hero ? "text-2xl font-semibold" : "text-base font-semibold"}>{c.title}</h3>
          {c.description && <p className="mt-2 max-w-xl text-sm text-muted">{c.description}</p>}
        </div>
        {c.completedAt ? <span className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="size-5" /> Completed</span> : <Button variant="primary" loading={busy === c.id} onClick={() => complete(c)}>Mark complete</Button>}
      </div>
    </Card>
  );
  return (
    <>
      <PageHeader title="Daily Challenge" subtitle="One small stretch each day. Rewards are validated on the server and can only be claimed once." actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> Custom challenge</Button>} />
      {error && !data ? <ErrorState message={error} retry={reload} /> : !data ? <ListSkeleton rows={2} /> : (
        <div className="space-y-[var(--gap)]">
          {main.map((c) => <Item key={c.id} c={c} hero />)}
          {custom.length > 0 && <div className="space-y-3"><h2 className="text-sm font-medium text-muted">Your custom challenges today</h2>{custom.map((c) => <Item key={c.id} c={c} />)}</div>}
          <p className="text-xs text-faint">Custom challenges (max 3 per day) earn half XP. Reminder time: {prefs.notifications.challengeTime} — change it in Settings → Notifications. {data.completedTotal} challenges completed overall.</p>
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted">History</h2>
            {data.history.length === 0 ? <EmptyState icon={<Zap className="size-5" />} title="No history yet" text="Past challenges will appear here." /> : (
              <Card pad={false}><ul className="divide-y divide-[var(--border)]">{data.history.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="min-w-0"><span className="block truncate">{c.title}</span><span className="text-xs text-faint">{fmtShort(c.date)} · {c.difficulty}</span></span>{c.completedAt ? <span className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="size-4" />+{c.xp} XP</span> : <span className="text-xs text-faint">Missed — no penalty</span>}</li>)}</ul></Card>
            )}
          </div>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Custom challenge" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!f.title.trim()} onClick={async () => { if (await run(() => api("/api/challenges", { body: f }), "Challenge added")) { setOpen(false); setF({ title: "", description: "", difficulty: "easy", minutes: 15 }); reload(); } }}>Add</Button></>}>
        <div className="space-y-4">
          <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} aria-label="Title" /></Field>
          <Field label="Description"><textarea className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} aria-label="Description" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Difficulty"><select className="input" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} aria-label="Difficulty"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Field>
            <Field label="Minutes"><input className="input" type="number" min={1} max={480} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} aria-label="Minutes" /></Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
