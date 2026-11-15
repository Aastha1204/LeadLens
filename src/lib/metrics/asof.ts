import type { Lead, RawEnquiry } from "@/lib/types";

/** The world as seen at `asOf`: later leads vanish, later timestamps are unset. */
export function asOfLeads(leads: Lead[], asOf: Date): Lead[] {
  const t = +asOf;
  const fut = (x: string | null) => x !== null && Date.parse(x) > t;
  return leads
    .filter((l) => Date.parse(l.created_at) <= t)
    .map((l) => {
      if (!fut(l.first_response_at) && !fut(l.site_visit_at) && !fut(l.closed_at)) return l;
      const c: Lead = { ...l };
      if (fut(c.first_response_at)) c.first_response_at = null;
      if (fut(c.site_visit_at)) c.site_visit_at = null;
      if (fut(c.closed_at)) { c.closed_at = null; c.deal_value = null; c.outcome_reason = null;
        c.stage = c.site_visit_at ? "site_visit" : c.first_response_at ? "contacted" : "new"; }
      return c;
    });
}
export const asOfRaw = (raws: RawEnquiry[], asOf: Date) => raws.filter((r) => Date.parse(r.received_at) <= +asOf);
