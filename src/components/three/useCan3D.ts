"use client";
import { useSyncExternalStore } from "react";

export type Support = { ok: true } | { ok: false; reason: "reduced-motion" | "no-webgl" | "low-end" | "server" };
let cached: Support | null = null;

function detect(): Support {
  if (cached) return cached;
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return (cached = { ok: false, reason: "reduced-motion" });
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return (cached = { ok: false, reason: "no-webgl" });
  } catch { return (cached = { ok: false, reason: "no-webgl" }); }
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) || (nav.deviceMemory && nav.deviceMemory <= 2)) return (cached = { ok: false, reason: "low-end" });
  return (cached = { ok: true });
}
const SERVER: Support = { ok: false, reason: "server" };

/** 3D only when motion is allowed, WebGL exists and the device is not low-end. Otherwise use the 2D SVG pipeline. */
export function useSupport(): Support {
  return useSyncExternalStore(() => () => {}, detect, () => SERVER);
}
