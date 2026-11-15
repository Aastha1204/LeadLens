import type { MetricsJson } from "@/lib/metrics";
import type { Lang } from "@/store/demo";

const MONTHS: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  mr: ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"],
};
export const LANG_LABEL: Record<Lang, string> = { en: "EN", hi: "हिं", mr: "मरा" };

/** WhatsApp summary built from metrics_json. Numbers are identical in every language. */
export function summaryText(m: MetricsJson, lang: Lang = "en"): string {
  const f = m.figures;
  const month = MONTHS[lang][Number(m.month.slice(5)) - 1];
  const enq = f["enquiries.total"].display;
  const change = f["enquiries.change_pct"]?.display;
  const won = f["won.total"].display;
  const med = f["response.median_min"];
  const mins = med.value < 60 ? String(Math.round(med.value)) : med.display;
  const c = change ? ` (${change})` : "";
  if (lang === "hi") return `${month}: ${enq} पूछताछ${c}, ${won} जीती गईं, औसत जवाब समय ${mins} मिनट। पूरी रिपोर्ट: [link]`;
  if (lang === "mr") return `${month}: ${enq} चौकशी${c}, ${won} मिळाल्या, सरासरी प्रतिसाद वेळ ${mins} मिनिटे. संपूर्ण अहवाल: [link]`;
  const medEn = med.value < 60 ? `${mins} minutes` : med.display;
  return `${month}: ${enq} enquiries${c}, ${won} won, median reply time ${medEn}. Full report: [link]`;
}
