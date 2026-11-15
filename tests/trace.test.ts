import { describe, it, expect } from "vitest";
import { getSeed, URBAN_NEST } from "@/data/seed";
import { buildMetricsJson, getTrace } from "@/lib/metrics";

const ds = getSeed();
const AS_OF = new Date("2026-11-01T03:30:00.000Z");

describe("trace drawer data", () => {
  const month = "2026-10";
  const figs = buildMetricsJson(ds, URBAN_NEST, month, AS_OF).figures;

  it("every count figure's contributing rows equal its value", () => {
    let checked = 0;
    for (const f of Object.values(figs)) {
      if (f.unit !== "count") continue;
      const t = getTrace(ds, URBAN_NEST, month, AS_OF, f.traceId)!;
      expect(t, f.key).toBeTruthy();
      if (t.rowKind === "table") continue; // care / GBP / spend rows are table lookups
      expect(t.rows.length, f.key).toBe(f.value);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("every figure has a definition and SQL text", () => {
    for (const f of Object.values(figs)) {
      const t = getTrace(ds, URBAN_NEST, month, AS_OF, f.traceId)!;
      expect(t.definition.length, f.key).toBeGreaterThan(10);
      expect(t.sql.length, f.key).toBeGreaterThan(10);
    }
  });

  it("view-backed traces show real view SQL", () => {
    const t = getTrace(ds, URBAN_NEST, month, AS_OF, "enquiries.total")!;
    expect(t.sql).toContain("create view v_monthly_headline");
    expect(t.baseSql).toContain("create view v_lead_base");
  });

  it("revenue trace lists the won leads whose deal values sum to the figure", () => {
    const t = getTrace(ds, URBAN_NEST, month, AS_OF, "revenue.won")!;
    expect(t.rowKind).toBe("lead");
    expect((t.rows as { deal_value: number }[]).reduce((a, r) => a + r.deal_value, 0)).toBe(figs["revenue.won"].value);
  });
});
