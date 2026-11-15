"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bug, RefreshCw, RotateCcw, Send } from "lucide-react";
import { AdminGuard } from "./AdminGuard";
import { Flagged, StatusChip } from "./bits";
import { MetricProvider } from "@/components/metric/MetricProvider";
import { StreamParts } from "@/components/narrative/Streaming";
import { useNarrative } from "@/components/narrative/useNarrative";
import { reviewRequired, sendCheck } from "@/lib/admin";
import { approveAndSend, injectHallucination, metricsFor, regenerateReport, resetNarrative, saveNarrative } from "@/lib/admin-actions";
import { resolveNarrative } from "@/lib/narrative/resolve";
import { useDemo } from "@/store/demo";
import { fmtDateTime } from "@/lib/format";
import { FULL_MONTH_NAME } from "@/lib/months";
import type { NarrativeData } from "@/lib/narrative/guard";
import { SERVICE_LABEL, type Narrative, type Service } from "@/lib/narrative/template";
import { cn } from "@/lib/utils";
import { useAdminData } from "@/store/admin";

export function ReportReview({ id }: { id: string }) {
  return <AdminGuard><Loader id={id} /></AdminGuard>;
}

function Loader({ id }: { id: string }) {
  const { reports } = useAdminData();
  const r = reports.find((x) => x.report.id === id);
  if (!r) return <div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-lg font-semibold">Report not found</h1><Link href="/admin" className="mt-3 inline-block text-primary">Back to admin</Link></div>;
  return <MetricProvider clientId={r.client.id} month={r.report.month}><Review id={id} /></MetricProvider>;
}

function Review({ id }: { id: string }) {
  const { reports, st } = useAdminData();
  const r = reports.find((x) => x.report.id === id)!;
  const { data, guard, source, edited } = useNarrative();
  const [streaming, setStreaming] = useState<Narrative | null>(null);
  const [busy, setBusy] = useState(false);
  const slug = r.client.slug;
  const check = sendCheck(r, guard.ok);
  const required = reviewRequired(r.client, st);

  const update = (next: NarrativeData) => saveNarrative(id, next);
  const setRec = (i: number, patch: Partial<NarrativeData["recommendations"][number]>) =>
    update({ ...data, recommendations: data.recommendations.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const regenerate = async () => {
    setBusy(true);
    await regenerateReport(id);
    setBusy(false);
    const x = metricsFor(id);
    if (x) setStreaming(resolveNarrative(x.metrics, useDemo.getState().reports[id]?.narrative).narrative);
  };

  const fieldItems = (name: string) => guard.fields.find((f) => f.field === name)?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <Link href="/admin" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft size={15} /> Admin</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{r.client.name} · {FULL_MONTH_NAME[r.report.month]}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted"><span className="font-mono">{r.report.id}</span><StatusChip status={r.status} />
            {r.generatedAt && <span>generated {fmtDateTime(r.generatedAt)}</span>}
            <span>· Narrative source: <b className="text-foreground">{source === "llm" ? "LLM" : "Template (offline)"}</b>{edited && " · edited"}</span>
            <span>· Neovia review {required ? "required" : "off"}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={regenerate} disabled={busy} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-50"><RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Regenerate</button>
          <button onClick={() => resetNarrative(id)} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-primary"><RotateCcw size={13} /> Reset to template</button>
          <button onClick={() => injectHallucination(id)} className="flex items-center gap-1.5 rounded-full border border-dashed border-red-400 px-3 py-1.5 text-xs font-medium text-red-600"><Bug size={13} /> Inject hallucinated figure</button>
          <button onClick={() => approveAndSend(id)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white", check.canSend ? "bg-primary" : "bg-neutral-400")}><Send size={13} /> {required ? "Approve & send" : "Send now"}</button>
        </div>
      </div>

      {r.changed && <p className="rounded-xl bg-amber-500/15 px-3.5 py-2 text-sm text-amber-800 dark:text-amber-300">Data changed since generation. Regenerate to include the latest enquiries and outcomes.</p>}
      {!check.canSend && r.status !== "sent" && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-sm text-red-800 dark:text-red-300">
          <p className="font-medium">This report cannot be sent yet</p>
          <ul className="mt-1 list-disc pl-5 text-xs">{check.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <section className={cn("rounded-2xl border p-4", guard.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5")}>
            <h2 className="text-sm font-semibold">Figure guard</h2>
            {guard.ok ? <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">✓ All {guard.total} figures verified</p> : (
              <>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">✗ {guard.unverified.length} unverified {guard.unverified.length === 1 ? "figure" : "figures"} out of {guard.total}</p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-red-700 dark:text-red-300">
                  {guard.fields.flatMap((f) => f.items.filter((i) => !i.ok).map((i) => <li key={f.field + i.start}><b>{i.text}</b> in {f.field}: no matching figure in your data</li>))}
                </ul>
              </>
            )}
          </section>

          {streaming && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Commentary just written</h2><button onClick={() => setStreaming(null)} className="text-xs text-muted">Dismiss</button></div>
              <ol className="mt-2 space-y-2 text-sm">
                {streaming.recommendations.map((x, i) => <li key={i}><b>{x.title}</b> <StreamParts parts={x.parts} /></li>)}
              </ol>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Commentary</h2>
            <label className="mt-3 block text-xs font-medium text-muted">Headline
              <input value={data.headline} onChange={(e) => update({ ...data, headline: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            {fieldItems("headline").some((i) => !i.ok) && <p className="mt-1 text-xs"><Flagged text={data.headline} items={fieldItems("headline")} /></p>}
            {data.recommendations.map((rec, i) => (
              <div key={i} className="mt-4 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-primary">Recommendation {i + 1}</span>
                  <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-medium text-fuchsia-700 dark:text-fuchsia-300" title="Visible to Neovia only">Upsell · {SERVICE_LABEL[rec.service as Service]}</span>
                </div>
                <input aria-label={`Recommendation ${i + 1} title`} value={rec.title} onChange={(e) => setRec(i, { title: e.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium" />
                <textarea aria-label={`Recommendation ${i + 1} text`} rows={3} value={rec.body} onChange={(e) => setRec(i, { body: e.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                {fieldItems(`recommendation ${i + 1}`).some((x) => !x.ok) && <p className="mt-1 text-xs text-muted"><Flagged text={rec.body} items={fieldItems(`recommendation ${i + 1}`)} /></p>}
              </div>
            ))}
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">Preview · what the client sees</p>
          <iframe title="Report preview" src={`/c/${slug}/report/${r.report.month}`} className="h-[780px] w-full border-0 bg-neutral-100" />
        </section>
      </div>
    </div>
  );
}
