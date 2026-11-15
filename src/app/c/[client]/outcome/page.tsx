import { Suspense } from "react";
import { OutcomeForm } from "@/components/outcome/OutcomeForm";

export const instant = false;

async function Inner({ params }: { params: Promise<{ client: string }> }) {
  const { client } = await params;
  return <OutcomeForm slug={client} />;
}

export default function Page({ params }: { params: Promise<{ client: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <Inner params={params} />
    </Suspense>
  );
}
