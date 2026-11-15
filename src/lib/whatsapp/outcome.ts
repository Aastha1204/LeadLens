import { buildMetricsJson } from "@/lib/metrics";
import { inr } from "@/lib/format";
import { iso } from "@/lib/time";
import { SOURCE_SHORT, type DataSet, type Lead } from "@/lib/types";
import { applyPatches } from "@/store/data";
import { REASON_LABEL, type Command } from "./parser";

export type OutcomeCmd = Extract<Command, { kind: "won" | "lost" }>;
export type OutcomeResult =
  | { ok: true; leadId: string; leadNumber: number; month: string; patch: Partial<Lead>; message: string }
  | { ok: false; message: string };

const monthName = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleString("en-IN", { month: "long", timeZone: "UTC" });
export const describeLead = (l: Lead) => `Lead #${l.number} (${l.name_masked} · ${SOURCE_SHORT[l.source]} · ${l.requirement})`;

/**
 * The one handler behind both WhatsApp replies and the outcome form.
 * Pure: returns the patch to apply and the confirmation text (computed on the updated data).
 */
export function computeOutcome(ds: DataSet, clientId: string, cmd: OutcomeCmd, now: Date): OutcomeResult {
  const lead = ds.leads.find((l) => l.client_id === clientId && l.number === cmd.lead && Date.parse(l.created_at) <= +now);
  if (!lead) return { ok: false, message: `I couldn't find lead #${cmd.lead}. Check the number and try again, for example WON 186 120000.` };
  const at = iso(+now);
  const patch: Partial<Lead> =
    cmd.kind === "won"
      ? { stage: "won", deal_value: cmd.amount, closed_at: at, outcome_reason: null, first_response_at: lead.first_response_at ?? at, site_visit_at: lead.site_visit_at ?? at }
      : { stage: "lost", deal_value: null, closed_at: at, outcome_reason: cmd.reason };
  const month = new Date(Date.parse(lead.created_at) + 330 * 60000).toISOString().slice(0, 7);
  const f = buildMetricsJson(applyPatches(ds, { [lead.id]: patch }, []), clientId, month, now).figures;
  const name = monthName(month);
  const message =
    cmd.kind === "won"
      ? `✅ ${describeLead(lead)} marked WON at ${inr(cmd.amount)}. ${name} now: ${f["won.total"].display} won, ${f["revenue.won"].display} revenue.`
      : `✅ ${describeLead(lead)} marked LOST (${REASON_LABEL[cmd.reason]}). ${name} lost reasons updated: ${REASON_LABEL[cmd.reason]} now ${f[`lost.${cmd.reason}`]?.display ?? "1"}.`;
  return { ok: true, leadId: lead.id, leadNumber: lead.number, month, patch, message };
}
