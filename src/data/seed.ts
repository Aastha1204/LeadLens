import seedrandom from "seedrandom";
import { CLIENTS } from "@/data/clients";
import { phoneHash } from "@/lib/hash";
import { DAY, HOUR, MIN, daysInMonth, istMs, iso, isWeekendIST, monthEndMs, weekdayIST } from "@/lib/time";
import {
  SOURCES,
  type AdSpend, type CareActivity, type ClientRow, type Connector, type DataSet, type GbpMetrics,
  type Lead, type LostReason, type MonthlyReport, type RawEnquiry, type SourceKey,
} from "@/lib/types";

type Rng = () => number;
const SEED = "leadlens-urban-nest-2026";
export const URBAN_NEST = "c1";
const SALT_FOR = (clientId: string) => `${clientId}-salt-v1`;
export const AUTOMATION_LIVE_AT = istMs(2026, 9, 12, 9, 0);
/** Nothing in the seeded history happens after this instant (the demo clock starts at 9:00 AM on 1 Nov). */
const HISTORY_CAP = istMs(2026, 11, 1, 8, 0);

// ───────────────────────── helpers ─────────────────────────
const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
function shuffle<T>(rng: Rng, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
function weighted<T>(rng: Rng, entries: [T, number][]): T {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
  return entries[entries.length - 1][0];
}

const LOCALITIES = ["Thane West", "Ghodbunder Road", "Majiwada", "Kolshet", "Hiranandani Estate", "Vasant Vihar", "Kasarvadavali", "Pokhran Road"];
const REQUIREMENTS = ["Full home", "Modular kitchen", "Wardrobes", "Renovation", "Office interiors"];
const PROPERTIES = ["1BHK", "2BHK", "3BHK", "Villa", "Office"];
const BUDGETS = ["₹3–5L", "₹5–8L", "₹8–12L", "₹12–20L", "₹20L+"];
const OWNERS = ["Neha (Designer)", "Amit (Sales)"];
const FIRST = ["Priya", "Rohan", "Amit", "Neha", "Vikram", "Anjali", "Karan", "Pooja", "Rahul", "Meera", "Sanjay", "Divya", "Arjun", "Kavita", "Nikhil", "Isha", "Manish", "Ritu", "Suresh", "Tanvi", "Harsh", "Swati", "Yash", "Pallavi", "Aditya", "Nisha", "Varun", "Komal", "Deepak", "Aarti", "Gaurav", "Shweta"];
const INITIALS = "SKMPRDGJTNBAVCHL".split("");

const HOUR_WEIGHTS: Record<SourceKey, [number, number][]> = {
  instagram: [[8, 1], [9, 1], [10, 1], [11, 1], [12, 2], [13, 2], [14, 1], [15, 1], [16, 2], [17, 3], [18, 5], [19, 7], [20, 8], [21, 8], [22, 5]],
  google: [[9, 3], [10, 6], [11, 7], [12, 6], [13, 4], [14, 5], [15, 6], [16, 6], [17, 5], [18, 4], [19, 3], [20, 2], [21, 1], [22, 1]],
  calls: [[10, 6], [11, 8], [12, 6], [13, 3], [14, 5], [15, 7], [16, 7], [17, 6], [18, 5], [19, 2]],
  website: [[9, 2], [10, 3], [11, 3], [12, 3], [13, 2], [14, 3], [15, 3], [16, 3], [17, 3], [18, 4], [19, 5], [20, 6], [21, 5], [22, 3]],
  whatsapp: [[9, 2], [10, 3], [11, 4], [12, 4], [13, 3], [14, 3], [15, 3], [16, 4], [17, 4], [18, 5], [19, 5], [20, 5], [21, 4], [22, 2]],
};
const WEEKEND_BOOST: Record<SourceKey, number> = { instagram: 2.8, google: 0.8, calls: 0.4, website: 1.3, whatsapp: 1.4 };

function pickTime(rng: Rng, y: number, mo: number, from: number, to: number, source: SourceKey): number {
  const days: [number, number][] = [];
  for (let d = from; d <= to; d++) {
    const t = istMs(y, mo, d, 12);
    days.push([d, [0, 6].includes(weekdayIST(t)) ? WEEKEND_BOOST[source] : 1]);
  }
  const day = weighted(rng, days);
  const hour = weighted(rng, HOUR_WEIGHTS[source]);
  return istMs(y, mo, day, hour, randInt(rng, 0, 59));
}

/** Sorted ascending delays (minutes) hitting an exact median and an exact "within 15 min" count. */
export function buildDelays(rng: Rng, n: number, median: number, within15: number, maxDelay: number, lateMin?: number): number[] {
  const mid = n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2];
  const first = mid[0], last = mid[mid.length - 1];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let lo = i < within15 ? 1 : 16;
    let hi = i < within15 ? 15 : maxDelay;
    if (i < first) hi = Math.min(hi, median);
    if (i > last) lo = Math.max(lo, median);
    out.push(mid.includes(i) ? median : randInt(rng, lo, Math.max(lo, hi)));
  }
  out.sort((a, b) => a - b);
  if (lateMin) out[n - 1] = lateMin;
  return out;
}

/** n deal values in ₹5,000 steps within [₹1.2L, ₹8.5L] summing exactly to total. */
export function splitRevenue(rng: Rng, n: number, total: number): number[] {
  const MINU = 24, MAXU = 170, units = total / 5000;
  const v = Array.from({ length: n }, () => randInt(rng, MINU, MAXU));
  const s0 = v.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) v[i] = Math.min(MAXU, Math.max(MINU, Math.round((v[i] * units) / s0)));
  let diff = units - v.reduce((a, b) => a + b, 0);
  for (let i = 0, guard = 0; diff !== 0; i++, guard++) {
    if (guard > 100000) throw new Error("splitRevenue did not converge");
    const step = diff > 0 ? 1 : -1, k = i % n;
    if (v[k] + step >= MINU && v[k] + step <= MAXU) { v[k] += step; diff -= step; }
  }
  return v.map((x) => x * 5000);
}

class PhoneBook {
  private used = new Set<string>();
  constructor(private rng: Rng, private salt: string) {}
  next() {
    for (;;) {
      const digits = String(pick(this.rng, [9, 8, 7])) + String(randInt(this.rng, 0, 999999999)).padStart(9, "0");
      if (this.used.has(digits)) continue;
      this.used.add(digits);
      const e164 = "+91" + digits;
      return {
        hash: phoneHash(e164, this.salt),
        masked: `+91 ${digits.slice(0, 2)}XXX XX${digits.slice(7)}`,
      };
    }
  }
}

function maskedName(rng: Rng, avoid?: string) {
  for (;;) {
    const n = `${pick(rng, FIRST)} ${pick(rng, INITIALS)}.`;
    if (n !== avoid) return n;
  }
}

// ───────────────────────── Urban Nest: calibrated months ─────────────────────────
interface CampaignQuota { name: string; n: number; wins?: number }
interface MonthCfg {
  month: string;
  startNumber: number;
  sources: Record<SourceKey, [number, number]>; // [unique enquiries, wins]
  weeks: { from: number; to: number; count: number }[];
  campaigns: Record<SourceKey, CampaignQuota[]>;
  dups: number;
  contacted: number;
  visited: number;
  revenue: number;
  medianMin: number;
  within15: number;
  maxDelay: number;
  lateMin?: number;
  openVisited: number;
  lostVisited: number;
  lostContactedOnly: number;
  lostNever: number;
  reasons: Partial<Record<LostReason, number>>;
  weekendInstagramNever?: number;
  pins?: { aIdx: number; bIdx: number; aCampaign: string; bCampaign: string };
}

const IG_KITCHEN = "Diwali Modular Kitchen Offer";
const IG_2BHK = "2BHK Full Home Interiors – Thane West";
const G_SEARCH = "Search · interior designer Thane";
const G_GBP = "Business Profile";
const CALLS_C = "AI receptionist (calls)";
const WEB_C = "Website contact form";
const WA_C = "WhatsApp chatbot";

const MONTHS: MonthCfg[] = [
  {
    month: "2026-08", startNumber: 1,
    sources: { instagram: [26, 2], google: [17, 4], calls: [9, 1], website: [11, 2], whatsapp: [5, 1] },
    weeks: [{ from: 1, to: 31, count: 68 }],
    campaigns: {
      instagram: [{ name: "Modular Kitchen Offer", n: 14 }, { name: IG_2BHK, n: 12 }],
      google: [{ name: G_SEARCH, n: 8 }, { name: G_GBP, n: 9 }],
      calls: [{ name: CALLS_C, n: 9 }], website: [{ name: WEB_C, n: 11 }], whatsapp: [{ name: WA_C, n: 5 }],
    },
    dups: 4, contacted: 55, visited: 21, revenue: 2_720_000,
    medianMin: 125, within15: 5, maxDelay: 1400, lateMin: 1700,
    openVisited: 1, lostVisited: 10, lostContactedOnly: 6, lostNever: 3,
    reasons: { price: 6, timeline: 4, competitor: 4, area: 2 },
  },
  {
    month: "2026-09", startNumber: 69,
    sources: { instagram: [27, 3], google: [19, 4], calls: [11, 2], website: [10, 2], whatsapp: [6, 0] },
    weeks: [{ from: 1, to: 30, count: 73 }],
    campaigns: {
      instagram: [{ name: "Modular Kitchen Offer", n: 15 }, { name: IG_2BHK, n: 12 }],
      google: [{ name: G_SEARCH, n: 9 }, { name: G_GBP, n: 10 }],
      calls: [{ name: CALLS_C, n: 11 }], website: [{ name: WEB_C, n: 10 }], whatsapp: [{ name: WA_C, n: 6 }],
    },
    dups: 5, contacted: 64, visited: 25, revenue: 3_150_000,
    medianMin: 41, within15: 25, maxDelay: 1400,
    openVisited: 3, lostVisited: 11, lostContactedOnly: 6, lostNever: 2,
    reasons: { price: 7, timeline: 4, competitor: 4, area: 2 },
  },
  {
    month: "2026-10", startNumber: 142,
    sources: { instagram: [31, 3], google: [22, 5], calls: [14, 2], website: [12, 2], whatsapp: [7, 0] },
    weeks: [
      { from: 1, to: 7, count: 18 }, { from: 8, to: 14, count: 21 }, { from: 15, to: 21, count: 24 },
      { from: 22, to: 28, count: 16 }, { from: 29, to: 31, count: 7 },
    ],
    campaigns: {
      instagram: [{ name: IG_KITCHEN, n: 17, wins: 2 }, { name: IG_2BHK, n: 14, wins: 1 }],
      google: [{ name: G_SEARCH, n: 9, wins: 2 }, { name: G_GBP, n: 13, wins: 3 }],
      calls: [{ name: CALLS_C, n: 14 }], website: [{ name: WEB_C, n: 12 }], whatsapp: [{ name: WA_C, n: 7 }],
    },
    dups: 6, contacted: 81, visited: 31, revenue: 3_680_000,
    medianMin: 9, within15: 63, maxDelay: 180,
    openVisited: 4, lostVisited: 15, lostContactedOnly: 4, lostNever: 2,
    reasons: { price: 8, timeline: 5, competitor: 4, area: 2 },
    weekendInstagramNever: 3,
    pins: { aIdx: 44, bIdx: 59, aCampaign: IG_KITCHEN, bCampaign: G_GBP }, // leads #186 and #201
  },
];

type Role = "won" | "never" | "visited" | "contactedOnly";
interface W {
  source: SourceKey; t: number; number: number; campaign: string;
  role?: Role; pin?: "A" | "B"; lost?: boolean; reason?: LostReason; delay?: number; deal?: number;
}

function genMonth(cfg: MonthCfg, rng: Rng, phones: PhoneBook): { leads: Lead[]; raws: RawEnquiry[] } {
  const [y, mo] = cfg.month.split("-").map(Number);
  const unique = SOURCES.reduce((a, s) => a + cfg.sources[s][0], 0);
  const won = SOURCES.reduce((a, s) => a + cfg.sources[s][1], 0);
  const never = unique - cfg.contacted;
  const visitedNonWon = cfg.visited - won;
  if (cfg.weeks.reduce((a, w) => a + w.count, 0) !== unique) throw new Error("weeks != unique");
  if (cfg.openVisited + cfg.lostVisited !== visitedNonWon) throw new Error("visited split");
  if (Object.values(cfg.reasons).reduce((a, b) => a + (b ?? 0), 0) !== cfg.lostVisited + cfg.lostContactedOnly) throw new Error("reasons split");
  for (const s of SOURCES) if (cfg.campaigns[s].reduce((a, c) => a + c.n, 0) !== cfg.sources[s][0]) throw new Error("campaign quota " + s);

  // 1. slots: sources dealt across weeks, then times
  const srcList: SourceKey[] = [];
  for (const s of SOURCES) for (let k = 0; k < cfg.sources[s][0]; k++) srcList.push(s);
  shuffle(rng, srcList);
  let si = 0;
  const ws: W[] = [];
  for (const wk of cfg.weeks) {
    for (let k = 0; k < wk.count; k++) {
      const source = srcList[si++];
      ws.push({ source, t: pickTime(rng, y, mo, wk.from, wk.to, source), number: 0, campaign: "" });
    }
  }
  ws.sort((a, b) => a.t - b.t);
  for (let i = 1; i < ws.length; i++) if (ws[i].t <= ws[i - 1].t) ws[i].t = ws[i - 1].t + MIN;

  // 2. pinned demo leads sit exactly at #186 / #201 (swap times so weekly counts are unchanged)
  if (cfg.pins) {
    const sorted = ws.map((w) => w.t);
    const a = ws.find((w) => w.source === "instagram")!;
    const b = ws.find((w) => w.source === "google" && w !== a)!;
    a.pin = "A"; b.pin = "B";
    for (const [pin, idx] of [[a, cfg.pins.aIdx], [b, cfg.pins.bIdx]] as [W, number][]) {
      const holder = ws.find((w) => w.t === sorted[idx])!;
      [holder.t, pin.t] = [pin.t, holder.t];
    }
    ws.sort((x, y2) => x.t - y2.t);
  }
  ws.forEach((w, i) => (w.number = cfg.startNumber + i));

  // 3. campaigns
  for (const s of SOURCES) {
    const pool = ws.filter((w) => w.source === s);
    const names = cfg.campaigns[s].flatMap((c) => Array<string>(c.n).fill(c.name));
    for (const w of pool) {
      const forced = w.pin === "A" ? cfg.pins!.aCampaign : w.pin === "B" ? cfg.pins!.bCampaign : null;
      if (forced) { w.campaign = forced; names.splice(names.indexOf(forced), 1); }
    }
    shuffle(rng, names);
    for (const w of pool) if (!w.campaign) w.campaign = names.pop()!;
  }

  // 4. winners
  const free = (f: (w: W) => boolean) => ws.filter((w) => !w.pin && !w.role && f(w));
  for (const s of SOURCES) {
    const quotas = cfg.campaigns[s];
    if (quotas.some((q) => q.wins !== undefined)) {
      for (const q of quotas) for (const w of shuffle(rng, free((x) => x.source === s && x.campaign === q.name)).slice(0, q.wins ?? 0)) w.role = "won";
    } else {
      for (const w of shuffle(rng, free((x) => x.source === s)).slice(0, cfg.sources[s][1])) w.role = "won";
    }
  }

  // 5. never contacted (must be >24h old at report time to count as missed)
  const cutoff = Date.UTC(y, mo, 1) - 330 * MIN + 9 * HOUR - DAY; // report time minus 24h
  const eligible = (f: (w: W) => boolean) => shuffle(rng, free((x) => x.t <= cutoff && f(x)));
  const weekendIg = cfg.weekendInstagramNever ?? 0;
  const neverSet = eligible((x) => x.source === "instagram" && isWeekendIST(x.t)).slice(0, weekendIg);
  if (neverSet.length !== weekendIg) throw new Error("not enough weekend Instagram leads");
  neverSet.forEach((w) => (w.role = "never"));
  const others = eligible((x) => (weekendIg ? x.source !== "instagram" : true)).slice(0, never - weekendIg);
  others.forEach((w) => (w.role = "never"));
  const neverLeads = ws.filter((w) => w.role === "never");
  if (neverLeads.length !== never) throw new Error("never-contacted shortfall");

  // 6. visited / contacted-only
  const pins = ws.filter((w) => w.pin);
  pins.forEach((w) => (w.role = "visited"));
  const rest = shuffle(rng, free(() => true));
  rest.slice(0, visitedNonWon - pins.length).forEach((w) => (w.role = "visited"));
  rest.slice(visitedNonWon - pins.length).forEach((w) => (w.role = "contactedOnly"));

  // 7. open vs lost, lost reasons
  const visitedLeads = ws.filter((w) => w.role === "visited");
  const openV = new Set<W>(pins);
  for (const w of shuffle(rng, visitedLeads.filter((x) => !x.pin))) if (openV.size < cfg.openVisited) openV.add(w);
  const lostV = visitedLeads.filter((w) => !openV.has(w));
  const coLeads = shuffle(rng, ws.filter((w) => w.role === "contactedOnly"));
  const lostCO = coLeads.slice(0, cfg.lostContactedOnly);
  const reasons = shuffle(rng, Object.entries(cfg.reasons).flatMap(([r, n]) => Array<LostReason>(n ?? 0).fill(r as LostReason)));
  for (const w of [...lostV, ...lostCO]) { w.lost = true; w.reason = reasons.pop(); }
  const nonWeekend = neverLeads.filter((w) => !(w.source === "instagram" && isWeekendIST(w.t)));
  for (const w of [...nonWeekend, ...neverLeads].filter((v, i, a) => a.indexOf(v) === i).slice(0, cfg.lostNever)) { w.lost = true; w.reason = "no_response"; }

  // 8. response delays (faster once automation went live on 12 Sep)
  const contacted = ws.filter((w) => w.role !== "never");
  const delays = buildDelays(rng, contacted.length, cfg.medianMin, cfg.within15, cfg.maxDelay, cfg.lateMin);
  const order = contacted
    .map((w) => ({ w, score: (w.t < AUTOMATION_LIVE_AT ? 0.7 : 0) + rng() * 0.5 }))
    .sort((a, b) => a.score - b.score);
  order.forEach((o, i) => (o.w.delay = delays[i]));

  // 9. deal values
  const winners = ws.filter((w) => w.role === "won");
  splitRevenue(rng, winners.length, cfg.revenue).forEach((v, i) => (winners[i].deal = v));

  // 10. materialise leads and raw enquiries
  const bounded = (base: number, minT: number) => (base <= HISTORY_CAP ? base : minT + Math.floor((HISTORY_CAP - minT) * rng()));
  const leads: Lead[] = [];
  const raws: RawEnquiry[] = [];
  const monthEnd = monthEndMs(cfg.month);
  const dupSet = new Set(shuffle(rng, ws.filter((w) => !w.pin && w.t <= monthEnd - 3 * DAY)).slice(0, cfg.dups));
  for (const w of ws) {
    const phone = phones.next();
    const created = w.t;
    const resp = w.role === "never" ? null : created + (w.delay ?? 0) * MIN;
    let visit: number | null = null, closed: number | null = null;
    if (resp !== null && (w.role === "won" || w.role === "visited")) {
      visit = bounded(resp + randInt(rng, 2, 9) * DAY + randInt(rng, 0, 8) * HOUR, resp + HOUR);
      if (w.role === "won") closed = bounded(visit + randInt(rng, 2, 10) * DAY, visit + HOUR);
      else if (w.lost) closed = bounded(visit + randInt(rng, 1, 7) * DAY, visit + HOUR);
    } else if (resp !== null && w.lost) {
      closed = bounded(resp + randInt(rng, 3, 14) * DAY, resp + HOUR);
    } else if (w.role === "never" && w.lost) {
      closed = bounded(created + 3 * DAY, created + HOUR);
    }
    const stage: Lead["stage"] = w.role === "won" ? "won" : w.lost ? "lost" : visit !== null ? "site_visit" : resp !== null ? "contacted" : "new";
    const isKitchen = /kitchen/i.test(w.campaign);
    const is2bhk = /2BHK/.test(w.campaign);
    const isA = w.pin === "A";
    const rawA = `raw_${w.number}_a`;
    const lead: Lead = {
      id: `ld_${w.number}`, number: w.number, client_id: URBAN_NEST, source: w.source, campaign: w.campaign,
      created_at: iso(created),
      first_response_at: resp === null ? null : iso(resp),
      site_visit_at: visit === null ? null : iso(visit),
      closed_at: closed === null ? null : iso(closed),
      stage,
      deal_value: w.role === "won" ? w.deal ?? null : null,
      outcome_reason: w.lost ? w.reason ?? "other" : null,
      phone_hash: phone.hash, phone_masked: phone.masked,
      name_masked: isA ? "Sneha K." : w.pin === "B" ? "Vikram P." : maskedName(rng, "Sneha K."),
      locality: pick(rng, LOCALITIES),
      requirement: isKitchen ? "Modular kitchen" : is2bhk ? "Full home" : pick(rng, REQUIREMENTS),
      property: is2bhk ? "2BHK" : pick(rng, PROPERTIES),
      budget_band: pick(rng, BUDGETS),
      owner: pick(rng, OWNERS),
      merged_raw_ids: [rawA],
    };
    raws.push({
      id: rawA, client_id: URBAN_NEST, source: w.source, source_record_id: `${w.source}-${cfg.month}-${w.number}`,
      phone_hash: phone.hash, payload: { name: lead.name_masked, requirement: lead.requirement }, received_at: lead.created_at,
    });
    if (dupSet.has(w)) {
      const rawB = `raw_${w.number}_b`;
      const otherSource = pick(rng, SOURCES.filter((s) => s !== w.source));
      lead.merged_raw_ids.push(rawB);
      raws.push({
        id: rawB, client_id: URBAN_NEST, source: otherSource, source_record_id: `${otherSource}-${cfg.month}-${w.number}-dup`,
        phone_hash: phone.hash, payload: { name: lead.name_masked, note: "same phone, second touch" },
        received_at: iso(created + randInt(rng, 60, 2400) * MIN),
      });
    }
    leads.push(lead);
  }
  return { leads, raws };
}

// ───────────────────────── lighter generator (Nov alert data + other clients) ─────────────────────────
interface LightOpts {
  clientId: string; month: string; from: number; to: number; count: number; startNumber: number;
  firstHour?: number; cap: number; winRate?: number; fast?: boolean; campaigns?: string[];
}
function genLight(o: LightOpts, rng: Rng, phones: PhoneBook): { leads: Lead[]; raws: RawEnquiry[] } {
  const [y, mo] = o.month.split("-").map(Number);
  const weights: [SourceKey, number][] = [["instagram", 35], ["google", 25], ["calls", 15], ["website", 15], ["whatsapp", 10]];
  const ts: { t: number; s: SourceKey }[] = [];
  for (let i = 0; i < o.count; i++) {
    const s = weighted(rng, weights);
    let t = pickTime(rng, y, mo, o.from, o.to, s);
    if (t < istMs(y, mo, o.from, o.firstHour ?? 0)) t += DAY;
    ts.push({ t, s });
  }
  ts.sort((a, b) => a.t - b.t);
  for (let i = 1; i < ts.length; i++) if (ts[i].t <= ts[i - 1].t) ts[i].t = ts[i - 1].t + MIN;
  const campaigns = o.campaigns ?? ["Diwali Modular Kitchen Offer", "Search · interior designer Thane", "Website contact form", "Walk-in referrals"];
  const leads: Lead[] = [], raws: RawEnquiry[] = [];
  ts.forEach(({ t, s }, i) => {
    const number = o.startNumber + i;
    const phone = phones.next();
    const contacted = rng() < 0.82;
    const delay = contacted ? (o.fast ? (rng() < 0.8 ? randInt(rng, 2, 14) : randInt(rng, 16, 120)) : weighted(rng, [[randInt(rng, 2, 14), 3], [randInt(rng, 16, 180), 4], [randInt(rng, 181, 900), 2]])) : 0;
    const resp = contacted ? t + delay * MIN : null;
    const visited = resp !== null && rng() < 0.33;
    const visit = visited ? Math.min(resp! + randInt(rng, 2, 8) * DAY, o.cap) : null;
    const isWon = visited && rng() < (o.winRate ?? 0.3);
    const lost = !isWon && contacted && rng() < 0.25;
    const closed = isWon && visit !== null ? Math.min(visit + randInt(rng, 1, 6) * DAY, o.cap) : lost ? Math.min(t + 5 * DAY, o.cap) : null;
    const rawId = `raw_${o.clientId}_${number}_a`;
    leads.push({
      id: `ld_${o.clientId}_${number}`, number, client_id: o.clientId, source: s, campaign: pick(rng, campaigns),
      created_at: iso(t), first_response_at: resp === null ? null : iso(Math.min(resp, o.cap)),
      site_visit_at: visit === null ? null : iso(visit), closed_at: closed === null ? null : iso(closed),
      stage: isWon ? "won" : lost ? "lost" : visit !== null ? "site_visit" : resp !== null ? "contacted" : "new",
      deal_value: isWon ? randInt(rng, 24, 120) * 5000 : null,
      outcome_reason: lost ? pick(rng, ["price", "timeline", "competitor", "area"] as LostReason[]) : null,
      phone_hash: phone.hash, phone_masked: phone.masked, name_masked: maskedName(rng),
      locality: pick(rng, LOCALITIES), requirement: pick(rng, REQUIREMENTS), property: pick(rng, PROPERTIES),
      budget_band: pick(rng, BUDGETS), owner: pick(rng, OWNERS), merged_raw_ids: [rawId],
    });
    raws.push({
      id: rawId, client_id: o.clientId, source: s, source_record_id: `${s}-${o.month}-${number}`,
      phone_hash: phone.hash, payload: {}, received_at: iso(t),
    });
  });
  return { leads, raws };
}

// ───────────────────────── assemble ─────────────────────────
export function buildSeed(): DataSet {
  const rng = seedrandom(SEED);
  const phonesUN = new PhoneBook(rng, SALT_FOR(URBAN_NEST));
  const leads: Lead[] = [], rawEnquiries: RawEnquiry[] = [];

  for (const cfg of MONTHS) {
    const r = genMonth(cfg, seedrandom(`${SEED}:${cfg.month}`), phonesUN);
    leads.push(...r.leads); rawEnquiries.push(...r.raws);
  }

  // 1–14 Nov: 25 enquiries vs 39 in 1–14 Oct (-36%): triggers the mid-month alert.
  const nov = genLight(
    { clientId: URBAN_NEST, month: "2026-11", from: 1, to: 14, count: 25, startNumber: 228, firstHour: 10, cap: istMs(2026, 11, 14, 22, 0), winRate: 0.2, fast: true },
    seedrandom(`${SEED}:2026-11`), phonesUN,
  );
  leads.push(...nov.leads); rawEnquiries.push(...nov.raws);

  // Four other fictional clients (lighter data for the admin view).
  const others: [string, number, number][] = [["c2", 35, 40], ["c3", 30, 33], ["c4", 31, 28], ["c5", 18, 22]];
  for (const [clientId, sep, oct] of others) {
    const phones = new PhoneBook(seedrandom(`${SEED}:${clientId}`), SALT_FOR(clientId));
    const rr = seedrandom(`${SEED}:${clientId}:gen`);
    const a = genLight({ clientId, month: "2026-09", from: 1, to: 30, count: sep, startNumber: 1, cap: HISTORY_CAP }, rr, phones);
    const b = genLight({ clientId, month: "2026-10", from: 1, to: 31, count: oct, startNumber: 1 + sep, cap: HISTORY_CAP }, rr, phones);
    leads.push(...a.leads, ...b.leads); rawEnquiries.push(...a.raws, ...b.raws);
  }

  const clients: ClientRow[] = CLIENTS.map((c) => ({
    ...c,
    logo_url: null,
    report_day: 1,
    review_required: c.id === "c1" || c.id === "c3",
    onboarded_month: { c1: "2026-08", c2: "2026-03", c3: "2026-08", c4: "2026-05", c5: "2026-06" }[c.id]!,
  }));

  const adSpend: AdSpend[] = [
    ["2026-08", 15000, 8000], ["2026-09", 16000, 8000], ["2026-10", 18000, 9000],
  ].flatMap(([month, meta, google]) => [
    { id: `ad_${month}_meta`, client_id: URBAN_NEST, month: `${month}-01`, platform: "meta" as const, amount: meta as number },
    { id: `ad_${month}_google`, client_id: URBAN_NEST, month: `${month}-01`, platform: "google" as const, amount: google as number },
  ]);

  const careRows: [string, number, number, number, number][] = [
    ["2026-08", 8, 2, 0, 99.99], ["2026-09", 10, 3, 2, 99.95], ["2026-10", 12, 4, 1, 99.97],
  ];
  const careActivity: CareActivity[] = careRows.flatMap(([m, post, update, fix, uptime]) =>
    ([["post", post], ["update", update], ["fix", fix], ["uptime", uptime]] as const).map(([type, count]) => ({
      id: `care_${m}_${type}`, client_id: URBAN_NEST, month: `${m}-01`, type, count,
    })),
  );

  const gbpMetrics: GbpMetrics[] = [
    { client_id: URBAN_NEST, month: "2026-10-01", calls: 31, direction_requests: 24, website_clicks: 67, source: "manual" },
  ];

  const syncOk = iso(istMs(2026, 11, 1, 8, 45));
  const mk = (client_id: string, type: Connector["type"], extra: Partial<Connector> = {}): Connector => ({
    id: `cn_${client_id}_${type}`, client_id, type, config_json: {}, last_sync_at: syncOk, status: "healthy", message: "Synced OK", ...extra,
  });
  const connectors: Connector[] = [
    mk("c1", "website_forms"), mk("c1", "whatsapp_bot"), mk("c1", "meta_lead_ads"), mk("c1", "callcatch"),
    mk("c1", "gbp_manual", { last_sync_at: iso(istMs(2026, 10, 31, 18, 0)), message: "Manual entry for October" }),
    mk("c2", "website_forms"), mk("c2", "whatsapp_bot"), mk("c2", "google_sheet"),
    mk("c3", "website_forms"), mk("c3", "whatsapp_bot"), mk("c3", "meta_lead_ads"),
    mk("c4", "website_forms"), mk("c4", "slotpay"),
    mk("c4", "meta_lead_ads", { status: "failed", last_sync_at: iso(istMs(2026, 10, 30, 11, 20)), message: "Meta Lead Ads token expired since 30 Oct" }),
    mk("c5", "website_forms"), mk("c5", "google_sheet"),
    mk("c5", "whatsapp_bot", { status: "warning", last_sync_at: iso(istMs(2026, 10, 31, 22, 10)), message: "Slow responses from WhatsApp API" }),
  ];

  const gen = iso(istMs(2026, 11, 1, 9, 0));
  const rep = (id: string, client_id: string, month: string, status: MonthlyReport["status"], sent?: string): MonthlyReport => ({
    id, client_id, month, metrics_json: null, narrative_json: null, narrative_source: "template", guard_result: null, pdf_url: null,
    status, generated_at: gen, sent_at: sent ?? null, data_changed_since_generation: false,
  });
  const monthlyReports: MonthlyReport[] = [
    rep("LL-UN-2026-08", "c1", "2026-08", "sent", iso(istMs(2026, 9, 1, 9, 30))),
    rep("LL-UN-2026-09", "c1", "2026-09", "sent", iso(istMs(2026, 10, 1, 9, 30))),
    rep("LL-UN-2026-10", "c1", "2026-10", "generated"),
    rep("LL-BS-2026-10", "c2", "2026-10", "sent", iso(istMs(2026, 11, 1, 9, 20))),
    rep("LL-AC-2026-10", "c3", "2026-10", "in_review"),
    rep("LL-FF-2026-10", "c4", "2026-10", "blocked"),
    rep("LL-SR-2026-10", "c5", "2026-10", "generated"),
  ];

  return { clients, connectors, rawEnquiries, leads, adSpend, careActivity, gbpMetrics, monthlyReports };
}

let cached: DataSet | null = null;
/** Memoised seed (treat as read-only; use structuredClone before mutating). */
export function getSeed(): DataSet {
  return (cached ??= buildSeed());
}
export { daysInMonth };
