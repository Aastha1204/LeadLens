"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Moon, Settings, Smartphone, Sun } from "lucide-react";
import { useDemo, type Role } from "@/store/demo";
import { NeoviaLogo } from "./Logos";
import { cn } from "@/lib/utils";
import { OWNER_CLIENT_SLUG } from "@/data/clients";

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, theme, setTheme, togglePanel, togglePhone, hydrated } = useDemo();
  const dark = pathname === "/" || pathname.startsWith("/run");

  const switchRole = (r: Role) => {
    setRole(r);
    router.push(r === "admin" ? "/admin" : `/c/${OWNER_CLIENT_SLUG}/dashboard?month=2026-10`);
  };


  return (
    <header
      data-chrome
      className={cn(
        "no-print sticky top-0 z-40 border-b border-border backdrop-blur",
        dark ? "force-dark bg-ink/80" : "bg-background/80"
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <NeoviaLogo className="h-7" />
          <span className="hidden text-sm font-semibold text-muted sm:inline">· LeadLens</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 whitespace-nowrap text-sm lg:flex">
          {role === "admin" ? (
            <NavLink href="/admin" active={pathname.startsWith("/admin")}>Admin</NavLink>
          ) : null}
          <NavLink href={`/c/${OWNER_CLIENT_SLUG}/dashboard?month=2026-10`} active={pathname.includes("/dashboard")}>Dashboard</NavLink>
          <NavLink href={`/c/${OWNER_CLIENT_SLUG}/leads`} active={pathname.includes("/leads")}>Leads</NavLink>
          <NavLink href={`/c/${OWNER_CLIENT_SLUG}/report/2026-10`} active={pathname.includes("/report")}>Report</NavLink>
          <NavLink href="/run" active={pathname.startsWith("/run")}>1st-of-month run</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div
            role="group"
            aria-label="Role switcher"
            className="flex shrink-0 rounded-full border border-border bg-surface p-0.5 text-xs font-medium"
          >
            {(["admin", "owner"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => switchRole(r)}
                aria-pressed={hydrated && role === r}
                className={cn(
                  "whitespace-nowrap rounded-full px-2.5 py-1.5 transition-colors sm:px-3",
                  hydrated && role === r ? "bg-primary text-white" : "text-muted hover:text-foreground"
                )}
              >
                <span className="hidden sm:inline">{r === "admin" ? "Neovia admin" : "Urban Nest owner"}</span><span className="sm:hidden">{r === "admin" ? "Admin" : "Owner"}</span>
              </button>
            ))}
          </div>
          <IconBtn label="Toggle phone (P)" onClick={() => togglePhone()}><Smartphone size={16} /></IconBtn>
          <IconBtn label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </IconBtn>
          <IconBtn label="Demo panel (D)" onClick={() => togglePanel()}><Settings size={16} /></IconBtn>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "whitespace-nowrap rounded-md px-3 py-1.5 text-muted transition-colors hover:text-foreground",
        active && "bg-surface-2 text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full border border-border bg-surface text-muted transition-colors hover:text-foreground"
    >
      {children}
    </button>
  );
}
