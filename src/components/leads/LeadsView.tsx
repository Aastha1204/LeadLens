"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, Download, Search } from "lucide-react";
import { clientBySlug } from "@/data/clients";
import { fmtDateTime, inr, minutesLabel } from "@/lib/format";
import { MONTH_LABEL, availableMonths } from "@/lib/months";
import { SPEED_BUCKETS, SPEED_BUCKET_LABEL, missedReason, responseMin, speedBucket } from "@/lib/metrics";
import { monthOf } from "@/lib/time";
import { SOURCES, SOURCE_COLOR, SOURCE_LABEL, type Lead, type RawEnquiry, type Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDataset, useNow } from "@/store/data";
import { useDemo } from "@/store/demo";
import { respondToLead } from "@/lib/demo-actions";

type SortKey = "number" | "created_at" | "name_masked" | "source" | "campaign" | "locality" | "stage" | "response" | "deal_value";
const PAGE = 40;

/** Counts up in real time from when a live lead arrived. */
function LiveTimer({ start }: { start: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - start) / 1000));
  return <span className={cn("font-medium tabular-nums", s > 900 ? "text-red-600" : "text-amber-600")}>waiting {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>;
}
const STAGES: Stage[] = ["new", "contacted", "site_visit", "won", "lost"];
const STAGE_STYLE: Record<Stage, string> = {
  new: "bg-slate-500/15 text-slate-600 dark:text-slate-300", contacted: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  site_visit: "bg-amber-500/15 text-amber-700 dark:text-amber-300", won: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  lost: "bg-red-500/15 text-red-600 dark:text-red-300",
};

export function LeadsView({ slug }: { slug: string }) {
  const params = useSearchParams();
  const ds = useDataset();
  const now = useNow();
  const client = clientBySlug(slug)!;
  const [q, setQ] = useState(params.get("q") ?? "");
  const [month, setMonth] = useState("all");
  const [source, setSource] = useState("all");
  const [stage, setStage] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [bucket, setBucket] = useState("all");
  const [missedOnly, setMissedOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "number", dir: -1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const timers = useDemo((s) => s.liveTimers);

  const all = useMemo(() => ds.leads.filter((l) => l.client_id === client.id && Date.parse(l.created_at) <= +now), [ds, client.id, now]);
  const rawById = useMemo(() => new Map(ds.rawEnquiries.map((r) => [r.id, r])), [ds]);
  const campaigns = useMemo(() => [...new Set(all.map((l) => l.campaign))].sort(), [all]);
  const months = availableMonths(now);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, "");
    const f = all.filter((l) => {
      if (month !== "all" && monthOf(l.created_at) !== month) return false;
      if (source !== "all" && l.source !== source) return false;
      if (stage !== "all" && l.stage !== stage) return false;
      if (campaign !== "all" && l.campaign !== campaign) return false;
      if (bucket !== "all" && speedBucket(l) !== bucket) return false;
      if (missedOnly && !missedReason(l, monthOf(l.created_at), now)) return false;
      if (needle && ![String(l.number), l.name_masked, l.phone_masked, l.locality, l.campaign].some((x) => x.toLowerCase().includes(needle))) return false;
      return true;
    });
    const val = (l: Lead): string | number => {
      if (sort.key === "response") return responseMin(l) ?? Infinity;
      if (sort.key === "created_at") return Date.parse(l.created_at);
      return (l[sort.key] as string | number | null) ?? -1;
    };
    return [...f].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [all, q, month, source, stage, campaign, bucket, missedOnly, sort, now]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  const exportCsv = () => {
    const head = ["Lead no", "Created (IST)", "Name", "Phone", "Source", "Campaign", "Locality", "Requirement", "Property", "Stage", "Reply (min)", "Deal value", "Owner", "Raw records"];
    const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((l) => [l.number, fmtDateTime(l.created_at), l.name_masked, l.phone_masked, SOURCE_LABEL[l.source], l.campaign, l.locality, l.requirement, l.property, l.stage, responseMin(l) ?? "", l.deal_value ?? "", l.owner, l.merged_raw_ids.length].map(esc).join(","));
    const url = URL.createObjectURL(new Blob([[head.map(esc).join(","), ...body].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `leadlens-${slug}-leads.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  const th = (k: SortKey, children: React.ReactNode, className?: string) => (
    <th key={k} className={cn("whitespace-nowrap p-2.5 text-left font-medium", className)}>
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (-s.dir as 1 | -1) : 1 }))} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}{sort.key === k && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );
  const sel = "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs";

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-semibold">Leads</h1><p className="text-xs text-muted">{client.name} · {rows.length} of {all.length} leads · phones are masked</p></div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-primary"><Download size={14} /> Export CSV</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search size={13} className="absolute left-2.5 top-2 text-muted" />
          <input value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Search # or name" aria-label="Search leads" className={cn(sel, "w-44 pl-7")} />
        </label>
        <select aria-label="Month" className={sel} value={month} onChange={(e) => reset(setMonth)(e.target.value)}>
          <option value="all">All months</option>{months.map((m) => <option key={m} value={m}>{MONTH_LABEL[m]}</option>)}
        </select>
        <select aria-label="Source" className={sel} value={source} onChange={(e) => reset(setSource)(e.target.value)}>
          <option value="all">All sources</option>{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
        <select aria-label="Stage" className={sel} value={stage} onChange={(e) => reset(setStage)(e.target.value)}>
          <option value="all">All stages</option>{STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select aria-label="Campaign" className={cn(sel, "max-w-48")} value={campaign} onChange={(e) => reset(setCampaign)(e.target.value)}>
          <option value="all">All campaigns</option>{campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Response time" className={sel} value={bucket} onChange={(e) => reset(setBucket)(e.target.value)}>
          <option value="all">Any reply time</option>{SPEED_BUCKETS.map((b) => <option key={b} value={b}>{SPEED_BUCKET_LABEL[b]}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={missedOnly} onChange={(e) => reset(setMissedOnly)(e.target.checked)} /> Missed only</label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border bg-surface-2 text-xs text-muted">
            <tr><th className="w-6" />{th("number", "#")}{th("created_at", "Created")}{th("name_masked", "Lead")}{th("source", "Source")}{th("campaign", "Campaign")}{th("locality", "Locality")}{th("stage", "Stage")}{th("response", "Reply")}{th("deal_value", "Deal", "text-right")}</tr>
          </thead>
          <tbody>
            {view.map((l) => {
              const m = responseMin(l);
              const merged = l.merged_raw_ids.length > 1;
              const expanded = open === l.id;
              return (
                <Fragment key={l.id}>
                  <tr className="border-t border-border hover:bg-surface-2/60">
                    <td className="pl-2">{merged && <button aria-label="Show raw records" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : l.id)} className="text-muted"><ChevronRight size={14} className={cn("transition-transform", expanded && "rotate-90")} /></button>}</td>
                    <td className="p-2.5 font-medium tabular-nums">#{l.number}</td>
                    <td className="whitespace-nowrap p-2.5 text-xs text-muted">{fmtDateTime(l.created_at)}</td>
                    <td className="p-2.5"><div className="flex items-center gap-2">{l.name_masked}{merged && <button onClick={() => setOpen(expanded ? null : l.id)} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Merged ×{l.merged_raw_ids.length}</button>}</div><div className="text-xs text-muted">{l.phone_masked}</div></td>
                    <td className="p-2.5"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: SOURCE_COLOR[l.source] }} />{SOURCE_LABEL[l.source]}</td>
                    <td className="max-w-52 truncate p-2.5 text-xs" title={l.campaign}>{l.campaign}</td>
                    <td className="p-2.5 text-xs">{l.locality}</td>
                    <td className="p-2.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STAGE_STYLE[l.stage])}>{l.stage.replace("_", " ")}</span></td>
                    <td className="p-2.5 tabular-nums">{m === null ? (timers[l.id] ? <span className="flex items-center gap-2"><LiveTimer start={timers[l.id]} /><button onClick={() => respondToLead(l.id)} className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:border-primary">Mark replied</button></span> : <span className="text-muted">never</span>) : minutesLabel(m)}</td>
                    <td className="p-2.5 text-right tabular-nums">{l.deal_value ? inr(l.deal_value) : <span className="text-muted">—</span>}</td>
                  </tr>
                  {expanded && (
                    <tr className="bg-surface-2/50"><td /><td colSpan={9} className="p-3">
                      <p className="mb-1.5 text-xs font-medium">Raw records merged into this lead (same phone number; first touch wins)</p>
                      <ul className="space-y-1 text-xs">
                        {l.merged_raw_ids.map((id, i) => { const r: RawEnquiry | undefined = rawById.get(id); return r ? (
                          <li key={id} className="flex flex-wrap gap-x-3"><span className="font-mono text-muted">{id}</span><span><span className="mr-1 inline-block size-2 rounded-full" style={{ background: SOURCE_COLOR[r.source] }} />{SOURCE_LABEL[r.source]}</span><span className="text-muted">{fmtDateTime(r.received_at)}</span>{i === 0 && <span className="font-medium text-primary">first touch</span>}</li>) : null; })}
                      </ul>
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
            {view.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-sm text-muted">No leads match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-full border border-border px-3 py-1 disabled:opacity-40">Previous</button>
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-full border border-border px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
