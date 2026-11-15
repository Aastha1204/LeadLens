"use client";
import { motion } from "framer-motion";
import type { SceneData } from "@/lib/run/sceneData";
import type { RunStatus } from "@/lib/run/controller";

const FY = [60, 120, 180, 240];
/** Animated 2D SVG version of the same pipeline (reduced motion, no WebGL, low-end devices). */
export default function Fallback2D({ data, step, status }: { data: SceneData; step: number; status: RunStatus }) {
  const top = data.funnel[0] || 1;
  const blocked = status === "blocked";
  const srcY = (i: number) => 50 + i * 55;
  return (
    <svg viewBox="0 0 860 330" className="h-full w-full" role="img" aria-label="Pipeline: sources, lead table, funnel, report, phone">
      <rect width="860" height="330" fill="#070914" />
      {data.sources.map((s, i) => (
        <g key={s.key}>
          <circle cx="60" cy={srcY(i)} r="13" fill={s.color} opacity={step >= 0 ? 1 : 0.5} />
          <text x="82" y={srcY(i) + 4} fontSize="11" fill="#cbd0f5">{s.label} · {s.raw}</text>
          {step === 0 && [0, 1, 2].map((d) => (
            <motion.circle key={d} r="4" fill={s.color} initial={{ cx: 60, cy: srcY(i), opacity: 0 }}
              animate={{ cx: [60, 300], cy: [srcY(i), 150], opacity: [0, 1, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay: d * 0.5 + i * 0.12 }} />
          ))}
        </g>
      ))}
      <rect x="290" y="95" width="120" height="110" rx="10" fill="#3b3fd8" opacity="0.18" stroke="#9aa6ff" />
      <text x="350" y="86" textAnchor="middle" fontSize="11" fill="#cbd0f5">Lead table · {data.particles.length} → {data.unique}</text>
      {step === 1 && Array.from({ length: Math.min(6, data.merges) }, (_, i) => (
        <motion.circle key={i} cx={320 + (i % 3) * 30} cy={125 + Math.floor(i / 3) * 40} fill="none" stroke="#fff" initial={{ r: 2, opacity: 1 }} animate={{ r: 18, opacity: 0 }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
      ))}
      {data.funnel.map((c, i) => {
        const w = 40 + 170 * Math.sqrt(c / top);
        const active = step >= 2;
        const ok = step > 4;
        return (
          <g key={i}>
            <motion.rect x={560 - w / 2} y={FY[i] - 10} width={w} height="18" rx="9" initial={false}
              animate={{ fill: blocked && step >= 4 ? "#ef4444" : ok ? "#22c55e" : i % 2 ? "#14c8b4" : "#5b5fe0", opacity: active ? 1 : 0.25 }} />
            <text x={560 + w / 2 + 10} y={FY[i] + 4} fontSize="11" fill="#cbd0f5" opacity={active ? 1 : 0}>{["Enquiries", "Contacted", "Meeting / visit", "Won"][i]} <tspan fontWeight="700" fill="#fff">{c}</tspan></text>
          </g>
        );
      })}
      {step === 2 && Array.from({ length: 8 }, (_, i) => (
        <motion.circle key={i} cx={560 + ((i % 4) - 1.5) * 18} r="3.5" fill="#cbd0f5" initial={{ cy: 40, opacity: 0 }} animate={{ cy: [40, 250], opacity: [0, 1, 0] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.22 }} />
      ))}
      <motion.g initial={false} animate={{ opacity: step >= 5 && step <= 7 ? 1 : 0, x: step >= 7 ? 190 : 0, y: step >= 7 ? -60 : 0, scale: step >= 7 ? 0.6 : 1 }} transition={{ duration: 1.2 }}>
        <rect x="520" y="262" width="52" height="64" rx="4" fill="#fff" /><rect x="520" y="262" width="52" height="12" rx="4" fill="#3b3fd8" />
        {[282, 292, 302, 312].map((y) => <rect key={y} x="528" y={y} width="36" height="4" rx="2" fill="#c9ccd8" />)}
      </motion.g>
      <rect x="790" y="110" width="44" height="86" rx="9" fill="#111426" stroke="#3b3fd8" strokeWidth="2" />
      <motion.rect x="796" y="124" width="32" height="14" rx="3" fill="#25d366" initial={false} animate={{ opacity: status === "done" || step >= 7 ? 1 : 0.15 }} />
    </svg>
  );
}
