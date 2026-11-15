"use client";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useDemo } from "@/store/demo";

/** Admin screens are Neovia-only. An owner sees a clean 403. */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { role, hydrated } = useDemo();
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy />;
  if (role !== "admin") {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 text-center">
        <div>
          <ShieldAlert className="mx-auto mb-4 text-terracotta" size={40} />
          <p className="text-sm font-semibold tracking-widest text-muted">403</p>
          <h1 className="mt-1 text-xl font-semibold">You can only see your own business data.</h1>
          <p className="mt-2 text-sm text-muted">The Neovia admin area is not available to client accounts.</p>
          <Link href="/c/urban-nest/dashboard?month=2026-10" className="mt-5 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-white">Back to my dashboard</Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
