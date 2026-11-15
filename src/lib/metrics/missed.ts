// mirrors sql view: v_missed_opportunities
import type { Lead } from "@/lib/types";
import { monthLeads, missedReason, type MissedReason } from "./predicates";

export interface MissedRow { lead: Lead; reason: MissedReason }
export function vMissedOpportunities(leads: Lead[], month: string, asOf: Date): MissedRow[] {
  return monthLeads(leads, month).flatMap((lead) => {
    const reason = missedReason(lead, month, asOf);
    return reason ? [{ lead, reason }] : [];
  });
}
