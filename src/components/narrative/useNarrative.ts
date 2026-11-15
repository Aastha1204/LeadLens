"use client";
import { useMemo } from "react";
import { useMetricScope } from "@/components/metric/MetricProvider";
import { resolveNarrative } from "@/lib/narrative/resolve";
import { useDemo } from "@/store/demo";

/** Narrative for the current client and month (template unless edited, LLM-written or injected), with the figure-guard result. */
export function useNarrative() {
  const { metrics, ds, clientId, month } = useMetricScope();
  const reportId = ds.monthlyReports.find((r) => r.client_id === clientId && r.month === month)?.id;
  const override = useDemo((s) => (reportId ? s.reports[reportId] : undefined));
  return useMemo(() => {
    const r = resolveNarrative(metrics, override?.narrative);
    return { ...r, reportId, source: override?.narrative ? (override.narrativeSource ?? "template") : ("template" as const), edited: !!override?.edited };
  }, [metrics, override, reportId]);
}
