"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth";
import { api } from "@/lib/client";
import { useApp } from "@/components/providers";
import { translateError } from "@/lib/i18n";

function Inner() {
  const { t, lang } = useApp();
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"loading" | "ok" | "error" | "none">(token ? "loading" : "none");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!token) return;
    api("/api/auth/verify", { body: { token } }).then(() => setState("ok")).catch((e) => { setMsg(translateError(lang, e.message)); setState("error"); });
  }, [token]);
  return (
    <AuthShell title="Email verification" footer={<Link href="/dashboard" className="font-medium text-accent">{t("Continue to LIFE OS")}</Link>}>
      <div role="status" className="text-center text-sm">
        {state === "loading" && <Loader2 className="mx-auto size-6 animate-spin" />}
        {state === "ok" && <p>{t("Your email is verified. Thank you!")}</p>}
        {state === "error" && <p className="text-red-300">{msg}</p>}
        {state === "none" && <p className="text-muted">{t("Open the verification link from your email. You can resend it from Settings → Account.")}</p>}
      </div>
    </AuthShell>
  );
}
export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
