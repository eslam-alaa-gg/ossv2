"use client";
import { Bell, Download, KeyRound, Mail, Music2, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, Field, Modal, PageHeader, Switch, useUI } from "@/components/ui";
import { api, useFetch } from "@/lib/client";

function b64(s: string) {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
const Row = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => <div className="flex items-center justify-between gap-4 py-3"><span className="text-sm">{title}{hint && <span className="block text-xs text-faint">{hint}</span>}</span>{children}</div>;

export default function SettingsPage() {
  const { user, prefs, savePrefs } = useApp();
  const { run, toast } = useUI();
  const n = prefs.notifications;
  const push = useFetch<{ configured: boolean; publicKey: string | null; subscribed: number }>("/api/push");
  const [perm, setPerm] = useState<string>("default");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState("");
  useEffect(() => { if ("Notification" in window) setPerm(Notification.permission); }, []);
  if (!user) return null;
  const setN = (p: Partial<typeof n>) => run(() => savePrefs({ notifications: { ...n, ...p } }));

  async function enablePush() {
    if (!push.data?.publicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return toast("error", "This browser doesn't support Web Push.");
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== "granted") return toast("info", "Notification permission was not granted. You can change this in your browser's site settings.");
    const ok = await run(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(push.data!.publicKey!) }));
      await api("/api/push", { body: { subscription: sub.toJSON() } });
      await savePrefs({ notifications: { ...n, push: true } });
      return true;
    }, "Browser push enabled");
    if (ok) push.reload();
  }
  async function disablePush() {
    await run(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await api("/api/push", { method: "DELETE", body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      await savePrefs({ notifications: { ...n, push: false } });
    }, "Browser push disabled");
    push.reload();
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Account, notifications and data." />
      <div className="grid gap-[var(--gap)] lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><Bell className="size-4" /> Notifications</h2>
          <div className="divide-y divide-[var(--border)]">
            <Row title="In-app notifications" hint="Task deadlines, habit & challenge reminders, achievements"><Switch checked={n.inApp} onChange={(v) => setN({ inApp: v })} label="In-app notifications" /></Row>
            <Row title="Browser push" hint={push.data && !push.data.configured ? "Not configured on this server (VAPID keys missing)" : perm === "denied" ? "Blocked in browser settings" : "Delivered through your browser's push service"}>
              {user.isDemo ? <Badge>Unavailable in demo</Badge> : push.data?.configured ? (n.push && push.data.subscribed ? <Button size="sm" onClick={disablePush}>Disable</Button> : <Button size="sm" variant="primary" onClick={enablePush} disabled={perm === "denied"}>Enable</Button>) : <Badge tone="amber">Not configured</Badge>}
            </Row>
            {n.push && push.data?.subscribed ? <div className="py-3"><Button size="sm" onClick={() => run(() => api("/api/push", { body: { test: true } }), "Test notification sent")}>Send test push</Button></div> : null}
            <Row title="Email reminders" hint="Requires an email provider (RESEND_API_KEY) on the server"><Switch checked={n.email} onChange={(v) => setN({ email: v })} label="Email reminders" /></Row>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Quiet hours start"><input className="input" type="time" value={n.quietStart} onChange={(e) => e.target.value && setN({ quietStart: e.target.value })} aria-label="Quiet hours start" /></Field>
            <Field label="Quiet hours end"><input className="input" type="time" value={n.quietEnd} onChange={(e) => e.target.value && setN({ quietEnd: e.target.value })} aria-label="Quiet hours end" /></Field>
            <Field label="Challenge reminder"><input className="input" type="time" value={n.challengeTime} onChange={(e) => e.target.value && setN({ challengeTime: e.target.value })} aria-label="Challenge reminder time" /></Field>
            <Field label="Habit reminder"><input className="input" type="time" value={n.habitTime} onChange={(e) => e.target.value && setN({ habitTime: e.target.value })} aria-label="Habit reminder time" /></Field>
          </div>
          <p className="mt-4 text-xs text-faint">In-app reminders are generated from your real tasks and habits whenever you use LIFE OS. Background push/email delivery runs only when the server's scheduler (<code>/api/cron/notify</code>) and provider keys are configured — see the setup guide.</p>
        </Card>

        <div className="space-y-[var(--gap)]">
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><KeyRound className="size-4" /> Account</h2>
            {user.isDemo ? <p className="rounded-xl bg-card p-4 text-sm text-muted">You're in <b className="text-fg">Demo Mode</b>. Password changes, email verification, account deletion and push notifications are disabled. <Link href="/signup" className="text-accent underline">Create a free account</Link> to unlock them.</p> : (
              <>
                <Row title={user.email} hint="Email address cannot be changed here"><Badge tone={user.emailVerified ? "green" : "amber"}>{user.emailVerified ? "Verified" : "Unverified"}</Badge></Row>
                {!user.emailVerified && <Button size="sm" onClick={async () => { const r = await run(() => api<{ emailSent: boolean }>("/api/auth/resend", { body: {} })); if (r) toast(r.emailSent ? "success" : "info", r.emailSent ? "Verification email sent" : "Email delivery isn't configured on this server."); }}><Mail className="size-4" /> Resend verification</Button>}
                <form className="mt-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api("/api/me/account", { body: { current: pw.current, next: pw.next } }), "Password changed")) setPw({ current: "", next: "" }); }}>
                  <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} aria-label="Current password" /></Field>
                  <Field label="New password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} aria-label="New password" /></Field>
                  <Button type="submit" disabled={!pw.current || pw.next.length < 8}>Change password</Button>
                </form>
              </>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><Music2 className="size-4" /> Spotify & appearance</h2>
            <p className="text-sm text-muted">Connection, ambience and playback options are in the <Link href="/music" className="text-accent">Music Hub</Link>. Colors, gradients and fonts are in the <Link href="/themes" className="text-accent">Theme Studio</Link>.</p>
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><Download className="size-4" /> Your data</h2>
            <p className="mb-3 text-sm text-muted">Download everything LIFE OS stores about you as JSON.</p>
            <a href="/api/export" className="glass-btn"><Download className="size-4" /> Export my data</a>
          </Card>
          {!user.isDemo && <Card className="border-red-400/30"><h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-red-400"><ShieldAlert className="size-4" /> Danger zone</h2><p className="mb-3 text-sm text-muted">Permanently delete your account and all associated data. This can't be undone.</p><Button variant="danger" onClick={() => setDel(true)}><Trash2 className="size-4" /> Delete account</Button></Card>}
        </div>
      </div>
      <Modal open={del} onClose={() => setDel(false)} title="Delete account" footer={<><Button onClick={() => setDel(false)}>Cancel</Button><Button variant="danger" disabled={!delPw} onClick={async () => { if (await run(() => api("/api/me/account", { method: "DELETE", body: { password: delPw } }))) window.location.href = "/signup"; }}>Delete permanently</Button></>}>
        <p className="mb-3 text-sm text-muted">All tasks, habits, goals, notes, journal entries and your profile will be erased. Enter your password to confirm.</p>
        <input className="input" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} aria-label="Password" placeholder="Password" />
      </Modal>
    </>
  );
}
