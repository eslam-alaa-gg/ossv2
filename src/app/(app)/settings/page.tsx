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
  const { user, prefs, savePrefs, t } = useApp();
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
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return toast("error", t("This browser doesn't support Web Push."));
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== "granted") return toast("info", t("Notification permission was not granted. You can change this in your browser's site settings."));
    const ok = await run(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(push.data!.publicKey!) }));
      await api("/api/push", { body: { subscription: sub.toJSON() } });
      await savePrefs({ notifications: { ...n, push: true } });
      return true;
    }, t("Browser push enabled"));
    if (ok) push.reload();
  }
  async function disablePush() {
    await run(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await api("/api/push", { method: "DELETE", body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      await savePrefs({ notifications: { ...n, push: false } });
    }, t("Browser push disabled"));
    push.reload();
  }

  return (
    <>
      <PageHeader title={t("Settings")} subtitle={t("Account, notifications and data.")} />
      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><Bell className="size-4" /> {t("Notifications")}</h2>
          <div className="divide-y divide-[var(--border)]">
            <Row title={t("In-app notifications")} hint={t("Task deadlines, habit & challenge reminders, achievements")}><Switch checked={n.inApp} onChange={(v) => setN({ inApp: v })} label={t("In-app notifications")} /></Row>
            <Row title={t("Browser push")} hint={push.data && !push.data.configured ? t("Not configured on this server (VAPID keys missing)") : perm === "denied" ? t("Blocked in browser settings") : t("Delivered through your browser's push service")}>
              {user.isDemo ? <Badge>{t("Unavailable in demo")}</Badge> : push.data?.configured ? (n.push && push.data.subscribed ? <Button size="sm" onClick={disablePush}>{t("Disable")}</Button> : <Button size="sm" variant="primary" onClick={enablePush} disabled={perm === "denied"}>{t("Enable")}</Button>) : <Badge tone="amber">{t("Not configured")}</Badge>}
            </Row>
            {n.push && push.data?.subscribed ? <div className="py-3"><Button size="sm" onClick={() => run(() => api("/api/push", { body: { test: true } }), t("Test notification sent"))}>{t("Send test push")}</Button></div> : null}
            <Row title={t("Email reminders")} hint={t("Requires an email provider (RESEND_API_KEY) on the server")}><Switch checked={n.email} onChange={(v) => setN({ email: v })} label={t("Email reminders")} /></Row>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label={t("Quiet hours start")}><input className="input" type="time" value={n.quietStart} onChange={(e) => e.target.value && setN({ quietStart: e.target.value })} aria-label={t("Quiet hours start")} /></Field>
            <Field label={t("Quiet hours end")}><input className="input" type="time" value={n.quietEnd} onChange={(e) => e.target.value && setN({ quietEnd: e.target.value })} aria-label={t("Quiet hours end")} /></Field>
            <Field label={t("Challenge reminder")}><input className="input" type="time" value={n.challengeTime} onChange={(e) => e.target.value && setN({ challengeTime: e.target.value })} aria-label={t("Challenge reminder")} /></Field>
            <Field label={t("Habit reminder")}><input className="input" type="time" value={n.habitTime} onChange={(e) => e.target.value && setN({ habitTime: e.target.value })} aria-label={t("Habit reminder")} /></Field>
          </div>
          <p className="mt-4 text-xs text-faint">{t("In-app reminders are generated from your real tasks and habits whenever you use Ukiyo. Background push/email delivery runs only when the server's scheduler (")}<code>/api/cron/notify</code>{t(") and provider keys are configured — see the setup guide.")}</p>
        </Card>

        <div className="space-y-[var(--gap)]">
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><KeyRound className="size-4" /> {t("Account")}</h2>
            {user.isDemo ? <p className="rounded-xl bg-card p-4 text-sm text-muted">{t("You're in ")}<b className="text-fg">{t("Demo Mode")}</b>{t(". Password changes, email verification, account deletion and push notifications are disabled.")} <Link href="/signup" className="text-accent underline">{t("Create a free account")}</Link>{t(" to unlock them.")}</p> : (
              <>
                <Row title={user.email} hint={t("Email address cannot be changed here")}><Badge tone={user.emailVerified ? "green" : "amber"}>{t(user.emailVerified ? "Verified" : "Unverified")}</Badge></Row>
                {!user.emailVerified && <Button size="sm" onClick={async () => { const r = await run(() => api<{ emailSent: boolean }>("/api/auth/resend", { body: {} })); if (r) toast(r.emailSent ? "success" : "info", r.emailSent ? "Verification email sent" : "Email delivery isn't configured on this server."); }}><Mail className="size-4" /> {t("Resend verification")}</Button>}
                <form className="mt-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api("/api/me/account", { body: { current: pw.current, next: pw.next } }), t("Password changed"))) setPw({ current: "", next: "" }); }}>
                  {user.hasPassword && <Field label={t("Current password")}><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} aria-label={t("Current password")} /></Field>}
                  <Field label={t(user.hasPassword ? "New password" : "Set a password")} hint={t("At least 8 characters")}><input className="input" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} aria-label={t("New password")} /></Field>
                  <Button type="submit" disabled={(user.hasPassword && !pw.current) || pw.next.length < 8}>{t(user.hasPassword ? "Change password" : "Set password")}</Button>
                </form>
              </>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><Music2 className="size-4" /> {t("Spotify & appearance")}</h2>
            <p className="text-sm text-muted">{t("Connection, ambience and playback options are in the ")}<Link href="/music" className="text-accent">{t("Music Hub")}</Link>. {t("Colors, gradients and fonts are in the ")}<Link href="/themes" className="text-accent">{t("Theme Studio")}</Link>.</p>
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"><Download className="size-4" /> {t("Your data")}</h2>
            <p className="mb-3 text-sm text-muted">{t("Download everything Ukiyo stores about you as JSON.")}</p>
            <a href="/api/export" className="glass-btn"><Download className="size-4" /> {t("Export my data")}</a>
          </Card>
          {!user.isDemo && <Card className="border-red-400/30"><h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-red-400"><ShieldAlert className="size-4" /> {t("Danger zone")}</h2><p className="mb-3 text-sm text-muted">{t("Permanently delete your account and all associated data. This can't be undone.")}</p><Button variant="danger" onClick={() => setDel(true)}><Trash2 className="size-4" /> {t("Delete account")}</Button></Card>}
        </div>
      </div>
      <Modal open={del} onClose={() => setDel(false)} title={t("Delete account")} footer={<><Button onClick={() => setDel(false)}>{t("Cancel")}</Button><Button variant="danger" disabled={!delPw} onClick={async () => { if (await run(() => api("/api/me/account", { method: "DELETE", body: { password: delPw } }))) window.location.href = "/signup"; }}>{t("Delete permanently")}</Button></>}>
        <p className="mb-3 text-sm text-muted">{t("All tasks, habits, goals, notes, journal entries and your profile will be erased. Enter your password to confirm.")}</p>
        <input className="input" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} aria-label={t("Password")} placeholder={t("Password")} />
      </Modal>
    </>
  );
}
