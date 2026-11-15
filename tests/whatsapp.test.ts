import { describe, it, expect } from "vitest";
import { getSeed, URBAN_NEST } from "@/data/seed";
import { buildMetricsJson } from "@/lib/metrics";
import { parseAmount, parseMessage } from "@/lib/whatsapp/parser";
import { computeOutcome } from "@/lib/whatsapp/outcome";
import { summaryText } from "@/lib/whatsapp/summary";
import { applyPatches } from "@/store/data";

const ds = getSeed();
const NOW = new Date("2026-11-01T03:30:00.000Z");

describe("amount parser", () => {
  it.each([["120000", 120000], ["1,20,000", 120000], ["₹1,20,000", 120000], ["1.2L", 120000], ["1.2 lakh", 120000], ["120k", 120000], ["1.2 LAKHS", 120000], ["0.5 cr", 5000000]])("%s", (s, v) => expect(parseAmount(s)).toBe(v));
  it.each(["", "abc", "-5", "0", "1.2.3L"])("rejects %j", (s) => expect(parseAmount(s)).toBeNull());
});

describe("message parser", () => {
  it("WON, case-insensitive", () => {
    expect(parseMessage("WON 186 120000")).toEqual({ ok: true, cmd: { kind: "won", lead: 186, amount: 120000 } });
    expect(parseMessage("won #186 1.2 lakh")).toEqual({ ok: true, cmd: { kind: "won", lead: 186, amount: 120000 } });
  });
  it("LOST maps reasons", () => {
    const r = (t: string) => (parseMessage(`lost 201 ${t}`) as { cmd: { reason: string } }).cmd.reason;
    expect([r("price"), r("too expensive"), r("timeline"), r("chose another designer"), r("outside area"), r("no response"), r("whatever")])
      .toEqual(["price", "price", "timeline", "competitor", "area", "no_response", "other"]);
  });
  it("HELP", () => expect(parseMessage("Help")).toEqual({ ok: true, cmd: { kind: "help" } }));
  it("invalid input gets a friendly correction with an example", () => {
    for (const bad of ["WON", "WON abc 100", "WON 186", "WON 186 lots", "LOST 201", "random text", ""]) {
      const r = parseMessage(bad);
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error.length).toBeGreaterThan(10);
    }
    expect((parseMessage("WON 186") as { error: string }).error).toContain("WON 186 120000");
  });
});

describe("outcome handler", () => {
  it("WON 186 120000 → 13 won, ₹38,00,000", () => {
    const r = computeOutcome(ds, URBAN_NEST, { kind: "won", lead: 186, amount: 120000 }, NOW);
    expect(r.ok).toBe(true);
    expect(r.message).toBe("✅ Lead #186 (Sneha K. · Instagram · Modular kitchen) marked WON at ₹1,20,000. October now: 13 won, ₹38,00,000 revenue.");
  });
  it("LOST 201 price updates lost reasons", () => {
    const r = computeOutcome(ds, URBAN_NEST, { kind: "lost", lead: 201, reason: "price" }, NOW);
    expect(r.ok && r.message).toContain("price now 9");
    if (r.ok) {
      const f = buildMetricsJson(applyPatches(ds, { [r.leadId]: r.patch }, []), URBAN_NEST, "2026-10", NOW).figures;
      expect(f["lost.price"].value).toBe(9);
      expect(f["won.total"].value).toBe(12);
    }
  });
  it("unknown lead", () => expect(computeOutcome(ds, URBAN_NEST, { kind: "won", lead: 9999, amount: 1 }, NOW).ok).toBe(false));
  it("won lead keeps the funnel monotone", () => {
    const r = computeOutcome(ds, URBAN_NEST, { kind: "won", lead: 150, amount: 200000 }, NOW);
    if (!r.ok) throw new Error("expected ok");
    const f = buildMetricsJson(applyPatches(ds, { [r.leadId]: r.patch }, []), URBAN_NEST, "2026-10", NOW).figures;
    expect(f["won.total"].value).toBeLessThanOrEqual(f["meetings.total"].value);
    expect(f["meetings.total"].value).toBeLessThanOrEqual(f["contacted.total"].value);
  });
});

describe("summary text", () => {
  const m = buildMetricsJson(ds, URBAN_NEST, "2026-10", NOW);
  it("English matches the spec", () => expect(summaryText(m)).toBe("October: 86 enquiries (+18%), 12 won, median reply time 9 minutes. Full report: [link]"));
  it("Hindi and Marathi keep the same numbers", () => {
    for (const l of ["hi", "mr"] as const) { const t = summaryText(m, l); for (const n of ["86", "+18%", "12", "9"]) expect(t).toContain(n); }
  });
});
