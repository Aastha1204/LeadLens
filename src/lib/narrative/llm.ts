import type { MetricsJson } from "@/lib/metrics";
import type { NarrativeData } from "./guard";
import { toData } from "./resolve";
import { templateNarrative } from "./template";

/** Only figures (display strings) and labels leave the browser. No lead rows, names or phones. */
export function llmPayload(m: MetricsJson) {
  return {
    figures: Object.fromEntries(Object.values(m.figures).map((f) => [f.key, { display: f.display, unit: f.unit }])),
    labels: m.labels,
  };
}

let enabled: Promise<boolean> | null = null;
const llmEnabled = () => (enabled ??= fetch("/api/narrative").then((r) => r.json()).then((j: { enabled?: boolean }) => !!j.enabled).catch(() => false));

/** LLM commentary when LLM_API_KEY is configured on the server; otherwise (or on any failure) the offline template. */
export async function generateNarrative(m: MetricsJson): Promise<{ data: NarrativeData; source: "llm" | "template" }> {
  try {
    if (!(await llmEnabled())) return { data: toData(templateNarrative(m)), source: "template" };
    const res = await fetch("/api/narrative", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(llmPayload(m)) });
    if (res.ok) {
      const json = (await res.json()) as { data?: NarrativeData };
      if (json.data) return { data: json.data, source: "llm" };
    }
  } catch { /* offline: fall back */ }
  return { data: toData(templateNarrative(m)), source: "template" };
}
