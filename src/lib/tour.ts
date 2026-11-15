import { deliverMonthlyReport } from "@/lib/whatsapp/actions";
import { useDemo } from "@/store/demo";

export interface TourStep { route: string; target: string; caption: string; onEnter?: () => void }

const ensureDelivered = () => { if (useDemo.getState().chat.length === 0) void deliverMonthlyReport(); };

/** The 3-minute demo, one short sentence per step so the presenter can read it aloud. */
export const TOUR: TourStep[] = [
  { route: "/run", target: "[data-tour=run-button]", caption: "Press Run: leads from five sources flow in, duplicates merge, every figure is checked, and the report lands on the owner's phone." },
  { route: "/c/urban-nest/report/2026-10", target: ".report-page-1", caption: "Tap the link in WhatsApp and the one-page report opens: enquiries by source, speed to lead and the funnel.", onEnter: ensureDelivered },
  { route: "/c/urban-nest/report/2026-10", target: "[data-tour=recs]", caption: "Three recommendations, each backed by figures from the owner's own data." },
  { route: "/c/urban-nest/dashboard?month=2026-10", target: "[data-tour=dock]", caption: "The owner replies with a deal, like WON 186 120000, and the dashboard, report and funnel update live.", onEnter: () => { ensureDelivered(); useDemo.getState().togglePhone(true); } },
  { route: "/c/urban-nest/dashboard?month=2026-10", target: "[data-tour=revenue-card]", caption: "Click any number to see exactly how it was computed: the SQL and the leads behind it." },
  { route: "/#pricing", target: "#pricing", caption: "Every Care plan client gets this on the 1st, so you always know what your money is doing." },
];
