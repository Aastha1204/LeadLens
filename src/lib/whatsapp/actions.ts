import { toast } from "sonner";
import { buildMetricsJson } from "@/lib/metrics";
import { currentDataset } from "@/store/data";
import { useDemo, type ChatMsg, type Lang } from "@/store/demo";
import { URBAN_NEST } from "@/data/seed";
import { HELP_TEXT, parseMessage } from "./parser";
import { computeOutcome, type OutcomeCmd, type OutcomeResult } from "./outcome";
import { summaryText } from "./summary";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date(useDemo.getState().demoClock);
const store = () => useDemo.getState();

function ping() {
  if (!store().soundOn || typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.2);
      o.start(ctx.currentTime + i * 0.12); o.stop(ctx.currentTime + i * 0.12 + 0.22);
    });
  } catch { /* audio is optional */ }
}

export function pushBot(m: Omit<ChatMsg, "id" | "from" | "at" | "kind"> & { kind?: ChatMsg["kind"] }) {
  store().pushChat({ id: uid(), from: "bot", kind: "text", at: store().demoClock, ...m });
  ping();
}

/** Bot message with a typing indicator first. */
export async function botSay(text: string, extra: Partial<ChatMsg> = {}, typingMs = 800) {
  store().setTyping(true);
  await sleep(typingMs);
  store().setTyping(false);
  pushBot({ text, ...extra });
}

/** The single handler behind WhatsApp replies and the outcome form. */
export function applyOutcomeCommand(cmd: OutcomeCmd, clientId = URBAN_NEST): OutcomeResult {
  const ds = currentDataset();
  const r = computeOutcome(ds, clientId, cmd, now());
  if (!r.ok) return r;
  const s = store();
  s.patchLead(r.leadId, r.patch);
  const report = ds.monthlyReports.find((x) => x.client_id === clientId && x.month === r.month);
  if (report) s.markReportChanged(report.id);
  toast.success(`Lead #${r.leadNumber} marked ${cmd.kind.toUpperCase()} · dashboard and report updated`);
  return r;
}

export async function sendUserText(text: string) {
  const t = text.trim();
  if (!t) return;
  store().pushChat({ id: uid(), from: "user", kind: "text", text: t, at: store().demoClock });
  const parsed = parseMessage(t);
  if (!parsed.ok) return botSay(parsed.error);
  if (parsed.cmd.kind === "help") return botSay(HELP_TEXT);
  const result = applyOutcomeCommand(parsed.cmd);
  return botSay(result.message, {}, 900);
}

const SHORT_MONTH = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

/** The monthly delivery: PDF bubble then the summary text with the report link. */
export async function deliverMonthlyReport(month = "2026-10", clientId = URBAN_NEST) {
  const s = store();
  s.togglePhone(true);
  const m = buildMetricsJson(currentDataset(), clientId, month, now());
  await botSay("", { kind: "doc", doc: { name: `LeadLens_UrbanNest_${SHORT_MONTH(month)}${month.slice(0, 4)}.pdf`, pages: 2 } }, 1200);
  toast("New WhatsApp message from Neovia LeadLens");
  await botSay(summaryText(m, store().lang), { href: `/c/urban-nest/report/${month}` }, 1400);
}

export function changeLang(lang: Lang) {
  const s = store();
  s.setLang(lang);
  const last = [...s.chat].reverse().find((c) => c.href);
  if (!last?.href) return;
  const month = last.href.split("/").pop()!;
  const m = buildMetricsJson(currentDataset(), URBAN_NEST, month, now());
  pushBot({ text: summaryText(m, lang), href: last.href });
}
