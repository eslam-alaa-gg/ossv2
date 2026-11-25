"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { Button, Field, Progress, Segmented, Switch, cn, useUI } from "@/components/ui";
import { useApp } from "@/components/providers";
import { api } from "@/lib/client";
import { PREDEFINED_HABITS_CLIENT } from "@/lib/habit-templates";

const GOALS = [
  { title: "Get fitter and healthier", category: "Health" },
  { title: "Learn a new skill", category: "Learning" },
  { title: "Advance my career", category: "Career" },
  { title: "Read more books", category: "Personal Growth" },
  { title: "Be more creative", category: "Creativity" },
  { title: "Build better routines", category: "Lifestyle" },
];

export default function Onboarding() {
  const { user, patchUser, savePrefs, prefs } = useApp();
  const { run } = useUI();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [habits, setHabits] = useState<string[]>([]);
  const [tz, setTz] = useState(user?.timezone ?? "UTC");
  const [daily, setDaily] = useState(user?.dailyGoal ?? 5);
  const [notif, setNotif] = useState({ inApp: true, email: false });
  const [busy, setBusy] = useState(false);
  const steps = ["Goals", "Habits", "Routine", "Notifications"];
  const tzs = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
  const toggle = (arr: string[], set: (a: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function finish(skip = false) {
    setBusy(true);
    const ok = await run(async () => {
      if (!skip) {
        for (const g of GOALS.filter((x) => goals.includes(x.title))) await api("/api/goals", { body: { title: g.title, category: g.category, type: "yearly" } });
        for (const key of habits) {
          const h = PREDEFINED_HABITS_CLIENT.find((x) => x.key === key)!;
          await api("/api/habits", { body: { name: h.name, icon: h.icon, kind: h.kind, target: h.target, unit: h.unit, description: h.description } }).catch(() => {});
        }
        await savePrefs({ onboarding: { goals, habits }, notifications: { ...prefs.notifications, inApp: notif.inApp, email: notif.email } });
        await patchUser({ timezone: tz, dailyGoal: daily });
      }
      await patchUser({ onboarded: true });
      return true;
    });
    if (ok) window.location.href = "/dashboard";
    else setBusy(false);
  }

  const chip = (on: boolean) => cn("flex items-center justify-between gap-3 rounded-2xl border p-4 text-start text-sm transition-all", on ? "border-accent bg-[rgba(var(--accent-rgb),.12)]" : "border-line bg-card hover:bg-[var(--card-hover)]");
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-muted">LIFE OS</p>
          <h1 className="mt-3 text-2xl font-semibold">Let's set up your space{user ? `, ${user.displayName.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-muted">Every step is optional — you can change all of this later.</p>
        </div>
        <Progress value={((step + 1) / steps.length) * 100} className="mb-5" />
        <div className="glass p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-faint">Step {step + 1} of {steps.length} · {steps[step]}</p>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              {step === 0 && (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {GOALS.map((g) => (
                    <button key={g.title} onClick={() => toggle(goals, setGoals, g.title)} className={chip(goals.includes(g.title))} aria-pressed={goals.includes(g.title)}>
                      <span><span className="block font-medium">{g.title}</span><span className="text-xs text-muted">{g.category}</span></span>
                      {goals.includes(g.title) && <Check className="size-4 text-accent" />}
                    </button>
                  ))}
                </div>
              )}
              {step === 1 && (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {PREDEFINED_HABITS_CLIENT.map((h) => (
                    <button key={h.key} onClick={() => toggle(habits, setHabits, h.key)} className={chip(habits.includes(h.key))} aria-pressed={habits.includes(h.key)}>
                      <span className="font-medium">{h.name}</span>
                      {habits.includes(h.key) && <Check className="size-4 text-accent" />}
                    </button>
                  ))}
                </div>
              )}
              {step === 2 && (
                <div className="space-y-4">
                  <Field label="Timezone"><select className="input" value={tz} onChange={(e) => setTz(e.target.value)} aria-label="Timezone">{tzs.map((z) => <option key={z}>{z}</option>)}</select></Field>
                  <Field label="Daily productivity goal (points)" hint="Tasks and habits are 1 point each; challenges and focus sessions are 2. Reaching the goal lights up your heatmap fully.">
                    <Segmented value={String(daily) as string} onChange={(v) => setDaily(Number(v))} options={["3", "5", "8", "12"].map((v) => ({ value: v, label: v }))} label="Daily goal" />
                  </Field>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl border border-line bg-card p-4"><span>In-app reminders<span className="block text-xs text-muted">Tasks, habits and daily challenge</span></span><Switch checked={notif.inApp} onChange={(v) => setNotif({ ...notif, inApp: v })} label="In-app reminders" /></div>
                  <div className="flex items-center justify-between rounded-2xl border border-line bg-card p-4"><span>Email reminders<span className="block text-xs text-muted">Requires an email provider on the server</span></span><Switch checked={notif.email} onChange={(v) => setNotif({ ...notif, email: v })} label="Email reminders" /></div>
                  <p className="text-xs text-faint">Browser push can be enabled later in Settings.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => (step < steps.length - 1 ? setStep(step + 1) : finish(true))} disabled={busy}>Skip {step < steps.length - 1 ? "this step" : "setup"}</Button>
            <div className="flex gap-2">
              {step > 0 && <Button onClick={() => setStep(step - 1)} disabled={busy}>Back</Button>}
              {step < steps.length - 1 ? <Button variant="primary" onClick={() => setStep(step + 1)}>Continue <ArrowRight className="size-4 rtl:rotate-180" /></Button> : <Button variant="primary" loading={busy} onClick={() => finish(false)}>Finish setup</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
