"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { TOUR } from "@/lib/tour";
import { useDemo } from "@/store/demo";

interface Box { x: number; y: number; w: number; h: number }
const pathOf = (r: string) => r.split("#")[0].split("?")[0] || "/";

/** Spotlight + caption following the 3-minute demo. Keys: → next, ← back, Esc exit. */
export function TourOverlay() {
  const step = useDemo((s) => s.tourStep);
  const setStep = useDemo((s) => s.setTourStep);
  const hydrated = useDemo((s) => s.hydrated);
  const pathname = usePathname();
  const router = useRouter();
  const [box, setBox] = useState<Box | null>(null);
  const cur = step === null ? null : TOUR[step];

  const go = useCallback((n: number) => { if (n < 0) return; if (n >= TOUR.length) setStep(null); else setStep(n); }, [setStep]);

  // navigate to the step's page and run its setup
  useEffect(() => {
    if (!hydrated || !cur) return;
    if (pathname !== pathOf(cur.route)) router.push(cur.route);
    cur.onEnter?.();
  }, [hydrated, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // find and track the target
  useEffect(() => {
    if (!cur || pathname !== pathOf(cur.route)) return;
    let scrolled = false;
    const measure = () => {
      const el = document.querySelector(cur.target) as HTMLElement | null;
      if (!el) { setBox(null); return; }
      if (!scrolled) { el.scrollIntoView({ block: "center", behavior: "smooth" }); scrolled = true; }
      const r = el.getBoundingClientRect();
      setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    measure();
    const t = setInterval(measure, 250);
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { clearInterval(t); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [cur, pathname]);

  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") go((step ?? 0) + 1);
      else if (e.key === "ArrowLeft") go((step ?? 0) - 1);
      else if (e.key === "Escape") setStep(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, step, go, setStep]);

  if (!hydrated || !cur || step === null) return null;
  const pad = 8;
  const below = box ? box.y + box.h / 2 < window.innerHeight * 0.55 : false;
  return (
    <div data-chrome className="no-print pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {box ? (
        <div className="absolute rounded-2xl border-2 border-accent transition-all duration-300"
          style={{ left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2, boxShadow: "0 0 0 9999px rgba(5,7,20,0.62)" }} />
      ) : <div className="absolute inset-0 bg-[rgba(5,7,20,0.45)]" />}
      <div className={`pointer-events-auto absolute left-1/2 w-[min(520px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-border bg-surface p-4 text-foreground shadow-2xl ${below ? "bottom-4" : "top-16"}`}>
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-semibold text-accent">Step {step + 1} of {TOUR.length}</span>
          <button aria-label="Exit tour" onClick={() => setStep(null)} className="hover:text-foreground"><X size={15} /></button>
        </div>
        <p className="mt-1.5 text-[15px] font-medium leading-snug">{cur.caption}</p>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => go(step - 1)} disabled={step === 0} className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-40"><ArrowLeft size={13} /> Back</button>
          <div className="flex gap-1">{TOUR.map((_, i) => <span key={i} className={`size-1.5 rounded-full ${i === step ? "bg-accent" : "bg-border"}`} />)}</div>
          <button onClick={() => go(step + 1)} className="flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white">{step === TOUR.length - 1 ? "Finish" : "Next"} <ArrowRight size={13} /></button>
        </div>
      </div>
    </div>
  );
}
