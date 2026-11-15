// mirrors sql view: v_speed_to_lead
import type { Lead } from "@/lib/types";
import { SPEED_BUCKETS, isContacted, isWithin15, monthLeads, responseMin, speedBucket, type SpeedBucket } from "./predicates";
import { median } from "./util";

export interface SpeedRow { contacted: number; median_min: number | null; within_15: number; buckets: Record<SpeedBucket, number> }
export function vSpeedToLead(leads: Lead[], month: string): SpeedRow {
  const ls = monthLeads(leads, month);
  const buckets = Object.fromEntries(SPEED_BUCKETS.map((b) => [b, 0])) as Record<SpeedBucket, number>;
  for (const l of ls) buckets[speedBucket(l)]++;
  return {
    contacted: ls.filter(isContacted).length,
    median_min: median(ls.map(responseMin).filter((x): x is number => x !== null)),
    within_15: ls.filter(isWithin15).length,
    buckets,
  };
}
