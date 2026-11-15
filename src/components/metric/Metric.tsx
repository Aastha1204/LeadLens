"use client";
import { memo, useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { inr, inrShort, minutesLabel } from "@/lib/format";
import type { MetricFigure } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { useDemo } from "@/store/demo";
import { useMetricScope } from "./MetricProvider";

function format(fig: MetricFigure, v: number, short?: boolean): string {
  switch (fig.unit) {
    case "inr": return short ? inrShort(v) : inr(v);
    case "minutes": return minutesLabel(v);
    case "count": return Math.round(v).toLocaleString("en-IN");
    default: return fig.display;
  }
}

/** Update the single text node in place so React keeps owning it. */
const set = (el: HTMLElement, text: string) => { if (el.firstChild) el.firstChild.nodeValue = text; };

/**
 * Every number in the UI renders through <Metric>. Clicking opens the trace drawer
 * (definition, SQL view and the contributing rows). Count-up writes straight to the DOM,
 * so animating never re-renders React.
 */
export const Metric = memo(function Metric({ id, short, animated, className, prefix, suffix }: {
  id: string; short?: boolean; animated?: boolean; className?: string; prefix?: string; suffix?: string;
}) {
  const { metrics, clientId, month } = useMetricScope();
  const fig = metrics.figures[id];
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const target = fig?.value ?? 0;
  const countable = !!animated && !!fig && fig.unit !== "percent";

  useEffect(() => {
    const el = ref.current;
    if (!el || !countable || !fig) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { shown.current = target; return; }
    const c = animate(shown.current, target, {
      duration: 1.1, ease: "easeOut",
      onUpdate: (x) => { shown.current = x; set(el, `${prefix ?? ""}${format(fig, x, short)}${suffix ?? ""}`); },
      onComplete: () => { shown.current = target; set(el, `${prefix ?? ""}${format(fig, target, short)}${suffix ?? ""}`); },
    });
    return () => c.stop();
  }, [target, countable, fig, short, prefix, suffix]);

  if (!fig) return <span className={cn("text-muted", className)} aria-label="no data">—</span>;
  const text = countable ? format(fig, target, short) : short && fig.unit === "inr" ? inrShort(fig.value) : fig.display;
  return (
    <button
      type="button"
      data-metric={id}
      title="Click to see how this was computed"
      onClick={() => useDemo.getState().setTraceTarget({ clientId, month, traceId: id })}
      className={cn(
        "cursor-pointer tabular-nums underline decoration-dotted decoration-muted/40 underline-offset-4 transition-colors hover:decoration-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
    >
      <span ref={ref}>{`${prefix ?? ""}${text}${suffix ?? ""}`}</span>
    </button>
  );
});
