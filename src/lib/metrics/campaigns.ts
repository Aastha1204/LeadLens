// mirrors sql view: v_campaigns, v_lost_reasons
import type { Lead, LostReason, SourceKey } from "@/lib/types";
import { isWon, monthLeads } from "./predicates";

export interface CampaignRow { source: SourceKey; campaign: string; enquiries: number; won: number }
export function vCampaigns(leads: Lead[], month: string): CampaignRow[] {
  const m = new Map<string, CampaignRow>();
  for (const l of monthLeads(leads, month)) {
    const k = l.source + "|" + l.campaign;
    const r = m.get(k) ?? { source: l.source, campaign: l.campaign, enquiries: 0, won: 0 };
    r.enquiries++; if (isWon(l)) r.won++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.enquiries - a.enquiries || a.campaign.localeCompare(b.campaign));
}
export function vLostReasons(leads: Lead[], month: string): { outcome_reason: LostReason; leads: number }[] {
  const m = new Map<LostReason, number>();
  for (const l of monthLeads(leads, month)) if (l.stage === "lost") m.set(l.outcome_reason ?? "other", (m.get(l.outcome_reason ?? "other") ?? 0) + 1);
  return [...m].map(([outcome_reason, leads]) => ({ outcome_reason, leads })).sort((a, b) => b.leads - a.leads);
}
