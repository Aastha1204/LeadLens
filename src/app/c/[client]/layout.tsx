import { Suspense } from "react";
import { ClientGuard } from "@/components/shell/ClientGuard";
import { CLIENTS } from "@/data/clients";

// Dev-only instant-navigation insight; these screens are fully client-rendered from the local store.
export const instant = false;

export function generateStaticParams() {
  return CLIENTS.map((c) => ({ client: c.slug }));
}

async function Guard({ children, params }: { children: React.ReactNode; params: Promise<{ client: string }> }) {
  const { client } = await params;
  return <ClientGuard slug={client}>{children}</ClientGuard>;
}

export default function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ client: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <Guard params={params}>{children}</Guard>
    </Suspense>
  );
}
