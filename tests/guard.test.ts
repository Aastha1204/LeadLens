import { describe, it, expect } from "vitest";
import { getSeed, URBAN_NEST } from "@/data/seed";
import { buildMetricsJson } from "@/lib/metrics";
import { checkText, extractNumbers, guardNarrative, partsFromText } from "@/lib/narrative/guard";
import { templateNarrative } from "@/lib/narrative/template";

const ds = getSeed();
const AS_OF = new Date("2026-11-01T03:30:00.000Z");
const oct = buildMetricsJson(ds, URBAN_NEST, "2026-10", AS_OF);

describe("number extraction", () => {
  it("finds amounts, percentages, durations and counts with units", () => {
    const e = extractNumbers("Won ₹36.8L (₹1,20,000) at 22.7% in 9 minutes, 2h 05m, within 24 hours; 5 of 22.").map((x) => [x.unit, x.value]);
    expect(e).toEqual([["inr", 3680000], ["inr", 120000], ["percent", 22.7], ["minutes", 9], ["minutes", 125], ["minutes", 1440], ["count", 5], ["count", 22]]);
  });
  it("does not read 'lost' as lakhs", () => expect(extractNumbers("₹1,20,000 lost")[0].value).toBe(120000));
});

describe("figure guard", () => {
  it("passes the template narrative for every client and month", () => {
    for (const client of ds.clients) for (const month of ["2026-09", "2026-10"]) {
      const m = buildMetricsJson(ds, client.id, month, AS_OF);
      const g = guardNarrative(templateNarrative(m), m);
      expect(g.unverified.map((u) => u.text), `${client.id} ${month}`).toEqual([]);
      expect(g.total).toBeGreaterThan(5);
    }
    for (const month of ["2026-08"]) {
      const m = buildMetricsJson(ds, URBAN_NEST, month, AS_OF);
      expect(guardNarrative(templateNarrative(m), m).ok).toBe(true);
    }
  });
  it("blocks the injected hallucination 'converted at 35%'", () => {
    const n = templateNarrative(oct);
    n.recommendations[0].body = n.recommendations[0].body.replace("22.7%", "35%");
    const g = guardNarrative(n, oct);
    expect(g.ok).toBe(false);
    expect(g.unverified.map((u) => u.text)).toEqual(["35%"]);
  });
  it("blocks wrong amounts, minutes and counts; accepts display variants", () => {
    const bad = (t: string) => checkText(t, oct).filter((c) => !c.ok).map((c) => c.text);
    expect(bad("Revenue was ₹40L")).toEqual(["₹40L"]);
    expect(bad("Median reply was 12 minutes")).toEqual(["12 minutes"]);
    expect(bad("We got 99 enquiries")).toEqual(["99"]);
    expect(bad("Revenue was ₹36.8L, or ₹36,80,000; replies took 9 min; 86 enquiries; 78% within 15 minutes; 2026")).toEqual([]);
  });
  it("whitelists 15 minutes, 24 hours, 30 days and the year only", () => {
    expect(checkText("within 15 minutes, 24 hours and 30 days of 2026", oct).every((c) => c.ok)).toBe(true);
    expect(checkText("within 16 minutes", oct)[0].ok).toBe(false);
  });
  it("linkifies verified numbers to their metric", () => {
    const parts = partsFromText("Google converted at 22.7% (5 of 22).", oct);
    expect(parts.filter((p) => "metric" in p).map((p) => (p as { metric: string }).metric)).toEqual(["source.google.conversion", expect.any(String), expect.any(String)]);
  });
});
