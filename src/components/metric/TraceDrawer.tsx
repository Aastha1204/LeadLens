"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";
import { getTrace } from "@/lib/metrics";
import { fmtDateTime, minutesLabel } from "@/lib/format";
import { responseMin } from "@/lib/metrics/predicates";
import { SOURCE_LABEL, type Lead, type RawEnquiry } from "@/lib/types";
import { useDataset, useNow } from "@/store/data";
import { useDemo } from "@/store/demo";

const MAX_ROWS = 250;

export function TraceDrawer() {
  const target = useDemo((s) => s.traceTarget);
  const close = () => useDemo.getState().setTraceTarget(null);
  const ds = useDataset();
  const asOf = useNow();
  const trace = useMemo(
    () => (target ? getTrace(ds, target.clientId, target.month, asOf, target.traceId) : null),
    [ds, asOf, target],
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target]);

  const sqlText = trace ? [trace.baseSql, trace.sql].filter(Boolean).join("\n\n") : "";
  const countMatches = trace && trace.unit === "count" && trace.rowKind !== "table" ? trace.rows.length === trace.value : null;

  return (
    <AnimatePresence>
      {target && trace && (
        <>
          <motion.div key="scrim" className="no-print fixed inset-0 z-50 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.aside
            key="drawer" role="dialog" aria-label="How this number was computed"
            className="no-print fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-border bg-surface text-foreground shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">How this was computed</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{trace.display}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">{trace.key}</p>
              </div>
              <button aria-label="Close" onClick={close} className="rounded-full border border-border p-1.5 text-muted hover:text-foreground"><X size={16} /></button>
            </header>
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section>
                <h3 className="text-sm font-semibold">Definition</h3>
                <p className="mt-1 text-sm text-muted">{trace.definition}</p>
              </section>
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">SQL <span className="font-mono text-xs font-normal text-muted">· {trace.view}</span></h3>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(sqlText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
                  >{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}</button>
                </div>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-ink p-3 font-mono text-[11px] leading-relaxed text-slate-200">{sqlText}</pre>
              </section>
              <section>
                <h3 className="text-sm font-semibold">
                  Contributing rows <span className="font-normal text-muted">({trace.rows.length}{countMatches === true ? " · matches the figure" : ""})</span>
                </h3>
                {trace.rows.length > MAX_ROWS && <p className="mt-1 text-xs text-muted">Showing the first {MAX_ROWS}.</p>}
                <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                  {trace.rowKind === "lead" && <LeadRows rows={(trace.rows as Lead[]).slice(0, MAX_ROWS)} />}
                  {trace.rowKind === "raw" && <RawRows rows={(trace.rows as RawEnquiry[]).slice(0, MAX_ROWS)} />}
                  {trace.rowKind === "table" && <pre className="p-3 font-mono text-[11px]">{JSON.stringify(trace.rows, null, 2)}</pre>}
                </div>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function LeadRows({ rows }: { rows: Lead[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-surface-2 text-muted"><tr><th className="p-2">#</th><th className="p-2">Lead</th><th className="p-2">Source</th><th className="p-2">Created</th><th className="p-2">Reply</th><th className="p-2">Stage</th></tr></thead>
      <tbody>
        {rows.map((l) => {
          const m = responseMin(l);
          return (
            <tr key={l.id} className="border-t border-border">
              <td className="p-2 font-medium tabular-nums">#{l.number}</td>
              <td className="p-2">{l.name_masked}</td>
              <td className="p-2">{SOURCE_LABEL[l.source]}</td>
              <td className="whitespace-nowrap p-2 text-muted">{fmtDateTime(l.created_at)}</td>
              <td className="p-2 tabular-nums">{m === null ? "never" : minutesLabel(m)}</td>
              <td className="p-2 capitalize">{l.stage.replace("_", " ")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
function RawRows({ rows }: { rows: RawEnquiry[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-surface-2 text-muted"><tr><th className="p-2">Raw id</th><th className="p-2">Source</th><th className="p-2">Received</th><th className="p-2">Phone hash</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border">
            <td className="p-2 font-mono">{r.id}</td><td className="p-2">{SOURCE_LABEL[r.source]}</td>
            <td className="whitespace-nowrap p-2 text-muted">{fmtDateTime(r.received_at)}</td>
            <td className="p-2 font-mono text-muted">{r.phone_hash.slice(0, 10)}…</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
