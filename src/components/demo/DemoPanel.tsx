"use client";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, Bug, CalendarClock, Play, RotateCcw, ShieldCheck, Wrench, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";
import { injectHallucination, setConnector } from "@/lib/admin-actions";
import { injectLiveLead, jumpTo15Nov, resetDemo } from "@/lib/demo-actions";
import { cn } from "@/lib/utils";
import { useAdminData } from "@/store/admin";
import { useNow } from "@/store/data";
import { useDemo } from "@/store/demo";
import { WhatsAppSend } from "./WhatsAppSend";

const META = "cn_c1_meta_lead_ads";

export function DemoPanel() {
  const { panelOpen, togglePanel, hydrated, setTourStep } = useDemo();
  const router = useRouter();
  const now = useNow();
  const { connectors, st } = useAdminData();
  const review = st.reviewRequiredBy["c1"] ?? true;
  const setReview = useDemo((s) => s.setReviewRequired);
  const broken = connectors.find((c) => c.id === META)?.status === "failed";
  if (!hydrated) return null;

  const items: { icon: typeof Play; label: string; hint: string; on?: boolean; act: () => void }[] = [
    { icon: Play, label: "Run the 1st of the month", hint: "Opens the 3D run", act: () => { togglePanel(false); router.push("/run"); } },
    { icon: Bell, label: "Inject a new live lead", hint: "Toast, phone ping, live response timer", act: () => { injectLiveLead(); router.push("/c/urban-nest/leads"); } },
    { icon: Wrench, label: broken ? "Fix Urban Nest's Meta Lead Ads" : "Break Urban Nest's Meta Lead Ads", hint: "A failing connector blocks auto-send", on: broken, act: () => setConnector(META, broken ? "healthy" : "failed") },
    { icon: Bug, label: "Inject a hallucinated figure", hint: "“Google converted at 35%”: the guard blocks it", act: () => injectHallucination() },
    { icon: CalendarClock, label: "Jump to 15 Nov", hint: "Mid-month alert: enquiries down 36%", act: () => { jumpTo15Nov(); router.push("/c/urban-nest/dashboard?month=2026-11"); } },
    { icon: ShieldCheck, label: `Neovia review ${review ? "on" : "off"}`, hint: "Toggle “Require Neovia review”", on: review, act: () => setReview("c1", !review) },
  ];

  return (
    <AnimatePresence>
      {panelOpen && (
        <motion.aside initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} role="dialog" aria-label="Demo panel"
          data-chrome className="no-print fixed bottom-4 left-4 z-50 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 text-sm text-foreground shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-semibold"><Zap size={15} className="text-accent" /> Demo panel</h2>
            <button aria-label="Close demo panel" onClick={() => togglePanel(false)} className="text-muted"><X size={16} /></button>
          </div>
          <p className="mt-0.5 text-xs text-muted">Demo clock · {fmtDateTime(now)}</p>
          <ul className="mt-3 space-y-1.5">
            {items.map((it) => (
              <li key={it.label}>
                <button onClick={it.act} className={cn("flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors hover:border-primary", it.on ? "border-accent/60 bg-accent/10" : "border-border")}>
                  <it.icon size={15} className="mt-0.5 shrink-0 text-muted" />
                  <span><span className="block font-medium">{it.label}</span><span className="block text-xs text-muted">{it.hint}</span></span>
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => { togglePanel(false); setTourStep(0); router.push("/run"); }} className="flex w-full items-start gap-2.5 rounded-xl border border-border px-3 py-2 text-left hover:border-primary">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-muted" /><span><span className="block font-medium">Start guided demo</span><span className="block text-xs text-muted">→ next · ← back · Esc exit</span></span>
              </button>
            </li>
            <li>
              <button onClick={() => { resetDemo(); togglePanel(false); router.push("/"); }} className="flex w-full items-start gap-2.5 rounded-xl border border-red-500/40 px-3 py-2 text-left text-red-600 hover:bg-red-500/10 dark:text-red-400">
                <RotateCcw size={15} className="mt-0.5 shrink-0" /><span><span className="block font-medium">Reset demo</span><span className="block text-xs opacity-80">Restores the initial state exactly</span></span>
              </button>
            </li>
          </ul>
          <WhatsAppSend onToast={(m) => toast(m)} />
          <p className="mt-3 text-[11px] leading-relaxed text-muted">Keys: <kbd>D</kbd> panel · <kbd>P</kbd> phone · <kbd>F</kbd> fullscreen · <kbd>R</kbd> reset · <kbd>→</kbd><kbd>←</kbd> tour</p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
