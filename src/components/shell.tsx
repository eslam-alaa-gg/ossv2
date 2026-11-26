"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bell, BookMarked, BookOpen, CalendarCheck, CalendarDays, Check, CheckSquare, ChevronsLeft, ChevronsRight, Droplets, Languages, LayoutDashboard, Lightbulb, LogOut, Minus, Music2, Palette, Plus, Repeat, Search, Settings, Target, Timer,
  Trophy, User as UserIcon, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, useFetch } from "@/lib/client";
import { Avatar } from "./avatar";
import { useApp } from "./providers";
import { SpotifyProvider } from "./spotify";
import { Button, Modal, cn, useUI } from "./ui";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, primary: true },
  { href: "/habits", label: "Habits", icon: Repeat, primary: true },
  { href: "/challenge", label: "Daily Challenge", icon: Zap },
  { href: "/focus", label: "Focus Room", icon: Timer, primary: true },
  { href: "/goals", label: "Life Goals", icon: Target },
  { href: "/vault", label: "Memory Vault", icon: BookMarked },
  { href: "/achievements", label: "Achievement Journey", icon: Trophy },
  { href: "/review", label: "Weekly Review", icon: CalendarCheck },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/music", label: "Music Hub", icon: Music2 },
  { href: "/music-bridge", label: "Music Detection", icon: Music2 },
  { href: "/themes", label: "Theme Studio", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function useSignOut() {
  return useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }, []);
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  const { t } = useApp();
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2" aria-label={t("Ukiyo home")}>
      <span className="accent-fill grid size-9 place-items-center rounded-xl text-sm font-bold text-[var(--on-accent)] shadow-lg">U</span>
      {!collapsed && <span className="text-[15px] font-semibold tracking-[0.14em]">Ukiyo</span>}
    </Link>
  );
}

function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (b: boolean) => void }) {
  const path = usePathname();
  const { t } = useApp();
  return (
    <aside className={cn("glass-panel fixed inset-y-3 start-3 z-40 hidden flex-col rounded-[var(--radius-lg)] p-3 transition-[width] duration-300 lg:flex", collapsed ? "w-[68px]" : "w-[248px]")} aria-label={t("Primary")}>
      <div className="mb-4 mt-1 flex items-center justify-between">
        <Brand collapsed={collapsed} />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {NAV.map((n) => {
          const active = path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} title={collapsed ? t(n.label) : undefined} aria-current={active ? "page" : undefined} className={cn("nav-link", active && "nav-active", collapsed && "justify-center px-0")}>
              <n.icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{t(n.label)}</span>}
            </Link>
          );
        })}
      </nav>
      <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")} className="mt-2 justify-start">
        {collapsed ? <ChevronsRight className="size-4 rtl:rotate-180" /> : <><ChevronsLeft className="size-4 rtl:rotate-180" /> <span className="text-muted">{t("Collapse")}</span></>}
      </Button>
      <SidebarUser collapsed={collapsed} />
    </aside>
  );
}

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { user, t } = useApp();
  if (!user) return null;
  return (
    <Link href="/profile" className="mt-2 flex items-center gap-3 rounded-[calc(var(--radius)*.6)] p-2 transition-colors hover:bg-card" aria-label={t("Open profile")}>
      <Avatar size={34} ring />
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.displayName}</span>
          <span className="block truncate text-xs text-faint">{user.email}</span>
        </span>
      )}
    </Link>
  );
}

function ProfileMenu() {
  const { user, t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const signOut = useSignOut();
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  if (!user) return null;
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-card";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={t("Account menu")} className="header-icon-btn rounded-full transition-transform active:scale-95">
        <Avatar size={36} ring />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="popover absolute end-0 top-12 z-50 w-64 p-2">
            <div className="flex items-center gap-3 border-b border-line p-3">
              <Avatar size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-xs text-faint">{user.isDemo ? t("Demo account") : user.email}</p>
              </div>
            </div>
            <div className="py-1" onClick={() => setOpen(false)}>
              <Link href="/profile" role="menuitem" className={item}><UserIcon className="size-4" /> {t("Profile")}</Link>
              <Link href="/settings" role="menuitem" className={item}><Settings className="size-4" /> {t("Settings")}</Link>
              <Link href="/themes" role="menuitem" className={item}><Palette className="size-4" /> {t("Theme Studio")}</Link>
              <button role="menuitem" onClick={signOut} className={cn(item, "text-red-400")}><LogOut className="size-4" /> {t("Sign out")}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Notif = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string; kind: string };
function Bell_() {
  const { t } = useApp();
  const { data, reload } = useFetch<{ items: Notif[]; unread: number }>("/api/notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const i = setInterval(reload, 90000);
    return () => clearInterval(i);
  }, [reload]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const markAll = async () => { await api("/api/notifications", { method: "POST", body: { all: true } }); reload(); };
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" className="header-icon-btn h-9 w-9" title={t("Notifications")} aria-label={`${t("Notifications")}${data?.unread ? `, ${data.unread} ${t("unread")}` : ""}`} onClick={() => { setOpen(!open); if (!open) reload(); }}>
        <Bell className="size-[19px]" />
        {!!data?.unread && <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-[var(--on-accent)]">{data.unread}</span>}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="popover absolute end-0 top-12 z-50 w-[min(92vw,22rem)] p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold">{t("Notifications")}</p>
              {!!data?.unread && <button onClick={markAll} className="text-xs text-accent">{t("Mark all read")}</button>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!data?.items.length && <p className="px-3 py-8 text-center text-sm text-muted">{t("You're all caught up.")}</p>}
              {data?.items.map((n) => (
                <button key={n.id} onClick={async () => { await api("/api/notifications", { method: "POST", body: { id: n.id } }); setOpen(false); reload(); if (n.href) router.push(n.href); }} className="flex w-full gap-3 rounded-lg px-3 py-2.5 text-start hover:bg-card">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t(n.title)}</span>
                    {n.body && <span className="block truncate text-xs text-muted">{n.kind === "habit_reminder" ? (n.body.startsWith("تذكّر عادتك: ") ? n.body : `${t("Remember your habit:")} ${t(n.body.replace("Remember your habit: ", ""))}`) : n.kind === "challenge_reminder" ? t(n.body) : n.body}</span>}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------- command menu ----------------------------- */
function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ kind: string; title: string; href: string }[]>([]);
  const [sel, setSel] = useState(0);
  const signOut = useSignOut();
  const actions = [
    { kind: "Action", title: "Create Task", href: "/tasks?new=1" },
    { kind: "Action", title: "Add Habit", href: "/habits?new=1" },
    { kind: "Action", title: "Create Note", href: "/vault?new=1" },
    { kind: "Action", title: "Add Goal", href: "/goals?new=1" },
    { kind: "Action", title: "Start Focus", href: "/focus" },
    ...NAV.map((n) => ({ kind: "Go to", title: n.label, href: n.href })),
    { kind: "Account", title: "Profile", href: "/profile" },
  ];
  useEffect(() => {
    if (!open) { setQ(""); setResults([]); }
  }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const h = setTimeout(() => api<{ results: typeof results }>(`/api/search?q=${encodeURIComponent(q)}`).then((r) => setResults(r.results)).catch(() => {}), 200);
    return () => clearTimeout(h);
  }, [q]);
  const filtered = actions.filter((a) => !q || t(a.title).toLowerCase().includes(q.toLowerCase()) || a.title.toLowerCase().includes(q.toLowerCase()));
  const all = [...filtered, ...results];
  useEffect(() => setSel(0), [q]);
  const go = (href: string) => { onClose(); router.push(href); };
  return (
    <Modal open={open} onClose={onClose} title={t("Command menu")}>
      <input className="input" placeholder={t("Search or jump to…")} aria-label={t("Search")} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, all.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
        if (e.key === "Enter" && all[sel]) go(all[sel].href);
      }} />
      <ul className="mt-3 max-h-80 space-y-0.5 overflow-y-auto" role="listbox">
        {all.map((a, i) => (
          <li key={a.kind + a.title + i}>
            <button role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(a.href)} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm", i === sel && "bg-card")}>
              <span className="truncate">{a.kind === "Action" || a.kind === "Go to" || a.kind === "Account" ? t(a.title) : a.title}</span>
              <span className="chip">{t(a.kind)}</span>
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && !all.length && <li className="py-6 text-center text-sm text-muted">{t("No results")}</li>}
        <li><button onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-card"><LogOut className="size-4" /> {t("Sign out")}</button></li>
      </ul>
    </Modal>
  );
}


type QuickHabit = { id: string; name: string; icon: string; kind: "standard" | "water" | "reading" | "learning"; target: number; todayAmount: number; todayDone: boolean; unit: string };
type QuickTrackers = { today: string; water: { goal: number; total: number }; reading: { target: number; todayPages: number }; learning: { target: number; todayCount: number } };

function HabitQuickPanel() {
  const { t } = useApp();
  const { run, toast } = useUI();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [habits, setHabits] = useState<QuickHabit[]>([]);
  const [tracker, setTracker] = useState<QuickTrackers | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, tr] = await Promise.all([
        api<{ habits: QuickHabit[] }>("/api/habits"),
        api<QuickTrackers>("/api/trackers"),
      ]);
      setHabits(h.habits);
      setTracker(tr);
    } catch {
      // The quick panel remains usable when a refresh fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!open) return;
    void load();
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open, load]);

  const water = habits.find((h) => h.kind === "water");
  const reading = habits.find((h) => h.kind === "reading");
  const learning = habits.find((h) => h.kind === "learning");
  const standard = habits.filter((h) => h.kind === "standard");
  const cup = 250;
  const waterAmount = tracker?.water.total ?? 0;
  const waterGoal = tracker?.water.goal ?? 0;

  const logStandard = async (h: QuickHabit) => {
    if (busyId) return;
    setBusyId(h.id);
    try {
      const next = h.target === 1 ? (h.todayDone ? 0 : 1) : Math.min(h.target, h.todayAmount + 1);
      const r = await run(() => api<{ completed: boolean }>(`/api/habits/${h.id}/log`, { body: { amount: next } }));
      if (r) {
        if (r.completed) toast("success", t("Habit complete"));
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const addWater = async () => {
    if (busyId) return;
    setBusyId("water");
    try {
      if (await run(() => api("/api/trackers/water", { body: { ml: cup } }), t("Water logged"))) await load();
    } finally { setBusyId(null); }
  };

  const openTracker = (tab: "reading" | "learning") => {
    setOpen(false);
    router.push(`/habits?tab=${tab}`);
  };

  const HabitButton = ({ id, name, icon, amount, target, done, onClick, disabled }: {
    id: string; name: string; icon: string; amount: number; target: number; done?: boolean; onClick: () => void; disabled?: boolean;
  }) => {
    const pct = target > 0 ? Math.min(100, (amount / target) * 100) : 0;
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const complete = done ?? (target > 0 && amount >= target);
    return (
      <button
        key={id}
        type="button"
        onClick={onClick}
        disabled={disabled || complete}
        title={`${t(name)} · ${amount}/${target}`}
        aria-label={`${t(name)}: ${amount} / ${target}`}
        className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
      >
        <span className="relative grid size-12 place-items-center">
          <svg viewBox="0 0 48 48" className="absolute inset-0 size-12 -rotate-90" aria-hidden="true">
            <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,.17)" strokeWidth="3" />
            <circle cx="24" cy="24" r={radius} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-300" />
          </svg>
          <span className={cn("grid size-9 place-items-center rounded-full transition-transform", complete ? "text-accent" : "text-white/90 group-hover:scale-110")}>
            {icon === "water" ? <Droplets className="size-5" /> : icon === "reading" ? <BookOpen className="size-5" /> : icon === "learning" ? <Lightbulb className="size-5" /> : <HabitIcon name={icon} className="size-5" />}
          </span>
          {complete && <Check className="absolute -end-0.5 -top-0.5 size-3.5 rounded-full bg-[var(--accent)] p-0.5 text-[var(--on-accent)]" />}
        </span>
        <span className="max-w-full truncate text-[11px] text-white/85">{t(name)}</span>
        <span className="text-[10px] tabular-nums text-white/55">{amount}/{target}</span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="header-icon-btn grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-transparent text-current transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        aria-label={t("Habit quick tracker")}
        title={t("Habit quick tracker")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="habit-quick-panel"
      >
        <Droplets className="size-[22px] stroke-[2.1]" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="habit-quick-panel"
            role="dialog"
            aria-label={t("Quick habit tracker")}
            initial={{ opacity: 0, y: -7, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: .98 }}
            transition={{ duration: .16 }}
            className="absolute start-0 top-[calc(100%+0.65rem)] z-[80] w-[min(calc(100vw-2rem),320px)] overflow-hidden rounded-2xl border border-white/15 p-3 shadow-2xl"
            style={{ background: "rgba(12, 12, 20, .66)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)" }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-semibold text-white">{t("Quick habit tracker")}</p>
                <p className="text-[11px] text-white/55">{t("Your daily targets")}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("Close")} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"><X className="size-4" /></button>
            </div>
            {loading && !tracker ? <p className="py-5 text-center text-xs text-white/60">{t("Loading…")}</p> : (
              <div className="grid grid-cols-3 gap-1">
                {tracker && water && (
                  <HabitButton id="water" name="Drink Water" icon="water" amount={Math.floor(waterAmount / cup)} target={Math.max(1, Math.ceil(waterGoal / cup))} onClick={addWater} disabled={!!busyId || waterAmount >= waterGoal} />
                )}
                {reading && tracker && (
                  <HabitButton id={reading.id} name={reading.name} icon="reading" amount={tracker.reading.todayPages} target={reading.target} onClick={() => openTracker("reading")} />
                )}
                {learning && tracker && (
                  <HabitButton id={learning.id} name={learning.name} icon="learning" amount={tracker.learning.todayCount} target={learning.target} onClick={() => openTracker("learning")} />
                )}
                {standard.map((h) => (
                  <HabitButton key={h.id} id={h.id} name={h.name} icon={h.icon} amount={h.todayAmount} target={h.target} done={h.todayDone} onClick={() => void logStandard(h)} disabled={!!busyId || (h.target > 1 && h.todayAmount >= h.target)} />
                ))}
                {!habits.length && <p className="col-span-3 py-5 text-center text-xs text-white/60">{t("Add a habit with a daily target to see it here.")}</p>}
              </div>
            )}
            <div className="mt-2 border-t border-white/15 pt-2">
              <Link href="/habits" onClick={() => setOpen(false)} className="block rounded-lg py-1.5 text-center text-xs text-white/80 transition-colors hover:bg-white/10">{t("Open all habits")}</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { t, lang, patchUser } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);
  useEffect(() => { setCollapsed(localStorage.getItem("ukiyo.sidebar") === "1"); }, []);
  const toggle = (b: boolean) => { setCollapsed(b); localStorage.setItem("ukiyo.sidebar", b ? "1" : "0"); };
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <SpotifyProvider>
      <Sidebar collapsed={collapsed} setCollapsed={toggle} />
      <div className={cn("min-h-dvh transition-[padding] duration-300", collapsed ? "lg:ps-[92px]" : "lg:ps-[272px]")}>
        <header className="app-topbar glass-panel sticky top-2 z-30 mx-auto mt-2 flex h-[54px] w-[calc(100%-1.25rem)] max-w-[1120px] items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4 lg:px-5">
          <button onClick={() => setCmd(true)} className="header-icon-btn glass-btn btn-ghost btn-icon h-9 w-9 shrink-0" aria-label={t("Open command menu")} title={t("Search")}>
            <Search className="size-[19px]" />
          </button>
          <HabitQuickPanel />
          <div className="ms-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => patchUser({ language: lang === "ar" ? "en" : "ar" })} className="header-icon-btn glass-btn btn-ghost btn-icon h-9 w-9" aria-label={lang === "ar" ? t("Switch to English") : t("Switch to Arabic")} title={lang === "ar" ? t("English") : t("Arabic")}><Languages className="size-[19px]" /></button>
            <Link href="/tasks?new=1" className="glass-btn btn-primary btn-sm hidden h-10 sm:inline-flex"><Plus className="size-4" /> {t("Create Task")}</Link>
            <Bell_ />
            <ProfileMenu />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pb-32 pt-2 sm:px-6 lg:px-8 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* A single dashboard control opens the same vertical navigation used on desktop. */}
      <nav aria-label={t("Mobile dashboard menu")} className="pb-safe fixed inset-x-0 bottom-3 z-40 flex justify-center px-4 lg:hidden">
        <button onClick={() => setDrawer(true)} aria-label={t("Open dashboard navigation")} aria-expanded={drawer} className="glass-panel flex h-12 min-w-[176px] items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold shadow-xl">
          <LayoutDashboard className="size-[18px]" />
          <span>{t("Dashboard")}</span>
        </button>
      </nav>
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label={t("Close navigation")} className="absolute inset-0 backdrop-blur-sm" style={{ background: "var(--overlay)" }} onClick={() => setDrawer(false)} />
            <motion.aside
              initial={{ x: lang === "ar" ? 300 : -300 }}
              animate={{ x: 0 }}
              exit={{ x: lang === "ar" ? 300 : -300 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass-panel absolute inset-y-0 start-0 flex w-[min(84vw,290px)] flex-col p-3 shadow-2xl"
              aria-label={t("Primary")}
            >
              <div className="mb-4 mt-1 flex items-center justify-between gap-2">
                <Brand />
                <Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label={t("Close navigation")}><X className="size-5" /></Button>
              </div>
              <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
                {NAV.map((n) => {
                  const active = path === n.href || path.startsWith(n.href + "/");
                  return (
                    <Link key={n.href} href={n.href} onClick={() => setDrawer(false)} aria-current={active ? "page" : undefined} className={cn("nav-link min-h-11", active && "nav-active")}>
                      <n.icon className="size-[18px] shrink-0" />
                      <span className="truncate">{t(n.label)}</span>
                    </Link>
                  );
                })}
              </nav>
              <SidebarUser collapsed={false} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <CommandMenu open={cmd} onClose={() => setCmd(false)} />
    </SpotifyProvider>
  );
}
void useUI;
