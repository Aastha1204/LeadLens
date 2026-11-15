"use client";
import { Suspense, useEffect } from "react";
import { Toaster } from "sonner";
import { useDemo } from "@/store/demo";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

// Loaded after hydration so they stay off the critical path.
const TraceDrawer = dynamic(() => import("@/components/metric/TraceDrawer").then((m) => m.TraceDrawer), { ssr: false });
const PhoneDock = dynamic(() => import("@/components/phone/PhoneDock").then((m) => m.PhoneDock), { ssr: false });
const DemoPanel = dynamic(() => import("@/components/demo/DemoPanel").then((m) => m.DemoPanel), { ssr: false });
const TourOverlay = dynamic(() => import("@/components/tour/TourOverlay").then((m) => m.TourOverlay), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useDemo((s) => s.theme);
  const router = useRouter();

  useEffect(() => {
    Promise.resolve(useDemo.persist.rehydrate()).finally(() => useDemo.getState().setHydrated(true));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Inside the in-phone report viewer, hide app chrome.
  useEffect(() => {
    if (window.self !== window.top) document.documentElement.classList.add("embedded");
  }, []);

  // "D" toggles the demo panel (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "d") useDemo.getState().togglePanel();
      if (k === "p") useDemo.getState().togglePhone();
      if (k === "f") { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }
      if (k === "r") { void import("@/lib/demo-actions").then((m) => { m.resetDemo(); router.push("/"); }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      {children}
      <TraceDrawer />
      <Suspense fallback={null}>
        <PhoneDock />
        <DemoPanel />
        <TourOverlay />
      </Suspense>
      <Toaster position="top-center" richColors />
    </>
  );
}
