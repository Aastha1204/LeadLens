import type { MetricsJson } from "@/lib/metrics";
import { guardNarrative, partsFromText, type NarrativeData } from "./guard";
import { templateNarrative, type Narrative } from "./template";

export const toData = (n: Narrative): NarrativeData => ({
  headline: n.headline,
  recommendations: n.recommendations.map(({ title, body, evidence, service }) => ({ title, body, evidence, service })),
});

/** Narrative to show: an override (edited / LLM / injected) when present, else the deterministic template. */
export function resolveNarrative(metrics: MetricsJson, override?: NarrativeData) {
  const tpl = templateNarrative(metrics);
  const data = override ?? toData(tpl);
  const narrative: Narrative = override
    ? {
        headline: override.headline,
        recommendations: override.recommendations.map((r) => ({ ...r, parts: partsFromText(r.body, metrics, r.evidence) })),
      }
    : tpl;
  return { narrative, data, guard: guardNarrative(data, metrics) };
}
