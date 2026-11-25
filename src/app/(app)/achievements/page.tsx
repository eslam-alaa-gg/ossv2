"use client";
import { Award, BookOpen, Brain, CalendarDays, Check, Compass, Crown, Flame, Flag, ListChecks, Lock, Medal, Repeat, Rocket, ShieldCheck, Sprout, Star, Target, Timer, Trophy, Zap, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "@/components/providers";
import { Badge, Card, ErrorState, ListSkeleton, PageHeader, Progress, Ring, cn } from "@/components/ui";
import { useFetch } from "@/lib/client";
import { fmtShort } from "@/lib/dates";

const ICONS: Record<string, LucideIcon> = { check: Check, list: ListChecks, trophy: Trophy, repeat: Repeat, flame: Flame, timer: Timer, brain: Brain, target: Target, zap: Zap, calendar: CalendarDays, medal: Medal, book: BookOpen, star: Star, rocket: Rocket, crown: Crown, sprout: Sprout, compass: Compass, shield: ShieldCheck, award: Award, flag: Flag };
type D = { xp: number; level: { level: number; into: number; span: number; next: number }; streak: { current: number; longest: number }; weeklyStreak: number; achievements: { key: string; title: string; desc: string; icon: string; xp: number; target: number; progress: number; unlockedAt: string | null }[]; xpHistory: { id: string; xp: number; label: string; createdAt: string }[] };

export default function AchievementsPage() {
  const { lang, t } = useApp();
  const { data, error, reload } = useFetch<D>("/api/achievements");
  if (error && !data) return <><PageHeader title={t("Achievement Journey")} /><ErrorState message={error} retry={reload} /></>;
  if (!data) return <><PageHeader title={t("Achievement Journey")} /><ListSkeleton /></>;
  const unlocked = data.achievements.filter((a) => a.unlockedAt);
  const upcoming = data.achievements.filter((a) => !a.unlockedAt).sort((a, b) => b.progress / b.target - a.progress / a.target);
  return (
    <>
      <PageHeader title={t("Achievement Journey")} subtitle={t("XP and badges are awarded by the server from verified activity only. Missing a day never costs you anything.")} />
      <div className="grid gap-[var(--gap)] md:grid-cols-3">
        <Card className="flex items-center gap-5 md:col-span-2">
          <Ring value={(100 * data.level.into) / data.level.span} size={116} stroke={9}><div><p className="text-[10px] uppercase tracking-widest text-faint">{t("Level")}</p><p className="text-3xl font-semibold">{data.level.level}</p></div></Ring>
          <div className="min-w-0 flex-1"><p className="text-2xl font-semibold tabular-nums">{data.xp.toLocaleString(lang === "ar" ? "ar-EG" : "en")} <span className="text-sm font-normal text-muted">{t("total XP")}</span></p><div className="mt-3"><Progress value={(100 * data.level.into) / data.level.span} /><p className="mt-1.5 text-xs text-muted">{data.level.span - data.level.into} {t("XP to level")} {data.level.level + 1}</p></div></div>
        </Card>
        <Card className="space-y-3"><div className="flex items-center gap-3"><Flame className="size-6 text-orange-400" /><div><p className="text-xl font-semibold">{data.streak.current} {t("day streak")}</p><p className="text-xs text-faint">{t("longest")} {data.streak.longest} {t("days")}</p></div></div><div className="flex items-center gap-3"><CalendarDays className="size-6 text-accent" /><div><p className="text-xl font-semibold">{data.weeklyStreak} {t("week streak")}</p><p className="text-xs text-faint">{t("weeks with any activity")}</p></div></div></Card>
      </div>
      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">{t("Unlocked badges")} ({unlocked.length})</h2>
      {unlocked.length === 0 ? <Card className="text-center text-sm text-muted">{t("No badges yet — complete a task, habit or focus session to earn your first.")}</Card> : (
        <div className="grid gap-[var(--gap)] sm:grid-cols-2 lg:grid-cols-3">{unlocked.map((a, i) => { const I = ICONS[a.icon] ?? Trophy; return <motion.div key={a.key} initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .35, delay: Math.min(i * .045, .35) }}><Card className="flex items-center gap-4"><motion.span animate={{ scale: [1, 1.07, 1], rotate: [0, 2, 0] }} transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 2.5 }} className="accent-fill grid size-12 shrink-0 place-items-center rounded-2xl text-[var(--on-accent)] shadow-lg"><I className="size-6" /></motion.span><div className="min-w-0"><p className="font-medium">{t(a.title)}</p><p className="text-xs text-muted">{t(a.desc)}</p><p className="mt-1 text-[11px] text-faint">{fmtShort(a.unlockedAt!.slice(0, 10), lang)}{a.xp ? ` · +${a.xp} XP` : ""}</p></div></Card></motion.div>; })}</div>
      )}
      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">{t("Upcoming")}</h2>
      <div className="grid gap-[var(--gap)] sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((a, i) => { const I = ICONS[a.icon] ?? Trophy; return <motion.div key={a.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: Math.min(i * .025, .25) }}><Card><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-muted"><Lock className="size-4" /></span><div className="min-w-0"><p className="text-sm font-medium">{t(a.title)}</p><p className="text-xs text-muted">{t(a.desc)}</p></div><I className="ms-auto size-5 shrink-0 text-accent" /></div><div className="mt-3 flex items-center gap-2"><Progress value={(100 * a.progress) / a.target} className="h-1.5 flex-1" /><span className="text-xs tabular-nums text-faint">{a.progress}/{a.target}</span></div></Card></motion.div>; })}</div>
      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">{t("Recent XP")}</h2>
      <Card pad={false}>{data.xpHistory.length === 0 ? <p className="p-5 text-sm text-muted">{t("XP will appear here as you complete things.")}</p> : <ul className="divide-y divide-[var(--border)]">{data.xpHistory.map((x) => <li key={x.id} className="flex items-center justify-between px-4 py-3 text-sm"><span className="min-w-0 truncate">{x.label ? t(x.label) : t("Reward")}</span><span className="flex shrink-0 items-center gap-3"><span className="text-xs text-faint">{fmtShort(x.createdAt.slice(0, 10), lang)}</span><Badge tone="accent" className={cn("tabular-nums")}>+{x.xp}</Badge></span></li>)}</ul>}</Card>
    </>
  );
}
