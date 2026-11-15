"use client";
import { useMemo } from "react";
import { effectiveConnectors, effectiveReports, type AdminState } from "@/lib/admin";
import { useDataset } from "./data";
import { useDemo } from "./demo";

export function useAdminState(): AdminState {
  const reports = useDemo((s) => s.reports);
  const connectorOverrides = useDemo((s) => s.connectorOverrides);
  const reviewRequiredBy = useDemo((s) => s.reviewRequiredBy);
  const changedReports = useDemo((s) => s.changedReports);
  return useMemo(() => ({ reports, connectorOverrides, reviewRequiredBy, changedReports }), [reports, connectorOverrides, reviewRequiredBy, changedReports]);
}

export function useAdminData() {
  const ds = useDataset();
  const st = useAdminState();
  return useMemo(() => ({ ds, st, reports: effectiveReports(ds, st), connectors: effectiveConnectors(ds, st) }), [ds, st]);
}
