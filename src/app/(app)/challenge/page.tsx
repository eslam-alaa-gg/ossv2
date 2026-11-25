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
  const { prefs, t } = useApp();
  const { run, toast } = useUI();
  const { data, error, reload } = useFetch<{ today: Ch[]; history: Ch[]; completedTotal: number }>("/api/challenges");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", difficulty: "easy", minutes: 15 });
  const [busy, setBusy] = useState<string | null>(null);

  async function complete(c: Ch) {
    setBusy(c.id);
    const r = await run(() => api<{ xp: number; unlocked: string[] }>(`/api/challenges/${c.id}/complete`, { method: "POST", body: {} }));
    setBusy(null);
    if (r) { toast("success", `${t("Challenge complete")} · +${r.xp} XP`); r.unlocked.forEach((u) => toast("success", `🏆 ${u}`)); reload(); }
  }
  const main = data?.today.filter((c) => !c.isCustom) ?? [];
  const custom = data?.today.filter((c) => c.isCustom) ?? [];
  const Item = ({ c, hero }: { c: Ch; hero?: boolean }) => (
    <Card className={hero ? "relative overflow-hidden" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-2"><Badge tone={TONE[c.difficulty as keyof typeof TONE]} >{t(c.difficulty)}</Badge><Badge><Clock className="size-3" />{c.minutes} min</Badge><Badge tone="accent">+{c.xp} XP</Badge>{c.isCustom && <Badge>{t("custom")}</Badge>}</div>
          <h3 className={hero ? "text-2xl font-semibold" : "text-base font-semibold"}>{t(c.title)}</h3>
          {c.description && <p className="mt-2 max-w-xl text-sm text-muted">{t(c.description)}</p>}
        </div>
        {c.completedAt ? <span className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="size-5" /> {t("Completed")}</span> : <Button variant="primary" loading={busy === c.id} onClick={() => complete(c)}>{t("Mark complete")}</Button>}
      </div>
    </Card>
  );
  return (
    <>
      <PageHeader title={t("Daily Challenge")} subtitle={t("One small stretch each day. Rewards are validated on the server and can only be claimed once.")} actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> {t("Custom challenge")}</Button>} />
      {error && !data ? <ErrorState message={error} retry={reload} /> : !data ? <ListSkeleton rows={2} /> : (
        <div className="space-y-[var(--gap)]">
          {main.map((c) => <Item key={c.id} c={c} hero />)}
          {custom.length > 0 && <div className="space-y-3"><h2 className="text-sm font-medium text-muted">{t("Your custom challenges today")}</h2>{custom.map((c) => <Item key={c.id} c={c} />)}</div>}
          <p className="text-xs text-faint">{t("Custom challenges (max 3 per day) earn half XP. Reminder time:")} {prefs.notifications.challengeTime} — {t("change it in Settings → Notifications.")} {data.completedTotal} {t("challenges completed overall.")}</p>
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted">{t("History")}</h2>
            {data.history.length === 0 ? <EmptyState icon={<Zap className="size-5" />} title={t("No history yet")} text={t("Past challenges will appear here.")} /> : (
              <Card pad={false}><ul className="divide-y divide-[var(--border)]">{data.history.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="min-w-0"><span className="block truncate">{t(c.title)}</span><span className="text-xs text-faint">{fmtShort(c.date)} · {t(c.difficulty)}</span></span>{c.completedAt ? <span className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="size-4" />+{c.xp} XP</span> : <span className="text-xs text-faint">{t("Missed — no penalty")}</span>}</li>)}</ul></Card>
            )}
          </div>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t("Custom challenge")} footer={<><Button onClick={() => setOpen(false)}>{t("Cancel")}</Button><Button variant="primary" disabled={!f.title.trim()} onClick={async () => { if (await run(() => api("/api/challenges", { body: f }), "Challenge added")) { setOpen(false); setF({ title: "", description: "", difficulty: "easy", minutes: 15 }); reload(); } }}>{t("Add")}</Button></>}>
        <div className="space-y-4">
          <Field label={t("Title")}><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} aria-label={t("Title")} /></Field>
          <Field label={t("Description")}><textarea className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} aria-label={t("Description")} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("Difficulty")}><select className="input" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} aria-label={t("Difficulty")}><option value="easy">{t("Easy")}</option><option value="medium">{t("Medium")}</option><option value="hard">{t("Hard")}</option></select></Field>
            <Field label={t("Minutes")}><input className="input" type="number" min={1} max={480} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} aria-label={t("Minutes")} /></Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
