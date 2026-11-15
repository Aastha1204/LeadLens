import type { ReportStatus } from "@/lib/types";
import type { Checked } from "@/lib/narrative/guard";
import { cn } from "@/lib/utils";

export const STATUS_STYLE: Record<ReportStatus, string> = {
  generated: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  sent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  blocked: "bg-red-500/15 text-red-700 dark:text-red-300",
};
export const STATUS_LABEL: Record<ReportStatus, string> = { generated: "Generated", in_review: "In review", approved: "Approved", sent: "Sent", blocked: "Blocked" };

export function StatusChip({ status }: { status: ReportStatus }) {
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export const DOT: Record<string, string> = { healthy: "bg-emerald-500", warning: "bg-amber-500", failed: "bg-red-500" };
export function Dot({ status, title }: { status: string; title?: string }) {
  return <span title={title} aria-label={title} className={cn("inline-block size-2.5 rounded-full", DOT[status])} />;
}

/** Text with unverified figures marked in red. */
export function Flagged({ text, items }: { text: string; items: Checked[] }) {
  const bad = items.filter((i) => !i.ok);
  if (!bad.length) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let at = 0;
  bad.forEach((b, i) => {
    if (b.start > at) out.push(text.slice(at, b.start));
    out.push(<mark key={i} className="rounded bg-red-500/20 px-0.5 font-semibold text-red-700 underline decoration-red-500 decoration-wavy dark:text-red-300">{b.text}</mark>);
    at = b.end;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}
