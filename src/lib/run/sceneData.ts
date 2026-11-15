import { SOURCES, SOURCE_COLOR, SOURCE_LABEL, type DataSet, type SourceKey } from "@/lib/types";
import { monthLeads } from "@/lib/metrics";
import { monthOf } from "@/lib/time";

export interface SceneParticle { source: SourceKey; /** index of the primary particle this duplicate merges into */ dupOf: number | null }
export interface SceneSource { key: SourceKey; label: string; color: string; raw: number }
export interface SceneData {
  sources: SceneSource[];
  particles: SceneParticle[]; // unique enquiries first, then duplicates
  unique: number;
  merges: number;
  funnel: [number, number, number, number]; // enquiries, contacted, meetings, won
}

/** One particle per raw enquiry; duplicates (same phone, other source) merge into their first touch. */
export function buildSceneData(ds: DataSet, clientId: string, month: string, funnel: SceneData["funnel"]): SceneData {
  const leads = monthLeads(ds.leads.filter((l) => l.client_id === clientId), month).sort((a, b) => a.number - b.number);
  const raws = new Map(ds.rawEnquiries.filter((r) => r.client_id === clientId && monthOf(r.received_at) === month).map((r) => [r.id, r]));
  const particles: SceneParticle[] = leads.map((l) => ({ source: l.source, dupOf: null }));
  leads.forEach((l, i) => {
    for (const id of l.merged_raw_ids.slice(1)) {
      const r = raws.get(id);
      if (r) particles.push({ source: r.source, dupOf: i });
    }
  });
  return {
    sources: SOURCES.map((key) => ({ key, label: SOURCE_LABEL[key], color: SOURCE_COLOR[key], raw: particles.filter((p) => p.source === key).length })),
    particles, unique: leads.length, merges: particles.length - leads.length, funnel,
  };
}
