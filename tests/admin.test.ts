import { describe, it, expect } from "vitest";
import { getSeed } from "@/data/seed";
import { effectiveConnectors, effectiveReports, mrr, monthsOnPlan, reviewRequired, sendCheck, type AdminState } from "@/lib/admin";

const ds = getSeed();
const empty: AdminState = { reports: {}, connectorOverrides: {}, reviewRequiredBy: {}, changedReports: [] };
const by = (rs: ReturnType<typeof effectiveReports>, id: string) => rs.find((r) => r.report.id === id)!;

describe("admin logic", () => {
  it("MRR is computed from plan prices (₹19,495)", () => expect(mrr(ds.clients)).toBe(5999 + 2999 + 5999 + 2999 + 1499));
  it("Urban Nest is in month 3 in October", () => expect(monthsOnPlan(ds.clients.find((c) => c.id === "c1")!, "2026-10")).toBe(3));
  it("initial statuses match the brief", () => {
    const rs = effectiveReports(ds, empty);
    expect(by(rs, "LL-BS-2026-10").status).toBe("sent");
    expect(by(rs, "LL-AC-2026-10").status).toBe("in_review");
    expect(by(rs, "LL-FF-2026-10").status).toBe("blocked");
    expect(by(rs, "LL-SR-2026-10").status).toBe("generated");
    expect(by(rs, "LL-UN-2026-10").status).toBe("generated");
  });
  it("FitForge is blocked by its failing Meta Lead Ads connector until fixed", () => {
    const rs = effectiveReports(ds, empty);
    expect(by(rs, "LL-FF-2026-10").blockedBy.map((c) => c.type)).toEqual(["meta_lead_ads"]);
    const fixed = effectiveReports(ds, { ...empty, connectorOverrides: { cn_c4_meta_lead_ads: "healthy" } });
    expect(by(fixed, "LL-FF-2026-10").status).toBe("generated");
  });
  it("breaking Urban Nest's Meta connector shows failed and blocks the report", () => {
    const st: AdminState = { ...empty, connectorOverrides: { cn_c1_meta_lead_ads: "failed" } };
    expect(effectiveConnectors(ds, st).find((c) => c.id === "cn_c1_meta_lead_ads")!.status).toBe("failed");
    const r = by(effectiveReports(ds, st), "LL-UN-2026-10");
    expect(r.status).toBe("blocked");
    expect(sendCheck(r, true).canSend).toBe(false);
  });
  it("review requirement defaults to the first three months and can be toggled", () => {
    const c1 = ds.clients.find((c) => c.id === "c1")!;
    expect(reviewRequired(c1, empty)).toBe(true);
    expect(reviewRequired(c1, { ...empty, reviewRequiredBy: { c1: false } })).toBe(false);
  });
  it("unverified figures block sending; a sent report is never blocked by connectors", () => {
    const r = by(effectiveReports(ds, empty), "LL-UN-2026-10");
    expect(sendCheck(r, false).canSend).toBe(false);
    expect(sendCheck(r, true).canSend).toBe(true);
    const sent = by(effectiveReports(ds, { ...empty, connectorOverrides: { cn_c1_meta_lead_ads: "failed" } }), "LL-UN-2026-08");
    expect(sent.status).toBe("sent");
  });
  it("'data changed' flag is carried per report", () => {
    expect(by(effectiveReports(ds, { ...empty, changedReports: ["LL-UN-2026-10"] }), "LL-UN-2026-10").changed).toBe(true);
  });
});
