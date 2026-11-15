import { toast } from "sonner";
import { effectiveConnectors, effectiveReports, reviewRequired, sendCheck } from "@/lib/admin";
import { buildMetricsJson } from "@/lib/metrics";
import { generateNarrative } from "@/lib/narrative/llm";
import { resolveNarrative, toData } from "@/lib/narrative/resolve";
import { templateNarrative } from "@/lib/narrative/template";
import { deliverMonthlyReport } from "@/lib/whatsapp/actions";
import { currentDataset } from "@/store/data";
import { useDemo, type ReportOverride } from "@/store/demo";

const st = () => useDemo.getState();
const clock = () => st().demoClock;
const adminState = () => { const s = st(); return { reports: s.reports, connectorOverrides: s.connectorOverrides, reviewRequiredBy: s.reviewRequiredBy, changedReports: s.changedReports }; };
const find = (id: string) => effectiveReports(currentDataset(), adminState()).find((r) => r.report.id === id);

export function metricsFor(id: string) {
  const r = find(id);
  if (!r) return null;
  return { r, metrics: buildMetricsJson(currentDataset(), r.client.id, r.report.month, new Date(clock())) };
}

/** Recompute the narrative (LLM when configured, otherwise template) and clear the "data changed" badge. */
export async function regenerateReport(id: string) {
  const x = metricsFor(id);
  if (!x) return;
  const { data, source } = await generateNarrative(x.metrics);
  const next: ReportOverride = {
    status: reviewRequired(x.r.client, adminState()) ? "in_review" : "generated",
    generatedAt: clock(), narrativeSource: source, edited: false,
    narrative: source === "llm" ? data : undefined,
  };
  st().patchReport(id, null);
  st().patchReport(id, next);
  st().clearReportChanged(id);
  toast.success(`${id} regenerated · narrative source: ${source === "llm" ? "LLM" : "Template (offline)"}`);
  return source;
}

export function approveAndSend(id: string): boolean {
  const x = metricsFor(id);
  if (!x) return false;
  const guard = resolveNarrative(x.metrics, x.r.override?.narrative).guard;
  const check = sendCheck(x.r, guard.ok);
  if (!check.canSend) {
    toast.error("Can't send this report yet", { description: check.reasons.join(" ") });
    return false;
  }
  st().patchReport(id, { status: "sent", sentAt: clock() });
  toast.success(`${x.r.client.name} · ${x.r.report.month} report sent`);
  if (x.r.client.id === "c1") void deliverMonthlyReport(x.r.report.month, "c1");
  return true;
}

export function submitForReview(id: string) { st().patchReport(id, { status: "in_review" }); }

export function saveNarrative(id: string, data: ReportOverride["narrative"]) {
  st().patchReport(id, { narrative: data, narrativeSource: "template", edited: true });
}
export function resetNarrative(id: string) {
  const o = st().reports[id];
  if (!o) return;
  st().patchReport(id, { narrative: undefined, narrativeSource: "template", edited: false });
}

/** Demo: replace the Google conversion figure with an invented one so the guard blocks sending. */
export function injectHallucination(id = "LL-UN-2026-10") {
  const x = metricsFor(id);
  if (!x) return;
  const data = toData(templateNarrative(x.metrics));
  const rec = data.recommendations[0];
  const m = x.metrics.figures[`source.${x.metrics.labels.best_source || "google"}.conversion`];
  rec.body = m && rec.body.includes(m.display) ? rec.body.replace(m.display, "35%") : `${rec.body} Conversion reached 35%.`;
  st().patchReport(id, { narrative: data, narrativeSource: "template", edited: true });
  toast.warning("Hallucinated figure injected", { description: "The figure guard will block this report from being sent." });
}

export function setConnector(id: string, status: "healthy" | "failed") {
  const base = currentDataset().connectors.find((c) => c.id === id);
  st().setConnectorStatus(id, base && base.status === status ? null : status);
}
export const connectorsNow = () => effectiveConnectors(currentDataset(), adminState());
