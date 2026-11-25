"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="accent-fill mb-4 grid size-12 place-items-center rounded-2xl text-lg font-bold text-[var(--on-accent)] shadow-xl">L</span>
          <p className="text-xs font-semibold tracking-[0.3em] text-muted">LIFE OS</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="glass card-pad" style={{ padding: "1.5rem" }}>{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        <p className="mt-8 text-center text-xs text-faint">Your Life. Your Goals. Your Progress.</p>
      </motion.div>
    </div>
  );
}

export function GoogleSignInButton({ next = "/dashboard" }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signIn() {
    setBusy(true); setError(null);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Google sign-in is not configured yet.");
      const supabase = createBrowserClient(url, key);
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { access_type: "online", prompt: "select_account" } } });
      if (authError) throw authError;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in could not start.");
      setBusy(false);
    }
  }
  return <div className="space-y-2">
    <button type="button" onClick={signIn} disabled={busy} className="glass-btn h-11 w-full justify-center disabled:opacity-60">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.16v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.85 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.35-2.11V7.05H2.16A11 11 0 0 0 1 12c0 1.78.43 3.46 1.16 4.95l3.69-2.84Z"/><path fill="#EA4335" d="M12 5.36c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 2.1 14.97 1 12 1a11 11 0 0 0-9.84 6.05l3.69 2.84C6.72 7.29 9.14 5.36 12 5.36Z"/></svg>
      {busy ? "Connecting to Google…" : "Continue with Google"}
    </button>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
  </div>;
}
