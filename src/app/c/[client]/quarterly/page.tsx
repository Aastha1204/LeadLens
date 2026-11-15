import { Suspense } from "react";
import { QuarterlyDeck } from "@/components/dashboard/QuarterlyDeck";

export const instant = false;

async function Inner({ params }: { params: Promise<{ client: string }> }) {
  const { client } = await params;
  return <QuarterlyDeck slug={client} />;
}

export default function Page({ params }: { params: Promise<{ client: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <Inner params={params} />
    </Suspense>
  );
}
