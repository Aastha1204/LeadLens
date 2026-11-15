import { describe, it, expect } from "vitest";
import { getSeed, URBAN_NEST } from "@/data/seed";
import { buildMetricsJson } from "@/lib/metrics";
import { applyPatches } from "@/store/data";

const ds = getSeed();
const AS_OF = new Date("2026-11-01T03:30:00.000Z");

describe("dashboard-only figures", () => {
  const f = buildMetricsJson(ds, URBAN_NEST, "2026-10", AS_OF).figures;
  it("blended cost per lead = ₹27,000 ÷ 53 paid enquiries", () => {
    expect(f["spend.total"].value).toBe(27000);
    expect(f["cpl.paid"].display).toBe("₹509");
  });
  it("speed buckets sum to the enquiries", () => {
    const total = ["lt5", "5_15", "15_60", "1_4h", "4_24h", "gt24_or_never"].reduce((a, b) => a + f[`speed.bucket.${b}`].value, 0);
    expect(total).toBe(86);
    expect(f["speed.bucket.gt24_or_never"].value).toBe(5);
  });
  it("owner edits layered on the seed flow into the metrics (WON 186 120000)", () => {
    const lead = ds.leads.find((l) => l.number === 186)!;
    const patched = applyPatches(ds, { [lead.id]: { stage: "won", deal_value: 120000, closed_at: "2026-11-01T03:00:00.000Z" } }, []);
    const g = buildMetricsJson(patched, URBAN_NEST, "2026-10", AS_OF).figures;
    expect(g["won.total"].value).toBe(13);
    expect(g["revenue.won"].display).toBe("₹38,00,000");
    expect(ds.leads.find((l) => l.number === 186)!.stage).toBe("site_visit"); // seed untouched
  });
});
