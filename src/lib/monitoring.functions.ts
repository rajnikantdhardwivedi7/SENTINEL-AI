import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { can, isRole, type Permission } from "./permissions";
import { DEFAULT_QUERIES, METRIC_KEYS, resolveQueries, resolveThresholds, thresholdsSchema, validatePrometheusUrl } from "./monitoring";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string };

async function authorize(ctx: Ctx, perm: Permission) {
  const { data } = await ctx.supabase.from("user_roles").select("role, organization_id").eq("user_id", ctx.userId).maybeSingle();
  if (!data || !isRole(data.role)) throw new Error("Your account has no role in an organization");
  if (!can(data.role, perm)) throw new Error(`Forbidden: your role cannot perform ${perm}`);
  return { orgId: data.organization_id, role: data.role };
}

/** Connection (no secret), latest snapshots and alert states. Readable by every org member via RLS. */
export const getMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: conn } = await supabase.from("monitoring_connections").select("*").maybeSingle();
    if (!conn) return { connection: null, snapshots: [], alerts: [], defaults: { queries: DEFAULT_QUERIES, thresholds: resolveThresholds({}) } };
    const { data: snaps } = await supabase
      .from("metric_snapshots")
      .select("id, ok, captured_at, metrics, targets, errors, source")
      .eq("connection_id", conn.id)
      .order("captured_at", { ascending: false })
      .limit(60);
    const { data: alerts } = await supabase.from("alert_states").select("fingerprint, rule, last_value, last_fired_at, incident_id, suppressed_count").eq("connection_id", conn.id);
    return {
      connection: { ...conn, queries: resolveQueries(conn.queries), thresholds: resolveThresholds(conn.thresholds) },
      snapshots: (snaps ?? []).reverse(),
      alerts: alerts ?? [],
      defaults: { queries: DEFAULT_QUERIES, thresholds: resolveThresholds({}) },
    };
  });

const saveSchema = z.object({
  baseUrl: z.string().trim().min(8).max(500),
  authType: z.enum(["none", "bearer", "basic"]),
  /** undefined = keep existing credential; "" = clear. */
  credential: z.string().max(4000).optional(),
  queries: z.record(z.enum(METRIC_KEYS as [string, ...string[]]), z.string().trim().max(2000)).optional(),
  thresholds: thresholdsSchema.optional(),
  cooldownMinutes: z.number().int().min(1).max(1440).optional(),
  enabled: z.boolean().optional(),
});

export const saveMonitoringConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { orgId } = await authorize(context, "monitoring.manage");
    const url = validatePrometheusUrl(data.baseUrl);
    if (!url.ok) throw new Error(url.error);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = (await supabaseAdmin.from("monitoring_connections").select("id, has_credential").eq("organization_id", orgId).maybeSingle()).data;
    const hasCred = data.authType === "none" ? false : data.credential !== undefined ? data.credential.length > 0 : !!existing?.has_credential;
    if (data.authType !== "none" && !hasCred) throw new Error("A credential is required for this authentication type");
    if (data.authType === "basic" && data.credential && !data.credential.includes(":")) throw new Error("Basic credentials must be in the form username:password");
    const row = {
      organization_id: orgId,
      base_url: url.url,
      auth_type: data.authType,
      has_credential: hasCred,
      ...(data.queries ? { queries: data.queries as Json } : {}),
      ...(data.thresholds ? { thresholds: data.thresholds as Json } : {}),
      ...(data.cooldownMinutes ? { cooldown_minutes: data.cooldownMinutes } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      status: "unknown",
      last_error: null,
      created_by: context.userId,
    };
    const { data: saved, error } = await supabaseAdmin.from("monitoring_connections").upsert(row, { onConflict: "organization_id" }).select("id").single();
    if (error || !saved) throw new Error("Failed to save connection");
    if (data.authType === "none" || data.credential === "") {
      await supabaseAdmin.from("monitoring_credentials").delete().eq("connection_id", saved.id);
    } else if (data.credential) {
      const { error: ce } = await supabaseAdmin.from("monitoring_credentials").upsert({ connection_id: saved.id, organization_id: orgId, secret: data.credential, updated_at: new Date().toISOString() });
      if (ce) throw new Error("Failed to store credential");
    }
    await supabaseAdmin.from("audit_logs").insert({
      organization_id: orgId,
      actor_id: context.userId,
      actor_type: "user",
      action: "monitoring.configured",
      message: `Configured Prometheus connection ${url.url} (auth: ${data.authType}${data.credential !== undefined ? ", credential updated" : ""})`,
      details: { baseUrl: url.url, authType: data.authType, thresholds: data.thresholds ?? null } as Json,
    });
    return { ok: true };
  });

export const testMonitoringConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await authorize(context, "monitoring.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { testPrometheus, loadAuth } = await import("./prometheus.server");
    const conn = (await supabaseAdmin.from("monitoring_connections").select("*").eq("organization_id", orgId).maybeSingle()).data;
    if (!conn) throw new Error("No Prometheus connection configured");
    const now = new Date().toISOString();
    try {
      const r = await testPrometheus(conn.base_url, await loadAuth(supabaseAdmin, conn));
      await supabaseAdmin.from("monitoring_connections").update({ status: "connected", last_checked_at: now, last_success_at: now, last_error: null }).eq("id", conn.id);
      return { ok: true as const, ...r };
    } catch (e) {
      const msg = (e as Error).message;
      await supabaseAdmin.from("monitoring_connections").update({ status: "error", last_checked_at: now, last_error: msg }).eq("id", conn.id);
      return { ok: false as const, error: msg };
    }
  });

export const scrapeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await authorize(context, "monitoring.scrape");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runScrape } = await import("./prometheus.server");
    const conn = (await supabaseAdmin.from("monitoring_connections").select("*").eq("organization_id", orgId).maybeSingle()).data;
    if (!conn) throw new Error("No Prometheus connection configured");
    if (!conn.enabled) throw new Error("Monitoring is paused for this connection");
    return runScrape(supabaseAdmin, conn, context.userId);
  });
