"use client";
import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { buildMetricsJson } from "@/lib/metrics";
import { summaryText } from "@/lib/whatsapp/summary";
import { currentDataset } from "@/store/data";
import { useDemo } from "@/store/demo";

/** Optional: sends the real summary to the presenter's own phone via the WhatsApp Cloud API test number (only when configured). */
export function WhatsAppSend({ onToast }: { onToast: (m: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/whatsapp").then((r) => r.json()).then((j: { enabled?: boolean }) => setEnabled(!!j.enabled)).catch(() => {}); }, []);
  if (!enabled) return null;
  const send = async () => {
    setBusy(true);
    const s = useDemo.getState();
    const m = buildMetricsJson(currentDataset(), "c1", "2026-10", new Date(s.demoClock));
    const text = summaryText(m, s.lang).replace("[link]", `${location.origin}/c/urban-nest/report/2026-10`);
    try {
      const r = await fetch("/api/whatsapp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, text }) });
      const j = (await r.json()) as { error?: string };
      onToast(r.ok ? "Sent to your phone" : j.error ?? "Could not send");
    } catch { onToast("Could not send"); }
    setBusy(false);
  };
  return (
    <div className="mt-3 rounded-xl border border-border p-3">
      <p className="text-xs font-medium">Send to my phone (WhatsApp Cloud API)</p>
      <div className="mt-1.5 flex gap-1.5">
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91 98XXXXXXXX (your own number)" aria-label="Your WhatsApp number" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
        <button onClick={send} disabled={busy || to.length < 8} className="flex items-center gap-1 rounded-lg bg-[#25d366] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"><Send size={12} /> Send</button>
      </div>
      <p className="mt-1 text-[10px] text-muted">Message the test number from this phone first: free-form messages only deliver within 24 hours of your last message to it.</p>
    </div>
  );
}
