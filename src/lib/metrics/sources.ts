// mirrors sql view: v_source_breakdown
import { SOURCES, type Lead, type SourceKey } from "@/lib/types";
import { isContacted, isWon, monthLeads } from "./predicates";
import { sum } from "./util";

export interface SourceRow { source: SourceKey; enquiries: number; contacted: number; won: number; revenue_won: number; conversion_pct: number }
export function vSourceBreakdown(leads: Lead[], month: string): SourceRow[] {
  const ls = monthLeads(leads, month);
  return SOURCES.map((source) => {
    const s = ls.filter((l) => l.source === source);
    const w = s.filter(isWon);
    return {
      source, enquiries: s.length, contacted: s.filter(isContacted).length, won: w.length,
      revenue_won: sum(w.map((l) => l.deal_value ?? 0)), conversion_pct: s.length ? (100 * w.length) / s.length : 0,
    };
  }).filter((r) => r.enquiries > 0);
}
