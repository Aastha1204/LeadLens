import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function Page({ params }: { params: Promise<{ client: string }> }) {
  const { client } = await params;
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <DashboardView slug={client} />
    </Suspense>
  );
}

// Dev-only instant-navigation insight; this screen renders client-side from the local store.
export const instant = false;
