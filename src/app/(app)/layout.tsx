import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { getSessionUser } from "@/lib/server/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (!u.onboarded) redirect("/onboarding");
  return <AppShell>{children}</AppShell>;
}
