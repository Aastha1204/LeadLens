import type { LostReason } from "@/lib/types";

export type Command =
  | { kind: "won"; lead: number; amount: number }
  | { kind: "lost"; lead: number; reason: LostReason }
  | { kind: "help" };
export type ParseResult = { ok: true; cmd: Command } | { ok: false; error: string };

export const HELP_TEXT =
  "Here is what I understand:\n• WON <lead no> <amount>  e.g. WON 186 120000 (also 1,20,000 · 1.2L · 1.2 lakh · 120k)\n• LOST <lead no> <reason>  e.g. LOST 201 price\n  Reasons: price, timeline, competitor, area, no response, other\n• HELP  shows this list";

/** Accepts 120000, 1,20,000, ₹1,20,000, 1.2L, 1.2 lakh, 120k, 0.5 cr. Returns rupees or null. */
export function parseAmount(input: string): number | null {
  const s = input.toLowerCase().replace(/₹|rs\.?|inr|,/g, "").replace(/\s+/g, " ").trim();
  const m = /^(\d+(?:\.\d+)?)\s*(k|l|lac|lacs|lakh|lakhs|cr|crore|crores)?$/.exec(s);
  if (!m) return null;
  const mult = { k: 1e3, l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 }[m[2] ?? ""] ?? 1;
  const v = Math.round(parseFloat(m[1]) * mult);
  return v > 0 ? v : null;
}

const REASONS: [LostReason, RegExp][] = [
  ["no_response", /no.?resp|no.?repl|ghost|unreach|not respond|silent|didn'?t (reply|respond)/],
  ["price", /pric|cost|expens|budget|cheap|rate|quote|afford/],
  ["timeline", /time|delay|late|schedul|wait|date|urgent/],
  ["competitor", /compet|another|other (designer|firm|company)|someone else|rival|chose|went with/],
  ["area", /area|locat|far|distan|outside|service/],
];
export function parseReason(input: string): LostReason | null {
  const s = input.toLowerCase().trim();
  if (!s) return null;
  return REASONS.find(([, re]) => re.test(s))?.[0] ?? "other";
}
export const REASON_LABEL: Record<LostReason, string> = {
  price: "price", timeline: "timeline", competitor: "chose another designer", area: "outside service area", no_response: "no response", other: "other",
};

/** Owner reply parser. Case-insensitive; invalid input gets a friendly correction. */
export function parseMessage(text: string): ParseResult {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return { ok: false, error: "Send HELP to see what I can do." };
  const [cmdWord, ...rest] = raw.split(" ");
  const word = cmdWord.toLowerCase();
  if (word === "help" || word === "?" || word === "hi" || word === "hello") return { ok: true, cmd: { kind: "help" } };

  if (word === "won" || word === "lost") {
    const [numTok, ...tail] = rest;
    const lead = numTok ? Number(numTok.replace(/^#/, "")) : NaN;
    const example = word === "won" ? "WON 186 120000" : "LOST 201 price";
    if (!numTok) return { ok: false, error: `Which lead? Add its number, for example: ${example}` };
    if (!Number.isInteger(lead) || lead <= 0) return { ok: false, error: `"${numTok}" is not a lead number. The lead number looks like 186. Example: ${example}` };
    if (word === "won") {
      if (!tail.length) return { ok: false, error: `I need the deal amount too. Example: WON ${lead} 120000` };
      const amount = parseAmount(tail.join(" "));
      if (amount === null) return { ok: false, error: `I couldn't read "${tail.join(" ")}" as an amount. Try 120000, 1,20,000, 1.2L or 120k. Example: WON ${lead} 1.2L` };
      return { ok: true, cmd: { kind: "won", lead, amount } };
    }
    const reason = parseReason(tail.join(" "));
    if (!reason) return { ok: false, error: `Add a reason: price, timeline, competitor, area or no response. Example: LOST ${lead} price` };
    return { ok: true, cmd: { kind: "lost", lead, reason } };
  }
  return { ok: false, error: `Sorry, I didn't get "${raw.length > 30 ? raw.slice(0, 30) + "…" : raw}". Try WON 186 120000 or LOST 201 price. Send HELP for all commands.` };
}
