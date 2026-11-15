import { Suspense } from "react";
import { ReportReview } from "@/components/admin/ReportReview";

export const instant = false;

export function generateStaticParams() {
  return ["LL-UN-2026-10", "LL-UN-2026-09", "LL-UN-2026-08", "LL-BS-2026-10", "LL-AC-2026-10", "LL-FF-2026-10", "LL-SR-2026-10"].map((id) => ({ id }));
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportReview id={id} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <Inner params={params} />
    </Suspense>
  );
}
