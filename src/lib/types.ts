import type { ClientMeta } from "@/data/clients";

export type SourceKey = "instagram" | "google" | "calls" | "website" | "whatsapp";
export const SOURCES: SourceKey[] = ["instagram", "google", "calls", "website", "whatsapp"];
export const SOURCE_LABEL: Record<SourceKey, string> = {
  instagram: "Instagram ads",
  google: "Google",
  calls: "Calls",
  website: "Website",
  whatsapp: "WhatsApp",
};
export const SOURCE_SHORT: Record<SourceKey, string> = { instagram: "Instagram", google: "Google", calls: "Calls", website: "Website", whatsapp: "WhatsApp" };
export const SOURCE_COLOR: Record<SourceKey, string> = {
  instagram: "#D946EF",
  google: "#3B82F6",
  calls: "#F59E0B",
  website: "#14B8A6",
  whatsapp: "#22C55E",
};

export type Stage = "new" | "contacted" | "site_visit" | "won" | "lost";
export type LostReason = "price" | "timeline" | "competitor" | "area" | "no_response" | "other";

export interface Lead {
  id: string;
  number: number;
  client_id: string;
  source: SourceKey;
  campaign: string;
  created_at: string; // ISO instant
  first_response_at: string | null;
  site_visit_at: string | null;
  closed_at: string | null;
  stage: Stage;
  deal_value: number | null;
  outcome_reason: LostReason | null;
  phone_hash: string;
  name_masked: string;
  phone_masked: string;
  locality: string;
  requirement: string;
  property: string;
  budget_band: string;
  owner: string;
  merged_raw_ids: string[];
}

export interface RawEnquiry {
  id: string;
  client_id: string;
  source: SourceKey;
  source_record_id: string;
  phone_hash: string;
  payload: Record<string, unknown>;
  received_at: string;
}

export type ConnectorType =
  | "website_forms" | "whatsapp_bot" | "meta_lead_ads" | "callcatch" | "slotpay" | "gbp_manual" | "google_sheet";
export interface Connector {
  id: string;
  client_id: string;
  type: ConnectorType;
  config_json: Record<string, unknown>;
  last_sync_at: string | null;
  status: "healthy" | "warning" | "failed";
  message: string;
}

export interface AdSpend { id: string; client_id: string; month: string; platform: "meta" | "google"; amount: number }
export interface CareActivity { id: string; client_id: string; month: string; type: "post" | "update" | "fix" | "uptime"; count: number }
export interface GbpMetrics { client_id: string; month: string; calls: number; direction_requests: number; website_clicks: number; source: "api" | "manual" }

export type ReportStatus = "generated" | "in_review" | "approved" | "sent" | "blocked";
export interface MonthlyReport {
  id: string;
  client_id: string;
  month: string; // "2026-10"
  metrics_json: unknown | null;
  narrative_json: unknown | null;
  narrative_source: "llm" | "template";
  guard_result: unknown | null;
  pdf_url: string | null;
  status: ReportStatus;
  generated_at: string | null;
  sent_at: string | null;
  data_changed_since_generation: boolean;
}

export interface ClientRow extends ClientMeta {
  logo_url: string | null;
  report_day: number;
  review_required: boolean;
  onboarded_month: string; // "2026-08"
}

export interface DataSet {
  clients: ClientRow[];
  connectors: Connector[];
  rawEnquiries: RawEnquiry[];
  leads: Lead[];
  adSpend: AdSpend[];
  careActivity: CareActivity[];
  gbpMetrics: GbpMetrics[];
  monthlyReports: MonthlyReport[];
}
