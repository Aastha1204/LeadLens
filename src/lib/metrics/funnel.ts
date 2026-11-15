// mirrors sql view: v_funnel (stages counted from timestamps, not from current stage)
import type { Lead } from "@/lib/types";
import { isContacted, isSiteVisit, isWon, monthLeads } from "./predicates";

export interface FunnelRow { enquiries: number; contacted: number; site_visit: number; won: number }
export function vFunnel(leads: Lead[], month: string): FunnelRow {
  const ls = monthLeads(leads, month);
  return { enquiries: ls.length, contacted: ls.filter(isContacted).length, site_visit: ls.filter(isSiteVisit).length, won: ls.filter(isWon).length };
}
