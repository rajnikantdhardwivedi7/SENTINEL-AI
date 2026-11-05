// Server-only Prometheus client + scrape pipeline. Never import from client code.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  availability,
  evaluateRules,
  inCooldown,
  METRIC_KEYS,
  parseInstantQuery,
  parseTargets,
  resolveQueries,
  resolveThresholds,
  validatePrometheusUrl,
  type MetricKey,
  type MetricReading,
  type TargetHealth,
} from "./monitoring";

type Admin = SupabaseClient<Database>;
type Conn = Database["public"]["Tables"]["monitoring_connections"]["Row"];

export type PromAuth = { type: "none" | "bearer" | "basic"; secret: string | null };

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2; // 1 retry, only on network errors / 5xx

export class PromError extends Error {
  constructor(message: string, public kind: "auth" | "unreachable" | "http" | "malformed" | "config") {
    super(message);
  }
}

async function promGet(baseUrl: string, path: string, auth: PromAuth): Promise<unknown> {
  const safe = validatePrometheusUrl(baseUrl);
  if (!safe.ok) throw new PromError(safe.error, "config");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth.type === "bearer" && auth.secret) headers["Authorization"] = `Bearer ${auth.secret}`;
  if (auth.type === "basic" && auth.secret) headers["Authorization"] = `Basic ${btoa(auth.secret)}`;
  let last: PromError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${safe.url}${path}`, { headers, signal: ctl.signal, redirect: "error" });
      if (res.status === 401 || res.status === 403) throw new PromError("Prometheus rejected the credentials (HTTP " + res.status + ")", "auth");
      if (res.status >= 500) {
        last = new PromError(`Prometheus returned HTTP ${res.status}`, "http");
        continue;
      }
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new PromError(`Response is not JSON (HTTP ${res.status}) — is this a Prometheus URL?`, "malformed");
      }
      if (!res.ok) {
        const msg = (body as { error?: string })?.error;
        throw new PromError(`Prometheus error (HTTP ${res.status})${msg ? `: ${String(msg).slice(0, 200)}` : ""}`, "http");
      }
      return body;
    } catch (e) {
      if (e instanceof PromError) throw e;
      last = new PromError(ctl.signal.aborted ? `Timed out after ${TIMEOUT_MS / 1000}s` : "Could not reach Prometheus", "unreachable");
    } finally {
      clearTimeout(timer);
    }
  }
  throw last ?? new PromError("Could not reach Prometheus", "unreachable");
}

export async function testPrometheus(baseUrl: string, auth: PromAuth) {
  const body = await promGet(baseUrl, "/api/v1/query?query=" + encodeURIComponent("up"), auth);
  const r = parseInstantQuery(body);
  if (r.error && r.error.startsWith("Malformed")) throw new PromError("Endpoint did not return a Prometheus query response", "malformed");
  const t = parseTargets(await promGet(baseUrl, "/api/v1/targets?state=active", auth));
  return { targets: t.targets.length, up: t.targets.filter((x) => x.health === "up").length };
}

export type ScrapeResult = {
  ok: boolean;
  metrics: Partial<Record<MetricKey, MetricReading>>;
  targets: TargetHealth[];
  availability: number | null;
  errors: string[];
};

export async function scrapePrometheus(conn: Pick<Conn, "base_url" | "queries">, auth: PromAuth): Promise<ScrapeResult> {
  const queries = resolveQueries(conn.queries);
  const errors: string[] = [];
  const metrics: Partial<Record<MetricKey, MetricReading>> = {};
  // Probe connectivity once; auth/unreachable errors fail the whole scrape.
  const tBody = await promGet(conn.base_url, "/api/v1/targets?state=active", auth);
  const t = parseTargets(tBody);
  if (t.error) errors.push(`targets: ${t.error}`);
  await Promise.all(
    METRIC_KEYS.map(async (k) => {
      try {
        const r = parseInstantQuery(await promGet(conn.base_url, "/api/v1/query?query=" + encodeURIComponent(queries[k]), auth));
        metrics[k] = r;
        if (r.error) errors.push(`${k}: ${r.error}`);
      } catch (e) {
        metrics[k] = { value: null, at: null, error: (e as Error).message };
        errors.push(`${k}: ${(e as Error).message}`);
      }
    }),
  );
  return { ok: true, metrics, targets: t.targets, availability: availability(t.targets), errors };
}

export async function loadAuth(admin: Admin, conn: Pick<Conn, "id" | "auth_type">): Promise<PromAuth> {
  if (conn.auth_type === "none") return { type: "none", secret: null };
  const { data } = await admin.from("monitoring_credentials").select("secret").eq("connection_id", conn.id).maybeSingle();
  return { type: conn.auth_type as PromAuth["type"], secret: data?.secret ?? null };
}

/** Full pipeline: scrape → store snapshot → evaluate rules → dedup → create incidents → audit. Uses the admin client; callers must authorize first. */
export async function runScrape(admin: Admin, conn: Conn, actorId: string | null) {
  const now = new Date();
  let result: ScrapeResult;
  try {
    result = await scrapePrometheus(conn, await loadAuth(admin, conn));
  } catch (e) {
    const msg = (e as Error).message;
    await admin.from("metric_snapshots").insert({ organization_id: conn.organization_id, connection_id: conn.id, source: "real", ok: false, errors: [msg] as Json });
    await admin.from("monitoring_connections").update({ status: "error", last_checked_at: now.toISOString(), last_error: msg }).eq("id", conn.id);
    return { ok: false as const, error: msg, created: [] as string[], suppressed: 0 };
  }

  const metricsJson = { ...result.metrics, availability: { value: result.availability, at: now.toISOString() } };
  await admin.from("metric_snapshots").insert({
    organization_id: conn.organization_id,
    connection_id: conn.id,
    source: "real",
    ok: true,
    metrics: metricsJson as unknown as Json,
    targets: result.targets as unknown as Json,
    errors: result.errors as Json,
  });
  await admin
    .from("monitoring_connections")
    .update({ status: "connected", last_checked_at: now.toISOString(), last_success_at: now.toISOString(), last_error: result.errors.length ? result.errors.join("; ").slice(0, 500) : null })
    .eq("id", conn.id);

  const violations = evaluateRules(result.metrics, result.targets, resolveThresholds(conn.thresholds));
  const created: string[] = [];
  let suppressed = 0;
  if (!violations.length) return { ok: true as const, created, suppressed, errors: result.errors };

  const ws = (await admin.from("workspaces").select("id").eq("organization_id", conn.organization_id).order("created_at").limit(1)).data?.[0];
  const { data: states } = await admin.from("alert_states").select("*").eq("connection_id", conn.id);
  for (const v of violations) {
    const st = states?.find((s) => s.fingerprint === v.fingerprint);
    if (st && inCooldown(st.last_fired_at, conn.cooldown_minutes, now)) {
      await admin.from("alert_states").update({ suppressed_count: st.suppressed_count + 1, last_value: v.value }).eq("id", st.id);
      suppressed++;
      continue;
    }
    if (!ws) break;
    const { data: inc, error } = await admin
      .from("incidents")
      .insert({
        organization_id: conn.organization_id,
        workspace_id: ws.id,
        title: v.title.slice(0, 200),
        description: `Real Prometheus alert (${v.rule}) from ${conn.base_url}: value ${v.value} vs threshold ${v.threshold}.`,
        severity: v.severity,
        status: "open",
        source: "real",
        created_by: actorId,
      })
      .select("id, reference")
      .single();
    if (error || !inc) continue;
    created.push(inc.id);
    await admin
      .from("alert_states")
      .upsert({ organization_id: conn.organization_id, connection_id: conn.id, fingerprint: v.fingerprint, rule: v.rule, last_value: v.value, last_fired_at: now.toISOString(), incident_id: inc.id, suppressed_count: 0 }, { onConflict: "connection_id,fingerprint" });
    await admin.from("audit_logs").insert({
      organization_id: conn.organization_id,
      incident_id: inc.id,
      actor_id: actorId,
      actor_type: "agent",
      agent: "Monitoring",
      action: "anomaly.detected",
      message: `Real telemetry: ${v.title} — opened ${inc.reference} as ${v.severity}`,
      details: { rule: v.rule, value: v.value, threshold: v.threshold, source: "prometheus" } as Json,
    });
  }
  return { ok: true as const, created, suppressed, errors: result.errors };
}
