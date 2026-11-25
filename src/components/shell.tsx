"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bell, BookMarked, CalendarCheck, CalendarDays, CheckSquare, ChevronsLeft, ChevronsRight, Languages, LayoutDashboard, LogOut, Menu, Music2, Palette, Plus, Repeat, Search, Settings, Target, Timer,
  Trophy, User as UserIcon, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2" aria-label="LIFE OS home">
      <span className="accent-fill grid size-9 place-items-center rounded-xl text-sm font-bold text-[var(--on-accent)] shadow-lg">L</span>
      {!collapsed && <span className="text-[15px] font-semibold tracking-[0.14em]">LIFE OS</span>}
    </Link>
  );
}

function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (b: boolean) => void }) {
  const path = usePathname();
  const { t } = useApp();
  return (
    <aside className={cn("glass-panel fixed inset-y-3 start-3 z-40 hidden flex-col rounded-[var(--radius-lg)] p-3 transition-[width] duration-300 lg:flex", collapsed ? "w-[68px]" : "w-[248px]")} aria-label="Primary">
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
      <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="mt-2 justify-start">
        {collapsed ? <ChevronsRight className="size-4 rtl:rotate-180" /> : <><ChevronsLeft className="size-4 rtl:rotate-180" /> <span className="text-muted">Collapse</span></>}
      </Button>
      <SidebarUser collapsed={collapsed} />
    </aside>
  );
}

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { user } = useApp();
  if (!user) return null;
  return (
    <Link href="/profile" className="mt-2 flex items-center gap-3 rounded-[calc(var(--radius)*.6)] p-2 transition-colors hover:bg-card" aria-label="Open profile">
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
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className="header-icon-btn rounded-full transition-transform active:scale-95">
        <Avatar size={46} ring />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="popover absolute end-0 top-12 z-50 w-64 p-2">
            <div className="flex items-center gap-3 border-b border-line p-3">
              <Avatar size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-xs text-faint">{user.isDemo ? "Demo account" : user.email}</p>
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
      <Button variant="ghost" size="icon" className="header-icon-btn h-10 w-10" title="Notifications" aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`} onClick={() => { setOpen(!open); if (!open) reload(); }}>
        <Bell className="size-[19px]" />
        {!!data?.unread && <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-[var(--on-accent)]">{data.unread}</span>}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="popover absolute end-0 top-12 z-50 w-[min(92vw,22rem)] p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold">Notifications</p>
              {!!data?.unread && <button onClick={markAll} className="text-xs text-accent">Mark all read</button>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!data?.items.length && <p className="px-3 py-8 text-center text-sm text-muted">You're all caught up.</p>}
              {data?.items.map((n) => (
                <button key={n.id} onClick={async () => { await api("/api/notifications", { method: "POST", body: { id: n.id } }); setOpen(false); reload(); if (n.href) router.push(n.href); }} className="flex w-full gap-3 rounded-lg px-3 py-2.5 text-start hover:bg-card">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
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
    <Modal open={open} onClose={onClose} title="Command menu">
      <input className="input" placeholder="Search or jump to…" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, all.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
        if (e.key === "Enter" && all[sel]) go(all[sel].href);
      }} />
      <ul className="mt-3 max-h-80 space-y-0.5 overflow-y-auto" role="listbox">
        {all.map((a, i) => (
          <li key={a.kind + a.title + i}>
            <button role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(a.href)} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm", i === sel && "bg-card")}>
              <span className="truncate">{a.kind === "Action" || a.kind === "Go to" || a.kind === "Account" ? t(a.title) : a.title}</span>
              <span className="chip">{a.kind}</span>
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && !all.length && <li className="py-6 text-center text-sm text-muted">No results</li>}
        <li><button onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-card"><LogOut className="size-4" /> {t("Sign out")}</button></li>
      </ul>
    </Modal>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { t, lang, patchUser } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);
  useEffect(() => { setCollapsed(localStorage.getItem("lifeos.sidebar") === "1"); }, []);
  const toggle = (b: boolean) => { setCollapsed(b); localStorage.setItem("lifeos.sidebar", b ? "1" : "0"); };
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  const mobilePrimary = NAV.filter((n) => n.primary);
  return (
    <SpotifyProvider>
      <Sidebar collapsed={collapsed} setCollapsed={toggle} />
      <div className={cn("min-h-dvh transition-[padding] duration-300", collapsed ? "lg:ps-[92px]" : "lg:ps-[272px]")}>
        <header className="app-topbar glass-panel sticky top-2 z-30 mx-3 flex items-center gap-2 px-3 py-2.5 sm:mx-5 sm:gap-3 sm:px-4 lg:mx-6 lg:pe-6">
          <button onClick={() => setCmd(true)} className="header-icon-btn glass-btn btn-ghost btn-icon h-10 w-10 shrink-0" aria-label="Open command menu" title={t("Search")}>
            <Search className="size-[19px]" />
          </button>
          <div className="ms-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => patchUser({ language: lang === "ar" ? "en" : "ar" })} className="header-icon-btn glass-btn btn-ghost btn-icon h-10 w-10" aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"} title={lang === "ar" ? "English" : "العربية"}><Languages className="size-[19px]" /></button>
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

      {/* mobile floating pill navigation */}
      <nav aria-label="Mobile" className="pb-safe fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 lg:hidden">
        <div className="glass-panel flex w-full max-w-md items-center justify-between gap-1 rounded-full p-1.5">
          {mobilePrimary.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} aria-label={t(n.label)} className={cn("flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium transition-all", active ? "bg-accent px-4 text-[var(--on-accent)]" : "text-muted")}>
                <n.icon className="size-5" />
                {active && <span className="max-w-[5.5rem] truncate">{t(n.label)}</span>}
              </Link>
            );
          })}
          <button onClick={() => setDrawer(true)} aria-label={t("More")} className="flex h-12 flex-1 items-center justify-center rounded-full text-muted"><Menu className="size-5" /></button>
        </div>
      </nav>
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "var(--overlay)" }} onClick={() => setDrawer(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="popover pb-safe absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-b-none p-4" style={{ borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}>
              <div className="mb-3 flex items-center justify-between"><Brand /><Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="size-5" /></Button></div>
              <div className="grid grid-cols-3 gap-2">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-card p-3 text-center text-xs", path === n.href && "nav-active")}>
                    <n.icon className="size-5" /> <span className="leading-tight">{t(n.label)}</span>
                  </Link>
                ))}
                <Link href="/profile" className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-card p-3 text-center text-xs"><UserIcon className="size-5" />{t("Profile")}</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <CommandMenu open={cmd} onClose={() => setCmd(false)} />
    </SpotifyProvider>
  );
}
void useUI;
