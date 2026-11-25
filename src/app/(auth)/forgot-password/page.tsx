"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ done: boolean; configured?: boolean }>({ done: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ emailConfigured: boolean }>("/api/auth/forgot", { body: { email } });
      setState({ done: true, configured: r.emailConfigured });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setBusy(false);
  }
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure reset link" footer={<Link href="/login" className="font-medium text-accent">Back to sign in</Link>}>
      {state.done ? (
        <div className="space-y-2 text-sm" role="status">
          <p>If an account exists for <b>{email}</b>, a reset link has been sent.</p>
          {!state.configured && <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-300">Email delivery isn't configured on this server (RESEND_API_KEY missing), so no email can be sent. See the setup guide.</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" /></Field>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <Button type="submit" variant="primary" className="h-11 w-full" loading={busy} disabled={!email}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
