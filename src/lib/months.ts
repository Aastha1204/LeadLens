import { reportTimeMs } from "@/lib/time";

export const MONTH_LABEL: Record<string, string> = {
  "2026-08": "Aug 2026", "2026-09": "Sep 2026", "2026-10": "Oct 2026", "2026-11": "Nov 2026 (so far)",
};
export const FULL_MONTH_NAME: Record<string, string> = {
  "2026-08": "August 2026", "2026-09": "September 2026", "2026-10": "October 2026", "2026-11": "November 2026",
};
/** November month-to-date appears once the demo clock is past the October report. */
export function availableMonths(now: Date): string[] {
  const base = ["2026-08", "2026-09", "2026-10"];
  return +now > reportTimeMs("2026-10") ? [...base, "2026-11"] : base;
}
export const DEFAULT_MONTH = "2026-10";
