// Pure helpers shared by the Habits page, the quick tracker and the server,
// so every surface reports the same number for the same logged data.
export const CUP_ML = 250;
export const READING_STEP = 5;

export type TrackerKind = "water" | "reading" | "learning";

/** Progress never reads above the configured target; raw log entries are left untouched. */
export function cappedAmount(amount: number, target: number) {
  return Math.max(0, target > 0 ? Math.min(amount, target) : amount);
}

export function habitPercent(amount: number, target: number) {
  return target > 0 ? (100 * cappedAmount(amount, target)) / target : 0;
}

/** Rounds down so that 100% is only ever shown for a target that was really reached. */
export function wholePercent(percent: number) {
  return Math.floor(percent + 1e-9);
}

export function overallPercent(percents: number[]) {
  return percents.length ? percents.reduce((sum, p) => sum + p, 0) / percents.length : 0;
}

/** Water is stored in ml and displayed in cups. */
export function displayAmounts(kind: string, amount: number, target: number) {
  const shown = cappedAmount(amount, target);
  if (kind !== "water") return { amount: shown, target };
  return { amount: Number((shown / CUP_ML).toFixed(1)), target: Math.ceil(target / CUP_ML) };
}

/** What one tap on a quick-tracker ring records: one step, never more than what is left. */
export function quickStep(kind: TrackerKind, amount: number, target: number) {
  const step = kind === "water" ? CUP_ML : kind === "reading" ? READING_STEP : 1;
  return Math.max(0, Math.min(step, target - amount));
}
