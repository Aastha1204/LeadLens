// mirrors sql view: v_weekly_enquiries
import type { Lead } from "@/lib/types";
import { weekNo } from "@/lib/time";
import { monthLeads } from "./predicates";

export function vWeeklyEnquiries(leads: Lead[], month: string): { week_no: number; enquiries: number }[] {
  const m = new Map<number, number>();
  for (const l of monthLeads(leads, month)) m.set(weekNo(l.created_at), (m.get(weekNo(l.created_at)) ?? 0) + 1);
  return [...m].map(([week_no, enquiries]) => ({ week_no, enquiries })).sort((a, b) => a.week_no - b.week_no);
}
