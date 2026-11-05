import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { can, isRole, type Permission, type Role } from "./permissions";
import {
  detectAnomaly,
  generateCpuSpike,
  ruleBasedProvider,
  simulateRecovery,
  type TelemetryPoint,
} from "./investigation-engine";

type DB = SupabaseClient<Database>;
const json = (v: unknown) => v as Json;

async function getActor(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not load your role");
  if (!data || !isRole(data.role)) throw new Error("Your account has no role in an organization");
  return { userId, role: data.role as Role, orgId: data.organization_id };
}

function requirePerm(role: Role, permission: Permission) {
  if (!can(role, permission)) throw new Error(`Forbidden: your role cannot perform ${permission}`);
}

function check<R extends { data: unknown; error: { message: string } | null }>(res: R, what: string): NonNullable<R["data"]> {
  if (res.error || res.data === null) {
    console.error(what, res.error);
    throw new Error(`Failed to ${what}`);
  }
  return res.data as NonNullable<R["data"]>;
}

type AuditRow = {
  incident_id?: string | null;
  actor_type: "user" | "agent" | "system";
  agent?: string;
  action: string;
  message: string;
  details?: unknown;
};

async function audit(supabase: DB, actor: { userId: string; orgId: string }, rows: AuditRow[]) {
  const { error } = await supabase.from("audit_logs").insert(
    rows.map((r) => ({
      organization_id: actor.orgId,
      incident_id: r.incident_id ?? null,
      actor_id: actor.userId,
      actor_type: r.actor_type,
      agent: r.agent ?? null,
      action: r.action,
      message: r.message,
      details: json(r.details ?? {}),
    })),
  );
  if (error) {
    console.error("audit", error);
    throw new Error("Failed to write audit log");
  }
}

// ---------- Session / profile ----------

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const actor = await getActor(supabase, userId);
    const [profile, org, workspaces] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name, job_title").eq("id", userId).single(),
      supabase.from("organizations").select("id, name, join_code").eq("id", actor.orgId).single(),
      supabase.from("workspaces").select("id, name, environment").order("created_at"),
    ]);
    const isAdmin = actor.role === "admin";
    const o = check(org, "load organization");
    return {
      role: actor.role,
      profile: check(profile, "load profile"),
      organization: { id: o.id, name: o.name, join_code: isAdmin ? o.join_code : null },
      workspaces: workspaces.data ?? [],
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ display_name: z.string().trim().max(80), job_title: z.string().trim().max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.display_name || null, job_title: data.job_title || null })
      .eq("id", context.userId);
    if (error) throw new Error("Failed to update profile");
    return { ok: true };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await getActor(supabase, userId);
    const [profiles, roles] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name, job_title").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleOf = new Map((roles.data ?? []).map((r) => [r.user_id, r.role]));
    return (profiles.data ?? []).map((p) => ({ ...p, role: (roleOf.get(p.id) ?? "viewer") as Role }));
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "sre", "security_analyst", "viewer"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.supabase, context.userId);
    requirePerm(actor.role, "members.manage");
    if (data.userId === actor.userId && data.role !== "admin") {
      const { count } = await context.supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("You are the only administrator; promote someone else first");
    }
    const { data: updated, error } = await context.supabase
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", data.userId)
      .select("user_id");
    if (error || !updated?.length) throw new Error("Failed to change role");
    await audit(context.supabase, actor, [
      { actor_type: "user", action: "member.role_changed", message: `Changed role to ${data.role}`, details: data },
    ]);
    return { ok: true };
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.supabase, context.userId);
    requirePerm(actor.role, "workspace.manage");
    const { error } = await context.supabase.from("organizations").update({ name: data.name }).eq("id", actor.orgId);
    if (error) throw new Error("Failed to rename organization");
    return { ok: true };
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ name: z.string().trim().min(1).max(120), environment: z.enum(["production", "staging", "development"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.supabase, context.userId);
    requirePerm(actor.role, "workspace.manage");
    const { error } = await context.supabase
      .from("workspaces")
      .insert({ organization_id: actor.orgId, name: data.name, environment: data.environment });
    if (error) throw new Error("Failed to create workspace");
    await audit(context.supabase, actor, [
      { actor_type: "user", action: "workspace.created", message: `Created workspace ${data.name}` },
    ]);
    return { ok: true };
  });

// ---------- Overview (Command Center) ----------

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await getActor(supabase, userId);
    const [incidents, audits, services] = await Promise.all([
      supabase
        .from("incidents")
        .select("id, reference, title, severity, status, source, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("audit_logs")
        .select("id, agent, actor_type, message, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("services").select("id, status"),
    ]);
    const all = incidents.data ?? [];
    const { count: active } = await supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(resolved,closed)");
    return {
      recentIncidents: all,
      activeIncidents: active ?? 0,
      activity: audits.data ?? [],
      serviceCount: services.data?.length ?? 0,
    };
  });

// ---------- Incidents ----------

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().max(40).optional(),
  severity: z.string().max(10).optional(),
});

export const listIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const actor = await getActor(supabase, userId);
    let q = supabase
      .from("incidents")
      .select("id, reference, title, severity, status, source, assignee_id, detected_at, created_at, services(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.severity && data.severity !== "all") q = q.eq("severity", data.severity);
    if (data.q) {
      const term = data.q.replace(/[%,()]/g, " ");
      q = q.or(`title.ilike.%${term}%,reference.ilike.%${term}%`);
    }
    const res = await q;
    if (res.error) throw new Error("Failed to load incidents");
    return { incidents: res.data, role: actor.role };
  });

export const getIncident = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const actor = await getActor(supabase, userId);
    const incident = await supabase
      .from("incidents")
      .select("*, services(id, name, namespace, replicas, ready_replicas, current_version, status)")
      .eq("id", data.id)
      .maybeSingle();
    if (incident.error) throw new Error("Failed to load incident");
    if (!incident.data) return { incident: null, role: actor.role } as const;

    const [investigations, plans, timeline, sims, members] = await Promise.all([
      supabase.from("investigations").select("*").eq("incident_id", data.id).order("started_at", { ascending: false }),
      supabase.from("remediation_plans").select("*").eq("incident_id", data.id).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").eq("incident_id", data.id).order("created_at"),
      supabase.from("simulation_runs").select("id, scenario, telemetry, created_at").eq("incident_id", data.id).limit(1),
      supabase.from("profiles").select("id, email, display_name"),
    ]);
    const invIds = (investigations.data ?? []).map((i) => i.id);
    const planIds = (plans.data ?? []).map((p) => p.id);
    const [evidence, approvals] = await Promise.all([
      invIds.length
        ? supabase.from("investigation_evidence").select("*").in("investigation_id", invIds).order("weight", { ascending: false })
        : Promise.resolve({ data: [] as Database["public"]["Tables"]["investigation_evidence"]["Row"][] }),
      planIds.length
        ? supabase.from("remediation_approvals").select("*").in("plan_id", planIds).order("created_at")
        : Promise.resolve({ data: [] as Database["public"]["Tables"]["remediation_approvals"]["Row"][] }),
    ]);
    return {
      role: actor.role,
      incident: incident.data,
      investigations: investigations.data ?? [],
      evidence: evidence.data ?? [],
      plans: plans.data ?? [],
      approvals: approvals.data ?? [],
      timeline: timeline.data ?? [],
      simulation: sims.data?.[0] ?? null,
      members: members.data ?? [],
    };
  });

export const updateIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "investigating", "awaiting_approval", "remediating", "monitoring", "resolved", "closed"]).optional(),
        severity: z.enum(["sev1", "sev2", "sev3", "sev4"]).optional(),
        assigneeId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.supabase, context.userId);
    requirePerm(actor.role, "incident.update");
    const patch: Database["public"]["Tables"]["incidents"]["Update"] = {};
    const changes: string[] = [];
    if (data.status) {
      patch.status = data.status;
      patch.resolved_at = data.status === "resolved" || data.status === "closed" ? new Date().toISOString() : null;
      changes.push(`status → ${data.status}`);
    }
    if (data.severity) {
      patch.severity = data.severity;
      changes.push(`severity → ${data.severity}`);
    }
    if (data.assigneeId !== undefined) {
      patch.assignee_id = data.assigneeId;
      changes.push(data.assigneeId ? "assignee changed" : "unassigned");
    }
    if (!changes.length) return { ok: true };
    const { data: rows, error } = await context.supabase.from("incidents").update(patch).eq("id", data.id).select("id");
    if (error || !rows?.length) throw new Error("Failed to update incident");
    await audit(context.supabase, actor, [
      { incident_id: data.id, actor_type: "user", action: "incident.updated", message: `Updated ${changes.join(", ")}`, details: data },
    ]);
    return { ok: true };
  });

// ---------- Lifecycle: simulate → detect → incident ----------

export const runCpuSpikeSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ serviceId: z.string().uuid().optional(), cause: z.enum(["bad_deploy", "traffic_surge", "random"]).default("random") })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const actor = await getActor(supabase, context.userId);
    requirePerm(actor.role, "simulation.run");

    let svcQuery = supabase.from("services").select("*").limit(1);
    svcQuery = data.serviceId ? svcQuery.eq("id", data.serviceId) : svcQuery.eq("name", "checkout-svc");
    let svc = (await svcQuery).data?.[0];
    if (!svc) svc = (await supabase.from("services").select("*").limit(1)).data?.[0];
    if (!svc) throw new Error("No services exist in this organization");

    const scenario = generateCpuSpike({
      baseline: Number(svc.cpu_baseline),
      seed: Date.now() % 100000,
      currentVersion: svc.current_version ?? "v1.0.1",
      previousVersion: svc.previous_version ?? "v1.0.0",
      cause: data.cause === "random" ? undefined : data.cause,
    });
    const detection = detectAnomaly(scenario.telemetry);

    const run = check(
      await supabase
        .from("simulation_runs")
        .insert({
          organization_id: actor.orgId,
          service_id: svc.id,
          scenario: "cpu_spike",
          status: "running",
          telemetry: json({ points: scenario.telemetry, deploy: scenario.deploy, cause: scenario.cause, detection }),
          created_by: actor.userId,
        })
        .select("id")
        .single(),
      "start simulation",
    );

    if (!detection.detected) {
      await supabase.from("simulation_runs").update({ status: "no_anomaly", completed_at: new Date().toISOString() }).eq("id", run.id);
      return { incidentId: null, detection };
    }

    const incident = check(
      await supabase
        .from("incidents")
        .insert({
          organization_id: actor.orgId,
          workspace_id: svc.workspace_id,
          service_id: svc.id,
          title: `CPU spike on ${svc.name} (${detection.peakCpu}%)`,
          description: `Simulated CPU anomaly detected on ${svc.name}: ${detection.peakCpu}% vs threshold ${detection.threshold}%.`,
          severity: detection.severity,
          status: "open",
          source: "simulation",
          created_by: actor.userId,
        })
        .select("id, reference")
        .single(),
      "create incident",
    );
    await supabase.from("simulation_runs").update({ status: "detected", incident_id: incident.id }).eq("id", run.id);
    await supabase.from("services").update({ status: "degraded" }).eq("id", svc.id);
    await audit(supabase, actor, [
      { incident_id: incident.id, actor_type: "user", action: "simulation.started", message: `Started simulated CPU spike on ${svc.name}`, details: { runId: run.id } },
      { incident_id: incident.id, actor_type: "agent", agent: "Anomaly", action: "anomaly.detected", message: `CPU ${detection.peakCpu}% exceeded threshold ${detection.threshold}% (z=${detection.zScore})`, details: detection },
      { incident_id: incident.id, actor_type: "system", action: "incident.created", message: `Opened ${incident.reference} as ${detection.severity}` },
    ]);
    return { incidentId: incident.id, detection };
  });

// ---------- Lifecycle: investigate → plan → request approval ----------

export const startInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ incidentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const actor = await getActor(supabase, context.userId);
    requirePerm(actor.role, "investigation.run");

    const incident = check(
      await supabase.from("incidents").select("*, services(*)").eq("id", data.incidentId).maybeSingle(),
      "load incident",
    );
    if (incident.status === "resolved" || incident.status === "closed") throw new Error("Incident is already resolved");
    const svc = incident.services;
    if (!svc) throw new Error("Incident has no affected service to investigate");

    const sim = (await supabase.from("simulation_runs").select("telemetry").eq("incident_id", incident.id).limit(1)).data?.[0];
    const simData = (sim?.telemetry ?? {}) as { points?: TelemetryPoint[]; deploy?: { version: string; previous: string; atIndex: number } | null };
    if (!simData.points?.length) throw new Error("No telemetry available for this incident");
    const sec = (
      await supabase
        .from("security_events")
        .select("event_type, severity, description")
        .eq("service_id", svc.id)
        .order("created_at", { ascending: false })
        .limit(5)
    ).data ?? [];

    await supabase.from("incidents").update({ status: "investigating" }).eq("id", incident.id);
    const result = ruleBasedProvider.analyze({
      service: { name: svc.name, replicas: svc.replicas, currentVersion: svc.current_version, previousVersion: svc.previous_version },
      telemetry: simData.points,
      detection: detectAnomaly(simData.points),
      deploy: simData.deploy ?? null,
      securityEvents: sec,
    });

    const inv = check(
      await supabase
        .from("investigations")
        .insert({
          organization_id: actor.orgId,
          incident_id: incident.id,
          status: "completed",
          engine: result.engine,
          stages: json(result.stages),
          root_cause: result.rootCause,
          confidence: result.confidence,
          summary: result.summary,
          started_by: actor.userId,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
      "save investigation",
    );
    const ev = await supabase.from("investigation_evidence").insert(
      result.evidence.map((e) => ({
        organization_id: actor.orgId,
        investigation_id: inv.id,
        kind: e.kind,
        source: e.source,
        title: e.title,
        detail: e.detail,
        weight: e.weight,
        data: json(e.data ?? {}),
      })),
    );
    if (ev.error) throw new Error("Failed to save evidence");
    const plan = check(
      await supabase
        .from("remediation_plans")
        .insert({
          organization_id: actor.orgId,
          incident_id: incident.id,
          investigation_id: inv.id,
          title: result.plan.title,
          action: result.plan.action,
          risk: result.plan.risk,
          rationale: result.plan.rationale,
          steps: json(result.plan.steps),
          status: "pending_approval",
        })
        .select("id")
        .single(),
      "save remediation plan",
    );
    await supabase.from("incidents").update({ status: "awaiting_approval" }).eq("id", incident.id);
    const observed = result.evidence.filter((e) => e.kind === "observed").length;
    await audit(supabase, actor, [
      { incident_id: incident.id, actor_type: "user", action: "investigation.started", message: "Started investigation" },
      { incident_id: incident.id, actor_type: "agent", agent: "Monitoring", action: "evidence.collected", message: `Collected ${observed} observed signals` },
      { incident_id: incident.id, actor_type: "agent", agent: "RCA", action: "root_cause.hypothesized", message: `Probable root cause: ${result.rootCause} (${Math.round(result.confidence * 100)}% confidence)` },
      { incident_id: incident.id, actor_type: "agent", agent: "Remediation", action: "remediation.proposed", message: `Proposed: ${result.plan.title} (risk ${result.plan.risk}) — awaiting human approval`, details: { planId: plan.id } },
    ]);
    return { investigationId: inv.id, planId: plan.id };
  });

// ---------- Lifecycle: approve → execute → verify ----------

export const decideRemediation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ planId: z.string().uuid(), decision: z.enum(["approved", "rejected"]), comment: z.string().trim().max(1000).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const actor = await getActor(supabase, context.userId);
    requirePerm(actor.role, "remediation.approve");
    const plan = check(await supabase.from("remediation_plans").select("id, incident_id, status, title").eq("id", data.planId).maybeSingle(), "load plan");
    if (plan.status !== "pending_approval") throw new Error("This plan is no longer awaiting approval");
    const ins = await supabase.from("remediation_approvals").insert({
      organization_id: actor.orgId,
      plan_id: plan.id,
      decision: data.decision,
      comment: data.comment || null,
      decided_by: actor.userId,
    });
    if (ins.error) throw new Error("Failed to record decision");
    await supabase.from("remediation_plans").update({ status: data.decision }).eq("id", plan.id);
    if (data.decision === "rejected") await supabase.from("incidents").update({ status: "open" }).eq("id", plan.incident_id);
    await audit(supabase, actor, [
      { incident_id: plan.incident_id, actor_type: "user", action: `remediation.${data.decision}`, message: `${data.decision === "approved" ? "Approved" : "Rejected"}: ${plan.title}${data.comment ? ` — “${data.comment}”` : ""}` },
    ]);
    return { ok: true };
  });

export const executeRemediation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const actor = await getActor(supabase, context.userId);
    requirePerm(actor.role, "remediation.execute");
    const plan = check(await supabase.from("remediation_plans").select("*").eq("id", data.planId).maybeSingle(), "load plan");
    if (plan.status !== "approved") throw new Error("Only approved plans can be executed");
    const incident = check(await supabase.from("incidents").select("id, service_id, reference").eq("id", plan.incident_id).single(), "load incident");
    const svc = incident.service_id
      ? (await supabase.from("services").select("*").eq("id", incident.service_id).single()).data
      : null;

    await supabase.from("remediation_plans").update({ status: "executing" }).eq("id", plan.id);
    await supabase.from("incidents").update({ status: "remediating" }).eq("id", incident.id);

    const steps = (Array.isArray(plan.steps) ? plan.steps : []) as string[];
    const t0 = Date.now();
    const log = steps.map((s, k) => ({ step: s, result: "ok (simulated — no real infrastructure touched)", at: new Date(t0 + k * 4000).toISOString() }));
    const recovery = simulateRecovery(Number(svc?.cpu_baseline ?? 45), t0 % 100000);
    const verifiedAt = new Date().toISOString();
    const finalStatus = recovery.recovered ? "verified" : "failed";

    await supabase
      .from("remediation_plans")
      .update({
        status: finalStatus,
        execution_log: json(log),
        verification: json(recovery),
        executed_by: actor.userId,
        executed_at: new Date(t0).toISOString(),
        verified_at: verifiedAt,
      })
      .eq("id", plan.id);
    if (svc) {
      const svcPatch: Database["public"]["Tables"]["services"]["Update"] = { status: recovery.recovered ? "healthy" : "degraded" };
      if (plan.action === "rollback" && svc.previous_version) {
        svcPatch.current_version = svc.previous_version;
        svcPatch.previous_version = svc.current_version;
      }
      if (plan.action === "scale_out") {
        const target = Math.min(svc.replicas * 2, svc.replicas + 6);
        svcPatch.replicas = target;
        svcPatch.ready_replicas = target;
      }
      await supabase.from("services").update(svcPatch).eq("id", svc.id);
    }
    await supabase
      .from("incidents")
      .update(recovery.recovered ? { status: "resolved", resolved_at: verifiedAt } : { status: "open" })
      .eq("id", incident.id);
    await supabase.from("simulation_runs").update({ status: "completed", completed_at: verifiedAt }).eq("incident_id", incident.id);

    await audit(supabase, actor, [
      { incident_id: incident.id, actor_type: "user", action: "remediation.executed", message: `Executed: ${plan.title} (simulated)`, details: { log } },
      {
        incident_id: incident.id,
        actor_type: "agent",
        agent: "Verification",
        action: recovery.recovered ? "recovery.verified" : "recovery.failed",
        message: recovery.recovered
          ? `Recovery verified: avg CPU ${recovery.avgCpu}%, max error rate ${recovery.maxErrors}%`
          : `Recovery NOT verified: avg CPU ${recovery.avgCpu}%`,
        details: recovery,
      },
      { incident_id: incident.id, actor_type: "system", action: recovery.recovered ? "incident.resolved" : "incident.reopened", message: recovery.recovered ? `${incident.reference} resolved` : `${incident.reference} reopened` },
    ]);
    return { recovered: recovery.recovered };
  });
