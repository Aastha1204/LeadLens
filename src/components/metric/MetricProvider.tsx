"use client";
import { createContext, useContext, useMemo } from "react";
import { buildMetricsJson, type MetricsJson } from "@/lib/metrics";
import type { DataSet } from "@/lib/types";
import { useDataset, useNow } from "@/store/data";

interface Scope { clientId: string; month: string; metrics: MetricsJson; ds: DataSet; asOf: Date }
const Ctx = createContext<Scope | null>(null);

export function MetricProvider({ clientId, month, children }: { clientId: string; month: string; children: React.ReactNode }) {
  const ds = useDataset();
  const asOf = useNow();
  const metrics = useMemo(() => buildMetricsJson(ds, clientId, month, asOf), [ds, clientId, month, asOf]);
  const value = useMemo(() => ({ clientId, month, metrics, ds, asOf }), [clientId, month, metrics, ds, asOf]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useMetricScope(): Scope {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMetricScope must be used inside <MetricProvider>");
  return v;
}
