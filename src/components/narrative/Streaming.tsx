"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Part } from "@/lib/narrative/template";

/** Streams text in (typewriter) with figures highlighted. Works for template and LLM output. */
export function StreamParts({ parts, speed = 28, onDone, className }: { parts: Part[]; speed?: number; onDone?: () => void; className?: string }) {
  const reduce = useReducedMotion();
  const total = parts.reduce((a, p) => a + p.text.length, 0);
  const [n, setN] = useState(0);
  const shown = reduce ? total : n;
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setN((x) => (x >= total ? x : x + 2)), 1000 / speed);
    return () => clearInterval(t);
  }, [total, speed, reduce]);
  useEffect(() => { if (shown >= total) onDone?.(); }, [shown, total, onDone]);
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((a, p) => a + p.text.length, 0));
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const t = p.text.slice(0, Math.max(0, shown - starts[i]));
        if (!t) return null;
        return "metric" in p ? <mark key={i} className="rounded bg-amber-200/70 px-0.5 font-semibold text-inherit">{t}</mark> : <span key={i}>{t}</span>;
      })}
      {shown < total && <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle" />}
    </span>
  );
}
