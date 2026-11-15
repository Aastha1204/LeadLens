import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  { name: "Care Basic", price: "₹2,999", points: ["Hosting", "Security updates", "Small changes", "Monthly LeadLens report"] },
  { name: "Care Growth", price: "₹5,999", featured: true, points: ["Care Basic, plus", "4 content updates", "15-minute monthly review call", "Recommendations"] },
  { name: "LeadLens standalone", price: "₹1,499", points: ["Report and dashboard", "For businesses not on a Care plan"] },
];

export function Pricing({ compact, only }: { compact?: boolean; only?: string }) {
  return (
    <div className={cn("grid gap-4", compact ? "sm:grid-cols-1" : "md:grid-cols-3")}>
      {PLANS.filter((p) => !only || p.name === only).map((p) => (
        <div key={p.name} className={cn("rounded-2xl border p-5", p.featured ? "border-accent bg-accent/5" : "border-border bg-surface")}>
          <p className="text-sm font-medium text-muted">{p.name}</p>
          <p className="mt-1 text-3xl font-semibold">{p.price}<span className="text-sm font-normal text-muted">/month</span></p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {p.points.map((x) => <li key={x} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

const TIERS = [
  { tier: "Basic", monthly: "₹2,999", setup: "₹17,999", hours: 8, points: ["3 sources (website form, WhatsApp, Google Business Profile)", "Dashboard", "1 tareekh ko WhatsApp report + PDF"] },
  { tier: "Standard", monthly: "₹4,999", setup: "₹30,999", hours: 14, featured: true, points: ["6 sources tak (+ Instagram/Facebook ads, missed calls, AI receptionist)", "Duplicates hatana", "Reply time", "Cost per lead aur per deal", "AI ki 3 recommendations", "“WON” reply se revenue"] },
  { tier: "Pro", monthly: "₹7,499", setup: "₹48,999", hours: 22, points: ["Standard + kai branches", "Custom stages (jaise site visit)", "CRM sync (Zoho jaisa)", "Staff-wise reply time", "Weekly report"] },
];

/** Setup + monthly pricing by tier, as three big cards. */
export function TierPricing() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {TIERS.map((t) => (
        <div key={t.tier} className={cn("flex flex-col rounded-3xl border p-7", t.featured ? "border-accent bg-accent/5 shadow-[0_0_0_1px_var(--neovia-accent),0_20px_60px_-20px_rgba(20,200,180,0.35)]" : "border-border bg-surface")}>
          <p className="text-lg font-semibold">{t.tier}</p>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5 text-5xl font-bold tracking-tight tabular-nums">{t.monthly}<span className="text-base font-normal text-muted">/month</span></p>
          <dl className="mt-5 space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
            <div className="flex items-baseline justify-between gap-3"><dt className="text-muted">Setup</dt><dd className="text-xl font-semibold tabular-nums">{t.setup}</dd></div>
            <div className="flex items-baseline justify-between gap-3"><dt className="text-muted">Setup ke ghante</dt><dd className="text-xl font-semibold tabular-nums">{t.hours}</dd></div>
          </dl>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Kya juda hoga</p>
          <ul className="mt-3 flex-1 space-y-2.5 text-[15px]">
            {t.points.map((x) => <li key={x} className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
