"use client";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useDemo } from "@/store/demo";
import { OWNER_CLIENT_SLUG, clientBySlug } from "@/data/clients";

/** Per-client isolation: an owner may only see their own client's data. */
export function ClientGuard({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { role, hydrated } = useDemo();
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy />;
  if (!clientBySlug(slug)) return <Notice title="Client not found" body="That business does not exist in this demo." />;
  if (role === "owner" && slug !== OWNER_CLIENT_SLUG) {
    return (
      <Notice
        code="403"
        title="You can only see your own business data."
        body="Row-level security limits every query to your client_id."
      />
    );
  }
  return <>{children}</>;
}

function Notice({ code, title, body }: { code?: string; title: string; body: string }) {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 text-center">
      <div>
        <ShieldAlert className="mx-auto mb-4 text-terracotta" size={40} />
        {code && <p className="text-sm font-semibold tracking-widest text-muted">{code}</p>}
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <Link href={`/c/${OWNER_CLIENT_SLUG}/dashboard?month=2026-10`} className="mt-5 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-white">
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}
