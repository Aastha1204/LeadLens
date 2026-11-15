import { describe, it, expect } from "vitest";
import { getSeed, URBAN_NEST } from "@/data/seed";
import { buildMetricsJson, getTrace } from "@/lib/metrics";
import { istMs } from "@/lib/time";
import { useDemo } from "@/store/demo";
import { applyPatches } from "@/store/data";

const ds = getSeed();
const NOV15 = new Date(istMs(2026, 11, 15, 9, 0));

describe("mid-month alert (jump to 15 Nov)", () => {
  const f = buildMetricsJson(ds, URBAN_NEST, "2026-11", NOV15).figures;
  it("25 enquiries vs 39 at the same point last month, down 36%", () => {
    expect(f["midmonth.current"].value).toBe(25);
    expect(f["midmonth.previous"].value).toBe(39);
    expect(f["midmonth.change_pct"].display).toBe("-36%");
    expect(f["midmonth.drop_pct"].display).toBe("36%");
  });
  it("trace rows equal the figure", () => {
    for (const k of ["midmonth.current", "midmonth.previous"]) expect(getTrace(ds, URBAN_NEST, "2026-11", NOV15, k)!.rows.length).toBe(f[k].value);
  });
  it("no alert figures at the default clock (1 Nov, 9:00 AM)", () => {
    expect(buildMetricsJson(ds, URBAN_NEST, "2026-11", new Date("2026-11-01T03:30:00.000Z")).figures["midmonth.change_pct"]).toBeUndefined();
  });
  it("November's enquiry total at 15 Nov is 25 and the October report is unaffected", () => {
    expect(f["enquiries.total"].value).toBe(25);
    expect(buildMetricsJson(ds, URBAN_NEST, "2026-10", NOV15).figures["enquiries.total"].value).toBe(86);
  });
});

describe("injected live lead", () => {
  it("appears in November and counts as an enquiry with no response yet", () => {
    const lead = { ...ds.leads.find((l) => l.number === 228)!, id: "ld_live_253", number: 253, created_at: "2026-11-15T03:30:00.000Z", first_response_at: null, stage: "new" as const, site_visit_at: null, closed_at: null, deal_value: null, outcome_reason: null };
    const f = buildMetricsJson(applyPatches(ds, {}, [lead]), URBAN_NEST, "2026-11", new Date("2026-11-15T04:00:00.000Z")).figures;
    expect(f["enquiries.total"].value).toBe(26);
  });
});

describe("reset", () => {
  const snap = () => JSON.stringify(Object.fromEntries(Object.entries(useDemo.getState()).filter(([k, v]) => typeof v !== "function" && k !== "hydrated")));
  it("restores the initial state exactly", () => {
    const initial = snap();
    const s = useDemo.getState();
    s.setRole("owner"); s.setTheme("dark"); s.setDemoClock("2026-11-15T03:30:00.000Z"); s.togglePhone(true); s.togglePanel(true); s.setTourStep(3);
    s.setReviewRequired("c1", false); s.setConnectorStatus("cn_c1_meta_lead_ads", "failed"); s.patchReport("LL-UN-2026-10", { status: "sent" });
    s.patchLead("ld_186", { stage: "won" }); s.markReminded("ld_188"); s.markReportChanged("LL-UN-2026-10"); s.setLang("hi"); s.setSound(true);
    s.pushChat({ id: "x", from: "user", kind: "text", text: "hi", at: "2026-11-01T03:30:00.000Z" });
    s.startLiveTimer("ld_live_253"); s.setAlertSent("2026-11");
    expect(snap()).not.toBe(initial);
    useDemo.getState().reset();
    expect(snap()).toBe(initial);
  });
});
