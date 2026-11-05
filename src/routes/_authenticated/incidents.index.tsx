import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell, SeverityBadge, SourceTag, StatusPill } from "@/components/sentinel/AppShell";
import { listIncidents } from "@/lib/sentinel.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/incidents/")({
  head: () => ({
    meta: [
      { title: "Incidents — SENTINEL AI" },
      { name: "description", content: "Search, filter and triage every incident in your organization." },
      { property: "og:title", content: "Incidents — SENTINEL AI" },
      { property: "og:description", content: "Incident management for SENTINEL AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IncidentsPage,
});

const STATUSES = ["all", "open", "investigating", "awaiting_approval", "remediating", "monitoring", "resolved", "closed"];
const SEVERITIES = ["all", "sev1", "sev2", "sev3", "sev4"];
const selectCls = "h-9 rounded-md border bg-surface px-2 text-[13px] transition-colors hover:bg-accent";

function IncidentsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const fetchIncidents = useServerFn(listIncidents);
  const { data, isLoading, error } = useQuery({
    queryKey: ["incidents", q, status, severity],
    queryFn: () => fetchIncidents({ data: { q: q || undefined, status, severity } }),
  });

  return (
    <AppShell title="Incidents" subtitle="Search, triage and follow every incident in your organization." actions={<Button asChild size="sm"><Link to="/simulation">Simulate incident</Link></Button>}>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search title or reference" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" maxLength={100} />
          </div>
          <select aria-label="Status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s.replace(/_/g, " ")}</option>)}
          </select>
          <select aria-label="Severity" className={selectCls} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s === "all" ? "All severities" : s.toUpperCase()}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full text-[13px]">
            <thead className="border-b text-left text-[11px] uppercase tracking-wide text-subtle-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Incident</th><th className="px-4 py-2.5 font-medium">Service</th><th className="px-4 py-2.5 font-medium">Severity</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Source</th><th className="px-4 py-2.5 font-medium">Detected</th></tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 4 }, (_, i) => <tr key={i} className="border-t"><td colSpan={6} className="p-3"><Skeleton className="h-5 w-full" /></td></tr>)}
              {error && <tr><td colSpan={6} className="p-6 text-center text-destructive">{(error as Error).message}</td></tr>}
              {data && data.incidents.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No incidents match. <Link to="/simulation" className="text-primary underline">Run a simulation</Link> to create one.</td></tr>
              )}
              {data?.incidents.map((i) => (
                <tr key={i.id} className="border-t transition-colors hover:bg-accent/40">
                  <td className="p-3"><Link to="/incidents/$incidentId" params={{ incidentId: i.id }} className="block"><span className="font-mono text-xs text-muted-foreground">{i.reference}</span><span className="block font-medium">{i.title}</span></Link></td>
                  <td className="p-3 font-mono text-xs">{i.services?.name ?? "—"}</td>
                  <td className="p-3"><SeverityBadge severity={i.severity} /></td>
                  <td className="p-3"><StatusPill status={i.status} /></td>
                  <td className="p-3"><SourceTag kind={i.source === "real" ? "real" : "simulated"} /></td>
                  <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(i.detected_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
