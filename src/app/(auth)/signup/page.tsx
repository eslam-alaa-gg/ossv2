"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthShell, GoogleSignInButton } from "@/components/auth";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client";
import { useApp } from "@/components/providers";

export default function SignupPage() {
  const { t } = useApp();
  const [f, setF] = useState({ displayName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const weak = f.password.length > 0 && f.password.length < 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/signup", { body: { ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      window.location.href = "/onboarding";
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t("Couldn't create the account."));
      setBusy(false);
    }
  }
  return (
    <AuthShell title="Create your workspace" subtitle="A private space for your tasks, habits and goals" footer={<>{t("Already have an account?")} <Link href="/login" className="font-medium text-accent">{t("Sign in")}</Link></>}>
      <GoogleSignInButton next="/onboarding" />
      <div className="my-5 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-[var(--border)]" /> {t("or use email")} <span className="h-px flex-1 bg-[var(--border)]" /></div>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("Display name")}><input className="input" required minLength={2} maxLength={40} autoComplete="name" value={f.displayName} onChange={set("displayName")} placeholder={t("Your name")} aria-label={t("Display name")} /></Field>
        <Field label={t("Email")}><input className="input" type="email" required autoComplete="email" value={f.email} onChange={set("email")} placeholder="you@example.com" aria-label={t("Email")} /></Field>
        <Field label={t("Password")} error={weak ? t("Use at least 8 characters") : null} hint={t("At least 8 characters")}>
          <input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set("password")} aria-label={t("Password")} />
        </Field>
        {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" className="h-11 w-full" loading={busy} disabled={!f.email || f.password.length < 8 || f.displayName.trim().length < 2}>{t("Create account")}</Button>
      </form>
    </AuthShell>
  );
}
