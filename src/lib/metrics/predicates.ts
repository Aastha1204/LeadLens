import type { Lead } from "@/lib/types";
import { DAY, MIN, monthOf, reportTimeMs } from "@/lib/time";

export const inMonth = (l: Pick<Lead, "created_at">, month: string) => monthOf(l.created_at) === month;
export const monthLeads = (leads: Lead[], month: string) => leads.filter((l) => inMonth(l, month));

export const isContacted = (l: Lead) => l.first_response_at !== null;
export const isSiteVisit = (l: Lead) => l.site_visit_at !== null;
export const isWon = (l: Lead) => l.stage === "won";

/** Response delay in minutes, null if never contacted. */
export function responseMin(l: Lead): number | null {
  return l.first_response_at === null ? null : (Date.parse(l.first_response_at) - Date.parse(l.created_at)) / MIN;
}
export const WITHIN_MIN = 15;
export const isWithin15 = (l: Lead) => { const m = responseMin(l); return m !== null && m <= WITHIN_MIN; };

export type MissedReason = "never_contacted" | "late_response";
/** Never contacted and older than 24h at report time, or first response more than 24h after creation. */
export function missedReason(l: Lead, month: string, asOf: Date): MissedReason | null {
  const cut = Math.min(+asOf, reportTimeMs(month));
  if (l.first_response_at === null) return Date.parse(l.created_at) < cut - DAY ? "never_contacted" : null;
  return Date.parse(l.first_response_at) - Date.parse(l.created_at) > DAY ? "late_response" : null;
}

export const SPEED_BUCKETS = ["lt5", "5_15", "15_60", "1_4h", "4_24h", "gt24_or_never"] as const;
export type SpeedBucket = (typeof SPEED_BUCKETS)[number];
export const SPEED_BUCKET_LABEL: Record<SpeedBucket, string> = {
  lt5: "<5 min", "5_15": "5–15 min", "15_60": "15–60 min", "1_4h": "1–4 h", "4_24h": "4–24 h", gt24_or_never: ">24 h / never",
};
export function speedBucket(l: Lead): SpeedBucket {
  const m = responseMin(l);
  if (m === null || m > 1440) return "gt24_or_never";
  if (m < 5) return "lt5";
  if (m <= 15) return "5_15";
  if (m <= 60) return "15_60";
  if (m <= 240) return "1_4h";
  return "4_24h";
}
