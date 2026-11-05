import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3, BookOpen, Brain, ChevronsUpDown, FileClock, FlaskConical, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  Radar, Server, Settings, ShieldCheck, Siren, Wrench, Check,
} from "lucide-react";
import { Logo, LogoMark } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { getMe } from "@/lib/sentinel.functions";
import { ROLE_LABELS } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Route = "/dashboard" | "/incidents" | "/simulation" | "/settings";
type NavItem = { icon: typeof Server; label: string; to?: Route };
const sections: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ icon: LayoutDashboard, label: "Command Center", to: "/dashboard" }] },
  { label: "Operations", items: [{ icon: Server, label: "Infrastructure" }, { icon: Siren, label: "Incidents", to: "/incidents" }, { icon: Brain, label: "Investigations" }, { icon: Wrench, label: "Remediation" }] },
  { label: "Security", items: [{ icon: ShieldCheck, label: "Security Center" }, { icon: Radar, label: "Threat Events" }, { icon: FileClock, label: "Audit Logs" }] },
  { label: "Development", items: [{ icon: FlaskConical, label: "Simulation Lab", to: "/simulation" }, { icon: BarChart3, label: "Analytics" }] },
];
const bottom: NavItem[] = [{ icon: BookOpen, label: "Documentation" }, { icon: Settings, label: "Settings", to: "/settings" }];

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const base = "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors";
  const inner = item.to ? (
    <Link to={item.to} onClick={onNavigate} aria-label={item.label} className={cn(base, "text-muted-foreground hover:bg-accent hover:text-foreground", collapsed && "justify-center px-0")}
      activeProps={{ className: "bg-accent !text-foreground shadow-[inset_2px_0_0_var(--primary)]" }}>
      <item.icon className="size-4 shrink-0" strokeWidth={1.75} />{!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  ) : (
    <div aria-disabled className={cn(base, "cursor-default text-subtle-foreground", collapsed && "justify-center px-0")}>
      <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
      {!collapsed && <><span className="truncate">{item.label}</span><span className="ml-auto rounded border px-1 text-[10px] leading-4">Soon</span></>}
    </div>
  );
  if (!collapsed) return inner;
  return (
    <Tooltip><TooltipTrigger asChild>{inner}</TooltipTrigger><TooltipContent side="right">{item.label}{!item.to && " · soon"}</TooltipContent></Tooltip>
  );
}

function useMe(enabled: boolean) {
  const fetchMe = useServerFn(getMe);
  return useQuery({ queryKey: ["me"], queryFn: () => fetchMe(), enabled, staleTime: 60_000 });
}

function WorkspaceSelector({ collapsed, me }: { collapsed: boolean; me: ReturnType<typeof useMe>["data"] }) {
  const org = me?.organization.name ?? "Demo organization";
  const workspaces = me?.workspaces ?? [{ id: "demo", name: "Production", environment: "production" }];
  const [active, setActive] = useState<string | null>(null);
  const current = workspaces.find((w) => w.id === active) ?? workspaces[0]!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("flex w-full items-center gap-2 rounded-md border bg-surface px-2 py-1.5 text-left transition-colors hover:bg-accent", collapsed && "justify-center px-0")} aria-label="Switch workspace">
        <span className="grid size-6 shrink-0 place-items-center rounded bg-elevated font-mono text-[11px] text-muted-foreground">{org.slice(0, 1).toUpperCase()}</span>
        {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-[13px]">{current.name}</span><span className="block truncate text-[11px] text-subtle-foreground">{org}</span></span><ChevronsUpDown className="size-3.5 text-subtle-foreground" /></>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{org}</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => setActive(w.id)} className="text-[13px]">
            <span className="flex-1">{w.name}</span><span className="font-mono text-[10px] text-subtle-foreground">{w.environment}</span>
            {w.id === current.id && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
        {me && <><DropdownMenuSeparator /><DropdownMenuItem asChild className="text-[13px]"><Link to="/settings">Manage workspaces</Link></DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({ collapsed, onNavigate, onSignOut }: { collapsed: boolean; onNavigate?: () => void; onSignOut: () => void }) {
  const { session } = useSession();
  const me = useMe(!!session);
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className={cn("flex h-9 items-center px-1", collapsed && "justify-center px-0")}>{collapsed ? <LogoMark /> : <Logo />}</div>
      <WorkspaceSelector collapsed={collapsed} me={me.data} />
      <nav className="flex-1 space-y-4 overflow-y-auto pt-1">
        {sections.map((s) => (
          <div key={s.label} className="space-y-0.5">
            {!collapsed ? <div className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">{s.label}</div> : <div className="mx-auto mb-1 h-px w-5 bg-border" />}
            {s.items.map((i) => <NavLink key={i.label} item={i} collapsed={collapsed} {...(onNavigate ? { onNavigate } : {})} />)}
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t pt-3">
        {bottom.map((i) => <NavLink key={i.label} item={i} collapsed={collapsed} {...(onNavigate ? { onNavigate } : {})} />)}
        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger className={cn("mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent", collapsed && "justify-center px-0")} aria-label="Account">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-elevated text-[11px] font-medium">{(me.data?.profile.display_name || session.user.email || "?").slice(0, 2).toUpperCase()}</span>
              {!collapsed && <span className="min-w-0"><span className="block truncate text-[13px]">{me.data?.profile.display_name || session.user.email}</span><span className="block truncate text-[11px] text-subtle-foreground">{me.data ? ROLE_LABELS[me.data.role] : "Signed in"}</span></span>}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{session.user.email}</DropdownMenuLabel>
              <DropdownMenuItem asChild className="text-[13px]"><Link to="/settings">Profile & settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onSignOut} className="text-[13px]"><LogOut className="size-3.5" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link to="/auth" className={cn("mt-2 flex h-8 items-center justify-center rounded-md border text-[13px] transition-colors hover:bg-accent")}>{collapsed ? "→" : "Sign in"}</Link>
        )}
      </div>
    </div>
  );
}

export function AppShell({ title, subtitle, banner, actions, children }: { title: string; subtitle?: ReactNode; banner?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setCollapsed(localStorage.getItem("sentinel.sidebar") === "collapsed"); }, []);
  const toggle = () => setCollapsed((c) => { localStorage.setItem("sentinel.sidebar", c ? "open" : "collapsed"); return !c; });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen flex-col">
        {banner}
        <div className="flex flex-1">
          <aside className={cn("sticky top-0 hidden h-screen shrink-0 border-r bg-sidebar transition-[width] duration-200 ease-out lg:block", collapsed ? "w-[60px]" : "w-60")}>
            <SidebarBody collapsed={collapsed} onSignOut={signOut} />
          </aside>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-64 border-r bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} onSignOut={signOut} />
            </SheetContent>
          </Sheet>
          <main className="min-w-0 flex-1">
            <div className="flex h-12 items-center gap-2 border-b px-4 md:px-6">
              <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"><Menu className="size-4" /></button>
              <button onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:block">
                {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </button>
              <span className="text-[13px] text-subtle-foreground">SENTINEL</span><span className="text-subtle-foreground">/</span><span className="text-[13px]">{title}</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-1 pt-6 md:px-6">
              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold leading-tight tracking-tight">{title}</h1>
                {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function Panel({ title, sub, className = "", children, flush = false }: { title: string; sub?: ReactNode; className?: string; children: ReactNode; flush?: boolean }) {
  return (
    <section className={cn("rounded-lg border bg-surface", className)}>
      <div className="flex min-h-11 items-center justify-between gap-2 border-b px-4 py-2.5"><h2 className="text-[15px] font-medium">{title}</h2>{sub && <span className="text-xs text-muted-foreground">{sub}</span>}</div>
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

const sevTone: Record<string, string> = {
  sev1: "text-destructive border-destructive/40 bg-destructive/10",
  sev2: "text-destructive border-destructive/25 bg-destructive/[0.06]",
  sev3: "text-warning border-warning/25 bg-warning/[0.06]",
  sev4: "text-muted-foreground border-border bg-elevated",
};
export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`inline-flex rounded border px-1.5 py-px font-mono text-[10.5px] uppercase ${sevTone[severity] ?? sevTone["sev4"]}`}>{severity}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "resolved" || status === "closed" || status === "verified" || status === "healthy" || status === "approved" || status === "completed"
      ? "bg-success"
      : status === "awaiting_approval" || status === "pending_approval" || status === "warning"
        ? "bg-warning"
        : status === "rejected" || status === "failed" || status === "disconnected" || status === "degraded" || status === "open"
          ? "bg-destructive"
          : "bg-primary";
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs capitalize text-foreground/90"><span className={`size-1.5 rounded-full ${tone}`} />{status.replace(/_/g, " ")}</span>;
}

export function SourceTag({ kind }: { kind: "simulated" | "real" | "ai" }) {
  const map = {
    simulated: ["Simulated", "text-warning border-warning/25"],
    real: ["Real telemetry", "text-success border-success/25"],
    ai: ["Engine-generated", "text-primary border-primary/25"],
  } as const;
  const [label, tone] = map[kind];
  return <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-px text-[10.5px] ${tone}`}>{label}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
      <div className="text-[13px] font-medium">{title}</div>
      {children && <div className="text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}
