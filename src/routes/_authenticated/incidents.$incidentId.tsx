import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Brain, CheckCircle2, Circle, Play, ShieldCheck, XCircle } from "lucide-react";
import { AppShell, Panel, SeverityBadge, SourceTag, StatusPill } from "@/components/sentinel/AppShell";
import { decideRemediation, executeRemediation, getIncident, startInvestigation, updateIncident } from "@/lib/sentinel.functions";
import { can } from "@/lib/permissions";
import type { TelemetryPoint, Stage } from "@/lib/investigation-engine";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/incidents/$incidentId")({
  head: () => ({
    meta: [
      { title: "Incident detail — SENTINEL AI" },
      { name: "description", content: "Evidence, investigation, remediation and timeline for one incident." },
      { property: "og:title", content: "Incident detail — SENTINEL AI" },
      { property: "og:description", content: "Inspect an incident end to end." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IncidentDetail,
});

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 };
const axis = { stroke: "var(--muted-foreground)", fontSize: 10, tickLine: false, axisLine: false };
const selectCls = "h-8 rounded-md border bg-background px-2 text-xs disabled:opacity-60";

function IncidentDetail() {
  const { incidentId } = Route.useParams();
  const qc = useQueryClient();
  const fetchIncident = useServerFn(getIncident);
  const key = ["incident", incidentId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => fetchIncident({ data: { id: incidentId } }) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["incidents"] });
  };
  const onError = (e: unknown) => toast.error((e as Error).message);

  const update = useServerFn(updateIncident);
  const investigate = useServerFn(startInvestigation);
  const decide = useServerFn(decideRemediation);
  const execute = useServerFn(executeRemediation);

  const updM = useMutation({ mutationFn: (d: { id: string; status?: "open" | "investigating" | "awaiting_approval" | "remediating" | "monitoring" | "resolved" | "closed"; severity?: "sev1" | "sev2" | "sev3" | "sev4"; assigneeId?: string | null }) => update({ data: d }), onSuccess: () => { toast.success("Incident updated"); refresh(); }, onError });
  const invM = useMutation({ mutationFn: () => investigate({ data: { incidentId } }), onSuccess: () => { toast.success("Investigation complete — approval requested"); refresh(); }, onError });
  const decM = useMutation({ mutationFn: (d: { planId: string; decision: "approved" | "rejected"; comment?: string | undefined }) => decide({ data: d }), onSuccess: (_r, v) => { toast.success(v.decision === "approved" ? "Plan approved" : "Plan rejected"); refresh(); }, onError });
  const exeM = useMutation({ mutationFn: (planId: string) => execute({ data: { planId } }), onSuccess: (r) => { r.recovered ? toast.success("Recovery verified — incident resolved") : toast.error("Recovery not verified"); refresh(); }, onError });

  if (isLoading) return <AppShell title="Incident"><div className="space-y-3 p-6"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div></AppShell>;
  if (error) return <AppShell title="Incident"><p className="p-6 text-destructive">{(error as Error).message}</p></AppShell>;
  if (!data?.incident) return <AppShell title="Incident"><div className="p-6 text-muted-foreground">Incident not found. <Link to="/incidents" className="text-primary underline">Back to incidents</Link></div></AppShell>;

  const { incident: inc, role } = data;
  const canUpdate = can(role, "incident.update");
  const canInvestigate = can(role, "investigation.run");
  const canApprove = can(role, "remediation.approve");
  const canExecute = can(role, "remediation.execute");
  const inv = data.investigations[0];
  const plan = data.plans[0];
  const sim = (data.simulation?.telemetry ?? {}) as { points?: TelemetryPoint[]; detection?: { threshold: number } };
  const evidence = inv ? data.evidence.filter((e) => e.investigation_id === inv.id) : [];
  const observed = evidence.filter((e) => e.kind === "observed");
  const hypotheses = evidence.filter((e) => e.kind === "hypothesis");
  const memberName = (id: string | null) => { const m = data.members.find((x) => x.id === id); return m ? m.display_name || m.email || "Unknown" : "Unknown"; };
  const done = inc.status === "resolved" || inc.status === "closed";

  const lifecycle = [
    { label: "Detected", ok: true },
    { label: "Investigated", ok: !!inv },
    { label: "Plan approved", ok: !!plan && ["approved", "executing", "executed", "verified"].includes(plan.status) },
    { label: "Executed", ok: !!plan && ["executed", "verified", "failed"].includes(plan.status) },
    { label: "Recovery verified", ok: plan?.status === "verified" },
    { label: "Resolved", ok: done },
  ];

  return (
    <AppShell title={inc.title} subtitle={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{inc.reference}</span><SeverityBadge severity={inc.severity} /><StatusPill status={inc.status} /><span>{inc.description}</span></span>} banner={inc.source === "simulation" ? <div className="border-b border-warning/20 bg-warning/[0.06] px-4 py-1.5 text-center text-xs text-warning">Simulated incident — telemetry and remediation are simulated; investigation output is generated by the rule engine.</div> : undefined}>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/incidents" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" />All incidents</Link>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Severity" className={selectCls} disabled={!canUpdate || updM.isPending} value={inc.severity} onChange={(e) => updM.mutate({ id: inc.id, severity: e.target.value as "sev1" })}>
              {["sev1", "sev2", "sev3", "sev4"].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
            <select aria-label="Status" className={selectCls} disabled={!canUpdate || updM.isPending} value={inc.status} onChange={(e) => updM.mutate({ id: inc.id, status: e.target.value as "open" })}>
              {["open", "investigating", "awaiting_approval", "remediating", "monitoring", "resolved", "closed"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <select aria-label="Assignee" className={selectCls} disabled={!canUpdate || updM.isPending} value={inc.assignee_id ?? ""} onChange={(e) => updM.mutate({ id: inc.id, assigneeId: e.target.value || null })}>
              <option value="">Unassigned</option>
              {data.members.map((m) => <option key={m.id} value={m.id}>{m.display_name || m.email}</option>)}
            </select>
          </div>
        </div>
        {!canUpdate && <p className="text-xs text-muted-foreground">You have view-only access to this incident.</p>}

        <ol className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-6">
          {lifecycle.map((s) => (
            <li key={s.label} className="flex items-center gap-2 bg-background p-3 text-xs">
              {s.ok ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
              <span className={s.ok ? "" : "text-muted-foreground"}>{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="CPU during incident" sub={<SourceTag kind={inc.source === "real" ? "real" : "simulated"} />} className="xl:col-span-2">
            {sim.points?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={sim.points}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="i" {...axis} tickFormatter={(v) => `-${30 - Number(v)}m`} />
                  <YAxis {...axis} domain={[0, 100]} width={28} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {sim.detection && <ReferenceLine y={sim.detection.threshold} stroke="var(--destructive)" strokeDasharray="4 4" />}
                  <Area type="monotone" dataKey="cpu" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="py-10 text-center text-sm text-muted-foreground">No telemetry recorded for this incident.</p>}
          </Panel>
          <Panel title="Affected service">
            {inc.services ? (
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Name</dt><dd className="font-mono text-xs">{inc.services.name}</dd>
                <dt className="text-muted-foreground">Namespace</dt><dd>{inc.services.namespace}</dd>
                <dt className="text-muted-foreground">Replicas</dt><dd className="font-mono text-xs">{inc.services.ready_replicas}/{inc.services.replicas}</dd>
                <dt className="text-muted-foreground">Version</dt><dd className="font-mono text-xs">{inc.services.current_version}</dd>
                <dt className="text-muted-foreground">Status</dt><dd><StatusPill status={inc.services.status} /></dd>
              </dl>
            ) : <p className="text-sm text-muted-foreground">None linked.</p>}
          </Panel>
        </div>

        <Panel title="Investigation" sub={inv ? <SourceTag kind="ai" /> : undefined}>
          {!inv ? (
            <div className="flex flex-col items-start gap-3 py-2">
              <p className="text-sm text-muted-foreground">No investigation yet. The rule engine will collect evidence, rank root-cause hypotheses and propose a remediation.</p>
              <Button onClick={() => invM.mutate()} disabled={!canInvestigate || invM.isPending || done}><Brain className="size-4" />{invM.isPending ? "Investigating…" : "Run investigation"}</Button>
              {!canInvestigate && <p className="text-xs text-warning">Your role cannot run investigations.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <ol className="grid gap-2 md:grid-cols-3">
                {(inv.stages as Stage[]).map((s, i) => (
                  <li key={s.key} className="rounded-md border p-3 text-xs">
                    <div className="flex items-center gap-2 font-medium">{s.status === "done" || (s.key === "verify" && plan?.status === "verified") ? <CheckCircle2 className="size-3.5 text-success" /> : <Circle className="size-3.5 text-muted-foreground" />}{i + 1}. {s.label}</div>
                    <div className="mt-1 text-muted-foreground">{s.key === "verify" && plan?.verified_at ? `Checked after execution — ${plan.status}` : s.note}</div>
                  </li>
                ))}
              </ol>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="text-xs text-muted-foreground">Probable root cause · {Math.round(Number(inv.confidence) * 100)}% confidence · engine {inv.engine}</div>
                <div className="mt-1 font-medium">{inv.root_cause}</div>
                <p className="mt-1 text-sm text-muted-foreground">{inv.summary}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Observed evidence</h3>
                  <ul className="space-y-2">{observed.map((e) => <li key={e.id} className="rounded-md border p-2.5 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{e.title}</span><span className="font-mono text-[10px] uppercase text-muted-foreground">{e.source}</span></div><p className="text-xs text-muted-foreground">{e.detail}</p></li>)}</ul>
                </div>
                <div>
                  <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Generated hypotheses</h3>
                  <ul className="space-y-2">{hypotheses.map((e) => <li key={e.id} className="rounded-md border border-dashed p-2.5 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{e.title}</span><span className="font-mono text-xs text-primary">{Math.round(Number(e.weight) * 100)}%</span></div><p className="text-xs text-muted-foreground">{e.detail}</p></li>)}</ul>
                </div>
              </div>
            </div>
          )}
        </Panel>

        {plan && <PlanPanel plan={plan} approvals={data.approvals.filter((a) => a.plan_id === plan.id)} memberName={memberName} canApprove={canApprove} canExecute={canExecute} deciding={decM.isPending} executing={exeM.isPending} onDecide={(decision, comment) => decM.mutate({ planId: plan.id, decision, comment })} onExecute={() => exeM.mutate(plan.id)} />}

        <Panel title="Timeline & audit trail" sub={`${data.timeline.length} events`}>
          {data.timeline.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p> : (
            <ol className="relative space-y-3 border-l pl-4">
              {data.timeline.map((t) => (
                <li key={t.id} className="text-sm">
                  <span className={`absolute -left-[5px] mt-1.5 size-2.5 rounded-full ${t.actor_type === "agent" ? "bg-primary" : t.actor_type === "system" ? "bg-muted-foreground" : "bg-success"}`} />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-xs text-muted-foreground">{new Date(t.created_at).toLocaleTimeString()}</span>
                    <span className="text-xs font-medium text-foreground">{t.actor_type === "agent" ? `${t.agent} agent` : t.actor_type === "system" ? "System" : memberName(t.actor_id)}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{t.action}</span>
                  </div>
                  <div>{t.message}</div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

type PlanRow = { id: string; title: string; action: string; risk: string; rationale: string | null; steps: unknown; status: string; execution_log: unknown; verification: unknown };
type ApprovalRow = { id: string; decision: string; comment: string | null; decided_by: string; created_at: string };

function PlanPanel({ plan, approvals, memberName, canApprove, canExecute, deciding, executing, onDecide, onExecute }: {
  plan: PlanRow; approvals: ApprovalRow[]; memberName: (id: string | null) => string; canApprove: boolean; canExecute: boolean; deciding: boolean; executing: boolean;
  onDecide: (d: "approved" | "rejected", comment?: string) => void; onExecute: () => void;
}) {
  const [comment, setComment] = useState("");
  const steps = (Array.isArray(plan.steps) ? plan.steps : []) as string[];
  const log = (Array.isArray(plan.execution_log) ? plan.execution_log : []) as { step: string; result: string }[];
  const ver = plan.verification as { recovered: boolean; avgCpu: number; maxErrors: number } | null;
  return (
    <Panel title="Remediation plan" sub={<StatusPill status={plan.status} />}>
      <div className="space-y-4">
        <div>
          <div className="font-medium">{plan.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Action <span className="font-mono">{plan.action}</span> · risk <span className="font-mono">{plan.risk}</span> · {plan.rationale}</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 font-mono text-xs">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        {plan.status === "pending_approval" && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-warning"><ShieldCheck className="size-4" />Human approval required</div>
            {canApprove ? (
              <>
                <Textarea placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => onDecide("approved", comment)} disabled={deciding}><CheckCircle2 className="size-4" />Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => onDecide("rejected", comment)} disabled={deciding}><XCircle className="size-4" />Reject</Button>
                </div>
              </>
            ) : <p className="text-xs text-muted-foreground">Only Administrators and SRE Engineers can approve remediation.</p>}
          </div>
        )}
        {approvals.map((a) => <p key={a.id} className="text-xs text-muted-foreground"><span className={a.decision === "approved" ? "text-success" : "text-destructive"}>{a.decision}</span> by {memberName(a.decided_by)} · {new Date(a.created_at).toLocaleString()}{a.comment ? ` — “${a.comment}”` : ""}</p>)}
        {plan.status === "approved" && (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onExecute} disabled={!canExecute || executing}><Play className="size-4" />{executing ? "Executing…" : "Execute simulated remediation"}</Button>
            {!canExecute && <span className="text-xs text-warning">Your role cannot execute remediation.</span>}
          </div>
        )}
        {log.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Execution log</h3>
            <ul className="space-y-1 font-mono text-xs">{log.map((l, i) => <li key={i}><span className="text-success">✓</span> {l.step} <span className="text-muted-foreground">— {l.result}</span></li>)}</ul>
          </div>
        )}
        {ver && (
          <div className={`rounded-md border p-3 text-sm ${ver.recovered ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="font-medium">{ver.recovered ? "Recovery verified" : "Recovery not verified"}</div>
            <div className="text-xs text-muted-foreground">Average CPU {ver.avgCpu}% (target &lt; 70%) · max error rate {ver.maxErrors}% (target &lt; 1%) · simulated post-remediation telemetry</div>
          </div>
        )}
      </div>
    </Panel>
  );
}
