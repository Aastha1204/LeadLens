import { describe, it, expect } from "vitest";
import { getSeed, URBAN_NEST } from "@/data/seed";
import {
  buildMetricsJson, dedupeRaw, midMonthComparison, vCampaigns, vCostPerLead, vFunnel, vLostReasons, vMissedOpportunities,
  vMonthlyHeadline, vSourceBreakdown, vSpeedToLead, vWeeklyEnquiries,
} from "@/lib/metrics";
import { isWeekendIST } from "@/lib/time";

const ds = getSeed();
const AS_OF = new Date("2026-11-01T03:30:00.000Z"); // demo clock default: 1 Nov 2026, 9:00 AM IST
const un = ds.leads.filter((l) => l.client_id === URBAN_NEST);
const unRaw = ds.rawEnquiries.filter((r) => r.client_id === URBAN_NEST);

const T = {
  "2026-08": { raw: 72, dups: 4, uniq: 68, contacted: 55, meet: 21, won: 10, rev: 2_720_000, median: 125, w15: 5, missed: 14, never: 13, late: 1, meta: 15000, google: 8000 },
  "2026-09": { raw: 78, dups: 5, uniq: 73, contacted: 64, meet: 25, won: 11, rev: 3_150_000, median: 41, w15: 25, missed: 9, never: 9, late: 0, meta: 16000, google: 8000 },
  "2026-10": { raw: 92, dups: 6, uniq: 86, contacted: 81, meet: 31, won: 12, rev: 3_680_000, median: 9, w15: 63, missed: 5, never: 5, late: 0, meta: 18000, google: 9000 },
} as const;
const SRC = {
  "2026-08": { instagram: [26, 2], google: [17, 4], calls: [9, 1], website: [11, 2], whatsapp: [5, 1] },
  "2026-09": { instagram: [27, 3], google: [19, 4], calls: [11, 2], website: [10, 2], whatsapp: [6, 0] },
  "2026-10": { instagram: [31, 3], google: [22, 5], calls: [14, 2], website: [12, 2], whatsapp: [7, 0] },
} as const;

describe.each(Object.entries(T))("calibration %s", (month, t) => {
  it("headline", () => {
    const h = vMonthlyHeadline(un, unRaw, month);
    expect(h.raw_enquiries).toBe(t.raw);
    expect(h.duplicates_merged).toBe(t.dups);
    expect(h.enquiries).toBe(t.uniq);
    expect(h.contacted).toBe(t.contacted);
    expect(h.site_visits).toBe(t.meet);
    expect(h.won).toBe(t.won);
    expect(h.revenue_won).toBe(t.rev);
    expect(h.median_response_min).toBe(t.median);
  });
  it("speed to lead", () => {
    const s = vSpeedToLead(un, month);
    expect(s.contacted).toBe(t.contacted);
    expect(s.within_15).toBe(t.w15);
    expect(Object.values(s.buckets).reduce((a, b) => a + b, 0)).toBe(t.uniq);
  });
  it("missed opportunities", () => {
    const m = vMissedOpportunities(un, month, AS_OF);
    expect(m.length).toBe(t.missed);
    expect(m.filter((x) => x.reason === "never_contacted").length).toBe(t.never);
    expect(m.filter((x) => x.reason === "late_response").length).toBe(t.late);
  });
  it("sources: unique enquiries / wins", () => {
    const rows = vSourceBreakdown(un, month);
    for (const [s, [n, w]] of Object.entries(SRC[month as keyof typeof SRC])) {
      const r = rows.find((x) => x.source === s)!;
      expect([s, r.enquiries, r.won]).toEqual([s, n, w]);
    }
  });
  it("funnel is monotone and equals the headline", () => {
    const f = vFunnel(un, month);
    expect(f).toEqual({ enquiries: t.uniq, contacted: t.contacted, site_visit: t.meet, won: t.won });
  });
  it("ad spend", () => {
    const sp = ds.adSpend.filter((a) => a.month === `${month}-01`);
    expect(sp.find((a) => a.platform === "meta")!.amount).toBe(t.meta);
    expect(sp.find((a) => a.platform === "google")!.amount).toBe(t.google);
  });
  it("deal values are ₹1.2L–₹8.5L in ₹5,000 steps", () => {
    for (const l of un.filter((x) => x.stage === "won" && x.created_at.startsWith(month))) {
      expect(l.deal_value!).toBeGreaterThanOrEqual(120_000);
      expect(l.deal_value!).toBeLessThanOrEqual(850_000);
      expect(l.deal_value! % 5000).toBe(0);
    }
  });
});

describe("change vs previous month", () => {
  it("Sep +7%, Oct +18%", () => {
    const sep = buildMetricsJson(ds, URBAN_NEST, "2026-09", AS_OF).figures["enquiries.change_pct"];
    const oct = buildMetricsJson(ds, URBAN_NEST, "2026-10", AS_OF).figures["enquiries.change_pct"];
    expect(sep.display).toBe("+7%");
    expect(oct.display).toBe("+18%");
    expect(buildMetricsJson(ds, URBAN_NEST, "2026-08", AS_OF).figures["enquiries.change_pct"]).toBeUndefined();
  });
});

describe("October details", () => {
  it("weekly enquiries", () => {
    expect(vWeeklyEnquiries(un, "2026-10").map((w) => w.enquiries)).toEqual([18, 21, 24, 16, 7]);
  });
  it("campaigns", () => {
    const c = vCampaigns(un, "2026-10");
    const get = (n: string) => c.find((x) => x.campaign === n)!;
    expect(c[0].campaign).toBe("Diwali Modular Kitchen Offer");
    expect([get("Diwali Modular Kitchen Offer").enquiries, get("Diwali Modular Kitchen Offer").won]).toEqual([17, 2]);
    expect([get("2BHK Full Home Interiors – Thane West").enquiries, get("2BHK Full Home Interiors – Thane West").won]).toEqual([14, 1]);
    expect(get("Search · interior designer Thane").enquiries).toBe(9);
    expect(get("Business Profile").enquiries).toBe(13);
  });
  it("conversion, cost per lead and cost per win", () => {
    const s = vSourceBreakdown(un, "2026-10");
    const ig = s.find((x) => x.source === "instagram")!, g = s.find((x) => x.source === "google")!;
    expect(ig.conversion_pct.toFixed(1)).toBe("9.7");
    expect(g.conversion_pct.toFixed(1)).toBe("22.7");
    const cost = vCostPerLead(un, ds.adSpend, URBAN_NEST, "2026-10");
    const ci = cost.find((x) => x.source === "instagram")!, cg = cost.find((x) => x.source === "google")!;
    expect([ci.cost_per_lead, ci.cost_per_win]).toEqual([581, 6000]);
    expect([cg.cost_per_lead, cg.cost_per_win]).toEqual([409, 1800]);
  });
  it("lost reasons", () => {
    const r = Object.fromEntries(vLostReasons(un, "2026-10").map((x) => [x.outcome_reason, x.leads]));
    expect(r).toEqual({ price: 8, timeline: 5, competitor: 4, area: 2, no_response: 2 });
  });
  it("3 of the 5 missed opportunities are weekend Instagram leads", () => {
    const m = vMissedOpportunities(un, "2026-10", AS_OF);
    expect(m.filter((x) => x.lead.source === "instagram" && isWeekendIST(x.lead.created_at)).length).toBe(3);
  });
  it("lead numbers are sequential across months", () => {
    const nums = (m: string) => un.filter((l) => l.created_at.startsWith(m) || false);
    const byNum = [...un].sort((a, b) => a.number - b.number);
    expect(byNum[0].number).toBe(1);
    byNum.forEach((l, i) => expect(l.number).toBe(i + 1));
    expect(vMonthlyHeadline(un, unRaw, "2026-08").enquiries).toBe(68);
    expect(nums).toBeTruthy();
    const range = (m: string) => { const ls = un.filter((l) => buildMonth(l.created_at) === m).map((l) => l.number); return [Math.min(...ls), Math.max(...ls)]; };
    expect(range("2026-08")).toEqual([1, 68]);
    expect(range("2026-09")).toEqual([69, 141]);
    expect(range("2026-10")).toEqual([142, 227]);
    expect(range("2026-11")[0]).toBe(228);
  });
  it("pinned demo leads #186 and #201", () => {
    const a = un.find((l) => l.number === 186)!;
    expect(a).toMatchObject({ name_masked: "Sneha K.", source: "instagram", campaign: "Diwali Modular Kitchen Offer", requirement: "Modular kitchen", stage: "site_visit", deal_value: null });
    expect(a.created_at.startsWith("2026-10") || a.created_at.startsWith("2026-09")).toBe(true);
    const b = un.find((l) => l.number === 201)!;
    expect(b.stage).toBe("site_visit");
    expect(b.created_at.slice(0, 7)).toBe("2026-10");
  });
  it("Neovia care activity and GBP", () => {
    const f = buildMetricsJson(ds, URBAN_NEST, "2026-10", AS_OF).figures;
    expect([f["care.posts"].value, f["care.updates"].value, f["care.fixes"].value, f["care.uptime"].display]).toEqual([12, 4, 1, "99.97%"]);
    expect([f["gbp.calls"].value, f["gbp.directions"].value, f["gbp.website_clicks"].value]).toEqual([31, 24, 67]);
  });
  it("automation story: median falls Aug > Sep > Oct", () => {
    const f = buildMetricsJson(ds, URBAN_NEST, "2026-10", AS_OF).figures;
    expect([f["trend.median_min.2026-08"].display, f["trend.median_min.2026-09"].display, f["trend.median_min.2026-10"].display]).toEqual(["2h 05m", "41 min", "9 min"]);
  });
});

function buildMonth(iso: string) { return new Date(Date.parse(iso) + 330 * 60000).toISOString().slice(0, 7); }

describe("mid-month alert data", () => {
  it("1–14 Nov: 25 vs 39 in 1–14 Oct (−36%)", () => {
    const r = midMonthComparison(un, "2026-11", "2026-10", 14);
    expect(r.current).toBe(25);
    expect(r.previous).toBe(39);
    expect(Math.round(r.change_pct!)).toBe(-36);
  });
});

describe("headline figures from metrics_json", () => {
  const f = buildMetricsJson(ds, URBAN_NEST, "2026-10", AS_OF).figures;
  it("display strings", () => {
    expect(f["enquiries.total"].display).toBe("86");
    expect(f["revenue.won"].display).toBe("₹36,80,000");
    expect(f["revenue.won"].variants).toContain("₹36.8L");
    expect(f["response.median_min"].display).toBe("9 min");
    expect(f["response.within15_pct"].display).toBe("78%");
    expect(f["source.google.conversion"].display).toBe("22.7%");
    expect(f["source.instagram.conversion"].display).toBe("9.7%");
    expect(f["cpl.instagram"].display).toBe("₹581");
    expect(f["cpw.google"].display).toBe("₹1,800");
    expect(f["campaign.top.enquiries"].value).toBe(17);
  });
  it("every figure has a traceId", () => {
    for (const fig of Object.values(f)) expect(fig.traceId).toBeTruthy();
  });
});

describe("clean November snapshot", () => {
  it("November leads are invisible while the demo clock is 1 Nov 9:00 AM", () => {
    const f = buildMetricsJson(ds, URBAN_NEST, "2026-11", AS_OF).figures;
    expect(f["enquiries.total"].value).toBeLessThan(25);
  });
});

describe("dedupe", () => {
  it("raw enquiries merge to unique leads, first touch wins", () => {
    const merged = dedupeRaw(unRaw);
    expect(merged.length).toBe(un.length);
    for (const l of un) {
      const m = merged.find((x) => x.raw_ids.includes(l.merged_raw_ids[0]))!;
      expect(m.raw_ids.sort()).toEqual([...l.merged_raw_ids].sort());
      expect(m.source).toBe(l.source);
    }
  });
  it("two raw enquiries with the same phone from different sources are one lead", () => {
    const base = { client_id: "x", payload: {}, phone_hash: "abc" };
    const out = dedupeRaw([
      { ...base, id: "r1", source: "google", source_record_id: "a", received_at: "2026-10-01T05:00:00.000Z" },
      { ...base, id: "r2", source: "instagram", source_record_id: "b", received_at: "2026-10-03T05:00:00.000Z" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("google");
    expect(out[0].raw_ids).toEqual(["r1", "r2"]);
  });
  it("same phone more than 30 days apart is a new lead", () => {
    const base = { client_id: "x", payload: {}, phone_hash: "abc", source: "google" as const, source_record_id: "a" };
    expect(dedupeRaw([
      { ...base, id: "r1", received_at: "2026-08-01T05:00:00.000Z" },
      { ...base, id: "r2", received_at: "2026-09-05T05:00:00.000Z" },
    ])).toHaveLength(2);
  });
  it("phone hashes are SHA-256 hex and duplicates share one", () => {
    expect(un.every((l) => /^[0-9a-f]{64}$/.test(l.phone_hash))).toBe(true);
    expect(new Set(un.map((l) => l.phone_hash)).size).toBe(un.length);
  });
});

describe("determinism", () => {
  it("seed is identical on every build", async () => {
    const { buildSeed } = await import("@/data/seed");
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(buildSeed()));
  });
});
