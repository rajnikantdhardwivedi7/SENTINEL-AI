import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, Panel, SeverityBadge, SourceTag, StatusPill } from "@/components/sentinel/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { getMonitoring } from "@/lib/monitoring.functions";
import { getOverview } from "@/lib/sentinel.functions";
import { METRIC_LABELS, type MetricKey, type MetricReading, type TargetHealth } from "@/lib/monitoring";

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--foreground)" };
const axis = { stroke: "var(--subtle-foreground)", fontSize: 10.5, tickLine: false, axisLine: false };
const STALE_MS = 15 * 60_000;

type Metrics = Partial<Record<MetricKey | "availability", MetricReading>>;

/** REAL environment: shows only Prometheus data. Never falls back to simulated values. */
export function RealCommandCenter({ signedIn }: { signedIn: boolean }) {
  const fetchMon = useServerFn(getMonitoring);
  const fetchOverview = useServerFn(getOverview);
  const mon = useQuery({ queryKey: ["monitoring"], queryFn: () => fetchMon(), enabled: signedIn, refetchInterval: 30_000 });
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview(), enabled: signedIn });

  if (!signedIn) return <Box><EmptyState title="Sign in to view real telemetry"><Link to="/auth" className="text-primary hover:underline">Sign in</Link> — real monitoring data is private to your organization.</EmptyState></Box>;
  if (mon.isLoading) return <div className="space-y-3 p-4 md:p-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (mon.error) return <Box><Disconnected reason={(mon.error as Error).message} /></Box>;
  const conn = mon.data?.connection;
  if (!conn) return <Box><EmptyState title="No monitoring connection">No Prometheus instance is connected. An Administrator can add one in <Link to="/settings" className="text-primary hover:underline">Settings → Monitoring</Link>. Simulated data is only shown in the DEMO environment.</EmptyState></Box>;

  const snaps = mon.data!.snapshots;
  const okSnaps = snaps.filter((s) => s.ok);
  const latest = snaps[snaps.length - 1];
  const lastOk = okSnaps[okSnaps.length - 1];
  const stale = !conn.last_success_at || Date.now() - new Date(conn.last_success_at).getTime() > STALE_MS;
  const disconnected = conn.status === "error" || !latest?.ok;
  const m = (lastOk?.metrics ?? {}) as Metrics;
  const targets = (lastOk?.targets ?? []) as TargetHealth[];
  const series = okSnaps.map((s) => {
    const x = s.metrics as Metrics;
    return { t: new Date(s.captured_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), cpu: x.cpu?.value ?? null, mem: x.mem?.value ?? null, p95: x.p95?.value ?? null, errors: x.errors?.value ?? null };
  });
  const realIncidents = (overview.data?.recentIncidents ?? []).filter((i) => i.source === "real");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-surface px-4 py-2.5 text-xs">
        <SourceTag kind="real" />
        <span className="text-muted-foreground">Source <span className="font-mono text-foreground">{conn.base_url}</span></span>
        <span className="text-muted-foreground">Status <StatusPill status={disconnected ? "disconnected" : stale ? "warning" : "healthy"} /></span>
        <span className="text-muted-foreground">Last successful scrape <span className="font-mono text-foreground">{conn.last_success_at ? new Date(conn.last_success_at).toLocaleString() : "never"}</span></span>
        <Link to="/settings" className="ml-auto text-primary hover:underline">Configure</Link>
      </div>
      {disconnected && <Disconnected reason={conn.last_error ?? "The most recent scrape failed."} />}
      {!disconnected && stale && <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">Data is older than 15 minutes. Values below are the last successful scrape, not live.</div>}
      {lastOk && latest?.errors && (latest.errors as string[]).length > 0 && !disconnected && (
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground"><span className="text-warning">Monitoring warnings:</span> {(latest.errors as string[]).join(" · ")}</div>
      )}
      {!lastOk ? (
        <Panel title="Telemetry"><EmptyState title="No successful scrape yet">Run <span className="font-medium">Scrape now</span> in Settings → Monitoring. No values are shown until real data arrives.</EmptyState></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {(["cpu", "mem", "rps", "errors", "p95"] as const).map((k) => <RealKpi key={k} label={METRIC_LABELS[k].label} unit={METRIC_LABELS[k].unit} r={m[k]} threshold={k === "rps" ? undefined : conn.thresholds[k]} />)}
            <RealKpi label="Target availability" unit="%" r={m.availability} note={`${targets.filter((t) => t.health === "up").length}/${targets.length} up`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="CPU & memory utilization" sub={`${okSnaps.length} real snapshots`}>
              <div className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} /><XAxis dataKey="t" {...axis} /><YAxis {...axis} domain={[0, 100]} width={44} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} /><Legend iconType="plainline" wrapperStyle={{ fontSize: 11.5 }} />
                  <Line name="CPU" dataKey="cpu" stroke="var(--chart-1)" dot={series.length < 3} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
                  <Line name="Memory" dataKey="mem" stroke="var(--chart-2)" dot={series.length < 3} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
                </LineChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Request latency & error rate" sub="p95 ms · % 5xx">
              <div className="h-[240px]"><ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} /><XAxis dataKey="t" {...axis} />
                  <YAxis yAxisId="l" {...axis} width={56} tickFormatter={(v) => `${v}ms`} /><YAxis yAxisId="r" orientation="right" {...axis} width={44} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} /><Legend iconType="plainline" wrapperStyle={{ fontSize: 11.5 }} />
                  <Line yAxisId="l" name="p95 latency" dataKey="p95" stroke="var(--chart-4)" dot={series.length < 3} strokeWidth={1.5} isAnimationActive={false} />
                  <Line yAxisId="r" name="Error rate" dataKey="errors" stroke="var(--chart-5)" dot={series.length < 3} strokeWidth={1.5} isAnimationActive={false} />
                </LineChart></ResponsiveContainer></div>
            </Panel>
          </div>
          <div className="grid gap-4 2xl:grid-cols-2">
            <Panel title="Incidents from real telemetry" sub={<Link to="/incidents" className="text-primary hover:underline">View all</Link>} flush>
              {realIncidents.length === 0 ? <EmptyState title="No real incidents">No threshold has been exceeded on real telemetry.</EmptyState> : (
                <ul className="divide-y">{realIncidents.map((i) => (
                  <li key={i.id}><Link to="/incidents/$incidentId" params={{ incidentId: i.id }} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-accent/40">
                    <span className="font-mono text-xs text-muted-foreground">{i.reference}</span><SeverityBadge severity={i.severity} /><span className="min-w-0 flex-1 truncate">{i.title}</span><StatusPill status={i.status} />
                  </Link></li>))}</ul>
              )}
            </Panel>
            <Panel title="Prometheus targets" sub={`as of ${new Date(lastOk.captured_at).toLocaleTimeString()}`} flush>
              <div className="max-h-[320px] overflow-auto"><table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wide text-subtle-foreground"><tr className="border-b"><th className="px-4 py-2 font-medium">Job</th><th className="px-4 py-2 font-medium">Instance</th><th className="px-4 py-2 font-medium">Health</th><th className="px-4 py-2 text-right font-medium">Last scrape</th></tr></thead>
                <tbody>{targets.map((t) => (
                  <tr key={`${t.job}/${t.instance}`} className="border-b last:border-0"><td className="px-4 py-2 font-mono text-xs">{t.job}</td><td className="px-4 py-2 font-mono text-xs text-muted-foreground">{t.instance}</td><td className="px-4 py-2"><StatusPill status={t.health === "up" ? "healthy" : t.health === "down" ? "failed" : "unknown"} /></td><td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">{t.lastScrape ? new Date(t.lastScrape).toLocaleTimeString() : "—"}</td></tr>
                ))}</tbody>
              </table></div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-6"><Panel title="Real telemetry">{children}</Panel></div>;
}

function Disconnected({ reason }: { reason: string }) {
  return <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span className="font-medium">Disconnected from Prometheus.</span> {reason} No simulated values are substituted.</div>;
}

function RealKpi({ label, unit, r, threshold, note }: { label: string; unit: string; r?: MetricReading | undefined; threshold?: number | undefined; note?: string }) {
  const v = r?.value;
  const over = v != null && threshold != null && v > threshold;
  return (
    <div className="rounded-lg border bg-surface p-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1.5 font-mono text-[26px] font-medium leading-none tabular ${over ? "text-destructive" : ""}`}>{v == null ? <span className="text-base text-subtle-foreground">no data</span> : <>{v}<span className="ml-0.5 text-sm text-subtle-foreground">{unit}</span></>}</div>
      <div className="mt-2 truncate text-[11px] text-subtle-foreground" title={r?.error}>
        {r?.error ? r.error : note ?? (threshold != null ? `threshold ${threshold}${unit}` : "")}{r?.at && !r.error ? ` · ${new Date(r.at).toLocaleTimeString()}` : ""}
      </div>
    </div>
  );
}
