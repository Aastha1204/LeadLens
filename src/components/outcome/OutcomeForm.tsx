"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { clientBySlug } from "@/data/clients";
import { inr } from "@/lib/format";
import { SOURCE_SHORT, type Lead, type LostReason } from "@/lib/types";
import { parseAmount, REASON_LABEL } from "@/lib/whatsapp/parser";
import { applyOutcomeCommand } from "@/lib/whatsapp/actions";
import { cn } from "@/lib/utils";
import { useDataset, useNow } from "@/store/data";

const REASONS: LostReason[] = ["price", "timeline", "competitor", "area", "no_response", "other"];

/** Mobile-first outcome entry. Uses the same handler as WhatsApp replies. */
export function OutcomeForm({ slug }: { slug: string }) {
  const ds = useDataset();
  const now = useNow();
  const client = clientBySlug(slug)!;
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Lead | null>(null);
  const [mode, setMode] = useState<"won" | "lost">("won");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<LostReason>("price");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useMemo(() => ds.leads.filter((l) => l.client_id === client.id && Date.parse(l.created_at) <= +now && l.stage !== "won" && l.stage !== "lost")
    .sort((a, b) => Number(b.stage === "site_visit") - Number(a.stage === "site_visit") || b.number - a.number), [ds, client.id, now]);
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase().replace(/^#/, "");
    return (n ? open.filter((l) => String(l.number).startsWith(n) || l.name_masked.toLowerCase().includes(n)) : open).slice(0, 6);
  }, [open, q]);
  const parsed = amount ? parseAmount(amount) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    setError(null);
    if (mode === "won" && parsed === null) { setError("Enter the deal amount, for example 120000, 1.2L or 1,20,000."); return; }
    const r = applyOutcomeCommand(mode === "won" ? { kind: "won", lead: picked.number, amount: parsed! } : { kind: "lost", lead: picked.number, reason });
    if (r.ok) { setDone(r.message); setPicked(null); setAmount(""); setQ(""); } else setError(r.message);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-xl font-semibold">Record an outcome</h1>
      <p className="mt-1 text-sm text-muted">Tell us what happened with an enquiry. Your dashboard and report update straight away.</p>

      {done && (
        <div role="status" className="mt-4 flex gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} /><p>{done.replace(/^✅\s*/, "")}</p>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-5">
        <div>
          <label htmlFor="lead-search" className="text-sm font-medium">Which lead?</label>
          <div className="relative mt-1.5">
            <Search size={15} className="absolute left-3 top-3 text-muted" />
            <input id="lead-search" value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder="Search by number or name, e.g. 186" inputMode="search"
              className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-base outline-none focus:border-primary" />
          </div>
          {!picked && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {matches.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => { setPicked(l); setDone(null); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                    <span><span className="font-medium tabular-nums">#{l.number}</span> · {l.name_masked}<span className="block text-xs text-muted">{SOURCE_SHORT[l.source]} · {l.requirement} · {l.locality}</span></span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] capitalize text-muted">{l.stage.replace("_", " ")}</span>
                  </button>
                </li>
              ))}
              {matches.length === 0 && <li className="px-3 py-3 text-sm text-muted">No open lead matches.</li>}
            </ul>
          )}
          {picked && (
            <div className="mt-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
              <span className="font-semibold tabular-nums">#{picked.number}</span> · {picked.name_masked}
              <span className="block text-xs text-muted">{SOURCE_SHORT[picked.source]} · {picked.requirement} · {picked.campaign}</span>
            </div>
          )}
        </div>

        {picked && (
          <>
            <div role="tablist" aria-label="Outcome" className="grid grid-cols-2 rounded-xl border border-border bg-surface p-1 text-sm font-medium">
              {(["won", "lost"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={cn("rounded-lg py-2.5 transition-colors", mode === m ? (m === "won" ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "text-muted")}>
                  {m === "won" ? "Won" : "Lost"}
                </button>
              ))}
            </div>

            {mode === "won" ? (
              <div>
                <label htmlFor="amount" className="text-sm font-medium">Deal amount</label>
                <input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="120000, 1,20,000, 1.2L or 120k" inputMode="decimal"
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-primary" />
                {parsed !== null && <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">{inr(parsed)}</p>}
              </div>
            ) : (
              <fieldset>
                <legend className="text-sm font-medium">Why was it lost?</legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
                      className={cn("rounded-full border px-3.5 py-2 text-sm capitalize", reason === r ? "border-primary bg-primary text-white" : "border-border bg-surface")}>{REASON_LABEL[r]}</button>
                  ))}
                </div>
              </fieldset>
            )}

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-white">Save outcome</button>
          </>
        )}
      </form>
    </div>
  );
}
