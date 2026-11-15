"use client";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, BellRing, ExternalLink, FileText, Lock, Presentation, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { MetricProvider, useMetricScope } from "@/components/metric/MetricProvider";
import { Metric } from "@/components/metric/Metric";
import { Card, Lazy, TiltCard } from "./ui";
import { NarrativeText } from "@/components/report/Narrative";
import { useNarrative } from "@/components/narrative/useNarrative";
import { SERVICE_LABEL } from "@/lib/narrative/template";
import dynamic from "next/dynamic";
import { InView } from "./InView";

// Recharts is only fetched once a chart scrolls near the viewport.
const lazyChart = <K extends "SourceBars" | "WeeklyLine" | "SpeedHistogram" | "MedianTrend">(name: K) =>
  dynamic(() => import("./charts").then((m) => m[name] as never), { ssr: false }) as unknown as (typeof import("./charts"))[K];
const SourceBars = lazyChart("SourceBars");
const WeeklyLine = lazyChart("WeeklyLine");
const SpeedHistogram = lazyChart("SpeedHistogram");
const MedianTrend = lazyChart("MedianTrend");
import { NeoviaLogo, UrbanNestLogo } from "@/components/shell/Logos";
import { clientBySlug } from "@/data/clients";
import { DEFAULT_MONTH, FULL_MONTH_NAME, MONTH_LABEL, availableMonths } from "@/lib/months";
import { SPEED_BUCKETS, SPEED_BUCKET_LABEL } from "@/lib/metrics";
import { SOURCE_COLOR, SOURCE_LABEL } from "@/lib/types";
import { DAY, addMonths, daysInMonth } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useDemo } from "@/store/demo";
import { useNow } from "@/store/data";

export function DashboardView({ slug }: { slug: string }) {
  const params = useSearchParams();
  const now = useNow();
  const months = availableMonths(now);
  const wanted = params.get("month") ?? DEFAULT_MONTH;
  const month = months.includes(wanted) ? wanted : DEFAULT_MONTH;
  const client = clientBySlug(slug)!;
  return (
    <MetricProvider clientId={client.id} month={month}>
      <Dashboard slug={slug} month={month} months={months} />
    </MetricProvider>
  );
}

function Dashboard({ slug, month, months }: { slug: string; month: string; months: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const { metrics } = useMetricScope();
  const client = clientBySlug(slug)!;
  const t = metrics.tables;
  const change = metrics.figures["enquiries.change_pct"];

  const weekly = useMemo(() => t.weekly.map((w) => {
    const from = (w.week_no - 1) * 7 + 1, to = Math.min(w.week_no * 7, daysInMonth(month));
    return { week_no: w.week_no, enquiries: w.enquiries, week: `${from}–${to}` };
  }), [t.weekly, month]);
  const speed = SPEED_BUCKETS.map((b) => ({ key: b, label: SPEED_BUCKET_LABEL[b], count: t.speed.buckets[b] }));
  const trend = [-2, -1, 0].flatMap((k) => {
    const m = addMonths(month, k);
    const f = metrics.figures[`trend.median_min.${m}`];
    return f ? [{ month: m, label: new Date(`${m}-01T12:00:00Z`).toLocaleString("en-IN", { month: "short", timeZone: "UTC" }), minutes: Math.round(f.value) }] : [];
  });
  const { narrative } = useNarrative();
  const isAdmin = useDemo((s) => s.hydrated && s.role === "admin");
  const topSrc = metrics.labels.top_campaign_source as keyof typeof SOURCE_LABEL | "";

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {slug === "urban-nest" ? <UrbanNestLogo className="h-9" /> : <span className="grid size-9 place-items-center rounded-lg bg-sand font-bold text-terracotta">{client.name[0]}</span>}
          <div>
            <h1 className="text-xl font-semibold leading-tight">{slug === "urban-nest" ? "Lead dashboard" : client.name}</h1>
            <p className="text-xs text-muted">{client.city} · {client.industry} · {FULL_MONTH_NAME[month]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Month" className="flex rounded-full border border-border bg-surface p-0.5 text-xs font-medium">
            {months.map((m) => (
              <button key={m} role="tab" aria-selected={m === month} onClick={() => router.replace(`${path}?month=${m}`)}
                className={cn("rounded-full px-3 py-1.5 transition-colors", m === month ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
                {MONTH_LABEL[m]}
              </button>
            ))}
          </div>
          <Link href={`/c/${slug}/report/${month}`} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-primary">
            <FileText size={14} /> Report
          </Link>
          <Link href={`/c/${slug}/quarterly`} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-primary">
            <Presentation size={14} /> Quarterly review
          </Link>
        </div>
      </div>

      {(metrics.figures["midmonth.change_pct"]?.value ?? 0) <= -25 && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <p>Enquiries are down <Metric id="midmonth.drop_pct" className="font-semibold" /> versus the same point last month: <Metric id="midmonth.current" /> so far against <Metric id="midmonth.previous" />. Check your ads and your reply times.</p>
        </div>
      )}

      {/* headline cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TiltCard>
          <Label>Enquiries</Label>
          <Big><Metric id="enquiries.total" animated /></Big>
          <Sub>
            {change ? (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", change.value >= 0 ? "text-emerald-600" : "text-red-600")}>
                {change.value >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}<Metric id="enquiries.change_pct" />
              </span>
            ) : null}{" "}{change ? "vs last month" : "first month on LeadLens"}
          </Sub>
        </TiltCard>
        <TiltCard>
          <Label>Won</Label>
          <Big><Metric id="won.total" animated /></Big>
          <Sub><Metric id="conversion.overall" /> conversion</Sub>
        </TiltCard>
        <div data-tour="revenue-card">
        <TiltCard>
          <Label>Revenue won</Label>
          <Big><Metric id="revenue.won" animated short /></Big>
          <Sub><Metric id="revenue.won" /></Sub>
        </TiltCard>
        </div>
        <TiltCard>
          <Label>Median reply time</Label>
          <Big><Metric id="response.median_min" animated /></Big>
          <Sub><Metric id="response.within15_pct" /> within 15 min</Sub>
        </TiltCard>
        <TiltCard className="col-span-2 lg:col-span-1">
          <Label>Cost per lead</Label>
          <Big><Metric id="cpl.paid" animated /></Big>
          <Sub><Metric id="spend.total" /> ad spend</Sub>
        </TiltCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Lazy h={260}><Card title="Enquiries by source" aside={<><Metric id="enquiries.raw" /> raw → <Metric id="enquiries.total" /> unique (<Metric id="enquiries.duplicates" /> merged)</>}>
          <InView height={Math.max(180, t.sources.length * 44)}><SourceBars data={t.sources} /></InView>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted"><tr><th className="py-1 font-medium">Source</th><th className="font-medium">Enquiries</th><th className="font-medium">Won</th><th className="font-medium">Conv.</th></tr></thead>
              <tbody>
                {t.sources.map((s) => (
                  <tr key={s.source} className="border-t border-border">
                    <td className="py-1.5"><span className="mr-2 inline-block size-2 rounded-full" style={{ background: SOURCE_COLOR[s.source] }} />{SOURCE_LABEL[s.source]}</td>
                    <td><Metric id={`source.${s.source}.enquiries`} /></td><td><Metric id={`source.${s.source}.won`} /></td><td><Metric id={`source.${s.source}.conversion`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card></Lazy>

        <Lazy h={260}><Card title="Enquiries by week" aside={month === "2026-11" ? "month to date" : undefined}>
          <InView height={180}><WeeklyLine data={weekly} /></InView>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {weekly.map((w) => <span key={w.week_no}>{w.week}: <Metric id={`week.${w.week_no}.enquiries`} className="font-medium text-foreground" /></span>)}
          </div>
        </Card></Lazy>

        <Lazy h={260}><Card title="Funnel">
          <div className="space-y-2.5">
            {([["Enquiries", "enquiries.total", null], ["Contacted", "contacted.total", "funnel.contacted_pct"], ["Meeting / site visit", "meetings.total", "funnel.meeting_pct"], ["Won", "won.total", "funnel.won_pct"]] as const).map(([label, id, pct], i) => {
              const top = metrics.figures["enquiries.total"]?.value || 1;
              const w = Math.max(4, ((metrics.figures[id]?.value ?? 0) / top) * 100);
              return (
                <div key={id}>
                  <div className="mb-1 flex items-baseline justify-between text-xs"><span className="text-muted">{label}</span>
                    <span><Metric id={id} className="font-semibold" />{pct && <span className="ml-2 text-muted"><Metric id={pct} /> of previous</span>}</span></div>
                  <div className="h-7 rounded-md bg-surface-2"><div className="h-7 rounded-md transition-[width] duration-700" style={{ width: `${w}%`, background: ["var(--neovia-primary)", "#5b5fe0", "var(--client-primary)", "var(--neovia-accent)"][i] }} /></div>
                </div>
              );
            })}
          </div>
        </Card></Lazy>

        <Lazy h={260}><Card title="Speed to lead" aside={<>median <Metric id="response.median_min" /> · <Metric id="response.within15" /> within 15 min</>}>
          <InView height={180}><SpeedHistogram data={speed} /></InView>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {speed.map((s) => <span key={s.key}>{s.label}: <Metric id={`speed.bucket.${s.key}`} className="font-medium text-foreground" /></span>)}
          </div>
        </Card></Lazy>

        <Lazy h={260}><Card title="Median reply time, 3 months" aside="Click a point for the leads behind it">
          <InView height={180}><MedianTrend data={trend} /></InView>
          <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted">
            {trend.map((p) => <span key={p.month}>{p.label}: <Metric id={`trend.median_min.${p.month}`} className="font-medium text-foreground" /></span>)}
          </div>
        </Card></Lazy>

        <Lazy h={260}><Card title="Top campaign" className="lg:col-span-1">
          {metrics.labels.top_campaign ? (
            <div className="flex items-center gap-4">
              <span className="size-12 shrink-0 rounded-xl" style={{ background: topSrc ? SOURCE_COLOR[topSrc as keyof typeof SOURCE_COLOR] : "var(--neovia-primary)", opacity: 0.9 }} />
              <div>
                <p className="font-medium">{metrics.labels.top_campaign}</p>
                <p className="text-sm text-muted">{topSrc ? SOURCE_LABEL[topSrc] : ""} · <Metric id="campaign.top.enquiries" /> enquiries · <Metric id="campaign.top.won" /> won</p>
              </div>
            </div>
          ) : <p className="text-sm text-muted">No campaigns yet.</p>}
        </Card></Lazy>
      </div>

      <Lazy h={220}><MissedCard slug={slug} /></Lazy>

      <Lazy h={260}><Card title="Recommendations" aside="Every figure is clickable">
        <ol className="grid gap-3 md:grid-cols-3">
          {narrative.recommendations.map((r, i) => (
            <li key={r.title} className="rounded-xl bg-surface-2 p-4">
              <p className="text-xs font-semibold text-primary">{i + 1}</p>
              <p className="mt-1 font-semibold">{r.title}</p>
              <p className="mt-1 text-sm text-muted"><NarrativeText parts={r.parts} /></p>
              {isAdmin && <p className="mt-2 inline-block rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-medium text-fuchsia-700 dark:text-fuchsia-300" title="Visible to Neovia only">Upsell · {SERVICE_LABEL[r.service]}</p>}
            </li>
          ))}
        </ol>
      </Card></Lazy>

      <div className="grid gap-4 lg:grid-cols-2">
        <Lazy h={260}><Card title="Neovia work this month" aside={<NeoviaLogo className="h-5" />}>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {([["Posts", "care.posts"], ["Updates", "care.updates"], ["Fixes", "care.fixes"], ["Uptime", "care.uptime"]] as const).map(([l, id]) => (
              <div key={id} className="rounded-xl bg-surface-2 p-3"><dd className="text-lg font-semibold"><Metric id={id} /></dd><dt className="text-[11px] text-muted">{l}</dt></div>
            ))}
          </dl>
        </Card></Lazy>
        <Lazy h={260}><Card title="Industry benchmark">
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2"><Lock size={18} /></span>
            <p>Industry benchmark unlocks when 5+ clients in your industry join.</p>
          </div>
        </Card></Lazy>
        <Lazy h={260}><Card title="Google Business Profile" aside="manual entry">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {([["Calls", "gbp.calls"], ["Directions", "gbp.directions"], ["Website clicks", "gbp.website_clicks"]] as const).map(([l, id]) => (
              <div key={id} className="rounded-xl bg-surface-2 p-3"><dd className="text-lg font-semibold"><Metric id={id} /></dd><dt className="text-[11px] text-muted">{l}</dt></div>
            ))}
          </dl>
        </Card></Lazy>
      </div>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="text-xs font-medium text-muted">{children}</p>;
const Big = ({ children }: { children: React.ReactNode }) => <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{children}</p>;
const Sub = ({ children }: { children: React.ReactNode }) => <p className="mt-1 text-xs text-muted">{children}</p>;

function MissedCard({ slug }: { slug: string }) {
  const { metrics, ds, asOf, clientId } = useMetricScope();
  const reminded = useDemo((s) => s.remindedLeads);
  const mark = useDemo((s) => s.markReminded);
  const rows = metrics.tables.missed;
  const byNum = useMemo(() => new Map(ds.leads.filter((l) => l.client_id === clientId).map((l) => [l.number, l])), [ds, clientId]);
  return (
    <Card title={<>Missed opportunities · <Metric id="missed.total" /></>} aside="no follow-up within 24 hours">
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing missed. Every enquiry was followed up in time.</p> : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const l = byNum.get(r.lead_number);
            const days = Math.max(1, Math.floor((+asOf - Date.parse(r.created_at)) / DAY));
            const done = l ? reminded.includes(l.id) : false;
            return (
              <li key={r.lead_number} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <Link href={`/c/${slug}/leads?q=${r.lead_number}`} className="flex items-center gap-1 font-medium tabular-nums hover:text-primary">#{r.lead_number}<ExternalLink size={11} className="text-muted" /></Link>
                <span>{l?.name_masked}</span>
                <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: SOURCE_COLOR[r.source] }} />{SOURCE_LABEL[r.source]}</span>
                <span className="text-xs text-muted">{r.reason === "never_contacted" ? "never contacted" : "answered late"} · {days} {days === 1 ? "day" : "days"} ago</span>
                <button
                  disabled={done || !l}
                  onClick={() => { if (!l) return; mark(l.id); toast.success(`Reminder sent to ${l.owner} on WhatsApp`, { description: `Follow up with ${l.name_masked} (#${l.number}) today.` }); }}
                  className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary disabled:opacity-60"
                ><BellRing size={12} />{done ? "Reminded" : "Remind owner"}</button>
              </li>
            );
          })}
        </ul>
      )}
      {(metrics.figures["missed.weekend_instagram"]?.value ?? 0) > 0 && (
        <p className="mt-2 text-xs text-muted"><Metric id="missed.weekend_instagram" /> of these came from weekend Instagram ads.</p>
      )}
    </Card>
  );
}
