import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Panel, StatusPill } from "@/components/sentinel/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMonitoring, saveMonitoringConnection, scrapeNow, testMonitoringConnection } from "@/lib/monitoring.functions";
import { DEFAULT_QUERIES, DEFAULT_THRESHOLDS, METRIC_KEYS, METRIC_LABELS, type Queries, type Thresholds } from "@/lib/monitoring";

export function MonitoringSettings({ canManage, canScrape }: { canManage: boolean; canScrape: boolean }) {
  const qc = useQueryClient();
  const mon = useQuery({ queryKey: ["monitoring"], queryFn: useServerFn(getMonitoring) });
  const save = useServerFn(saveMonitoringConnection);
  const test = useServerFn(testMonitoringConnection);
  const scrape = useServerFn(scrapeNow);
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "bearer" | "basic">("none");
  const [cred, setCred] = useState("");
  const [queries, setQueries] = useState<Queries>(DEFAULT_QUERIES);
  const [th, setTh] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [cooldown, setCooldown] = useState(30);
  const conn = mon.data?.connection;
  useEffect(() => {
    if (conn) {
      setUrl(conn.base_url);
      setAuthType(conn.auth_type as typeof authType);
      setQueries(conn.queries);
      setTh(conn.thresholds);
      setCooldown(conn.cooldown_minutes);
    }
  }, [conn]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["monitoring"] }); qc.invalidateQueries({ queryKey: ["overview"] }); };
  const onError = (e: unknown) => toast.error((e as Error).message);
  const saveM = useMutation({
    mutationFn: () => save({ data: { baseUrl: url, authType, credential: cred ? cred : undefined, queries, thresholds: th, cooldownMinutes: cooldown } }),
    onSuccess: () => { toast.success("Connection saved"); setCred(""); refresh(); }, onError,
  });
  const testM = useMutation({
    mutationFn: () => test(),
    onSuccess: (r) => { r.ok ? toast.success(`Connected — ${r.up}/${r.targets} targets up`) : toast.error(r.error); refresh(); }, onError,
  });
  const scrapeM = useMutation({
    mutationFn: () => scrape(),
    onSuccess: (r) => {
      if (!r.ok) toast.error(`Scrape failed: ${r.error}`);
      else toast.success(`Scraped. ${r.created.length} incident(s) opened, ${r.suppressed} duplicate alert(s) suppressed.`);
      refresh();
    }, onError,
  });

  return (
    <Panel title="Monitoring · Prometheus" sub={conn ? <StatusPill status={conn.status === "connected" ? "healthy" : conn.status === "error" ? "failed" : "unknown"} /> : "not configured"} className="xl:col-span-2">
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveM.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="pu">Prometheus URL</Label><Input id="pu" placeholder="https://prometheus.example.com" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!canManage} /></div>
          <div className="flex gap-2">
            <div className="space-y-1.5"><Label htmlFor="pa">Authentication</Label>
              <select id="pa" className="h-9 rounded-md border bg-background px-2 text-sm" value={authType} onChange={(e) => setAuthType(e.target.value as typeof authType)} disabled={!canManage}>
                <option value="none">None</option><option value="bearer">Bearer token</option><option value="basic">Basic (user:password)</option>
              </select>
            </div>
            {authType !== "none" && (
              <div className="flex-1 space-y-1.5"><Label htmlFor="pc">Credential</Label>
                <Input id="pc" type="password" autoComplete="off" placeholder={conn?.has_credential ? "Saved — leave blank to keep" : authType === "basic" ? "user:password" : "token"} value={cred} onChange={(e) => setCred(e.target.value)} disabled={!canManage} />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Use a read-only account. Credentials are stored server-side and never sent back to the browser.</p>
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">PromQL queries & alert thresholds</summary>
            <div className="mt-3 space-y-2">
              {METRIC_KEYS.map((k) => (
                <div key={k} className="space-y-1"><Label htmlFor={`q-${k}`} className="text-xs">{METRIC_LABELS[k].label}</Label>
                  <Input id={`q-${k}`} className="font-mono text-xs" value={queries[k]} onChange={(e) => setQueries({ ...queries, [k]: e.target.value })} disabled={!canManage} /></div>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
                {(["cpu", "mem", "errors", "p95", "unhealthyTargets"] as const).map((k) => (
                  <div key={k} className="space-y-1"><Label htmlFor={`t-${k}`} className="text-xs">{k === "unhealthyTargets" ? "Targets down ≥" : `${METRIC_LABELS[k].label} >`}</Label>
                    <Input id={`t-${k}`} type="number" step="any" value={th[k]} onChange={(e) => setTh({ ...th, [k]: Number(e.target.value) })} disabled={!canManage} /></div>
                ))}
                <div className="space-y-1"><Label htmlFor="cd" className="text-xs">Cooldown (min)</Label><Input id="cd" type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} disabled={!canManage} /></div>
              </div>
            </div>
          </details>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={saveM.isPending || !url}>Save connection</Button>
              <Button type="button" size="sm" variant="outline" disabled={!conn || testM.isPending} onClick={() => testM.mutate()}>{testM.isPending ? "Testing…" : "Test connection"}</Button>
              {canScrape && <Button type="button" size="sm" variant="outline" disabled={!conn || scrapeM.isPending} onClick={() => scrapeM.mutate()}>{scrapeM.isPending ? "Scraping…" : "Scrape now"}</Button>}
            </div>
          ) : canScrape ? (
            <Button type="button" size="sm" variant="outline" disabled={!conn || scrapeM.isPending} onClick={() => scrapeM.mutate()}>Scrape now</Button>
          ) : <p className="text-xs text-muted-foreground">Only Administrators can configure monitoring.</p>}
        </form>
        <div className="space-y-2 text-sm">
          <Row k="Connection status" v={conn?.status ?? "not configured"} />
          <Row k="Last check" v={conn?.last_checked_at ? new Date(conn.last_checked_at).toLocaleString() : "—"} />
          <Row k="Last successful scrape" v={conn?.last_success_at ? new Date(conn.last_success_at).toLocaleString() : "never"} />
          {conn?.last_error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{conn.last_error}</div>}
          <div className="pt-2 text-xs text-muted-foreground">Active alert rules</div>
          {mon.data?.alerts.length ? (
            <ul className="space-y-1 text-xs">{mon.data.alerts.map((a) => <li key={a.fingerprint} className="flex justify-between rounded border p-2"><span className="font-mono">{a.rule}</span><span className="text-muted-foreground">last fired {new Date(a.last_fired_at).toLocaleTimeString()} · {a.suppressed_count} suppressed</span></li>)}</ul>
          ) : <p className="text-xs text-muted-foreground">No alerts have fired yet.</p>}
        </div>
      </div>
    </Panel>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground">{k}</span><span className="font-mono text-xs">{v}</span></div>;
}
