import type { MetricsJson } from "@/lib/metrics";
import { SOURCE_LABEL, type SourceKey } from "@/lib/types";

export type Service = "review_automation" | "whatsapp_followup" | "meta_ads" | "ai_call_answering" | "online_booking" | "content_updates";
export type Part = { text: string } | { metric: string; text: string };
export interface Recommendation { title: string; body: string; parts: Part[]; evidence: string[]; service: Service }
export interface Narrative { headline: string; recommendations: Recommendation[] }

export const SERVICE_LABEL: Record<Service, string> = {
  review_automation: "Review automation",
  whatsapp_followup: "WhatsApp follow-up",
  meta_ads: "Meta ads",
  ai_call_answering: "AI call answering",
  online_booking: "Online booking",
  content_updates: "Content updates",
};

type Arg = string | { k: string };
const k = (key: string): Arg => ({ k: key });

/** Text where every figure is a clickable metric reference: seg`won ${k("won.total")} leads`. */
function makeSeg(m: MetricsJson) {
  return (strings: TemplateStringsArray, ...args: Arg[]) => {
    const parts: Part[] = [];
    const evidence: string[] = [];
    const pushText = (t: string) => {
      if (!t) return;
      const last = parts[parts.length - 1];
      if (last && !("metric" in last)) last.text += t; else parts.push({ text: t });
    };
    strings.forEach((s, i) => {
      pushText(s);
      const a = args[i];
      if (a === undefined) return;
      if (typeof a === "string") pushText(a);
      else { parts.push({ metric: a.k, text: m.figures[a.k]?.display ?? "—" }); evidence.push(a.k); }
    });
    return { parts, evidence };
  };
}
const join = (parts: Part[]) => parts.map((p) => p.text).join("");
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Deterministic recommendations from metrics_json. The default, so the demo works offline. */
export function templateNarrative(m: MetricsJson): Narrative {
  const f = m.figures;
  const v = (key: string) => f[key]?.value ?? 0;
  const seg = makeSeg(m);
  const recs: Recommendation[] = [];
  const add = (title: string, s: { parts: Part[]; evidence: string[] }, tail: string, service: Service) =>
    recs.push({ title, body: join(s.parts) + tail, parts: [...s.parts, { text: tail }], evidence: s.evidence, service });

  // 1. strongest source
  const best = (m.labels.best_source || "google") as SourceKey;
  const other: SourceKey = best === "instagram" ? "google" : "instagram";
  const bestLabel = SOURCE_LABEL[best];
  const service: Service = best === "google" ? "review_automation" : best === "instagram" ? "meta_ads" : best === "calls" ? "ai_call_answering" : "content_updates";
  const closing = best === "google" ? " More Google reviews would strengthen this channel." : " Putting more behind this channel would pay off.";
  const b = (s: string) => k(`source.${best}.${s}`);
  const o = (s: string) => k(`source.${other}.${s}`);
  const s1 = v(`source.${other}.enquiries`) > 0
    ? seg`${bestLabel} enquiries converted at ${b("conversion")} (${b("won")} of ${b("enquiries")}), compared with ${o("conversion")} (${o("won")} of ${o("enquiries")}) from ${SOURCE_LABEL[other]}.`
    : seg`${bestLabel} enquiries converted at ${b("conversion")} (${b("won")} of ${b("enquiries")}).`;
  add(`Grow ${bestLabel} — it converts best.`, s1, closing, service);

  // 2. missed follow-ups, else keep replies fast
  if (v("missed.total") > 0) {
    const weekend = v("missed.weekend_instagram") > 0;
    const s = weekend
      ? seg`${k("missed.total")} enquiries got no follow-up within 24 hours, and ${k("missed.weekend_instagram")} of them came from weekend Instagram ads.`
      : seg`${k("missed.total")} enquiries got no follow-up within 24 hours.`;
    add(weekend ? "Close the weekend gap." : "Follow up every enquiry.", s,
      weekend ? " Weekend auto-replies and reminders would catch these." : " Auto-replies and reminders would catch these.", "whatsapp_followup");
  } else {
    add("Keep replies fast.", seg`${k("response.within15_pct")} of enquiries were answered within 15 minutes, with a median reply of ${k("response.median_min")}.`,
      " Keep automatic replies switched on to hold this pace.", "whatsapp_followup");
  }

  // 3. top campaign
  const camp = m.labels.top_campaign;
  if (camp) {
    const diwali = /diwali/i.test(camp);
    add(/kitchen/i.test(camp) ? "Extend the kitchen offer." : "Repeat your top campaign.",
      seg`The ${camp} was the top campaign with ${k("campaign.top.enquiries")} enquiries and ${k("campaign.top.won")} ${plural(v("campaign.top.won"), "win", "wins")}.`,
      diwali ? " A post-Diwali version could keep the momentum going in November." : " A fresh version could keep the momentum going next month.",
      m.labels.top_campaign_source === "instagram" ? "meta_ads" : "content_updates");
  }

  const name = new Date(`${m.month}-01T12:00:00Z`).toLocaleString("en-IN", { month: "long", timeZone: "UTC" });
  const change = f["enquiries.change_pct"];
  const h = change
    ? seg`${name}: ${k("enquiries.total")} enquiries (${k("enquiries.change_pct")}), ${k("won.total")} won, median reply time ${k("response.median_min")}.`
    : seg`${name}: ${k("enquiries.total")} enquiries, ${k("won.total")} won, median reply time ${k("response.median_min")}.`;
  return { headline: join(h.parts), recommendations: recs.slice(0, 3) };
}
