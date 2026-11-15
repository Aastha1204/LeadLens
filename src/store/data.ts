"use client";
import { useMemo } from "react";
import { getSeed } from "@/data/seed";
import type { DataSet, Lead } from "@/lib/types";
import { useDemo } from "./demo";

export function applyPatches(base: DataSet, patches: Record<string, Partial<Lead>>, extra: Lead[]): DataSet {
  const hasPatch = Object.keys(patches).length > 0;
  if (!hasPatch && !extra.length) return base;
  const leads = base.leads.map((l) => (patches[l.id] ? { ...l, ...patches[l.id] } : l));
  return { ...base, leads: [...leads, ...extra] };
}

/** Seed + owner edits. Every screen recomputes from this, so updates flow everywhere. */
export function useDataset(): DataSet {
  const patches = useDemo((s) => s.leadPatches);
  const extra = useDemo((s) => s.extraLeads);
  return useMemo(() => applyPatches(getSeed(), patches, extra), [patches, extra]);
}
export function useNow(): Date {
  const clock = useDemo((s) => s.demoClock);
  return useMemo(() => new Date(clock), [clock]);
}

/** Non-hook access for event handlers and timers. */
export function currentDataset(): DataSet {
  const s = useDemo.getState();
  return applyPatches(getSeed(), s.leadPatches, s.extraLeads);
}
