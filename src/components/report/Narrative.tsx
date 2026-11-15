"use client";
import { Metric } from "@/components/metric/Metric";
import type { Part } from "@/lib/narrative/template";

/** Renders narrative text with every figure as a clickable <Metric>. */
export function NarrativeText({ parts }: { parts: Part[] }) {
  return (
    <>
      {parts.map((p, i) => "metric" in p ? <Metric key={i} id={p.metric} className="font-semibold text-foreground" /> : <span key={i}>{p.text}</span>)}
    </>
  );
}
