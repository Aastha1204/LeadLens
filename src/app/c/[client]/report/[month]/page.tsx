import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/ReportView";

const MONTHS = ["2026-08", "2026-09", "2026-10", "2026-11"];
export function generateStaticParams() {
  return MONTHS.map((month) => ({ month }));
}

async function Inner({ params }: { params: Promise<{ client: string; month: string }> }) {
  const { client, month } = await params;
  if (!MONTHS.includes(month)) notFound();
  return <ReportView slug={client} month={month} />;
}

export default function Page({ params }: { params: Promise<{ client: string; month: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <Inner params={params} />
    </Suspense>
  );
}

// Dev-only instant-navigation insight; this screen renders client-side from the local store.
export const instant = false;
