"use client";
import { useEffect, useRef, useState } from "react";

/** Mounts the chart only when it scrolls near the viewport (keeps first load light); reserves its height so nothing shifts. */
export function InView({ height, children }: { height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "150px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return <div ref={ref} style={{ minHeight: height }}>{seen ? children : null}</div>;
}

