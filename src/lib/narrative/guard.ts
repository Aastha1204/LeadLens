import type { MetricFigure, MetricUnit, MetricsJson } from "@/lib/metrics";
import type { Part } from "./template";

export type ExtractUnit = MetricUnit | "days";
export interface Extracted { text: string; value: number; unit: ExtractUnit; start: number; end: number }
export interface Checked extends Extracted { ok: boolean; key?: string; whitelisted?: boolean }
export interface GuardResult { ok: boolean; total: number; verified: Checked[]; unverified: Checked[]; items: Checked[] }

/** Constants the narrative may mention without a matching figure. */
const WHITELIST: { unit: ExtractUnit; value: number }[] = [
  { unit: "minutes", value: 15 }, { unit: "minutes", value: 1440 }, // 15 minutes, 24 hours
  { unit: "days", value: 30 }, { unit: "count", value: 2026 },
];

const num = (s: string) => parseFloat(s.replace(/,/g, ""));
const PATTERNS: { re: RegExp; unit: ExtractUnit; value: (m: RegExpExecArray) => number }[] = [
  { // ₹36.8L, ₹36,80,000, ₹36.8 lakh
    re: /₹\s?(\d[\d,]*(?:\.\d+)?)(?:([Ll]|Cr)\b|\s(lakhs?|crores?)\b)?/g, unit: "inr",
    value: (m) => { const x = num(m[1]); const u = (m[2] ?? m[3] ?? "").toLowerCase(); return u.startsWith("l") ? Math.round(x * 1e5) : u.startsWith("c") ? Math.round(x * 1e7) : x; },
  },
  { re: /(\d+)\s?h(?:ours?)?\s*(\d+)\s?m(?:in(?:ute)?s?)?\b/gi, unit: "minutes", value: (m) => Number(m[1]) * 60 + Number(m[2]) },
  { re: /(\d+(?:\.\d+)?)\s?%/g, unit: "percent", value: (m) => num(m[1]) },
  { re: /(\d+(?:\.\d+)?)\s?(minutes?|mins?)\b/gi, unit: "minutes", value: (m) => num(m[1]) },
  { re: /(\d+(?:\.\d+)?)\s?(hours?|hrs?)\b/gi, unit: "minutes", value: (m) => num(m[1]) * 60 },
  { re: /(\d+(?:\.\d+)?)\s?days?\b/gi, unit: "days", value: (m) => num(m[1]) },
  { re: /\b\d[\d,]*(?:\.\d+)?\b/g, unit: "count", value: (m) => num(m[0]) },
];

/** Every number in the text with its unit (₹ amounts incl. L/lakh, percentages, minutes/hours, plain counts). */
export function extractNumbers(text: string): Extracted[] {
  const taken: [number, number][] = [];
  const out: Extracted[] = [];
  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      const start = m.index!, end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      taken.push([start, end]);
      out.push({ text: m[0], value: p.value(m), unit: p.unit, start, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function matches(e: Extracted, f: MetricFigure): boolean {
  const v = Math.abs(f.value);
  switch (e.unit) {
    case "percent": {
      if (f.unit !== "percent") return false;
      const body = e.text.replace(/\s?%/, "");
      return [v.toFixed(0), v.toFixed(1), v.toFixed(2)].includes(body) || Math.abs(e.value - v) < 0.005;
    }
    case "inr": return f.unit === "inr" && (Math.abs(e.value - v) < 0.5 || (/[Ll]|lakh/.test(e.text) && Math.abs(e.value - v) <= 5000));
    case "minutes": return f.unit === "minutes" && (Math.round(v) === e.value || Math.abs(e.value - v) < 0.005);
    case "count": return f.unit === "count" && Math.abs(e.value - v) < 0.0001;
    default: return false;
  }
}

export function checkText(text: string, m: MetricsJson, preferKeys: string[] = []): Checked[] {
  const figs = Object.values(m.figures);
  const ordered = [...preferKeys.map((k) => m.figures[k]).filter(Boolean), ...figs];
  return extractNumbers(text).map((e) => {
    const hit = ordered.find((f) => matches(e, f));
    if (hit) return { ...e, ok: true, key: hit.key };
    if (WHITELIST.some((w) => w.unit === e.unit && w.value === e.value)) return { ...e, ok: true, whitelisted: true };
    return { ...e, ok: false };
  });
}

export interface NarrativeData {
  headline: string;
  recommendations: { title: string; body: string; evidence: string[]; service: import("./template").Service }[];
}

/** Guard over a whole narrative. Unverified figures block sending. */
export function guardNarrative(n: NarrativeData, m: MetricsJson): GuardResult & { fields: { field: string; items: Checked[] }[] } {
  const fields = [
    { field: "headline", items: checkText(n.headline, m) },
    ...n.recommendations.flatMap((r, i) => [
      { field: `recommendation ${i + 1} title`, items: checkText(r.title, m, r.evidence) },
      { field: `recommendation ${i + 1}`, items: checkText(r.body, m, r.evidence) },
    ]),
  ];
  const items = fields.flatMap((f) => f.items);
  const unverified = items.filter((i) => !i.ok);
  return { ok: unverified.length === 0, total: items.length, verified: items.filter((i) => i.ok), unverified, items, fields };
}

/** Turns free text (LLM or edited) into clickable parts: verified numbers link to their metric. */
export function partsFromText(text: string, m: MetricsJson, preferKeys: string[] = []): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const c of checkText(text, m, preferKeys)) {
    if (!c.ok || !c.key) continue;
    if (c.start > at) parts.push({ text: text.slice(at, c.start) });
    parts.push({ metric: c.key, text: c.text });
    at = c.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
