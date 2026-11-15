"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { MetricProvider } from "@/components/metric/MetricProvider";
import { NarrativeText } from "@/components/report/Narrative";
import { useNarrative } from "@/components/narrative/useNarrative";
import { clientBySlug } from "@/data/clients";
import { buildMetricsJson, type MetricsJson } from "@/lib/metrics";
import { SERVICE_LABEL } from "@/lib/narrative/template";
import { SOURCES, SOURCE_COLOR, SOURCE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDataset, useNow } from "@/store/data";
import { useDemo } from "@/store/demo";

const DeckCtx = createContext<{ byMonth: Record<string, MetricsJson>; clientId: string } | null>(null);

/** A figure for a given month; click opens its trace. */
function Fig({ m, k, className }: { m: string; k: string; className?: string }) {
  const ctx = useContext(DeckCtx)!;
  const setTrace = useDemo((s) => s.setTraceTarget);
  const f = ctx.byMonth[m]?.figures[k];
  return f ? <button onClick={() => setTrace({ clientId: ctx.clientId, month: m, traceId: k })} title="How this was computed" className={cn("tabular-nums underline decoration-dotted decoration-white/30 underline-offset-4 hover:decoration-accent", className)}>{f.display}</button> : <span>—</span>;
}

const MONTHS = ["2026-08", "2026-09", "2026-10"];
const NAME: Record<string, string> = { "2026-08": "Aug", "2026-09": "Sep", "2026-10": "Oct" };

export function QuarterlyDeck({ slug }: { slug: string }) {
  const client = clientBySlug(slug)!;
  return <MetricProvider clientId={client.id} month="2026-10"><Deck slug={slug} clientId={client.id} /></MetricProvider>;
}

function Deck({ slug, clientId }: { slug: string; clientId: string }) {
  const ds = useDataset();
  const now = useNow();
  const setTrace = useDemo((s) => s.setTraceTarget);
  const isAdmin = useDemo((s) => s.hydrated && s.role === "admin");
  const { narrative } = useNarrative();
  const [i, setI] = useState(0);
  const byMonth = useMemo(() => Object.fromEntries(MONTHS.map((m) => [m, buildMetricsJson(ds, clientId, m, now)])) as Record<string, MetricsJson>, [ds, clientId, now]);
  const TOTAL = 5;
  const go = useCallback((n: number) => setI((x) => Math.min(TOTAL - 1, Math.max(0, typeof n === "number" ? n : x))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); setI((x) => Math.min(TOTAL - 1, x + 1)); }
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fig = (m: string, key: string) => byMonth[m].figures[key];
  const bars = (key: string) => { const vs = MONTHS.map((m) => fig(m, key)?.value ?? 0); const max = Math.max(1, ...vs); return vs.map((v) => v / max); };

  const slides = [
    <Slide key="trend" title="Three months at a glance" kicker="Enquiries, wins and revenue">
      <div className="grid gap-5 sm:grid-cols-3">
        {([["Enquiries", "enquiries.total", "var(--neovia-primary)"], ["Won", "won.total", "var(--neovia-accent)"], ["Revenue won", "revenue.won", "var(--client-primary)"]] as const).map(([l, k, c]) => (
          <div key={k} className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">{l}</p>
            <div className="mt-3 flex h-36 items-end gap-3">
              {MONTHS.map((m, j) => (
                <div key={m} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-sm font-semibold">{k === "revenue.won" ? <RevenueShort m={m} k={k} fig={fig} onClick={() => setTrace({ clientId, month: m, traceId: k })} /> : <Fig m={m} k={k} />}</span>
                  <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(6, bars(k)[j] * 80)}%` }} transition={{ duration: 0.7, delay: j * 0.1 }} className="w-full rounded-t-md" style={{ background: c, opacity: 0.55 + j * 0.22 }} />
                  <span className="text-[11px] text-slate-400">{NAME[m]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-lg">Enquiries grew <Fig m="2026-09" k="enquiries.change_pct" className="font-semibold text-accent" /> then <Fig m="2026-10" k="enquiries.change_pct" className="font-semibold text-accent" />.</p>
    </Slide>,

    <Slide key="sources" title="Where enquiries come from" kicker="Unique enquiries by source">
      <div className="space-y-3">
        {SOURCES.map((s) => (
          <div key={s} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm text-slate-300">{SOURCE_LABEL[s]}</span>
            <div className="flex flex-1 gap-1.5">
              {MONTHS.map((m, j) => {
                const v = fig(m, `source.${s}.enquiries`)?.value ?? 0;
                return <motion.div key={m} initial={{ width: 0 }} animate={{ width: `${(v / 34) * 100}%` }} transition={{ duration: 0.6, delay: j * 0.1 }} className="flex h-7 items-center rounded-r-md pl-2 text-xs font-semibold text-white" style={{ background: SOURCE_COLOR[s], opacity: 0.45 + j * 0.28, minWidth: 28 }}><Fig m={m} k={`source.${s}.enquiries`} /></motion.div>;
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">Bars per source: Aug, Sep, Oct.</p>
      <p className="mt-4 text-lg">In October, {SOURCE_LABEL[(byMonth["2026-10"].labels.best_source || "google") as keyof typeof SOURCE_LABEL]} converted best at <Fig m="2026-10" k={`source.${byMonth["2026-10"].labels.best_source || "google"}.conversion`} className="font-semibold text-accent" />.</p>
    </Slide>,

    <Slide key="speed" title="Faster replies, more wins" kicker="Median time to first response">
      <div className="flex items-end justify-around gap-6">
        {MONTHS.map((m, j) => {
          const v = fig(m, "response.median_min")?.value ?? 0;
          const max = Math.max(...MONTHS.map((x) => fig(x, "response.median_min")?.value ?? 0), 1);
          return (
            <div key={m} className="flex w-28 flex-col items-center gap-1">
              <span className="text-2xl font-bold"><Fig m={m} k="response.median_min" /></span>
              <motion.div initial={{ height: 0 }} animate={{ height: Math.max(10, (v / max) * 150) }} transition={{ duration: 0.7, delay: j * 0.12 }} className="w-full rounded-t-md bg-[var(--client-primary)]" />
              <span className="text-xs text-slate-400">{NAME[m]} · <Fig m={m} k="response.within15_pct" /> within 15 min</span>
            </div>
          );
        })}
      </div>
      <p className="mt-6 rounded-xl bg-accent/15 px-4 py-2 text-sm text-accent">Automation (AI receptionist + WhatsApp auto-reply) went live on 12 Sep.</p>
    </Slide>,

    <Slide key="wins" title="What it was worth" kicker="Closed deals and what they cost to win">
      <div className="grid gap-4 sm:grid-cols-3">
        {MONTHS.map((m) => (
          <div key={m} className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">{NAME[m]}</p>
            <p className="mt-1 text-3xl font-bold"><Fig m={m} k="won.total" /> <span className="text-base font-normal text-slate-400">won</span></p>
            <p className="mt-1 text-lg"><Fig m={m} k="revenue.won" /></p>
            <p className="mt-2 text-xs text-slate-400">Ad spend <Fig m={m} k="spend.total" /> · cost per win (Google) <Fig m={m} k="cpw.google" /></p>
          </div>
        ))}
      </div>
    </Slide>,

    <Slide key="next" title="Next quarter" kicker="Where to put the next rupee">
      <ol className="space-y-4">
        {narrative.recommendations.map((r, n) => (
          <li key={r.title} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold">{n + 1}</span>
            <div><p className="text-lg font-semibold">{r.title}</p><p className="text-sm text-slate-300"><NarrativeText parts={r.parts} /></p>
              {isAdmin && <p className="mt-1 inline-block rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[11px] text-fuchsia-300">Upsell · {SERVICE_LABEL[r.service]}</p>}</div>
          </li>
        ))}
      </ol>
    </Slide>,
  ];

  return (
    <DeckCtx.Provider value={{ byMonth, clientId }}>
    <div className="force-dark relative min-h-[calc(100vh-3.5rem)] bg-[radial-gradient(ellipse_at_80%_0%,rgba(59,63,216,0.35),transparent_55%)]">
      <Link href={`/c/${slug}/dashboard?month=2026-10`} aria-label="Close deck" className="absolute right-4 top-4 z-10 rounded-full border border-border p-2 text-muted hover:text-foreground"><X size={16} /></Link>
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-5 py-8">
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}>{slides[i]}</motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => go(i - 1)} disabled={i === 0} className="flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-40"><ArrowLeft size={14} /> Back</button>
          <div className="flex items-center gap-1.5">{slides.map((s, n) => <button key={s.key} aria-label={`Slide ${n + 1}`} onClick={() => go(n)} className={cn("h-2 rounded-full transition-all", n === i ? "w-6 bg-accent" : "w-2 bg-border")} />)}</div>
          <button onClick={() => go(i + 1)} disabled={i === TOTAL - 1} className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Next <ArrowRight size={14} /></button>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted">Use ← → to move between slides</p>
      </div>
    </div>
    </DeckCtx.Provider>
  );
}

function RevenueShort({ m, k, fig, onClick }: { m: string; k: string; fig: (m: string, k: string) => { value: number; variants?: string[] } | undefined; onClick: () => void }) {
  const f = fig(m, k);
  const short = f?.variants?.find((v) => /L$|Cr$/.test(v)) ?? "";
  return <button onClick={onClick} title="How this was computed" className="underline decoration-dotted decoration-white/30 underline-offset-4">{short || "—"}</button>;
}

function Slide({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">{kicker}</p>
      <h1 className="mb-6 mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {children}
    </div>
  );
}
