"use client";
import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Send, Wrench } from "lucide-react";
import { AdminGuard } from "./AdminGuard";
import { Dot, StatusChip, STATUS_LABEL } from "./bits";
import { CONNECTOR_LABEL, PLAN_LABEL, PLAN_PRICE, monthsOnPlan, mrr, reviewRequired, sendCheck, type EffectiveReport } from "@/lib/admin";
import { approveAndSend, regenerateReport, setConnector, submitForReview } from "@/lib/admin-actions";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { buildMetricsJson } from "@/lib/metrics";
import { FULL_MONTH_NAME } from "@/lib/months";
import { resolveNarrative } from "@/lib/narrative/resolve";
import type { ReportStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAdminData } from "@/store/admin";
import { useNow } from "@/store/data";
import { useDemo } from "@/store/demo";

const CURRENT = "2026-10";
const COLUMNS: ReportStatus[] = ["generated", "in_review", "approved", "sent", "blocked"];

export function AdminView() {
  return <AdminGuard><Admin /></AdminGuard>;
}

function Admin() {
  const { ds, st, reports, connectors } = useAdminData();
  const now = useNow();
  const setReview = useDemo((s) => s.setReviewRequired);
  const current = reports.filter((r) => r.report.month === CURRENT);
  const blocked = current.filter((r) => r.blockedBy.length);
  const failing = connectors.filter((c) => c.status === "failed");
  const drop = useMemo(() => buildMetricsJson(ds, "c1", "2026-11", now).figures, [ds, now]);
  const dropPct = drop["midmonth.change_pct"]?.value ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-xl font-semibold">Neovia admin</h1><p className="text-xs text-muted">{FULL_MONTH_NAME[CURRENT]} reports · demo clock {fmtDateTime(now)}</p></div>
        <div className="grid grid-cols-3 gap-3 text-right">
          <Kpi label="Monthly recurring revenue" value={inr(mrr(ds.clients))} strong />
          <Kpi label="Reports sent" value={`${current.filter((r) => r.status === "sent").length} of ${current.length}`} />
          <Kpi label="Failing connectors" value={String(failing.length)} bad={failing.length > 0} />
        </div>
      </div>

      {dropPct <= -25 && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <p><b>Urban Nest Interiors</b> · enquiries down {Math.abs(Math.round(dropPct))}% versus the same point last month ({drop["midmonth.current"].display} vs {drop["midmonth.previous"].display}). Mid-month alert sent to the owner.</p>
        </div>
      )}

      {blocked.map((r) => (
        <div key={r.report.id} role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-red-600" />
          <p className="flex-1"><b>{r.client.name}</b> · {r.blockedBy.map((c) => CONNECTOR_LABEL[c.type]).join(", ")} failing · {FULL_MONTH_NAME[r.report.month].split(" ")[0]} report blocked until fixed</p>
          {r.blockedBy.map((c) => <button key={c.id} onClick={() => setConnector(c.id, "healthy")} className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white"><Wrench size={12} /> Fix {CONNECTOR_LABEL[c.type]}</button>)}
        </div>
      ))}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Clients</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs text-muted">
              <tr><th className="p-3">Client</th><th>Plan</th><th>Fee / month</th><th>Require Neovia review</th><th>Report</th><th>Last sent</th><th>Connectors</th></tr>
            </thead>
            <tbody>
              {ds.clients.map((c) => {
                const rep = reports.find((r) => r.client.id === c.id && r.report.month === CURRENT);
                const sent = reports.filter((r) => r.client.id === c.id && r.sentAt).map((r) => r.sentAt!).sort().pop();
                const cs = connectors.filter((x) => x.client_id === c.id);
                const required = reviewRequired(c, st);
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-3"><p className="font-medium">{c.name}</p><p className="text-xs text-muted">{c.city} · {c.industry}{c.id === "c1" && ` · month ${monthsOnPlan(c, CURRENT)}`}</p></td>
                    <td>{PLAN_LABEL[c.plan]}</td>
                    <td className="tabular-nums">{inr(PLAN_PRICE[c.plan])}</td>
                    <td>
                      <button role="switch" aria-checked={required} aria-label={`Require Neovia review for ${c.name}`} onClick={() => setReview(c.id, !required)}
                        className={cn("relative h-5 w-9 rounded-full transition-colors", required ? "bg-primary" : "bg-border")}>
                        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", required ? "left-[18px]" : "left-0.5")} />
                      </button>
                    </td>
                    <td>{rep && <Link href={`/admin/reports/${rep.report.id}`}><StatusChip status={rep.status} /></Link>}</td>
                    <td className="text-xs text-muted">{sent ? fmtDate(sent) : "—"}</td>
                    <td><span className="flex gap-1.5">{cs.map((x) => <Dot key={x.id} status={x.status} title={`${CONNECTOR_LABEL[x.type]}: ${x.status}`} />)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Report queue · {FULL_MONTH_NAME[CURRENT]}</h2>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col} className="rounded-2xl border border-border bg-surface-2/50 p-2.5">
              <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-muted">{STATUS_LABEL[col]}<span>{current.filter((r) => r.status === col).length}</span></p>
              <div className="space-y-2">
                {current.filter((r) => r.status === col).map((r) => <QueueCard key={r.report.id} r={r} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Connector health</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs text-muted"><tr><th className="p-3">Client</th><th>Connector</th><th>Status</th><th>Last sync</th><th>Message</th><th /></tr></thead>
            <tbody>
              {connectors.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3">{ds.clients.find((x) => x.id === c.client_id)?.name}</td>
                  <td>{CONNECTOR_LABEL[c.type]}</td>
                  <td><span className="flex items-center gap-1.5 capitalize"><Dot status={c.status} />{c.status}</span></td>
                  <td className="text-xs text-muted">{c.last_sync_at ? fmtDateTime(c.last_sync_at) : "—"}</td>
                  <td className="text-xs text-muted">{c.message}</td>
                  <td className="pr-3 text-right">
                    {c.status === "failed"
                      ? <button onClick={() => setConnector(c.id, "healthy")} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary">Fix</button>
                      : c.status === "healthy" && c.type !== "gbp_manual" && <button onClick={() => setConnector(c.id, "failed")} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-red-500 hover:text-red-600">Break (demo)</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, strong, bad }: { label: string; value: string; strong?: boolean; bad?: boolean }) {
  return <div className="rounded-xl border border-border bg-surface px-3.5 py-2 text-left"><p className="text-[11px] text-muted">{label}</p><p className={cn("tabular-nums", strong ? "text-lg font-semibold" : "text-base font-medium", bad && "text-red-600")}>{value}</p></div>;
}

function QueueCard({ r }: { r: EffectiveReport }) {
  const { ds, st } = useAdminData();
  const now = useNow();
  const required = reviewRequired(r.client, st);
  const guardOk = useMemo(() => {
    const m = buildMetricsJson(ds, r.client.id, r.report.month, now);
    return resolveNarrative(m, r.override?.narrative).guard.ok;
  }, [ds, r.client.id, r.report.month, r.override?.narrative, now]);
  const check = sendCheck(r, guardOk);
  const sendLabel = required ? "Approve & send" : "Send now";
  return (
    <article className="rounded-xl border border-border bg-surface p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-medium leading-tight">{r.client.name}</p><p className="font-mono text-[11px] text-muted">{r.report.id}</p></div>
        <StatusChip status={r.status} />
      </div>
      {r.changed && (
        <button onClick={() => void regenerateReport(r.report.id)} className="mt-2 flex w-full items-center gap-1.5 rounded-lg bg-amber-500/15 px-2 py-1.5 text-left text-xs font-medium text-amber-800 dark:text-amber-300">
          <RefreshCw size={12} className="shrink-0" /> Data changed since generation · Regenerate
        </button>
      )}
      {!guardOk && <p className="mt-2 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-700 dark:text-red-300">Figure guard: unverified figure in commentary</p>}
      {r.blockedBy.length > 0 && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{r.blockedBy.map((c) => c.message).join(" · ")}</p>}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Link href={`/admin/reports/${r.report.id}`} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary">Review</Link>
        {r.status !== "sent" && r.status === "generated" && required && <button onClick={() => submitForReview(r.report.id)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary">Submit for review</button>}
        {r.status !== "sent" && (
          <button onClick={() => approveAndSend(r.report.id)} title={check.canSend ? undefined : check.reasons.join(" ")}
            className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white", check.canSend ? "bg-primary" : "bg-neutral-400")}><Send size={11} />{sendLabel}</button>
        )}
        <button onClick={() => void regenerateReport(r.report.id)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary">Regenerate</button>
      </div>
    </article>
  );
}
