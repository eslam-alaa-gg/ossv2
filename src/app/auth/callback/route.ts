import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/server/auth";
import { DEFAULT_PREFS } from "@/lib/prefs";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes(String.fromCharCode(92))) return "/dashboard";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!code || !url || !key) return NextResponse.redirect(new URL("/login?error=google", requestUrl.origin));

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const identity = data.user?.identities?.find((item) => item.provider === "google");
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !data.user || !identity || !email || !data.user.email_confirmed_at) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return NextResponse.redirect(new URL("/login?error=google", requestUrl.origin));
  }

  let appUser = (await db.select().from(users).where(eq(users.googleAuthId, data.user.id)).limit(1))[0];
  if (!appUser) {
    const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (existing) {
      if (!existing.emailVerified || (existing.googleAuthId && existing.googleAuthId !== data.user.id)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        return NextResponse.redirect(new URL("/login?error=account-link", requestUrl.origin));
      }
      [appUser] = await db.update(users).set({ googleAuthId: data.user.id, emailVerified: true, updatedAt: new Date() }).where(and(eq(users.id, existing.id), eq(users.email, email))).returning();
    } else {
      const metadataName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : "";
      const displayName = metadataName.trim().replace(/\\s+/g, " ").slice(0, 40) || email.split("@")[0].slice(0, 40) || "Google User";
      [appUser] = await db.insert(users).values({
        email,
        passwordHash: hashPassword(randomBytes(32).toString("hex")),
        googleAuthId: data.user.id,
        displayName,
        emailVerified: true,
        hasPassword: false,
        preferences: DEFAULT_PREFS,
      }).returning();
    }
  }

  if (!appUser) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return NextResponse.redirect(new URL("/login?error=google", requestUrl.origin));
  }

  await createSession(appUser.id);
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return NextResponse.redirect(new URL(appUser.onboarded ? (next === "/onboarding" ? "/dashboard" : next) : "/onboarding", requestUrl.origin));
}
