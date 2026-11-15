"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Box, FastForward, Play, RotateCcw, Square, Wrench, Zap } from "lucide-react";
import { Phone } from "@/components/phone/Phone";
import { Pricing } from "@/components/landing/Pricing";
import { StreamParts } from "@/components/narrative/Streaming";
import Fallback2D from "@/components/three/Fallback2D";
import { useSupport } from "@/components/three/useCan3D";
import { RunController, STEPS, type Tone } from "@/lib/run/controller";
import { buildSceneData, type SceneData } from "@/lib/run/sceneData";
import { setConnector } from "@/lib/admin-actions";
import { cn } from "@/lib/utils";
import { useAdminData } from "@/store/admin";
import { useDemo } from "@/store/demo";

const PipelineScene = dynamic(() => import("@/components/three/PipelineScene"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading 3D scene…</div> });
const TONE: Record<Tone, string> = { info: "text-slate-300", ok: "text-emerald-400", warn: "text-amber-300", error: "text-red-400", step: "text-sky-300 font-semibold" };
const UN_META = "cn_c1_meta_lead_ads";

export function RunView() {
  const controller = useMemo(() => new RunController("c1", "2026-10"), []);
  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const support = useSupport();
  const [mode, setMode] = useState<"auto" | "2d" | "3d">("auto");
  const use3D = mode === "3d" || (mode === "auto" && support.ok);
  const { reports, connectors, ds } = useAdminData();
  const reviewOn = useDemo((s) => s.reviewRequiredBy["c1"] ?? true);
  const setReview = useDemo((s) => s.setReviewRequired);
  const hydrated = useDemo((s) => s.hydrated);
  const logEnd = useRef<HTMLDivElement>(null);
  const metaFailing = connectors.find((c) => c.id === UN_META)?.status === "failed";
  const report = reports.find((r) => r.report.id === snap.reportId);

  useEffect(() => { logEnd.current?.scrollIntoView({ block: "nearest" }); }, [snap.log.length]);
  useEffect(() => () => controller.cancel(), [controller]);

  const idleScene: SceneData = useMemo(() => buildSceneData(ds, "c1", "2026-10", [86, 81, 31, 12]), [ds]);
  const scene = snap.scene ?? idleScene;
  const running = snap.status === "running" || snap.status === "waiting";
  const progress = snap.status === "done" ? 100 : snap.step < 0 ? 0 : Math.round(((snap.step + (snap.status === "waiting" ? 0.5 : 0.6)) / STEPS.length) * 100);

  return (
    <div className="force-dark min-h-[calc(100vh-3.5rem)] text-foreground">
      <div className="mx-auto grid max-w-[1500px] gap-4 p-3 lg:grid-cols-[360px_minmax(0,1fr)_320px] lg:p-4">
        {/* left: controls + log */}
        <aside className="order-2 flex flex-col gap-3 lg:order-1 lg:h-[calc(100vh-6rem)]">
          <div data-tour="run-button" className="rounded-2xl border border-border bg-surface p-4">
            <h1 className="text-base font-semibold">The 1st of the month</h1>
            <p className="mt-0.5 text-xs text-muted">Urban Nest Interiors · October 2026 report</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!running ? (
                <button onClick={() => void controller.start()} className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink">
                  {snap.status === "idle" ? <><Play size={15} /> Run</> : <><RotateCcw size={15} /> Replay</>}
                </button>
              ) : (
                <>
                  <button onClick={() => controller.skip()} className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm"><FastForward size={14} /> Skip</button>
                  <button onClick={() => controller.cancel()} className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm text-muted"><Square size={13} /> Stop</button>
                </>
              )}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <motion.div className={cn("h-full rounded-full", snap.status === "blocked" ? "bg-red-500" : "bg-accent")} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
            </div>
            <ol className="mt-3 grid grid-cols-4 gap-1 text-[10px] text-muted">
              {STEPS.map((s, i) => <li key={s.id} className={cn("truncate rounded px-1 py-0.5", i === snap.step && "bg-primary/30 text-white", i < snap.step && "text-emerald-400")}>{i + 1}. {s.title}</li>)}
            </ol>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-3 text-xs">
            <p className="mb-2 font-medium text-muted">Demo controls</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setConnector(UN_META, metaFailing ? "healthy" : "failed")} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5", metaFailing ? "border-red-500 text-red-400" : "border-border")}>
                <Wrench size={12} /> {metaFailing ? "Fix Meta Lead Ads" : "Break Meta Lead Ads"}
              </button>
              <button role="switch" aria-checked={reviewOn} onClick={() => hydrated && setReview("c1", !reviewOn)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5", reviewOn ? "border-accent text-accent" : "border-border")}>
                <Zap size={12} /> Neovia review {reviewOn ? "on" : "off"}
              </button>
              <button onClick={() => setMode(use3D ? "2d" : "3d")} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5"><Box size={12} /> {use3D ? "2D view" : "3D view"}</button>
            </div>
            {!support.ok && mode === "auto" && <p className="mt-2 text-[11px] text-muted">Showing the 2D pipeline ({support.reason === "reduced-motion" ? "reduced motion" : support.reason === "no-webgl" ? "no WebGL" : "low-end device"}).</p>}
          </div>

          <div className="min-h-40 flex-1 overflow-y-auto rounded-2xl border border-border bg-[#05060f] p-3 font-mono text-[11.5px] leading-relaxed" aria-live="polite" aria-label="Run log">
            {snap.log.length === 0 && <p className="text-muted">Press Run to build the October report.</p>}
            {snap.log.map((l) => <p key={l.id} className={cn(TONE[l.tone], l.tone === "step" && "mt-2 first:mt-0")}>{l.text}</p>)}
            <div ref={logEnd} />
          </div>

          {snap.status === "waiting" && (
            <button onClick={() => controller.approve()} className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-ink shadow-lg">Approve & send</button>
          )}
          {snap.status === "blocked" && (
            <div role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
              <p className="font-medium">Report blocked: {snap.blockedReason}</p>
              <p className="mt-1 text-xs text-red-300/80">Fix the problem, then replay the run.</p>
              {metaFailing && <button onClick={() => setConnector(UN_META, "healthy")} className="mt-2 rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white">Fix Meta Lead Ads</button>}
            </div>
          )}
        </aside>

        {/* centre: scene */}
        <section className="order-1 flex min-h-0 flex-col gap-3 lg:order-2">
          <div className="relative h-[46vh] min-h-[320px] overflow-hidden rounded-2xl border border-border bg-[#070914] lg:h-[calc(100vh-6rem)]">
            {use3D ? <PipelineScene data={scene} clock={controller.clock} /> : <Fallback2D data={scene} step={snap.step} status={snap.status} />}
            <AnimatePresence>
              {snap.commentary && snap.step >= 3 && snap.step <= 6 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-3 bottom-3 max-h-[46%] overflow-y-auto rounded-xl border border-white/10 bg-black/70 p-3 text-xs text-slate-200 backdrop-blur lg:inset-x-6">
                  <p className="mb-1 font-semibold text-accent">Commentary</p>
                  <ol className="space-y-1.5">
                    {snap.commentary.recommendations.map((r, i) => <li key={r.title}><b className="text-white">{i + 1}. {r.title}</b>{" "}<StreamParts parts={r.parts} speed={34} /></li>)}
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
            {report && snap.status === "done" && <Link href={`/c/urban-nest/report/2026-10`} className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink shadow">Open the report</Link>}
          </div>
        </section>

        {/* right: phone */}
        <aside className="order-3 flex justify-center lg:h-[calc(100vh-6rem)] lg:items-center">
          <Phone />
        </aside>
      </div>

      <AnimatePresence>
        {snap.status === "done" && (
          <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-4xl px-4 pb-14 pt-6 text-center">
            <p className="text-xl font-semibold sm:text-2xl">Every Care plan client gets this on the 1st, so you always know what your money is doing.</p>
            <div className="mx-auto mt-6 max-w-xl text-left"><Pricing compact only="Care Growth" /></div>
            <Link href="/#pricing" className="mt-4 inline-block text-sm text-accent underline">See all plans</Link>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
