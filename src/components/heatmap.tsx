"use client";
import { useMemo, useState } from "react";
import { addDays, fmtLong, parseD } from "@/lib/dates";
import { useApp } from "./providers";
import { cn } from "./ui";

export type HeatDay = { date: string; score: number; level: number; tasks: number; habits: number; challenges: number; focus: number; focusMinutes: number; milestones: number };

export function Heatmap({ year, days, today, goal }: { year: number; days: HeatDay[]; today: string; goal: number }) {
  const { lang } = useApp();
  const [tip, setTip] = useState<HeatDay | null>(null);
  const map = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const weeks = useMemo(() => {
    const start = `${year}-01-01`;
    const dow = (parseD(start).getUTCDay() + 6) % 7; // Monday first
    const first = addDays(start, -dow);
    const cols: string[][] = [];
    for (let w = 0; w < 54; w++) {
      const col = Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i));
      if (col[0] > `${year}-12-31`) break;
      cols.push(col);
    }
    return cols;
  }, [year]);
  const months = weeks.map((c, i) => { const d = c.find((x) => x.startsWith(String(year))); return d && d.slice(8) <= "07" && (i === 0 || weeks[i - 1].find((x) => x.startsWith(String(year)))?.slice(5, 7) !== d.slice(5, 7)) ? new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" }).format(parseD(d)) : ""; });
  const detail = (d: HeatDay | undefined, date: string) => d ? `${fmtLong(date, lang)}: ${d.score} pts — ${d.tasks} tasks, ${d.habits} habits, ${d.challenges} challenges, ${d.focus} focus sessions (${d.focusMinutes} min), ${d.milestones} milestones` : `${fmtLong(date, lang)}: no activity`;
  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-max" onMouseLeave={() => setTip(null)}>
          <div className="mb-1 flex gap-[3px] ps-0 text-[10px] text-faint">{months.map((m, i) => <span key={i} className="w-3 overflow-visible whitespace-nowrap">{m}</span>)}</div>
          <div className="flex gap-[3px]" role="grid" aria-label={`Contribution heatmap for ${year}`}>
            {weeks.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]" role="row">
                {col.map((date) => {
                  const inYear = date.startsWith(String(year));
                  if (!inYear) return <span key={date} className="size-3" />;
                  const d = map.get(date);
                  const future = date > today;
                  return <button key={date} role="gridcell" tabIndex={-1} aria-label={detail(d, date)} onMouseEnter={() => setTip(d ?? { date, score: 0, level: 0, tasks: 0, habits: 0, challenges: 0, focus: 0, focusMinutes: 0, milestones: 0 })} onFocus={() => setTip(d ?? { date, score: 0, level: 0, tasks: 0, habits: 0, challenges: 0, focus: 0, focusMinutes: 0, milestones: 0 })} className={cn("hm", `hm-${d?.level ?? 0}`, future && "opacity-30", date === today && "ring-1 ring-[var(--fg)]")} />;
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex min-h-12 flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-muted" aria-live="polite">{tip ? <><b className="text-fg">{fmtLong(tip.date, lang)}</b> — {tip.score ? `${tip.score} pts · ${tip.tasks} tasks · ${tip.habits} habits · ${tip.challenges} challenges · ${tip.focus} focus (${tip.focusMinutes}m) · ${tip.milestones} milestones` : "no verified activity"}</> : "Hover or tap a day for details"}</div>
        <div className="flex items-center gap-1.5 text-faint">Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className={cn("hm", `hm-${l}`)} />)} More</div>
      </div>
      <p className="mt-2 text-xs text-faint">Scoring: task completed = 1 pt, habit completed = 1 pt, challenge = 2 pts, full focus session = 2 pts, goal milestone = 2 pts. Levels: low (&lt;⅓ of your {goal}-pt daily goal), medium (&lt;⅔), high (&lt;100%), goal achieved (≥{goal} pts). Only verified, completed records count — opening the app never lights a day.</p>
    </div>
  );
}
