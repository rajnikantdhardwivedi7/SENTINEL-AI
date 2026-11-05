import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, Cpu } from "lucide-react";
import { AppShell, Panel, SeverityBadge, SourceTag, StatusPill } from "@/components/sentinel/AppShell";
import { useSession } from "@/hooks/use-session";
import { getOverview } from "@/lib/sentinel.functions";
import { DemoBanner } from "@/components/sentinel/Logo";
import { activityAt, clusters, healthScore, incidentTrend, metricWindow, services, type Activity } from "@/lib/demo-telemetry";

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


const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 };
const axis = { stroke: "var(--muted-foreground)", fontSize: 10, tickLine: false, axisLine: false };

function Dashboard() {
  const [tick, setTick] = useState(200);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);
  const data = metricWindow(tick);
  const now = data[data.length - 1]!;
  const score = healthScore(now);
  const { session } = useSession();
  const fetchOverview = useServerFn(getOverview);
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview(), enabled: !!session, refetchInterval: 10_000 });
  const feed: Activity[] = Array.from({ length: 8 }, (_, k) => activityAt(tick - k));

  return (
    <AppShell
      title="Command Center"
      banner={<DemoBanner />}
      actions={<span className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-success pulse-dot" />live · simulated</span>}
    >
          <div className="space-y-4 p-4 md:p-6">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4 xl:grid-cols-6">
              <Stat label="Health score" value={`${score}`} tone={score > 80 ? "text-success" : "text-warning"} />
              <Stat label={overview.data ? "Active incidents · saved" : "Active incidents"} value={`${overview.data?.activeIncidents ?? 2}`} tone="text-warning" />
              <Stat label="Critical alerts" value="1" tone="text-destructive" />
              <Stat label="Services" value={`${services.length}`} />
              <Stat label="CPU" value={`${now.cpu}%`} />
              <Stat label="Error rate" value={`${now.errors}%`} />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="CPU & memory utilization" sub="% across all clusters" className="xl:col-span-2">
                {mounted && <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="t" {...axis} interval={7} />
                    <YAxis {...axis} domain={[0, 100]} width={28} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="cpu" stroke="var(--chart-1)" fill="url(#gc)" strokeWidth={1.5} isAnimationActive={false} />
                    <Area type="monotone" dataKey="mem" stroke="var(--chart-2)" fill="transparent" strokeWidth={1.5} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>}
              </Panel>
              <Panel title="Agent activity" sub="real-time feed">
                <ul className="space-y-2.5 text-xs">
                  {feed.map((a) => (
                    <li key={a.id} className="flex gap-2">
                      <span className="w-14 shrink-0 font-mono text-muted-foreground">{a.at}</span>
                      <span><span className="font-medium text-primary">{a.agent}</span> <span className="text-muted-foreground">{a.msg}</span></span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Panel title="Request latency" sub="p95, ms">
                {mounted && <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={data}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="t" {...axis} interval={9} />
                    <YAxis {...axis} width={32} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="p95" stroke="var(--chart-4)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>}
              </Panel>
              <Panel title="Error rate" sub="% of requests">
                {mounted && <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="t" {...axis} interval={9} />
                    <YAxis {...axis} width={32} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="errors" stroke="var(--chart-5)" fill="var(--chart-5)" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>}
              </Panel>
              <Panel title="Incident trend" sub="last 7 days, by severity">
                {mounted && <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={incidentTrend}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" {...axis} />
                    <YAxis {...axis} width={20} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
                    <Bar dataKey="sev3" stackId="a" fill="var(--chart-2)" />
                    <Bar dataKey="sev2" stackId="a" fill="var(--chart-4)" />
                    <Bar dataKey="sev1" stackId="a" fill="var(--chart-5)" />
                  </BarChart>
                </ResponsiveContainer>}
              </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Monitored services" sub="Kubernetes workloads" className="xl:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr><th className="pb-2 font-normal">Service</th><th className="pb-2 font-normal">Namespace</th><th className="pb-2 font-normal">Pods</th><th className="pb-2 font-normal">CPU</th><th className="pb-2 font-normal">Status</th></tr>
                    </thead>
                    <tbody>
                      {services.map((s) => (
                        <tr key={s.name} className="border-t">
                          <td className="py-2 font-mono text-xs">{s.name}</td>
                          <td className="py-2 text-muted-foreground">{s.ns}</td>
                          <td className="py-2 font-mono text-xs">{s.pods}</td>
                          <td className="py-2"><div className="h-1.5 w-20 rounded bg-muted"><div className={`h-full rounded ${s.cpu > 80 ? "bg-destructive" : s.cpu > 70 ? "bg-warning" : "bg-primary"}`} style={{ width: `${s.cpu}%` }} /></div></td>
                          <td className="py-2"><StatusBadge status={s.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title="Kubernetes clusters" sub="simulated">
                <ul className="space-y-2">
                  {clusters.map((c) => (
                    <li key={c.name} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3"><Boxes className="size-4 text-muted-foreground" /><div><div className="font-mono text-xs">{c.name}</div><div className="text-xs text-muted-foreground"><Cpu className="mr-1 inline size-3" />{c.nodes} nodes</div></div></div>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
            <PersistedPanel session={!!session} loading={overview.isLoading} data={overview.data} />
          </div>
    </AppShell>
  );
}

function Stat({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-medium ${tone}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "healthy" ? "text-success border-success/30 bg-success/10" : status === "degraded" ? "text-destructive border-destructive/30 bg-destructive/10" : "text-warning border-warning/30 bg-warning/10";
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${tone}`}>{status}</span>;
}

type Overview = Awaited<ReturnType<typeof getOverview>>;

function PersistedPanel({ session, loading, data }: { session: boolean; loading: boolean; data?: Overview | undefined }) {
  if (!session) {
    return (
      <Panel title="Your organization" sub="saved incidents">
        <p className="text-sm text-muted-foreground">Everything above is simulated. <Link to="/auth" className="text-primary underline">Sign in</Link> to see your saved incidents and run the full incident lifecycle.</p>
      </Panel>
    );
  }
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="Recent incidents" sub={<Link to="/incidents" className="text-primary">View all</Link>} className="xl:col-span-2">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data?.recentIncidents.length ? (
          <p className="text-sm text-muted-foreground">No incidents yet. <Link to="/simulation" className="text-primary underline">Run a simulation</Link>.</p>
        ) : (
          <ul className="divide-y">
            {data.recentIncidents.map((i) => (
              <li key={i.id}><Link to="/incidents/$incidentId" params={{ incidentId: i.id }} className="flex items-center gap-3 py-2 text-sm hover:text-primary">
                <SeverityBadge severity={i.severity} /><span className="min-w-0 flex-1 truncate">{i.title}</span><SourceTag kind={i.source === "real" ? "real" : "simulated"} /><StatusPill status={i.status} />
              </Link></li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Audit trail" sub="saved">
        {!data?.activity.length ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : (
          <ul className="space-y-2 text-xs">
            {data.activity.map((a) => (
              <li key={a.id} className="flex gap-2"><span className="w-14 shrink-0 font-mono text-muted-foreground">{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span><span className="font-medium text-primary">{a.actor_type === "agent" ? a.agent : a.actor_type === "system" ? "System" : "You/team"}</span> <span className="text-muted-foreground">{a.message}</span></span></li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
