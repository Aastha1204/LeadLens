import type { RawEnquiry, SourceKey } from "@/lib/types";
import { DAY } from "@/lib/time";

export interface Merged { phone_hash: string; source: SourceKey; first: RawEnquiry; raw_ids: string[]; raws: RawEnquiry[] }

/** Raw enquiries sharing a phone_hash within 30 days merge into one lead; the first-touch source wins. */
export function dedupeRaw(raws: RawEnquiry[], windowDays = 30): Merged[] {
  const sorted = [...raws].sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at) || a.id.localeCompare(b.id));
  const open = new Map<string, Merged>();
  const out: Merged[] = [];
  for (const r of sorted) {
    const key = r.client_id + "|" + r.phone_hash;
    const cur = open.get(key);
    if (cur && Date.parse(r.received_at) - Date.parse(cur.first.received_at) <= windowDays * DAY) {
      cur.raw_ids.push(r.id); cur.raws.push(r);
    } else {
      const m: Merged = { phone_hash: r.phone_hash, source: r.source, first: r, raw_ids: [r.id], raws: [r] };
      open.set(key, m); out.push(m);
    }
  }
  return out;
}
