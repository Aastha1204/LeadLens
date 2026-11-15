import { PLAN_LABEL, PLAN_PRICE } from "@/data/clients";
import type { ClientRow, Connector, DataSet, MonthlyReport, ReportStatus } from "@/lib/types";
import type { ReportOverride } from "@/store/demo";

export interface AdminState {
  reports: Record<string, ReportOverride>;
  connectorOverrides: Record<string, Connector["status"]>;
  reviewRequiredBy: Record<string, boolean>;
  changedReports: string[];
}

export const CONNECTOR_LABEL: Record<Connector["type"], string> = {
  website_forms: "Website forms", whatsapp_bot: "WhatsApp bot", meta_lead_ads: "Meta Lead Ads", callcatch: "CallCatch (AI receptionist)",
  slotpay: "SlotPay", gbp_manual: "Google Business Profile", google_sheet: "Google Sheet",
};

export function effectiveConnectors(ds: DataSet, st: Pick<AdminState, "connectorOverrides">): Connector[] {
  return ds.connectors.map((c) => {
    const o = st.connectorOverrides[c.id];
    if (!o) return c;
    return { ...c, status: o, message: o === "healthy" ? "Fixed · synced OK" : o === "failed" ? "Token expired (demo)" : "Slow responses" };
  });
}

export function reviewRequired(client: ClientRow, st: Pick<AdminState, "reviewRequiredBy">): boolean {
  return st.reviewRequiredBy[client.id] ?? client.review_required;
}

export interface EffectiveReport {
  report: MonthlyReport;
  client: ClientRow;
  status: ReportStatus;
  blockedBy: Connector[];
  changed: boolean;
  generatedAt: string | null;
  sentAt: string | null;
  override?: ReportOverride;
}

/** Report state as admin sees it: seed + overrides, blocked while any connector is failing. */
export function effectiveReports(ds: DataSet, st: AdminState): EffectiveReport[] {
  const conns = effectiveConnectors(ds, st);
  return ds.monthlyReports.map((report) => {
    const client = ds.clients.find((c) => c.id === report.client_id)!;
    const o = st.reports[report.id];
    const base: ReportStatus = o?.status ?? (report.status === "blocked" ? "generated" : report.status);
    const blockedBy = base === "sent" ? [] : conns.filter((c) => c.client_id === client.id && c.status === "failed");
    return {
      report, client, override: o, blockedBy,
      status: blockedBy.length ? "blocked" : base,
      changed: st.changedReports.includes(report.id),
      generatedAt: o?.generatedAt ?? report.generated_at,
      sentAt: o?.sentAt ?? report.sent_at,
    };
  });
}

/** Monthly recurring revenue from plan prices. */
export function mrr(clients: Pick<ClientRow, "plan">[]): number {
  return clients.reduce((a, c) => a + PLAN_PRICE[c.plan], 0);
}
export { PLAN_LABEL, PLAN_PRICE };

/** "Month 3" for a client onboarded in 2026-08 looking at 2026-10. */
export function monthsOnPlan(client: Pick<ClientRow, "onboarded_month">, month: string): number {
  const [y1, m1] = client.onboarded_month.split("-").map(Number);
  const [y2, m2] = month.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

export interface SendCheck { canSend: boolean; reasons: string[] }
export function sendCheck(r: EffectiveReport, guardOk: boolean): SendCheck {
  const reasons: string[] = [];
  if (r.blockedBy.length) reasons.push(...r.blockedBy.map((c) => `${CONNECTOR_LABEL[c.type]} is failing: ${c.message}`));
  if (!guardOk) reasons.push("The commentary contains figures that do not match your data.");
  if (r.status === "sent") reasons.push("Already sent.");
  return { canSend: reasons.length === 0, reasons };
}
