import { formatInTimeZone } from "date-fns-tz";

export const TZ = "Asia/Kolkata";

/** en-IN grouping: 3680000 -> ₹36,80,000 */
export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/** Headline short form: 3680000 -> ₹36.8L, 15000000 -> ₹1.5Cr, 8000 -> ₹8,000 */
export function inrShort(n: number): string {
  const a = Math.abs(n);
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, "").replace(/(\.\d)\d$/, "$1");
  if (a >= 1e7) return `₹${trim(n / 1e7)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  return inr(n);
}

export function pct0(n: number): string {
  return `${Math.round(n)}%`;
}
export function pct1(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** 125 -> "2h 05m", 41 -> "41 min", 9 -> "9 min" */
export function minutesLabel(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${String(r).padStart(2, "0")}m`;
}

export const fmtDate = (d: Date | string | number) => formatInTimeZone(d, TZ, "d MMM yyyy");
export const fmtTime = (d: Date | string | number) => formatInTimeZone(d, TZ, "h:mm a");
export const fmtDateTime = (d: Date | string | number) =>
  `${fmtDate(d)}, ${fmtTime(d)} IST`;
