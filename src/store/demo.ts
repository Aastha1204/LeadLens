"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Lead, ReportStatus } from "@/lib/types";
import type { NarrativeData } from "@/lib/narrative/guard";

export type Role = "admin" | "owner";
export type Theme = "light" | "dark";

/** Demo clock default: 1 Nov 2026, 9:00 AM IST = 03:30 UTC */
export const DEMO_CLOCK_START = "2026-11-01T03:30:00.000Z";

export type Lang = "en" | "hi" | "mr";
export interface ChatMsg {
  id: string;
  from: "bot" | "user";
  kind: "text" | "doc";
  text: string;
  at: string; // ISO (demo clock)
  doc?: { name: string; pages: number };
  href?: string; // replaces "[link]" in text
}

export interface ReportOverride {
  status?: ReportStatus;
  sentAt?: string;
  generatedAt?: string;
  narrative?: NarrativeData; // edited, LLM-written or injected
  narrativeSource?: "llm" | "template";
  edited?: boolean;
}

export interface TraceTarget { clientId: string; month: string; traceId: string }

interface DemoState {
  // meta
  hydrated: boolean;
  role: Role;
  theme: Theme;
  demoClock: string; // ISO instant
  phoneOpen: boolean;
  panelOpen: boolean;
  tourStep: number | null;
  reviewRequiredBy: Record<string, boolean>;
  connectorOverrides: Record<string, "healthy" | "warning" | "failed">;
  reports: Record<string, ReportOverride>;
  /** Owner edits layered over the deterministic seed (so Reset restores it exactly). */
  leadPatches: Record<string, Partial<Lead>>;
  extraLeads: Lead[];
  remindedLeads: string[];
  traceTarget: TraceTarget | null;
  chat: ChatMsg[];
  botTyping: boolean;
  unread: number;
  lang: Lang;
  soundOn: boolean;
  /** Reports whose underlying data changed after generation (shown in admin). */
  changedReports: string[];
  /** Real-time start (ms) of live-lead response timers, by lead id. */
  liveTimers: Record<string, number>;
  alertSentFor: string | null;

  setHydrated: (v: boolean) => void;
  setRole: (r: Role) => void;
  setTheme: (t: Theme) => void;
  setDemoClock: (iso: string) => void;
  togglePhone: (v?: boolean) => void;
  togglePanel: (v?: boolean) => void;
  setTourStep: (n: number | null) => void;
  setReviewRequired: (clientId: string, v: boolean) => void;
  setConnectorStatus: (id: string, status: "healthy" | "warning" | "failed" | null) => void;
  patchReport: (id: string, patch: ReportOverride | null) => void;
  patchLead: (id: string, patch: Partial<Lead>) => void;
  addLead: (l: Lead) => void;
  markReminded: (id: string) => void;
  setTraceTarget: (t: TraceTarget | null) => void;
  pushChat: (m: ChatMsg) => void;
  setTyping: (v: boolean) => void;
  setLang: (l: Lang) => void;
  setSound: (v: boolean) => void;
  startLiveTimer: (id: string) => void;
  setAlertSent: (m: string | null) => void;
  markReportChanged: (id: string) => void;
  clearReportChanged: (id: string) => void;
  reset: () => void;
}

const initial = {
  role: "admin" as Role,
  theme: "light" as Theme,
  demoClock: DEMO_CLOCK_START,
  phoneOpen: false,
  panelOpen: false,
  tourStep: null as number | null,
  reviewRequiredBy: {} as Record<string, boolean>,
  connectorOverrides: {} as Record<string, "healthy" | "warning" | "failed">,
  reports: {} as Record<string, ReportOverride>,
  leadPatches: {} as Record<string, Partial<Lead>>,
  extraLeads: [] as Lead[],
  remindedLeads: [] as string[],
  traceTarget: null as TraceTarget | null,
  chat: [] as ChatMsg[],
  botTyping: false,
  unread: 0,
  lang: "en" as Lang,
  soundOn: false,
  changedReports: [] as string[],
  liveTimers: {} as Record<string, number>,
  alertSentFor: null as string | null,
};

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      hydrated: false,
      ...initial,
      setHydrated: (hydrated) => set({ hydrated }),
      setRole: (role) => set({ role }),
      setTheme: (theme) => set({ theme }),
      setDemoClock: (demoClock) => set({ demoClock }),
      togglePhone: (v) => set((s) => { const phoneOpen = v ?? !s.phoneOpen; return phoneOpen ? { phoneOpen, unread: 0 } : { phoneOpen }; }),
      togglePanel: (v) => set((s) => ({ panelOpen: v ?? !s.panelOpen })),
      setTourStep: (tourStep) => set({ tourStep }),
      setReviewRequired: (clientId, v) => set((st) => ({ reviewRequiredBy: { ...st.reviewRequiredBy, [clientId]: v } })),
      setConnectorStatus: (id, status) => set((st) => {
        const next = { ...st.connectorOverrides };
        if (status === null) delete next[id]; else next[id] = status;
        return { connectorOverrides: next };
      }),
      patchReport: (id, patch) => set((st) => {
        const next = { ...st.reports };
        if (patch === null) delete next[id]; else next[id] = { ...next[id], ...patch };
        return { reports: next };
      }),
      patchLead: (id, patch) => set((st) => ({ leadPatches: { ...st.leadPatches, [id]: { ...st.leadPatches[id], ...patch } } })),
      addLead: (l) => set((st) => ({ extraLeads: [...st.extraLeads, l] })),
      markReminded: (id) => set((st) => ({ remindedLeads: st.remindedLeads.includes(id) ? st.remindedLeads : [...st.remindedLeads, id] })),
      setTraceTarget: (traceTarget) => set({ traceTarget }),
      pushChat: (m) => set((st) => ({ chat: [...st.chat, m], unread: m.from === "bot" && !st.phoneOpen ? st.unread + 1 : st.unread })),
      setTyping: (botTyping) => set({ botTyping }),
      setLang: (lang) => set({ lang }),
      setSound: (soundOn) => set({ soundOn }),
      startLiveTimer: (id) => set((st) => ({ liveTimers: { ...st.liveTimers, [id]: Date.now() } })),
      setAlertSent: (alertSentFor) => set({ alertSentFor }),
      markReportChanged: (id) => set((st) => ({ changedReports: st.changedReports.includes(id) ? st.changedReports : [...st.changedReports, id] })),
      clearReportChanged: (id) => set((st) => ({ changedReports: st.changedReports.filter((x) => x !== id) })),
      reset: () => set({ ...initial, leadPatches: {}, extraLeads: [], remindedLeads: [], chat: [], changedReports: [], reviewRequiredBy: {}, connectorOverrides: {}, reports: {}, liveTimers: {}, alertSentFor: null }),
    }),
    {
      name: "leadlens-demo-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // rehydrated in <Providers/> to avoid SSR mismatch
      partialize: (s) =>
        Object.fromEntries(Object.entries(s).filter(([k, v]) => k !== "hydrated" && k !== "traceTarget" && k !== "botTyping" && typeof v !== "function")),
    }
  )
);

export const selectNow = (s: DemoState) => new Date(s.demoClock);
