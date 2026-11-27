// Date helpers. App dates are 'YYYY-MM-DD' strings in the user's timezone.
export function safeTz(tz?: string | null): string {
  try {
    if (tz) {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz });
      return tz;
    }
  } catch {
    /* fall through */
  }
  return "UTC";
}

export function todayIn(tz?: string | null, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: safeTz(tz), year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function hourIn(tz?: string | null, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: safeTz(tz), hour: "2-digit", hour12: false }).format(now)) % 24;
}

export function parseD(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
export function fmtD(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}
export function addDays(d: string, n: number): string {
  const dt = parseD(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmtD(dt);
}
export function diffDays(a: string, b: string): number {
  return Math.round((parseD(a).getTime() - parseD(b).getTime()) / 86400000);
}
/** Monday-based week start */
export function weekStart(d: string): string {
  const dow = (parseD(d).getUTCDay() + 6) % 7;
  return addDays(d, -dow);
}
export function dow(d: string): number {
  return parseD(d).getUTCDay();
}
export function isDateStr(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return parseD(s).toISOString().slice(0, 10) === s;
}
export function addMonths(d: string, n: number): string {
  const dt = parseD(d);
  const day = dt.getUTCDate();
  dt.setUTCDate(1);
  dt.setUTCMonth(dt.getUTCMonth() + n);
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(day, last));
  return fmtD(dt);
}
export function fmtLong(d: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(parseD(d));
}
export function fmtShort(d: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short", day: "numeric" }).format(parseD(d));
}
