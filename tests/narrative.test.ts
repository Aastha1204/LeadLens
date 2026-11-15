import { describe, it, expect } from "vitest";
import { getSeed, URBAN_NEST } from "@/data/seed";
import { buildMetricsJson } from "@/lib/metrics";
import { templateNarrative } from "@/lib/narrative/template";

const ds = getSeed();
const AS_OF = new Date("2026-11-01T03:30:00.000Z");
const m = buildMetricsJson(ds, URBAN_NEST, "2026-10", AS_OF);

describe("template narrative (October)", () => {
  const n = templateNarrative(m);
  it("reads exactly like the expected output", () => {
    expect(n.recommendations.map((r) => [r.title, r.body, r.service])).toEqual([
      ["Grow Google — it converts best.", "Google enquiries converted at 22.7% (5 of 22), compared with 9.7% (3 of 31) from Instagram ads. More Google reviews would strengthen this channel.", "review_automation"],
      ["Close the weekend gap.", "5 enquiries got no follow-up within 24 hours, and 3 of them came from weekend Instagram ads. Weekend auto-replies and reminders would catch these.", "whatsapp_followup"],
      ["Extend the kitchen offer.", "The Diwali Modular Kitchen Offer was the top campaign with 17 enquiries and 2 wins. A post-Diwali version could keep the momentum going in November.", "meta_ads"],
    ]);
  });
  it("headline", () => expect(n.headline).toBe("October: 86 enquiries (+18%), 12 won, median reply time 9 min."));
  it("every metric reference exists in metrics_json", () => {
    for (const r of n.recommendations) {
      expect(r.evidence.length).toBeGreaterThan(0);
      for (const p of r.parts) if ("metric" in p) expect(m.figures[p.metric], p.metric).toBeTruthy();
    }
  });
  it("works for every month without throwing", () => {
    for (const month of ["2026-08", "2026-09"]) expect(templateNarrative(buildMetricsJson(ds, URBAN_NEST, month, AS_OF)).recommendations).toHaveLength(3);
  });
});
