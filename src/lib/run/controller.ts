import { effectiveConnectors, effectiveReports, reviewRequired, CONNECTOR_LABEL } from "@/lib/admin";
import { buildMetricsJson, type MetricsJson } from "@/lib/metrics";
import { generateNarrative } from "@/lib/narrative/llm";
import { resolveNarrative } from "@/lib/narrative/resolve";
import type { Narrative } from "@/lib/narrative/template";
import { deliverMonthlyReport } from "@/lib/whatsapp/actions";
import { currentDataset } from "@/store/data";
import { useDemo } from "@/store/demo";
import { buildSceneData, type SceneData } from "./sceneData";
import type { ConnectorType } from "@/lib/types";

export const STEPS = [
  { id: "connectors", title: "Sync connectors", ms: 4200 },
  { id: "dedupe", title: "Deduplicate", ms: 2600 },
  { id: "compute", title: "Compute metrics", ms: 3400 },
  { id: "commentary", title: "Write commentary", ms: 4600 },
  { id: "verify", title: "Verify figures", ms: 2000 },
  { id: "render", title: "Render report", ms: 2200 },
  { id: "review", title: "Review", ms: 1000 },
  { id: "deliver", title: "Deliver", ms: 3000 },
] as const;

export type RunStatus = "idle" | "running" | "waiting" | "blocked" | "done";
export type Tone = "info" | "ok" | "warn" | "error" | "step";
export interface LogLine { id: number; step: number; text: string; tone: Tone; t: number }
export interface Snapshot {
  status: RunStatus; step: number; log: LogLine[]; commentary: Narrative | null; blockedReason: string | null;
  scene: SceneData | null; metrics: MetricsJson | null; reportId: string | null; month: string;
}
/** Mutable clock the 3D scene reads every frame (no React re-render). */
export interface SceneClock { step: number; startedAt: number; status: RunStatus; blocked: boolean }

const CONNECTOR_BY_SOURCE: [ConnectorType, string][] = [
  ["website_forms", "website"], ["whatsapp_bot", "whatsapp"], ["meta_lead_ads", "instagram"], ["callcatch", "calls"], ["gbp_manual", "google"],
];

export class RunController {
  readonly clock: SceneClock = { step: -1, startedAt: 0, status: "idle", blocked: false };
  private snap: Snapshot;
  private listeners = new Set<() => void>();
  private token = 0;
  private skipping = false;
  private gate: (() => void) | null = null;
  private lineId = 0;
  private t0 = 0;
  constructor(private clientId = "c1", month = "2026-10") {
    this.snap = { status: "idle", step: -1, log: [], commentary: null, blockedReason: null, scene: null, metrics: null, reportId: null, month };
  }

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => this.listeners.delete(cb); };
  getSnapshot = () => this.snap;
  private set(p: Partial<Snapshot>) { this.snap = { ...this.snap, ...p }; this.listeners.forEach((l) => l()); }
  private emit(step: number, text: string, tone: Tone = "info") {
    const line: LogLine = { id: ++this.lineId, step, text, tone, t: performance.now() - this.t0 };
    this.set({ log: [...this.snap.log, line] });
  }
  private enter(step: number) {
    this.clock.step = step; this.clock.startedAt = this.skipping ? -1e9 : performance.now();
    this.set({ step });
    this.emit(step, `${step + 1}. ${STEPS[step].title}`, "step");
  }
  private sleep(ms: number, token: number) {
    return new Promise<void>((res) => { if (this.skipping || token !== this.token) return res(); setTimeout(res, ms); });
  }
  private live = (token: number) => token === this.token;

  cancel() { this.token++; this.gate?.(); this.gate = null; }
  skip() { this.skipping = true; }
  approve() { this.gate?.(); this.gate = null; }

  async start() {
    const token = ++this.token;
    this.skipping = false; this.gate = null; this.t0 = performance.now(); this.lineId = 0;
    const s = useDemo.getState();
    const ds0 = currentDataset();
    const report = ds0.monthlyReports.find((r) => r.client_id === this.clientId && r.month === this.snap.month);
    const reportId = report?.id ?? null;
    // reset delivery state so the run is repeatable
    useDemo.setState({ chat: [], botTyping: false, unread: 0 });
    if (reportId) { s.patchReport(reportId, { status: undefined, sentAt: undefined }); s.clearReportChanged(reportId); }
    this.clock.blocked = false; this.clock.status = "running";
    this.set({ status: "running", step: -1, log: [], commentary: null, blockedReason: null, scene: null, metrics: null, reportId });
    const month = this.snap.month;
    const now = () => new Date(useDemo.getState().demoClock);
    const adminState = () => { const u = useDemo.getState(); return { reports: u.reports, connectorOverrides: u.connectorOverrides, reviewRequiredBy: u.reviewRequiredBy, changedReports: u.changedReports }; };

    // 1 · connectors
    this.enter(0);
    const ds = currentDataset();
    const conns = effectiveConnectors(ds, adminState()).filter((c) => c.client_id === this.clientId);
    const rawBySource = (src: string) => ds.rawEnquiries.filter((r) => r.client_id === this.clientId && r.source === src && r.received_at.slice(0, 7) === month).length;
    let failing: string[] = [];
    for (const [type, src] of CONNECTOR_BY_SOURCE) {
      await this.sleep(700, token); if (!this.live(token)) return;
      const c = conns.find((x) => x.type === type);
      const secs = (0.4 + ((type.length * 37) % 9) / 10).toFixed(1);
      if (c?.status === "failed") { failing.push(CONNECTOR_LABEL[c.type]); this.emit(0, `✗ ${type} · ${c.message}`, "error"); }
      else this.emit(0, `✓ ${type} · ${rawBySource(src)} raw · ${secs}s${type === "gbp_manual" ? " · manual entry" : ""}`, "ok");
    }
    await this.sleep(500, token); if (!this.live(token)) return;

    // 2 · dedupe
    this.enter(1);
    const metrics = buildMetricsJson(currentDataset(), this.clientId, month, now());
    const f = metrics.figures;
    const funnel: SceneData["funnel"] = [f["enquiries.total"].value, f["contacted.total"].value, f["meetings.total"].value, f["won.total"].value];
    const scene = buildSceneData(currentDataset(), this.clientId, month, funnel);
    this.set({ metrics, scene });
    await this.sleep(900, token); if (!this.live(token)) return;
    this.emit(1, `${f["enquiries.raw"].display} raw enquiries → ${f["enquiries.total"].display} unique (${f["enquiries.duplicates"].display} merged)`, "ok");
    await this.sleep(1200, token); if (!this.live(token)) return;

    // 3 · compute
    this.enter(2);
    const t = metrics.tables;
    const views: [string, number][] = [
      ["v_monthly_headline", 1], ["v_source_breakdown", t.sources.length], ["v_weekly_enquiries", t.weekly.length], ["v_speed_to_lead", 1],
      ["v_funnel", 1], ["v_missed_opportunities", t.missed.length], ["v_cost_per_lead", t.cost.length], ["v_campaigns", t.campaigns.length],
    ];
    for (const [i, [name, rows]] of views.entries()) {
      await this.sleep(330, token); if (!this.live(token)) return;
      this.emit(2, `✓ ${name} · ${rows} ${rows === 1 ? "row" : "rows"} · ${6 + ((i * 7) % 11)}ms`, "ok");
    }
    await this.sleep(500, token); if (!this.live(token)) return;

    // 4 · commentary
    this.enter(3);
    const override = reportId ? useDemo.getState().reports[reportId] : undefined;
    let data = override?.narrative, source: "llm" | "template" = override?.narrativeSource ?? "template";
    if (!data) ({ data, source } = await generateNarrative(metrics));
    if (!this.live(token)) return;
    const resolved = resolveNarrative(metrics, data);
    this.set({ commentary: resolved.narrative });
    this.emit(3, `Narrative source: ${source === "llm" ? "LLM" : "Template (offline)"}${override?.edited ? " · edited" : ""}`, "info");
    await this.sleep(3600, token); if (!this.live(token)) return;

    // 5 · verify
    this.enter(4);
    await this.sleep(700, token); if (!this.live(token)) return;
    const guard = resolved.guard;
    if (guard.ok) this.emit(4, `✓ All ${guard.total} figures verified against metrics`, "ok");
    else for (const u of guard.unverified) this.emit(4, `✗ Unverified figure ${u.text}: no matching metric`, "error");
    await this.sleep(1000, token); if (!this.live(token)) return;

    // 6 · render
    this.enter(5);
    await this.sleep(900, token); if (!this.live(token)) return;
    this.emit(5, `✓ Report ${reportId ?? ""} rendered · 2 pages · light, print-ready`, "ok");
    await this.sleep(1000, token); if (!this.live(token)) return;

    // 7 · review / blocking
    this.enter(6);
    const client = ds.clients.find((c) => c.id === this.clientId)!;
    failing = effectiveConnectors(currentDataset(), adminState()).filter((c) => c.client_id === this.clientId && c.status === "failed").map((c) => CONNECTOR_LABEL[c.type]);
    const reasons = [...failing.map((x) => `${x} is failing`), ...(guard.ok ? [] : ["commentary has unverified figures"])];
    if (reasons.length) {
      const why = reasons.join("; ");
      this.emit(6, `⛔ Auto-send blocked: ${why}`, "error");
      this.clock.blocked = true; this.clock.status = "blocked";
      this.set({ status: "blocked", blockedReason: why });
      return;
    }
    if (reviewRequired(client, adminState())) {
      this.emit(6, "⏸ Waiting for Neovia approval", "warn");
      this.clock.status = "waiting"; this.set({ status: "waiting" });
      await new Promise<void>((res) => { this.gate = res; });
      if (!this.live(token)) return;
      this.skipping = false;
      this.emit(6, "✓ Approved by Neovia", "ok");
      this.clock.status = "running"; this.set({ status: "running" });
    } else {
      this.emit(6, "Review not required for this client · sending automatically", "info");
      await this.sleep(700, token); if (!this.live(token)) return;
    }

    // 8 · deliver
    this.enter(7);
    if (reportId) useDemo.getState().patchReport(reportId, { status: "sent", sentAt: useDemo.getState().demoClock, generatedAt: useDemo.getState().demoClock });
    await deliverMonthlyReport(month, this.clientId);
    if (!this.live(token)) return;
    this.emit(7, "✓ Delivered via WhatsApp: summary and report link", "ok");
    this.clock.status = "done"; this.set({ status: "done" });
  }

  /** Used by tests and the admin view: which report row this run targets. */
  static reportFor(clientId: string, month: string) {
    return effectiveReports(currentDataset(), { reports: {}, connectorOverrides: {}, reviewRequiredBy: {}, changedReports: [] }).find((r) => r.client.id === clientId && r.report.month === month);
  }
}
