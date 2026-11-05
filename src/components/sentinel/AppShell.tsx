import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BarChart3, Brain, FlaskConical, LayoutDashboard, LogOut, Server, Settings, ShieldAlert, Siren, Wrench } from "lucide-react";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

type NavItem = { icon: typeof Server; label: string; to?: "/dashboard" | "/incidents" | "/simulation" | "/settings" };

const nav: NavItem[] = [
  { icon: LayoutDashboard, label: "Command Center", to: "/dashboard" },
  { icon: Siren, label: "Incidents", to: "/incidents" },
  { icon: FlaskConical, label: "Simulation Lab", to: "/simulation" },
  { icon: Server, label: "Infrastructure" },
  { icon: Brain, label: "Investigations" },
  { icon: ShieldAlert, label: "Security" },
  { icon: Wrench, label: "Remediation" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Settings, label: "Settings", to: "/settings" },
];

export function AppShell({ title, banner, actions, children }: { title: string; banner?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {banner}
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r bg-surface/40 p-3 lg:flex">
          <div className="px-2 py-2"><Logo /></div>
          <nav className="mt-4 space-y-0.5">
            {nav.map((n) =>
              n.to ? (
                <Link key={n.label} to={n.to} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "bg-accent !text-foreground" }}>
                  <n.icon className="size-4" />{n.label}
                </Link>
              ) : (
                <div key={n.label} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground/70">
                  <n.icon className="size-4" />{n.label}
                  <span className="ml-auto font-mono text-[10px] opacity-60">soon</span>
                </div>
              ),
            )}
          </nav>
          <div className="mt-auto border-t pt-3 text-xs">
            {session ? (
              <div className="space-y-2 px-2">
                <div className="truncate text-muted-foreground">{session.user.email}</div>
                <button onClick={signOut} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><LogOut className="size-3.5" />Sign out</button>
              </div>
            ) : (
              <Link to="/auth" className="block rounded-md border px-3 py-2 text-center hover:bg-accent">Sign in</Link>
            )}
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="flex h-14 items-center justify-between gap-3 border-b px-4 md:px-6">
            <div className="lg:hidden"><Logo /></div>
            <h1 className="hidden text-sm font-medium lg:block">{title}</h1>
            <div className="flex items-center gap-3">
              {actions}
              <nav className="flex gap-1 lg:hidden">
                {nav.filter((n) => n.to).map((n) => (
                  <Link key={n.label} to={n.to!} aria-label={n.label} className="rounded-md border p-2 text-muted-foreground" activeProps={{ className: "!text-primary border-primary/40" }}><n.icon className="size-4" /></Link>
                ))}
                {session && <button onClick={signOut} aria-label="Sign out" className="rounded-md border p-2 text-muted-foreground"><LogOut className="size-4" /></button>}
              </nav>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Panel({ title, sub, className = "", children }: { title: string; sub?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-lg border bg-surface/40 p-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-sm font-medium">{title}</h2>{sub && <span className="text-xs text-muted-foreground">{sub}</span>}</div>
      {children}
    </section>
  );
}

const sevTone: Record<string, string> = {
  sev1: "text-destructive border-destructive/40 bg-destructive/10",
  sev2: "text-destructive border-destructive/30 bg-destructive/5",
  sev3: "text-warning border-warning/30 bg-warning/10",
  sev4: "text-muted-foreground border-border bg-muted",
};
export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${sevTone[severity] ?? sevTone["sev4"]}`}>{severity}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "resolved" || status === "closed" || status === "verified" || status === "healthy" || status === "approved"
      ? "text-success border-success/30 bg-success/10"
      : status === "awaiting_approval" || status === "pending_approval" || status === "warning"
        ? "text-warning border-warning/30 bg-warning/10"
        : status === "rejected" || status === "failed" || status === "degraded" || status === "open"
          ? "text-destructive border-destructive/30 bg-destructive/10"
          : "text-info border-info/30 bg-info/10";
  return <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

export function SourceTag({ kind }: { kind: "simulated" | "real" | "ai" }) {
  const map = {
    simulated: ["Simulated telemetry", "text-warning border-warning/30"],
    real: ["Real telemetry", "text-success border-success/30"],
    ai: ["AI-generated analysis", "text-primary border-primary/30"],
  } as const;
  const [label, tone] = map[kind];
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${tone}`}>{label}</span>;
}
