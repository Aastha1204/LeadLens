"use client";
import { useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Link2, MessageCircle, RefreshCw } from "lucide-react";
import { Phone } from "@/components/phone/Phone";
import { Pricing, TierPricing } from "./Pricing";
import { useSupport } from "@/components/three/useCan3D";
import { SOURCES, SOURCE_COLOR, SOURCE_LABEL } from "@/lib/types";
import { buildMetricsJson } from "@/lib/metrics";
import { summaryText } from "@/lib/whatsapp/summary";
import { getSeed } from "@/data/seed";
import { useDemo, type ChatMsg } from "@/store/demo";

const HeroScene = dynamic(() => import("@/components/three/HeroScene"), { ssr: false });

const STEPS = [
  { icon: Link2, title: "We connect your lead sources", body: "Instagram ads, Google, calls, website forms and WhatsApp feed one lead table." },
  { icon: RefreshCw, title: "We merge the duplicates", body: "The same person enquiring twice counts once, credited to the first source." },
  { icon: BarChart3, title: "We compute every figure", body: "Enquiries, reply speed, funnel and cost per lead, each one traceable to the rows behind it." },
  { icon: MessageCircle, title: "It lands on your WhatsApp", body: "On the 1st, a one-page report and a live dashboard. Reply WON or LOST to keep it accurate." },
];

export function LandingView() {
  const router = useRouter();
  const support = useSupport();
  const setTour = useDemo((s) => s.setTourStep);
  const preview = useMemo<ChatMsg[]>(() => {
    const m = buildMetricsJson(getSeed(), "c1", "2026-10", new Date("2026-11-01T03:30:00.000Z"));
    const at = "2026-11-01T03:30:00.000Z";
    return [
      { id: "h1", from: "bot", kind: "doc", text: "", at, doc: { name: "LeadLens_UrbanNest_Oct2026.pdf", pages: 2 } },
      { id: "h2", from: "bot", kind: "text", text: summaryText(m), at, href: "/c/urban-nest/report/2026-10" },
    ];
  }, []);

  return (
    <div className="force-dark">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(59,63,216,0.35),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">LeadLens by Neovia AI</p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">Know exactly what your marketing money did last month.</h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">On the 1st of every month, a one-page report lands on your WhatsApp: how many enquiries came in, from where, how fast they were answered and how many converted.</p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm font-medium">
              <button onClick={() => { setTour(0); router.push("/run"); }} className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-white">Start guided demo <ArrowRight size={15} /></button>
              <Link href="/run" className="rounded-full bg-accent px-5 py-2.5 text-ink">Run the 1st of the month</Link>
              <Link href="/c/urban-nest/dashboard?month=2026-10" className="rounded-full border border-border px-5 py-2.5">Open client dashboard</Link>
              <Link href="/admin" className="rounded-full border border-border px-5 py-2.5">Neovia admin</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-2 text-xs text-muted">
              {SOURCES.map((s) => <li key={s} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><span className="size-2 rounded-full" style={{ background: SOURCE_COLOR[s] }} />{SOURCE_LABEL[s]}</li>)}
            </ul>
          </div>
          <div className="relative mx-auto h-[560px] w-full max-w-md">
            {support.ok && <div className="absolute inset-0 -z-0 opacity-90"><HeroScene /></div>}
            <div className="relative z-10 flex h-full items-center justify-center"><Phone messages={preview} preview /></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-border bg-surface p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/20 text-primary"><s.icon size={18} /></span>
              <p className="mt-3 text-xs font-semibold text-muted">Step {i + 1}</p>
              <p className="mt-0.5 font-semibold">{s.title}</p>
              <p className="mt-1.5 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-12 max-w-2xl text-center text-xl font-medium sm:text-2xl">Most agencies send screenshots of likes. We send you enquiries, reply times and closed deals.</p>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-4 pb-20">
        <h2 className="text-2xl font-semibold">Pricing</h2>
        <p className="mt-1 text-sm text-muted">Setup ek baar, monthly report har mahine. Every Care plan client gets the monthly report on the 1st.</p>
        <div className="mt-6"><TierPricing /></div>
        <h3 className="mt-10 text-lg font-semibold">Care plans</h3>
        <div className="mt-4"><Pricing /></div>
      </section>
    </div>
  );
}
