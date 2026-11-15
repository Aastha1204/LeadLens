"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { MetricProvider, useMetricScope } from "@/components/metric/MetricProvider";
import { Metric } from "@/components/metric/Metric";
import { NarrativeText } from "./Narrative";
import { NeoviaLogo, UrbanNestLogo } from "@/components/shell/Logos";
import { clientBySlug } from "@/data/clients";
import { fmtDate, fmtDateTime, fmtTime, inr, minutesLabel } from "@/lib/format";
import { FULL_MONTH_NAME } from "@/lib/months";
import { asOfLeads, metricDefinitions, monthLeads, responseMin } from "@/lib/metrics";
import { useNarrative } from "@/components/narrative/useNarrative";
import { SOURCE_COLOR, SOURCE_LABEL } from "@/lib/types";
import { DAY, addMonths, daysInMonth, prevMonth } from "@/lib/time";
import { cn } from "@/lib/utils";

const monthShort = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleString("en-IN", { month: "short", timeZone: "UTC" });

export function ReportView({ slug, month }: { slug: string; month: string }) {
  const client = clientBySlug(slug)!;
  return (
    <MetricProvider clientId={client.id} month={month}>
      <Report slug={slug} month={month} />
    </MetricProvider>
  );
}

function reportId(slug: string, month: string) {
  const abbr = slug.split("-").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return `LL-${abbr}-${month}`;
}

function Report({ slug, month }: { slug: string; month: string }) {
  const { metrics, ds, asOf, clientId } = useMetricScope();
  const client = clientBySlug(slug)!;
  const f = metrics.figures;
  const t = metrics.tables;
  const { narrative } = useNarrative();
  const row = ds.monthlyReports.find((r) => r.client_id === clientId && r.month === month);
  const id = row?.id ?? reportId(slug, month);
  const generated = row?.generated_at ? `Generated ${fmtDate(row.generated_at)}, ${fmtTime(row.generated_at)} IST` : `Month to date · as of ${fmtDateTime(asOf)}`;
  const prev = prevMonth(month);
  const change = f["enquiries.change_pct"];
  const leads = useMemo(
    () => monthLeads(asOfLeads(ds.leads.filter((l) => l.client_id === clientId), asOf), month).sort((a, b) => a.number - b.number),
    [ds, clientId, month, asOf],
  );
  const maxSrc = Math.max(1, ...t.sources.map((s) => s.enquiries));
  const weekly = t.weekly;
  const maxWeek = Math.max(1, ...weekly.map((w) => w.enquiries));
  const trend = [-2, -1, 0].flatMap((k) => { const m = addMonths(month, k); const fg = f[`trend.median_min.${m}`]; return fg ? [{ m, v: fg.value }] : []; });
  const maxTrend = Math.max(1, ...trend.map((x) => x.v));
  const defKeys = ["enquiries.total", "enquiries.raw", "enquiries.duplicates", "contacted.total", "meetings.total", "won.total", "revenue.won", "conversion.overall", "response.median_min", "response.within15_pct", "missed.total", "cpl.instagram", "cpw.instagram", "cpl.paid"];
  const defs = useMemo(() => metricDefinitions(ds, clientId, month, asOf, defKeys), [ds, clientId, month, asOf]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="force-light min-h-screen bg-neutral-100 pb-10 text-foreground print:bg-white print:pb-0">
      <div data-chrome className="no-print mx-auto flex max-w-[794px] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href={`/c/${slug}/dashboard?month=${month}`} className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"><ArrowLeft size={15} /> Dashboard</Link>
        <div className="flex flex-wrap gap-2">
          {["2026-08", "2026-09", "2026-10"].map((m) => (
            <Link key={m} href={`/c/${slug}/report/${m}`} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", m === month ? "bg-[var(--neovia-primary)] text-white" : "border border-neutral-300 bg-white text-neutral-600")}>{monthShort(m)}</Link>
          ))}
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white"><Printer size={13} /> Download PDF</button>
        </div>
      </div>

      <article className="report-sheet mx-auto max-w-[794px] bg-white p-5 text-[13px] leading-snug shadow-sm sm:p-8 print:p-0">
        {/* ───────────── Page 1 ───────────── */}
        <div className="report-page-1">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-[var(--neovia-primary)] pb-3 text-neutral-900">
            <div className="flex items-center gap-4"><NeoviaLogo className="h-7" />{slug === "urban-nest" ? <UrbanNestLogo className="h-7" /> : <span className="font-semibold">{client.name}</span>}</div>
            <div className="text-right"><h1 className="text-lg font-bold">{FULL_MONTH_NAME[month]} · Lead Report</h1><p className="text-[11px] text-neutral-500">{generated}</p></div>
          </header>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Enquiries" sub={change ? <><span className={cn("font-semibold", change.value >= 0 ? "text-emerald-700" : "text-red-700")}>{change.value >= 0 ? "▲" : "▼"} <Metric id="enquiries.change_pct" /></span> vs {monthShort(prev)}</> : "first month"}><Metric id="enquiries.total" /></Stat>
            <Stat label="Won" sub={<><Metric id="conversion.overall" /> conversion</>}><Metric id="won.total" /></Stat>
            <Stat label="Revenue won" sub={<Metric id="revenue.won" />}><Metric id="revenue.won" short /></Stat>
            <Stat label="Median reply" sub={<><Metric id="response.within15_pct" /> within 15 min</>}><Metric id="response.median_min" /></Stat>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Block title="Enquiries by source" aside={<><Metric id="enquiries.raw" /> raw → <Metric id="enquiries.total" /> unique</>}>
              <ul className="space-y-1.5">
                {t.sources.map((s) => (
                  <li key={s.source} className="flex items-center gap-2 text-[11px]">
                    <span className="w-[72px] shrink-0 text-neutral-600">{SOURCE_LABEL[s.source]}</span>
                    <span className="h-3.5 rounded-sm" style={{ width: `${(s.enquiries / maxSrc) * 55}%`, minWidth: 3, background: SOURCE_COLOR[s.source] }} />
                    <span className="font-semibold"><Metric id={`source.${s.source}.enquiries`} /></span>
                    <span className="text-neutral-500">· <Metric id={`source.${s.source}.won`} /> won</span>
                  </li>
                ))}
              </ul>
            </Block>
            <Block title="Enquiries by week" aside={month === "2026-11" ? "month to date" : undefined}>
              <svg viewBox="0 0 220 70" className="h-[70px] w-full" role="img" aria-label="Enquiries by week">
                <polyline fill="none" stroke="var(--neovia-primary)" strokeWidth="2.5" points={weekly.map((w, i) => `${weekly.length === 1 ? 110 : 12 + (i * 196) / (weekly.length - 1)},${62 - (w.enquiries / maxWeek) * 52}`).join(" ")} />
                {weekly.map((w, i) => <circle key={w.week_no} cx={weekly.length === 1 ? 110 : 12 + (i * 196) / (weekly.length - 1)} cy={62 - (w.enquiries / maxWeek) * 52} r="3.5" fill="var(--neovia-primary)" />)}
              </svg>
              <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
                {weekly.map((w) => <span key={w.week_no} className="text-center">{(w.week_no - 1) * 7 + 1}–{Math.min(w.week_no * 7, daysInMonth(month))}<br /><Metric id={`week.${w.week_no}.enquiries`} className="text-[12px] font-semibold text-neutral-900" /></span>)}
              </div>
            </Block>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Block title="Funnel">
              <ul className="space-y-1.5">
                {([["Enquiries", "enquiries.total"], ["Contacted", "contacted.total"], ["Meeting / site visit", "meetings.total"], ["Won", "won.total"]] as const).map(([l, key], i) => (
                  <li key={key} className="flex items-center gap-2 text-[11px]">
                    <span className="w-[92px] shrink-0 text-neutral-600">{l}</span>
                    <span className="h-3.5 rounded-sm" style={{ width: `${Math.max(3, ((f[key]?.value ?? 0) / (f["enquiries.total"]?.value || 1)) * 55)}%`, background: ["var(--neovia-primary)", "#5b5fe0", "var(--client-primary)", "var(--neovia-accent)"][i] }} />
                    <span className="font-semibold"><Metric id={key} /></span>
                  </li>
                ))}
              </ul>
            </Block>
            <Block title="Speed to lead · median reply">
              <div className="flex items-end justify-between gap-2">
                {trend.map((p) => (
                  <div key={p.m} className="flex flex-1 flex-col items-center">
                    <span className="text-[11px] font-semibold"><Metric id={`trend.median_min.${p.m}`} /></span>
                    <span className="mt-1 w-full max-w-14 rounded-t-sm" style={{ height: Math.max(6, (p.v / maxTrend) * 44), background: p.m === month ? "var(--client-primary)" : "#d9c9b8" }} />
                    <span className="mt-1 text-[10px] text-neutral-500">{monthShort(p.m)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-neutral-500">Automation (AI receptionist + WhatsApp auto-reply) went live on 12 Sep.</p>
            </Block>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Block title="Missed opportunities" aside={<><Metric id="missed.total" /> no follow-up in 24 h</>}>
              {t.missed.length === 0 ? <p className="text-[11px] text-neutral-500">None this month.</p> : (
                <ul className="space-y-1 text-[11px]">
                  {t.missed.map((m) => (
                    <li key={m.lead_number} className="flex items-center gap-2">
                      <span className="w-9 font-semibold tabular-nums">#{m.lead_number}</span>
                      <span className="size-2 rounded-full" style={{ background: SOURCE_COLOR[m.source] }} />
                      <span className="text-neutral-700">{SOURCE_LABEL[m.source]}</span>
                      <span className="ml-auto text-neutral-500">{m.reason === "never_contacted" ? "never contacted" : "answered late"} · {Math.max(1, Math.floor((+asOf - Date.parse(m.created_at)) / DAY))}d</span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
            <Block title="Neovia work this month">
              <dl className="grid grid-cols-4 gap-1.5 text-center">
                {([["Posts", "care.posts"], ["Updates", "care.updates"], ["Fixes", "care.fixes"], ["Uptime", "care.uptime"]] as const).map(([l, key]) => (
                  <div key={key} className="rounded-md bg-neutral-50 py-2"><dd className="text-[15px] font-semibold"><Metric id={key} /></dd><dt className="text-[10px] text-neutral-500">{l}</dt></div>
                ))}
              </dl>
            </Block>
          </div>

          <div data-tour="recs" className="mt-3"><Block title="What to do next">
            <ol className="space-y-2">
              {narrative.recommendations.map((r, i) => (
                <li key={r.title} className="flex gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--neovia-primary)] text-[11px] font-bold text-white">{i + 1}</span>
                  <div><p className="font-semibold text-neutral-900">{r.title}</p><p className="text-[12px] text-neutral-700"><NarrativeText parts={r.parts} /></p></div>
                </li>
              ))}
            </ol>
          </Block></div>

          <footer className="mt-3 border-t border-neutral-200 pt-2 text-center text-[10px] text-neutral-500">
            Every figure is computed from your lead data. Report ID {id}.
          </footer>
        </div>

        {/* ───────────── Appendix ───────────── */}
        <section className="report-appendix mt-10 print:mt-0">
          <h2 className="border-b border-neutral-300 pb-1 text-base font-bold text-neutral-900">Appendix</h2>

          <h3 className="mt-4 text-[13px] font-semibold">Ad spend and cost per lead</h3>
          <div className="overflow-x-auto"><table className="mt-1 w-full min-w-[420px] text-left text-[11px]">
            <thead className="text-neutral-500"><tr><th className="py-1">Platform</th><th>Spend</th><th>Leads</th><th>Wins</th><th>Cost per lead</th><th>Cost per win</th></tr></thead>
            <tbody>
              {([["Meta (Instagram ads)", "spend.meta", "instagram"], ["Google Ads", "spend.google", "google"]] as const).map(([l, sp, s]) => (
                <tr key={s} className="border-t border-neutral-200"><td className="py-1">{l}</td><td><Metric id={sp} /></td><td><Metric id={`source.${s}.enquiries`} /></td><td><Metric id={`source.${s}.won`} /></td><td><Metric id={`cpl.${s}`} /></td><td><Metric id={`cpw.${s}`} /></td></tr>
              ))}
              <tr className="border-t border-neutral-300 font-semibold"><td className="py-1">Blended</td><td><Metric id="spend.total" /></td><td colSpan={2} /><td><Metric id="cpl.paid" /></td><td /></tr>
            </tbody>
          </table></div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-[13px] font-semibold">Google Business Profile <span className="font-normal text-neutral-500">· manual entry</span></h3>
              <dl className="mt-1 grid grid-cols-3 gap-1.5 text-center">
                {([["Calls", "gbp.calls"], ["Directions", "gbp.directions"], ["Website clicks", "gbp.website_clicks"]] as const).map(([l, key]) => (
                  <div key={key} className="rounded-md bg-neutral-50 py-2"><dd className="text-[15px] font-semibold"><Metric id={key} /></dd><dt className="text-[10px] text-neutral-500">{l}</dt></div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold">Why enquiries were lost</h3>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                {(["price", "timeline", "competitor", "area", "no_response", "other"] as const).filter((r) => (f[`lost.${r}`]?.value ?? 0) > 0).map((r) => (
                  <li key={r} className="flex justify-between border-b border-neutral-100 py-0.5"><span className="capitalize text-neutral-700">{r === "competitor" ? "Chose another designer" : r === "area" ? "Outside service area" : r.replace("_", " ")}</span><Metric id={`lost.${r}`} className="font-semibold" /></li>
                ))}
              </ul>
            </div>
          </div>

          <h3 className="mt-5 text-[13px] font-semibold">Lead-level detail · <Metric id="enquiries.total" /> enquiries</h3>
          <div className="overflow-x-auto"><table className="mt-1 w-full min-w-[560px] text-left text-[10px]">
            <thead className="text-neutral-500"><tr><th className="py-1">#</th><th>Received</th><th>Lead</th><th>Source</th><th>Campaign</th><th>Stage</th><th>Reply</th><th className="text-right">Deal</th></tr></thead>
            <tbody>
              {leads.map((l) => { const m = responseMin(l); return (
                <tr key={l.id} className="border-t border-neutral-200">
                  <td className="py-0.5 font-medium tabular-nums">{l.number}</td><td className="whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  <td>{l.name_masked}{l.merged_raw_ids.length > 1 && <span className="ml-1 text-neutral-500">×{l.merged_raw_ids.length}</span>}</td>
                  <td>{SOURCE_LABEL[l.source]}</td><td className="max-w-40 truncate">{l.campaign}</td><td className="capitalize">{l.stage.replace("_", " ")}</td>
                  <td className="tabular-nums">{m === null ? "never" : minutesLabel(m)}</td><td className="text-right tabular-nums">{l.deal_value ? inr(l.deal_value) : ""}</td>
                </tr>); })}
            </tbody>
          </table></div>

          <h3 className="mt-5 text-[13px] font-semibold">How each figure is defined</h3>
          <dl className="mt-1 space-y-1 text-[11px]">
            {defs.map((d) => <div key={d.key}><dt className="inline font-semibold">{f[d.key]?.display ?? ""} </dt><dd className="inline text-neutral-600">— {d.definition}</dd></div>)}
          </dl>
          <p className="mt-4 text-[10px] text-neutral-500">Phone numbers are masked. Duplicate enquiries (same phone number, any source, within 30 days) are merged and credited to the first source.</p>
        </section>
      </article>
    </div>
  );
}

function Stat({ label, children, sub }: { label: string; children: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-neutral-900">{children}</p>
      <p className="text-[10px] text-neutral-500">{sub}</p>
    </div>
  );
}
function Block({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-neutral-200 p-2.5", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2"><h2 className="text-[12px] font-semibold text-neutral-900">{title}</h2>{aside && <span className="text-[10px] text-neutral-500">{aside}</span>}</div>
      {children}
    </section>
  );
}
