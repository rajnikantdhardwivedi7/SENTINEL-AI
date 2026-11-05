import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { AppShell, EmptyState, Panel, SeverityBadge, SourceTag, StatusPill } from "@/components/sentinel/AppShell";
import { useSession } from "@/hooks/use-session";
import { getOverview } from "@/lib/sentinel.functions";
import { DemoBanner } from "@/components/sentinel/Logo";
import { activityAt, clusters, demoIncidents, healthScore, metricWindow, services, type Activity, type MetricPoint } from "@/lib/demo-telemetry";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center — SENTINEL AI" },
      { name: "description", content: "Live operational overview of infrastructure health, incidents, security alerts and agent activity." },
      { property: "og:title", content: "Command Center — SENTINEL AI" },
      { property: "og:description", content: "Infrastructure health, incidents and AI agent activity in one view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--foreground)" };
const axis = { stroke: "var(--subtle-foreground)", fontSize: 10.5, tickLine: false, axisLine: false };
const legendStyle = { fontSize: 11.5, color: "var(--muted-foreground)", paddingTop: 4 };
const RANGES = { "30m": 30, "1h": 60, "2h": 120 } as const;
type RangeKey = keyof typeof RANGES;
const selectCls = "h-8 rounded-md border bg-surface px-2 text-[13px] text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const avg = (xs: MetricPoint[], k: keyof Omit<MetricPoint, "t">) => xs.reduce((a, p) => a + p[k], 0) / Math.max(1, xs.length);

function Dashboard() {
  const [tick, setTick] = useState(200);
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<RangeKey>("30m");
  const [env, setEnv] = useState("all");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => { setMounted(true); setUpdatedAt(new Date()); }, []);
  useEffect(() => {
    const id = setInterval(() => { setTick((t) => t + 1); setUpdatedAt(new Date()); }, 2000);
    return () => clearInterval(id);
  }, []);

  const size = RANGES[range];
  const data = metricWindow(tick, size);
  const prev = useMemo(() => metricWindow(tick - size, size), [tick, size]);
  const now = data[data.length - 1]!;
  const score = healthScore(now);
  const prevScore = healthScore(prev[prev.length - 1]!);

  const { session } = useSession();
  const fetchOverview = useServerFn(getOverview);
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview(), enabled: !!session, refetchInterval: 10_000 });
  const feed: Activity[] = Array.from({ length: 7 }, (_, k) => activityAt(tick - k));
  const interval = Math.max(1, Math.floor(size / 6));

  const resources = [
    ...clusters.map((c) => ({ name: c.name, kind: "cluster", env: c.name, status: c.status, cpu: c.cpu, mem: c.mem, hb: c.heartbeat })),
    ...services.map((s) => ({ name: s.name, kind: s.ns, env: s.env, status: s.status, cpu: s.cpu, mem: s.mem, hb: s.heartbeat })),
  ].filter((r) => env === "all" || r.env === env);

  return (
    <AppShell
      title="Command Center"
      subtitle="Infrastructure overview and operational health."
      banner={<DemoBanner />}
      actions={
        <>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
            <span className="size-1.5 rounded-full bg-success pulse-dot" />Updated {updatedAt ? updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </span>
          <SourceTag kind="simulated" />
          <select aria-label="Environment" className={selectCls} value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="all">All environments</option>
            {clusters.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select aria-label="Time range" className={selectCls} value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
            <option value="30m">Last 30 min</option><option value="1h">Last 1 hour</option><option value="2h">Last 2 hours</option>
          </select>
        </>
      }
    >
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="System health" value={`${score}`} unit="/100" delta={score - prevScore} goodWhenUp spark={data.map((p) => ({ v: healthScore(p) }))} mounted={mounted} />
          <Kpi label="Active incidents" value={`${overview.data?.activeIncidents ?? 2}`} note={overview.data ? "saved · your org" : "vs 3 prior period"} delta={overview.data ? undefined : -1} />
          <Kpi label="Critical alerts" value="1" delta={0} note="security + infra" tone="destructive" />
          <Kpi label="Monitored services" value={`${services.length}`} note={`${clusters.length} clusters`} />
          <Kpi label="CPU utilization" value={`${now.cpu}`} unit="%" delta={Number((avg(data, "cpu") - avg(prev, "cpu")).toFixed(1))} spark={data.map((p) => ({ v: p.cpu }))} mounted={mounted} />
          <Kpi label="Error rate" value={`${now.errors}`} unit="%" delta={Number((avg(data, "errors") - avg(prev, "errors")).toFixed(2))} spark={data.map((p) => ({ v: p.errors }))} mounted={mounted} tone={now.errors > 1 ? "warning" : undefined} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="CPU & memory utilization" sub="% across clusters">
            <ChartBox mounted={mounted}>
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <defs><linearGradient id="gcpu" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="t" {...axis} interval={interval} />
                <YAxis {...axis} domain={[0, 100]} width={36} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--border)" }} />
                <Legend iconType="plainline" wrapperStyle={legendStyle} />
                <Area name="CPU" type="monotone" dataKey="cpu" stroke="var(--chart-1)" fill="url(#gcpu)" strokeWidth={1.5} animationDuration={400} />
                <Area name="Memory" type="monotone" dataKey="mem" stroke="var(--chart-2)" fill="transparent" strokeWidth={1.5} animationDuration={400} />
              </AreaChart>
            </ChartBox>
          </Panel>
          <Panel title="Request latency & error rate" sub="p95 ms · % of requests">
            <ChartBox mounted={mounted}>
              <LineChart data={data} margin={{ top: 4, right: 0, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="t" {...axis} interval={interval} />
                <YAxis yAxisId="l" {...axis} width={40} tickFormatter={(v) => `${v}ms`} />
                <YAxis yAxisId="r" orientation="right" {...axis} width={36} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--border)" }} />
                <Legend iconType="plainline" wrapperStyle={legendStyle} />
                <Line yAxisId="l" name="p95 latency" type="monotone" dataKey="p95" stroke="var(--chart-4)" dot={false} strokeWidth={1.5} animationDuration={400} />
                <Line yAxisId="r" name="Error rate" type="monotone" dataKey="errors" stroke="var(--chart-5)" dot={false} strokeWidth={1.5} animationDuration={400} />
              </LineChart>
            </ChartBox>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-5">
          <Panel title="Incidents" sub={session ? <Link to="/incidents" className="text-primary hover:underline">View all</Link> : <SourceTag kind="simulated" />} className="xl:col-span-3" flush>
            <IncidentTable session={!!session} loading={overview.isLoading && !!session} data={overview.data} />
          </Panel>
          <Panel title="Agent activity" sub={<SourceTag kind="simulated" />} className="xl:col-span-2" flush>
            <ul className="divide-y">
              {feed.map((a) => (
                <li key={a.id} className="grid grid-cols-[64px_1fr] gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40">
                  <span className="font-mono text-[11px] text-subtle-foreground">{a.at}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">{a.agent}</span>
                      {a.incident && <span className="font-mono text-[11px] text-muted-foreground">{a.incident}</span>}
                      <span className="ml-auto"><StatusPill status={a.state} /></span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{a.msg}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Infrastructure health" sub={<SourceTag kind="simulated" />} flush>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wide text-subtle-foreground">
                <tr className="border-b"><Th>Resource</Th><Th>Environment</Th><Th>Status</Th><Th>CPU</Th><Th>Memory</Th><Th className="text-right">Last heartbeat</Th></tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.name} className="border-b last:border-0 transition-colors hover:bg-accent/40">
                    <td className="px-4 py-2"><span className="font-mono text-xs">{r.name}</span><span className="ml-2 text-[11px] text-subtle-foreground">{r.kind}</span></td>
                    <td className="px-4 py-2 text-muted-foreground">{r.env}</td>
                    <td className="px-4 py-2"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-2"><Meter v={r.cpu} /></td>
                    <td className="px-4 py-2"><Meter v={r.mem} /></td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">{r.hb}s ago</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-2 font-medium ${className}`}>{children}</th>;
}

function ChartBox({ mounted, children }: { mounted: boolean; children: React.ReactElement }) {
  return <div className="h-[240px]">{mounted ? <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer> : <Skeleton className="h-full w-full" />}</div>;
}

function Meter({ v }: { v: number }) {
  const tone = v > 80 ? "bg-destructive" : v > 70 ? "bg-warning" : "bg-chart-2";
  return <div className="flex items-center gap-2"><div className="h-1 w-16 rounded-full bg-elevated"><div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} /></div><span className="w-8 font-mono text-xs text-muted-foreground">{v}%</span></div>;
}

function Kpi({ label, value, unit, delta, goodWhenUp = false, note, spark, mounted, tone }: {
  label: string; value: string; unit?: string; delta?: number | undefined; goodWhenUp?: boolean; note?: string; spark?: { v: number }[]; mounted?: boolean; tone?: "destructive" | "warning" | undefined;
}) {
  const up = (delta ?? 0) > 0;
  const good = delta === undefined || delta === 0 ? null : up === goodWhenUp;
  return (
    <div className="rounded-lg border bg-surface p-3.5 transition-colors hover:border-foreground/15">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className={`font-mono text-[26px] font-medium leading-none tabular ${tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : ""}`}>{value}<span className="ml-0.5 text-sm text-subtle-foreground">{unit}</span></div>
        {spark && mounted && (
          <div className="h-7 w-16">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={spark}><Line type="monotone" dataKey="v" stroke="var(--chart-2)" dot={false} strokeWidth={1.25} isAnimationActive={false} /></LineChart></ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-subtle-foreground">
        {delta !== undefined && (
          <span className={`inline-flex items-center font-mono ${good === null ? "" : good ? "text-success" : "text-destructive"}`}>
            {delta === 0 ? "±0" : <>{up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(delta)}</>}
          </span>
        )}
        <span className="truncate">{note ?? "vs previous period"}</span>
      </div>
    </div>
  );
}

type Overview = Awaited<ReturnType<typeof getOverview>>;

function IncidentTable({ session, loading, data }: { session: boolean; loading: boolean; data?: Overview | undefined }) {
  const rows = session && data
    ? data.recentIncidents.map((i) => ({ id: i.id, ref: i.reference, title: i.title, severity: i.severity, service: i.services?.name ?? "—", detected: new Date(i.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: i.status, agent: i.assignee_id ? "Assigned" : "—", link: true }))
    : demoIncidents.map((i) => ({ id: i.ref, ref: i.ref, title: i.title, severity: i.severity, service: i.service, detected: i.detected, status: i.status, agent: i.agent, link: false }));
  if (loading) return <div className="space-y-2 p-4">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-7 w-full" />)}</div>;
  if (session && rows.length === 0) return <EmptyState title="No incidents yet"><Link to="/simulation" className="text-primary hover:underline">Run a simulation</Link> to create one.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="text-left text-[11px] uppercase tracking-wide text-subtle-foreground">
          <tr className="border-b"><Th>ID</Th><Th>Incident</Th><Th>Severity</Th><Th>Service</Th><Th>Detected</Th><Th>Status</Th><Th>Agent</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 transition-colors hover:bg-accent/40">
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">{r.ref}</td>
              <td className="max-w-[260px] truncate px-4 py-2">{r.link ? <Link to="/incidents/$incidentId" params={{ incidentId: r.id }} className="hover:text-primary">{r.title}</Link> : r.title}</td>
              <td className="px-4 py-2"><SeverityBadge severity={r.severity} /></td>
              <td className="px-4 py-2 font-mono text-xs">{r.service}</td>
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">{r.detected}</td>
              <td className="px-4 py-2"><StatusPill status={r.status} /></td>
              <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{r.agent}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!session && <p className="border-t px-4 py-2 text-xs text-subtle-foreground"><Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see your organization's saved incidents.</p>}
    </div>
  );
}
