"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthShell, GoogleSignInButton } from "@/components/auth";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email, password } });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your private workspace" footer={<>New to LIFE OS? <Link href="/signup" className="font-medium text-accent">Create an account</Link></>}>
      <GoogleSignInButton next="/dashboard" />
      <div className="my-5 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-[var(--border)]" /> or use email <span className="h-px flex-1 bg-[var(--border)]" /></div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" aria-label="Password" />
        </Field>
        <div className="text-end text-xs"><Link href="/forgot-password" className="text-muted hover:text-fg">Forgot password?</Link></div>
        {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" className="h-11 w-full" loading={busy} disabled={!email || !password}>Sign In</Button>
      </form>
    </AuthShell>
  );
}
