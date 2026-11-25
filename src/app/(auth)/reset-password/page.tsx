"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client";

function Inner() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset", { body: { token, password: pw } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset the password.");
    }
    setBusy(false);
  }
  return (
    <AuthShell title="Choose a new password" footer={<Link href="/login" className="font-medium text-accent">Back to sign in</Link>}>
      {!token ? <p className="text-sm text-red-300">This link is missing its token. Request a new reset email.</p> : done ? (
        <p className="text-sm" role="status">Password updated. All other sessions were signed out. <Link href="/login" className="font-medium text-accent">Sign in</Link></p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint="At least 8 characters"><input className="input" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password" /></Field>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <Button type="submit" variant="primary" className="h-11 w-full" loading={busy} disabled={pw.length < 8}>Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}
export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
