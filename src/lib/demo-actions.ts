import { toast } from "sonner";
import { URBAN_NEST } from "@/data/seed";
import { phoneHash } from "@/lib/hash";
import { fmtDate } from "@/lib/format";
import { buildMetricsJson } from "@/lib/metrics";
import { istMs, iso } from "@/lib/time";
import { SOURCE_LABEL, type Lead, type SourceKey } from "@/lib/types";
import { currentDataset } from "@/store/data";
import { useDemo } from "@/store/demo";
import { pushBot } from "@/lib/whatsapp/actions";

const st = () => useDemo.getState();
const clock = () => new Date(st().demoClock);
const LIVE: { source: SourceKey; campaign: string; name: string }[] = [
  { source: "instagram", campaign: "Diwali Modular Kitchen Offer", name: "Riya S." },
  { source: "google", campaign: "Search · interior designer Thane", name: "Kunal M." },
  { source: "website", campaign: "Website contact form", name: "Pallavi D." },
  { source: "calls", campaign: "AI receptionist (calls)", name: "Hemant K." },
  { source: "whatsapp", campaign: "WhatsApp chatbot", name: "Anita R." },
];

/** A brand-new enquiry arrives now. It shows in the leads table with a live response timer. */
export function injectLiveLead(): Lead {
  const ds = currentDataset();
  const n = Math.max(...ds.leads.filter((l) => l.client_id === URBAN_NEST).map((l) => l.number)) + 1;
  const pick = LIVE[(n - 1) % LIVE.length];
  const digits = String(7000000000 + ((n * 7919) % 999999999)).slice(0, 10);
  const lead: Lead = {
    id: `ld_live_${n}`, number: n, client_id: URBAN_NEST, source: pick.source, campaign: pick.campaign,
    created_at: st().demoClock, first_response_at: null, site_visit_at: null, closed_at: null, stage: "new", deal_value: null, outcome_reason: null,
    phone_hash: phoneHash("+91" + digits, "demo-live"), phone_masked: `+91 ${digits.slice(0, 2)}XXX XX${digits.slice(7)}`, name_masked: pick.name,
    locality: "Thane West", requirement: "Modular kitchen", property: "2BHK", budget_band: "₹8–12L", owner: "Neha (Designer)", merged_raw_ids: [`raw_live_${n}`],
  };
  st().addLead(lead);
  st().startLiveTimer(lead.id);
  toast.info(`New enquiry #${n} from ${SOURCE_LABEL[pick.source]}`, { description: `${pick.name} · reply within 15 minutes` });
  pushBot({ text: `🔔 New enquiry #${n} from ${SOURCE_LABEL[pick.source]}: ${pick.name}, Modular kitchen, Thane West. Reply within 15 minutes to win it.` });
  return lead;
}

/** Marks a live lead as answered, stopping its timer. */
export function respondToLead(id: string) {
  const started = st().liveTimers[id];
  const at = iso(+clock() + (started ? Date.now() - started : 0));
  st().patchLead(id, { first_response_at: at, stage: "contacted" });
  toast.success("Reply recorded");
}

/** Jump to 15 Nov 2026, 9:00 AM IST and raise the mid-month drop alert. */
export function jumpTo15Nov() {
  const s = st();
  s.setDemoClock(iso(istMs(2026, 11, 15, 9, 0)));
  const f = buildMetricsJson(currentDataset(), URBAN_NEST, "2026-11", clock()).figures;
  const drop = f["midmonth.change_pct"];
  if (drop && drop.value <= -25) {
    const text = `⚠️ Mid-month alert: enquiries are down ${Math.abs(Math.round(drop.value))}% versus the same point last month (${f["midmonth.current"].display} vs ${f["midmonth.previous"].display} by 14 Nov).`;
    toast.warning(`Enquiries are down ${Math.abs(Math.round(drop.value))}% versus the same point last month`, { description: `Demo clock: ${fmtDate(clock())}` });
    if (s.alertSentFor !== "2026-11") { pushBot({ text }); s.setAlertSent("2026-11"); }
  }
}

export function resetDemo() {
  st().reset();
  toast.success("Demo reset to its initial state");
}
