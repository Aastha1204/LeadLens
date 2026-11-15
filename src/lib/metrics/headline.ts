// mirrors sql view: v_monthly_headline
import type { Lead, RawEnquiry } from "@/lib/types";
import { dayOfMonthIST, monthOf } from "@/lib/time";
import { isContacted, isSiteVisit, isWon, monthLeads, responseMin } from "./predicates";
import { median, sum } from "./util";

export interface Headline {
  month: string; raw_enquiries: number; enquiries: number; duplicates_merged: number;
  contacted: number; site_visits: number; won: number; revenue_won: number; median_response_min: number | null;
}
export function vMonthlyHeadline(leads: Lead[], raws: RawEnquiry[], month: string): Headline {
  const ls = monthLeads(leads, month);
  const raw = raws.filter((r) => monthOf(r.received_at) === month).length;
  return {
    month, raw_enquiries: raw, enquiries: ls.length, duplicates_merged: raw - ls.length,
    contacted: ls.filter(isContacted).length, site_visits: ls.filter(isSiteVisit).length,
    won: ls.filter(isWon).length, revenue_won: sum(ls.filter(isWon).map((l) => l.deal_value ?? 0)),
    median_response_min: median(ls.map(responseMin).filter((x): x is number => x !== null)),
  };
}

/** Enquiries created on days 1..day of a month (used for the mid-month drop alert). */
export function enquiriesThroughDay(leads: Lead[], month: string, day: number): number {
  return monthLeads(leads, month).filter((l) => dayOfMonthIST(l.created_at) <= day).length;
}
export function midMonthComparison(leads: Lead[], month: string, prev: string, day: number) {
  const current = enquiriesThroughDay(leads, month, day);
  const previous = enquiriesThroughDay(leads, prev, day);
  return { current, previous, change_pct: previous ? ((current - previous) / previous) * 100 : null };
}
