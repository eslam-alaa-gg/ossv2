"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { translate, type Lang } from "@/lib/i18n";
import { DEFAULT_PREFS, type Prefs } from "@/lib/prefs";
import { PRESETS, themeCss, type Theme } from "@/lib/theme";
import type { PublicUser } from "@/lib/types";
import { UIProvider } from "./ui";

type Ctx = {
  user: PublicUser | null;
  prefs: Prefs;
  theme: Theme;
  lang: Lang;
  t: (s: string) => string;
  setDraft: (t: Theme | null) => void;
  hasDraft: boolean;
  refresh: () => Promise<void>;
  patchUser: (f: Partial<Pick<PublicUser, "displayName" | "language" | "timezone" | "dailyGoal" | "onboarded">>) => Promise<void>;
  savePrefs: (p: Partial<Prefs>) => Promise<void>;
  setAvatarVersion: (v: number | null) => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function AppProvider({ initialUser, initialPrefs, initialLang = "en", children }: { initialUser: PublicUser | null; initialPrefs: Prefs; initialLang?: Lang; children: ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs ?? DEFAULT_PREFS);
  const [draft, setDraft] = useState<Theme | null>(null);
  const theme = draft ?? prefs.theme;
  const lang: Lang = user ? (user.language === "ar" ? "ar" : "en") : initialLang;

  // keep in sync with server-rendered data after router refreshes / login changes
  useEffect(() => setUser(initialUser), [initialUser]);
  useEffect(() => setPrefs(initialPrefs), [initialPrefs]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const mode = theme.mode === "system" ? (mq.matches ? "dark" : "light") : theme.mode;
      root.dataset.mode = mode;
      const preset = PRESETS.find((item) => item.id === theme.preset) ?? PRESETS[0];
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "light" ? preset.l.bg : preset.d.bg);
    };
    apply();
    root.dataset.motion = theme.reducedMotion || theme.animation === 0 ? "off" : "on";
    if (theme.mode === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme.mode, theme.preset, theme.reducedMotion, theme.animation]);

  const refresh = useCallback(async () => {
    const r = await api<{ user: PublicUser; prefs: Prefs }>("/api/me");
    setUser(r.user);
    setPrefs(r.prefs);
  }, []);
  const patchUser: Ctx["patchUser"] = useCallback(async (f) => {
    const r = await api<{ user: PublicUser }>("/api/me", { method: "PATCH", body: f });
    setUser(r.user);
  }, []);
  const savePrefs: Ctx["savePrefs"] = useCallback(async (p) => {
    const r = await api<{ prefs: Prefs }>("/api/me/prefs", { method: "PATCH", body: p });
    setPrefs(r.prefs);
    if (p.theme) setDraft(null);
  }, []);
  const setAvatarVersion = useCallback((v: number | null) => setUser((u) => (u ? { ...u, avatarVersion: v } : u)), []);
  const t = useCallback((s: string) => translate(lang, s), [lang]);
  const css = useMemo(() => themeCss(theme), [theme]);

  const value = useMemo<Ctx>(
    () => ({ user, prefs, theme, lang, t, setDraft, hasDraft: !!draft, refresh, patchUser, savePrefs, setAvatarVersion }),
    [user, prefs, theme, lang, t, draft, refresh, patchUser, savePrefs, setAvatarVersion],
  );
  return (
    <AppCtx.Provider value={value}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <UIProvider lang={lang}>{children}</UIProvider>
    </AppCtx.Provider>
  );
}
