import { SOURCES, SOURCE_LABEL, type DataSet, type Lead, type RawEnquiry, type SourceKey } from "@/lib/types";
import { inr, inrShort, minutesLabel } from "@/lib/format";
import { addMonths, dayOfMonthIST, isWeekendIST, monthOf, prevMonth, weekNo } from "@/lib/time";
import { SQL_VIEWS } from "@/lib/sql/generated";
import { asOfLeads, asOfRaw } from "./asof";
import {
  SPEED_BUCKETS, SPEED_BUCKET_LABEL, inMonth, isContacted, isSiteVisit, isWithin15, isWon, monthLeads, responseMin, speedBucket,
} from "./predicates";
import { median, sum } from "./util";
import { vMonthlyHeadline } from "./headline";
import { vSourceBreakdown } from "./sources";
import { vWeeklyEnquiries } from "./weekly";
import { vSpeedToLead } from "./speed";
import { vFunnel } from "./funnel";
import { vMissedOpportunities } from "./missed";
import { vCostPerLead } from "./cost";
import { vCampaigns, vLostReasons } from "./campaigns";

export type MetricUnit = "count" | "percent" | "inr" | "minutes";
export interface MetricFigure { key: string; value: number; display: string; unit: MetricUnit; traceId: string; variants?: string[] }

export interface Ctx {
  ds: DataSet; clientId: string; month: string; prev: string; asOf: Date;
  leads: Lead[]; raws: RawEnquiry[];
  /** Per-build cache so each month/missed/campaign list is computed once, not once per figure. */
  memo: Map<string, unknown>;
}
const memo = <T,>(c: Ctx, key: string, fn: () => T): T => {
  if (!c.memo.has(key)) c.memo.set(key, fn());
  return c.memo.get(key) as T;
};
export function makeCtx(ds: DataSet, clientId: string, month: string, asOf: Date): Ctx {
  return {
    ds, clientId, month, prev: prevMonth(month), asOf,
    leads: asOfLeads(ds.leads.filter((l) => l.client_id === clientId), asOf),
    raws: asOfRaw(ds.rawEnquiries.filter((r) => r.client_id === clientId), asOf),
    memo: new Map(),
  };
}

export type TraceRows =
  | { kind: "lead"; rows: Lead[] }
  | { kind: "raw"; rows: RawEnquiry[] }
  | { kind: "table"; rows: object[] };

interface Def {
  key: string;
  unit: MetricUnit;
  view: string; // key into SQL_VIEWS, or "" when `sql` is given
  sql?: string;
  definition: string;
  rows: (c: Ctx) => TraceRows;
  /** Count figures are exactly rows.length. Others compute from earlier figures. */
  value?: (c: Ctx, g: (k: string) => number) => number | null;
  display?: (v: number) => string;
}

// ───────── display helpers ─────────
const dCount = (v: number) => Math.round(v).toLocaleString("en-IN");
const dPct0 = (v: number) => `${Math.round(v)}%`;
const dPct1 = (v: number) => `${v.toFixed(1)}%`;
const dPct2 = (v: number) => `${v.toFixed(2)}%`;
const dSigned = (v: number) => `${v >= 0 ? "+" : "-"}${Math.abs(Math.round(v))}%`;
const defaultDisplay: Record<MetricUnit, (v: number) => string> = { count: dCount, percent: dPct0, inr: inr, minutes: minutesLabel };
function variantsOf(unit: MetricUnit, v: number, display: string): string[] {
  const out = new Set<string>([display]);
  if (unit === "inr") { out.add(inr(v)); if (v >= 1e5) out.add(inrShort(v)); if (v >= 1e5) out.add(`₹${(v / 1e5).toFixed(1).replace(/\.0$/, "")} lakh`); }
  if (unit === "minutes") { out.add(`${Math.round(v)} minutes`); out.add(`${Math.round(v)} min`); }
  if (unit === "percent") { out.add(`${Math.round(v)}%`); out.add(`${v.toFixed(1)}%`); }
  if (unit === "count") out.add(String(Math.round(v)));
  return [...out];
}

const leadRows = (rows: Lead[]): TraceRows => ({ kind: "lead", rows });
const L = (c: Ctx, m = c.month): Lead[] => memo(c, `L:${m}`, () => monthLeads(c.leads, m));
/** day-of-month and week-of-month per lead, computed once. */
const when = (c: Ctx) => memo(c, "when", () => new Map(c.leads.map((l) => [l.id, { day: dayOfMonthIST(l.created_at), week: weekNo(l.created_at) }])));
const rawInMonth = (c: Ctx) => c.raws.filter((r) => inMonth({ created_at: r.received_at }, c.month));

function defsFor(c: Ctx): Def[] {
  const defs: Def[] = [];
  const add = (d: Def) => defs.push(d);
  const spendRows = (c2: Ctx, month = c2.month): TraceRows => ({
    kind: "table", rows: c2.ds.adSpend.filter((a) => a.client_id === c2.clientId && a.month === `${month}-01`),
  });
  const spendOf = (platform: "meta" | "google") => (c2: Ctx) =>
    c2.ds.adSpend.find((a) => a.client_id === c2.clientId && a.month === `${c2.month}-01` && a.platform === platform)?.amount ?? 0;

  // headline
  add({ key: "enquiries.total", unit: "count", view: "v_monthly_headline", definition: "Unique enquiries (after de-duplicating by phone number) created in the month.", rows: (c) => leadRows(L(c)) });
  add({ key: "enquiries.raw", unit: "count", view: "v_monthly_headline", definition: "Every enquiry received in the month before de-duplication, across all sources.", rows: (c) => ({ kind: "raw", rows: rawInMonth(c) }) });
  add({
    key: "enquiries.duplicates", unit: "count", view: "v_monthly_headline",
    definition: "Raw enquiries merged into an existing lead (same phone number, different source, within 30 days; first-touch source wins).",
    rows: (c) => { const ids = new Set(L(c).flatMap((l) => l.merged_raw_ids.slice(1))); return { kind: "raw", rows: rawInMonth(c).filter((r) => ids.has(r.id)) }; },
  });
  add({ key: "enquiries.prev", unit: "count", view: "v_monthly_headline", definition: "Unique enquiries in the previous month.", rows: (c) => leadRows(L(c, c.prev)) });
  add({
    key: "enquiries.change_pct", unit: "percent", view: "v_monthly_headline", definition: "Change in unique enquiries versus the previous month: (this month − last month) ÷ last month.",
    rows: (c) => leadRows(L(c)), display: dSigned,
    value: (_c, g) => { const p = g("enquiries.prev"); return p ? ((g("enquiries.total") - p) / p) * 100 : null; },
  });
  add({ key: "contacted.total", unit: "count", view: "v_funnel", definition: "Enquiries that received a first response (first_response_at is set).", rows: (c) => leadRows(L(c).filter(isContacted)) });
  add({ key: "meetings.total", unit: "count", view: "v_funnel", definition: "Enquiries that reached a meeting or site visit (site_visit_at is set).", rows: (c) => leadRows(L(c).filter(isSiteVisit)) });
  add({ key: "won.total", unit: "count", view: "v_monthly_headline", definition: "Enquiries from the month that were won (stage = won).", rows: (c) => leadRows(L(c).filter(isWon)) });
  add({ key: "won.prev", unit: "count", view: "v_monthly_headline", definition: "Enquiries from the previous month that were won.", rows: (c) => leadRows(L(c, c.prev).filter(isWon)) });
  add({
    key: "revenue.won", unit: "inr", view: "v_monthly_headline", definition: "Sum of owner-entered deal values on won enquiries from the month.",
    rows: (c) => leadRows(L(c).filter(isWon)), value: (c) => sum(L(c).filter(isWon).map((l) => l.deal_value ?? 0)),
  });
  add({
    key: "revenue.prev", unit: "inr", view: "v_monthly_headline", definition: "Revenue won on the previous month's enquiries.",
    rows: (c) => leadRows(L(c, c.prev).filter(isWon)), value: (c) => sum(L(c, c.prev).filter(isWon).map((l) => l.deal_value ?? 0)),
  });
  add({
    key: "conversion.overall", unit: "percent", view: "v_monthly_headline", definition: "Conversion = won ÷ unique enquiries.",
    rows: (c) => leadRows(L(c)), display: dPct1, value: (_c, g) => (g("enquiries.total") ? (100 * g("won.total")) / g("enquiries.total") : 0),
  });

  // speed to lead
  add({
    key: "response.median_min", unit: "minutes", view: "v_speed_to_lead", definition: "Median time from enquiry to first response, over contacted enquiries only.",
    rows: (c) => leadRows(L(c).filter(isContacted)),
    value: (c) => median(L(c).map(responseMin).filter((x): x is number => x !== null)),
  });
  add({
    key: "response.median_min.prev", unit: "minutes", view: "v_speed_to_lead", definition: "Median time to first response in the previous month.",
    rows: (c) => leadRows(L(c, c.prev).filter(isContacted)),
    value: (c) => median(L(c, c.prev).map(responseMin).filter((x): x is number => x !== null)),
  });
  add({ key: "response.within15", unit: "count", view: "v_speed_to_lead", definition: "Contacted enquiries answered within 15 minutes.", rows: (c) => leadRows(L(c).filter(isWithin15)) });
  add({
    key: "response.within15_pct", unit: "percent", view: "v_speed_to_lead", definition: "Share of contacted enquiries answered within 15 minutes.",
    rows: (c) => leadRows(L(c).filter(isContacted)), value: (_c, g) => (g("contacted.total") ? (100 * g("response.within15")) / g("contacted.total") : 0),
  });

  // missed
  const missed = (c: Ctx) => memo(c, "missed", () => vMissedOpportunities(c.leads, c.month, c.asOf));
  add({ key: "missed.total", unit: "count", view: "v_missed_opportunities", definition: "Enquiries never contacted and older than 24 hours at report time, or first answered more than 24 hours after arriving.", rows: (c) => leadRows(missed(c).map((m) => m.lead)) });
  add({ key: "missed.never", unit: "count", view: "v_missed_opportunities", definition: "Missed opportunities that were never contacted.", rows: (c) => leadRows(missed(c).filter((m) => m.reason === "never_contacted").map((m) => m.lead)) });
  add({ key: "missed.late", unit: "count", view: "v_missed_opportunities", definition: "Missed opportunities first answered more than 24 hours after arriving.", rows: (c) => leadRows(missed(c).filter((m) => m.reason === "late_response").map((m) => m.lead)) });
  add({ key: "missed.weekend_instagram", unit: "count", view: "v_missed_opportunities", definition: "Missed opportunities that came from Instagram ads on a Saturday or Sunday.", rows: (c) => leadRows(missed(c).filter((m) => m.lead.source === "instagram" && isWeekendIST(m.lead.created_at)).map((m) => m.lead)) });

  // sources
  for (const s of SOURCES) {
    add({ key: `source.${s}.enquiries`, unit: "count", view: "v_source_breakdown", definition: `Unique enquiries from ${SOURCE_LABEL[s]} in the month.`, rows: (c) => leadRows(L(c).filter((l) => l.source === s)) });
    add({ key: `source.${s}.won`, unit: "count", view: "v_source_breakdown", definition: `Won enquiries from ${SOURCE_LABEL[s]}.`, rows: (c) => leadRows(L(c).filter((l) => l.source === s && isWon(l))) });
    add({
      key: `source.${s}.conversion`, unit: "percent", view: "v_source_breakdown", definition: `Conversion for ${SOURCE_LABEL[s]} = won ÷ enquiries from that source.`,
      rows: (c) => leadRows(L(c).filter((l) => l.source === s)), display: dPct1,
      value: (_c, g) => (g(`source.${s}.enquiries`) ? (100 * g(`source.${s}.won`)) / g(`source.${s}.enquiries`) : 0),
    });
  }

  // spend and cost
  add({ key: "spend.meta", unit: "inr", view: "", sql: "select * from ad_spend where platform = 'meta' and month = :month;", definition: "Meta (Instagram) ad spend for the month, entered by Neovia.", rows: (c) => spendRows(c), value: spendOf("meta") });
  add({ key: "spend.google", unit: "inr", view: "", sql: "select * from ad_spend where platform = 'google' and month = :month;", definition: "Google Ads spend for the month, entered by Neovia.", rows: (c) => spendRows(c), value: spendOf("google") });
  add({ key: "spend.total", unit: "inr", view: "", sql: "select sum(amount) from ad_spend where month = :month;", definition: "Total paid-ad spend for the month.", rows: (c) => spendRows(c), value: (_c, g) => g("spend.meta") + g("spend.google") });
  for (const s of ["instagram", "google"] as const) {
    const plat = s === "instagram" ? "meta" : "google";
    add({
      key: `cpl.${s}`, unit: "inr", view: "v_cost_per_lead", definition: `Cost per lead = ${plat === "meta" ? "Meta" : "Google Ads"} spend ÷ unique enquiries from ${SOURCE_LABEL[s]}.`,
      rows: (c) => leadRows(L(c).filter((l) => l.source === s)),
      value: (c) => memo(c, "cost", () => vCostPerLead(c.leads, c.ds.adSpend, c.clientId, c.month)).find((r) => r.source === s)?.cost_per_lead ?? null,
    });
    add({
      key: `cpw.${s}`, unit: "inr", view: "v_cost_per_lead", definition: `Cost per win = ${plat === "meta" ? "Meta" : "Google Ads"} spend ÷ won enquiries from ${SOURCE_LABEL[s]}.`,
      rows: (c) => leadRows(L(c).filter((l) => l.source === s && isWon(l))),
      value: (c) => memo(c, "cost", () => vCostPerLead(c.leads, c.ds.adSpend, c.clientId, c.month)).find((r) => r.source === s)?.cost_per_win ?? null,
    });
  }

  add({
    key: "cpl.paid", unit: "inr", view: "v_cost_per_lead", definition: "Blended cost per lead = total paid-ad spend ÷ enquiries from paid sources (Instagram ads + Google).",
    rows: (c) => leadRows(L(c).filter((l) => l.source === "instagram" || l.source === "google")),
    value: (_c, g) => { const n = g("source.instagram.enquiries") + g("source.google.enquiries"); return g("spend.total") && n ? Math.round(g("spend.total") / n) : null; },
  });
  for (const b of SPEED_BUCKETS) {
    add({ key: `speed.bucket.${b}`, unit: "count", view: "v_speed_to_lead", definition: `Enquiries whose first response took ${SPEED_BUCKET_LABEL[b]} (the last bucket also includes enquiries never contacted).`, rows: (c) => leadRows(L(c).filter((l) => speedBucket(l) === b)) });
  }

  // top campaign
  const top = (c: Ctx) => memo(c, "top", () => vCampaigns(c.leads, c.month)[0]);
  add({ key: "campaign.top.enquiries", unit: "count", view: "v_campaigns", definition: "Enquiries from the campaign that brought in the most enquiries this month.", rows: (c) => leadRows(L(c).filter((l) => top(c) && l.campaign === top(c).campaign && l.source === top(c).source)) });
  add({ key: "campaign.top.won", unit: "count", view: "v_campaigns", definition: "Wins from the top campaign.", rows: (c) => leadRows(L(c).filter((l) => top(c) && l.campaign === top(c).campaign && l.source === top(c).source && isWon(l))) });

  // weeks
  for (let w = 1; w <= 5; w++) {
    add({ key: `week.${w}.enquiries`, unit: "count", view: "v_weekly_enquiries", definition: `Enquiries created in week ${w} of the month (days ${(w - 1) * 7 + 1}–${Math.min(w * 7, 31)}).`, rows: (c) => leadRows(L(c).filter((l) => when(c).get(l.id)!.week === w)) });
  }

  // funnel conversion steps
  add({ key: "funnel.contacted_pct", unit: "percent", view: "v_funnel", definition: "Contacted ÷ enquiries.", rows: (c) => leadRows(L(c)), display: dPct0, value: (_c, g) => (g("enquiries.total") ? (100 * g("contacted.total")) / g("enquiries.total") : 0) });
  add({ key: "funnel.meeting_pct", unit: "percent", view: "v_funnel", definition: "Meetings or site visits ÷ contacted.", rows: (c) => leadRows(L(c).filter(isContacted)), display: dPct0, value: (_c, g) => (g("contacted.total") ? (100 * g("meetings.total")) / g("contacted.total") : 0) });
  add({ key: "funnel.won_pct", unit: "percent", view: "v_funnel", definition: "Won ÷ meetings or site visits.", rows: (c) => leadRows(L(c).filter(isSiteVisit)), display: dPct0, value: (_c, g) => (g("meetings.total") ? (100 * g("won.total")) / g("meetings.total") : 0) });

  // lost reasons
  for (const r of ["price", "timeline", "competitor", "area", "no_response", "other"] as const) {
    add({ key: `lost.${r}`, unit: "count", view: "v_lost_reasons", definition: `Lost enquiries whose recorded reason is “${r.replace("_", " ")}”.`, rows: (c) => leadRows(L(c).filter((l) => l.stage === "lost" && l.outcome_reason === r)) });
  }

  // Neovia work + Google Business Profile (manual)
  const care = (type: "post" | "update" | "fix" | "uptime") => (c: Ctx) =>
    c.ds.careActivity.find((a) => a.client_id === c.clientId && a.month === `${c.month}-01` && a.type === type)?.count ?? null;
  const careRows = (c: Ctx): TraceRows => ({ kind: "table", rows: c.ds.careActivity.filter((a) => a.client_id === c.clientId && a.month === `${c.month}-01`) });
  const careSql = "select type, count from care_activity where month = :month;";
  add({ key: "care.posts", unit: "count", view: "", sql: careSql, definition: "Social posts published by Neovia this month.", rows: careRows, value: care("post") });
  add({ key: "care.updates", unit: "count", view: "", sql: careSql, definition: "Website content updates completed this month.", rows: careRows, value: care("update") });
  add({ key: "care.fixes", unit: "count", view: "", sql: careSql, definition: "Fixes completed this month.", rows: careRows, value: care("fix") });
  add({ key: "care.uptime", unit: "percent", view: "", sql: careSql, definition: "Website uptime for the month.", rows: careRows, display: dPct2, value: care("uptime") });
  const gbp = (f: "calls" | "direction_requests" | "website_clicks") => (c: Ctx) =>
    c.ds.gbpMetrics.find((g) => g.client_id === c.clientId && g.month === `${c.month}-01`)?.[f] ?? null;
  const gbpRows = (c: Ctx): TraceRows => ({ kind: "table", rows: c.ds.gbpMetrics.filter((g) => g.client_id === c.clientId && g.month === `${c.month}-01`) });
  const gbpSql = "select * from gbp_metrics where month = :month;  -- manual entry";
  add({ key: "gbp.calls", unit: "count", view: "", sql: gbpSql, definition: "Calls from the Google Business Profile (manual entry).", rows: gbpRows, value: gbp("calls") });
  add({ key: "gbp.directions", unit: "count", view: "", sql: gbpSql, definition: "Direction requests from the Google Business Profile (manual entry).", rows: gbpRows, value: gbp("direction_requests") });
  add({ key: "gbp.website_clicks", unit: "count", view: "", sql: gbpSql, definition: "Website clicks from the Google Business Profile (manual entry).", rows: gbpRows, value: gbp("website_clicks") });

  // 3-month response trend
  for (const k of [-2, -1, 0]) {
    const m = addMonths(c.month, k);
    add({
      key: `trend.median_min.${m}`, unit: "minutes", view: "v_speed_to_lead", definition: `Median time to first response for ${m}.`,
      rows: (c2) => leadRows(L(c2, m).filter(isContacted)),
      value: (c2) => median(L(c2, m).map(responseMin).filter((x): x is number => x !== null)),
    });
  }
  // mid-month: same point last month (only while the month is in progress)
  const midDay = monthOf(c.asOf.getTime()) === c.month ? dayOfMonthIST(c.asOf.getTime()) - 1 : 0;
  if (midDay >= 1) {
    const upTo = (c2: Ctx, m: string) => L(c2, m).filter((l) => when(c2).get(l.id)!.day <= midDay);
    add({ key: "midmonth.current", unit: "count", view: "v_weekly_enquiries", definition: `Enquiries received from day 1 to day ${midDay} of this month.`, rows: (c2) => leadRows(upTo(c2, c2.month)) });
    add({ key: "midmonth.previous", unit: "count", view: "v_weekly_enquiries", definition: `Enquiries received from day 1 to day ${midDay} of last month (the same point in the month).`, rows: (c2) => leadRows(upTo(c2, c2.prev)) });
    add({
      key: "midmonth.change_pct", unit: "percent", view: "v_weekly_enquiries", definition: "Change in enquiries versus the same point last month.", rows: (c2) => leadRows(upTo(c2, c2.month)), display: dSigned,
      value: (_c2, g) => (g("midmonth.previous") ? ((g("midmonth.current") - g("midmonth.previous")) / g("midmonth.previous")) * 100 : null),
    });
  }
  if (midDay >= 1) {
    add({
      key: "midmonth.drop_pct", unit: "percent", view: "v_weekly_enquiries", definition: "How far enquiries are below the same point last month (a positive number means a drop).", rows: (c2) => leadRows(L(c2, c2.month).filter((l) => when(c2).get(l.id)!.day <= midDay)), display: (v) => `${Math.round(Math.abs(v))}%`,
      value: (_c2, g) => (g("midmonth.previous") ? ((g("midmonth.previous") - g("midmonth.current")) / g("midmonth.previous")) * 100 : null),
    });
  }
  add({
    key: "revenue.change_pct", unit: "percent", view: "v_monthly_headline", definition: "Change in revenue won versus the previous month.", rows: (c) => leadRows(L(c).filter(isWon)), display: dSigned,
    value: (_c, g) => { const p = g("revenue.prev"); return p ? ((g("revenue.won") - p) / p) * 100 : null; },
  });
  return defs;
}

function computeFigures(c: Ctx, defs: Def[], stopAt?: string): Record<string, MetricFigure> {
  const figures: Record<string, MetricFigure> = {};
  const g = (k: string) => figures[k]?.value ?? 0;
  for (const d of defs) {
    const value = d.value ? d.value(c, g) : d.rows(c).rows.length;
    if (value !== null && !Number.isNaN(value)) {
      const noBaseline =
        (d.key === "enquiries.prev" && value === 0) || // no prior data (e.g. first month)
        (d.key.startsWith("trend.") && value === 0 && !L(c, d.key.slice(-7)).length) ||
        (d.key === "enquiries.change_pct" && !figures["enquiries.prev"]) ||
        (d.key === "revenue.change_pct" && !figures["revenue.prev"]?.value);
      if (!noBaseline) {
        const display = (d.display ?? defaultDisplay[d.unit])(value);
        figures[d.key] = { key: d.key, value, display, unit: d.unit, traceId: d.key, variants: variantsOf(d.unit, value, display) };
      }
    }
    if (d.key === stopAt) break;
  }
  return figures;
}

export interface MetricsJson {
  clientId: string; month: string; generatedAt: string;
  figures: Record<string, MetricFigure>;
  labels: Record<string, string>;
  tables: {
    headline: ReturnType<typeof vMonthlyHeadline>; sources: ReturnType<typeof vSourceBreakdown>;
    weekly: ReturnType<typeof vWeeklyEnquiries>; speed: ReturnType<typeof vSpeedToLead>; funnel: ReturnType<typeof vFunnel>;
    campaigns: ReturnType<typeof vCampaigns>; cost: ReturnType<typeof vCostPerLead>; lostReasons: ReturnType<typeof vLostReasons>;
    missed: { lead_number: number; source: SourceKey; created_at: string; reason: string; age_hours: number }[];
  };
}

/** Every figure a report or narrative needs, precomputed with display strings. The LLM never calculates. */
export function buildMetricsJson(ds: DataSet, clientId: string, month: string, asOf: Date): MetricsJson {
  const c = makeCtx(ds, clientId, month, asOf);
  const figures = computeFigures(c, defsFor(c));

  const campaigns = vCampaigns(c.leads, month);
  const sources = vSourceBreakdown(c.leads, month);
  const best = [...sources].filter((s) => s.enquiries >= 5).sort((a, b) => b.conversion_pct - a.conversion_pct)[0];
  const labels: Record<string, string> = {
    month, top_campaign: campaigns[0]?.campaign ?? "", top_campaign_source: campaigns[0]?.source ?? "",
    best_source: best?.source ?? "", best_source_label: best ? SOURCE_LABEL[best.source] : "",
  };
  const missed = vMissedOpportunities(c.leads, month, asOf).map((m) => ({
    lead_number: m.lead.number, source: m.lead.source, created_at: m.lead.created_at, reason: m.reason,
    age_hours: Math.round((Math.min(+asOf, Date.parse(m.lead.created_at) + 1e12) - Date.parse(m.lead.created_at)) / 3_600_000),
  }));
  return {
    clientId, month, generatedAt: asOf.toISOString(), figures, labels,
    tables: {
      headline: vMonthlyHeadline(c.leads, c.raws, month), sources, weekly: vWeeklyEnquiries(c.leads, month),
      speed: vSpeedToLead(c.leads, month), funnel: vFunnel(c.leads, month), campaigns,
      cost: vCostPerLead(c.leads, ds.adSpend, clientId, month), lostReasons: vLostReasons(c.leads, month), missed,
    },
  };
}

export interface Trace {
  traceId: string; key: string; unit: MetricUnit; value: number; display: string;
  definition: string; view: string; sql: string; baseSql: string | null;
  rowKind: TraceRows["kind"]; rows: TraceRows["rows"];
}
/** Drill-down for any figure: definition, SQL view text, and the contributing rows. */
export function getTrace(ds: DataSet, clientId: string, month: string, asOf: Date, traceId: string): Trace | null {
  const c = makeCtx(ds, clientId, month, asOf);
  const defs = defsFor(c);
  const d = defs.find((x) => x.key === traceId);
  const fig = d ? computeFigures(c, defs, traceId)[traceId] : undefined;
  if (!d || !fig) return null;
  const rows = d.rows(c);
  const usesBase = d.view !== "" && SQL_VIEWS[d.view]?.includes("v_lead_base");
  return {
    traceId, key: d.key, unit: d.unit, value: fig.value, display: fig.display, definition: d.definition,
    view: d.view || "(table query)", sql: d.view ? SQL_VIEWS[d.view] : d.sql ?? "", baseSql: usesBase ? SQL_VIEWS["v_lead_base"] : null,
    rowKind: rows.kind, rows: rows.rows,
  };
}
export const metricKeys = (ds: DataSet, clientId: string, month: string, asOf: Date) => defsFor(makeCtx(ds, clientId, month, asOf)).map((d) => d.key);

/** Plain-English definitions for a set of figure keys (report appendix). */
export function metricDefinitions(ds: DataSet, clientId: string, month: string, asOf: Date, keys: string[]): { key: string; definition: string }[] {
  const defs = defsFor(makeCtx(ds, clientId, month, asOf));
  return keys.flatMap((key) => { const d = defs.find((x) => x.key === key); return d ? [{ key, definition: d.definition }] : []; });
}
