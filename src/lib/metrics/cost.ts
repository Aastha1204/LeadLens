// mirrors sql view: v_cost_per_lead
import type { AdSpend, Lead, SourceKey } from "@/lib/types";
import { isWon, monthLeads } from "./predicates";

export const PLATFORM_OF: Partial<Record<SourceKey, "meta" | "google">> = { instagram: "meta", google: "google" };
export interface CostRow { source: SourceKey; platform: "meta" | "google"; spend: number; leads: number; wins: number; cost_per_lead: number | null; cost_per_win: number | null }
export function vCostPerLead(leads: Lead[], spend: AdSpend[], clientId: string, month: string): CostRow[] {
  const ls = monthLeads(leads, month);
  return (["instagram", "google"] as const).flatMap((source) => {
    const s = ls.filter((l) => l.source === source);
    if (!s.length) return [];
    const platform = PLATFORM_OF[source]!;
    const amount = spend.find((a) => a.client_id === clientId && a.month === `${month}-01` && a.platform === platform)?.amount ?? 0;
    const wins = s.filter(isWon).length;
    const has = spend.some((a) => a.client_id === clientId && a.month === `${month}-01` && a.platform === platform);
    return [{
      source, platform, spend: amount, leads: s.length, wins,
      cost_per_lead: has ? Math.round(amount / s.length) : null,
      cost_per_win: has && wins ? Math.round(amount / wins) : null,
    }];
  });
}
