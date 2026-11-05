// Pure, I/O-free monitoring logic: PromQL defaults, response validation,
// normalization, threshold rules, dedup/cooldown, and URL safety.
// Shared by server code and tests; contains no secrets.
import { z } from "zod";

export type MetricKey = "cpu" | "mem" | "rps" | "errors" | "p95";
export const METRIC_KEYS: MetricKey[] = ["cpu", "mem", "rps", "errors", "p95"];

export const METRIC_LABELS: Record<MetricKey, { label: string; unit: string }> = {
  cpu: { label: "CPU utilization", unit: "%" },
  mem: { label: "Memory utilization", unit: "%" },
  rps: { label: "HTTP request rate", unit: "req/s" },
  errors: { label: "HTTP 5xx error rate", unit: "%" },
  p95: { label: "p95 latency", unit: "ms" },
};

export type Queries = Record<MetricKey, string>;

/** Defaults assume node_exporter + a conventional `http_requests_total` / `http_request_duration_seconds` app. */
export const DEFAULT_QUERIES: Queries = {
  cpu: '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))',
  mem: "100 * (1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))",
  rps: "sum(rate(http_requests_total[5m]))",
  errors: '100 * sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))',
  p95: "1000 * histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
};

export type Thresholds = { cpu: number; mem: number; errors: number; p95: number; unhealthyTargets: number };
export const DEFAULT_THRESHOLDS: Thresholds = { cpu: 85, mem: 90, errors: 5, p95: 1000, unhealthyTargets: 1 };

export const thresholdsSchema = z.object({
  cpu: z.number().min(1).max(100),
  mem: z.number().min(1).max(100),
  errors: z.number().min(0.01).max(100),
  p95: z.number().min(1).max(600_000),
  unhealthyTargets: z.number().int().min(1).max(10_000),
});

export function resolveQueries(q: unknown): Queries {
  const o = (q && typeof q === "object" ? q : {}) as Partial<Record<MetricKey, unknown>>;
  const out = { ...DEFAULT_QUERIES };
  for (const k of METRIC_KEYS) if (typeof o[k] === "string" && (o[k] as string).trim()) out[k] = (o[k] as string).trim();
  return out;
}
export function resolveThresholds(t: unknown): Thresholds {
  const r = thresholdsSchema.partial().safeParse(t ?? {});
  const out = { ...DEFAULT_THRESHOLDS };
  if (r.success) for (const [k, v] of Object.entries(r.data)) if (typeof v === "number") out[k as keyof Thresholds] = v;
  return out;
}

// ---------- Response validation ----------

const instantSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    resultType: z.enum(["vector", "scalar", "matrix", "string"]),
    result: z.unknown(),
  }),
});

export type MetricReading = { value: number | null; at: string | null; error?: string };

/** Parse a /api/v1/query response into a single number. Missing data → value null with an explanation. */
export function parseInstantQuery(body: unknown): MetricReading {
  const r = instantSchema.safeParse(body);
  if (!r.success) return { value: null, at: null, error: "Malformed Prometheus response" };
  const { resultType, result } = r.data.data;
  let pair: unknown;
  if (resultType === "scalar") pair = result;
  else if (resultType === "vector") {
    if (!Array.isArray(result) || result.length === 0) return { value: null, at: null, error: "No data (metric missing)" };
    pair = (result[0] as { value?: unknown })?.value;
  } else return { value: null, at: null, error: `Unsupported result type ${resultType}` };
  if (!Array.isArray(pair) || pair.length !== 2) return { value: null, at: null, error: "Malformed sample" };
  const ts = Number(pair[0]);
  const v = Number(pair[1]);
  if (!Number.isFinite(ts)) return { value: null, at: null, error: "Malformed sample timestamp" };
  if (!Number.isFinite(v)) return { value: null, at: new Date(ts * 1000).toISOString(), error: "Non-numeric value (NaN/Inf)" };
  return { value: Math.round(v * 100) / 100, at: new Date(ts * 1000).toISOString() };
}

const targetsSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    activeTargets: z.array(
      z.object({
        labels: z.record(z.string(), z.string()).optional(),
        scrapePool: z.string().optional(),
        health: z.string(),
        lastError: z.string().optional(),
        lastScrape: z.string().optional(),
      }),
    ),
  }),
});

export type TargetHealth = { job: string; instance: string; health: "up" | "down" | "unknown"; lastError: string | null; lastScrape: string | null };

export function parseTargets(body: unknown): { targets: TargetHealth[]; error?: string } {
  const r = targetsSchema.safeParse(body);
  if (!r.success) return { targets: [], error: "Malformed targets response" };
  return {
    targets: r.data.data.activeTargets.slice(0, 200).map((t) => ({
      job: t.labels?.["job"] ?? t.scrapePool ?? "unknown",
      instance: t.labels?.["instance"] ?? "unknown",
      health: t.health === "up" ? "up" : t.health === "down" ? "down" : "unknown",
      lastError: t.lastError || null,
      lastScrape: t.lastScrape ?? null,
    })),
  };
}

export function availability(targets: TargetHealth[]): number | null {
  if (!targets.length) return null;
  return Math.round((targets.filter((t) => t.health === "up").length / targets.length) * 10000) / 100;
}

// ---------- Threshold rules ----------

export type Violation = {
  fingerprint: string;
  rule: string;
  value: number;
  threshold: number;
  severity: "sev1" | "sev2" | "sev3";
  title: string;
};

export function evaluateRules(metrics: Partial<Record<MetricKey, MetricReading>>, targets: TargetHealth[], th: Thresholds): Violation[] {
  const out: Violation[] = [];
  const check = (k: "cpu" | "mem" | "errors" | "p95", rule: string) => {
    const v = metrics[k]?.value;
    if (v == null || v <= th[k]) return;
    const ratio = v / th[k];
    out.push({
      fingerprint: `metric:${k}`,
      rule,
      value: v,
      threshold: th[k],
      severity: ratio >= 1.3 ? "sev1" : ratio >= 1.1 ? "sev2" : "sev3",
      title: `${METRIC_LABELS[k].label} ${v}${METRIC_LABELS[k].unit} exceeds ${th[k]}${METRIC_LABELS[k].unit}`,
    });
  };
  check("cpu", "cpu_high");
  check("mem", "memory_high");
  check("errors", "error_rate_high");
  check("p95", "latency_high");
  const down = targets.filter((t) => t.health === "down");
  if (down.length >= th.unhealthyTargets) {
    out.push({
      fingerprint: "targets:down",
      rule: "targets_unhealthy",
      value: down.length,
      threshold: th.unhealthyTargets,
      severity: down.length >= 3 ? "sev1" : "sev2",
      title: `${down.length} Prometheus target(s) down: ${down.slice(0, 3).map((t) => `${t.job}/${t.instance}`).join(", ")}`,
    });
  }
  return out;
}

/** True when an alert with this fingerprint fired within the cooldown window and must be suppressed. */
export function inCooldown(lastFiredAt: string | null | undefined, cooldownMinutes: number, now: Date): boolean {
  if (!lastFiredAt) return false;
  return now.getTime() - new Date(lastFiredAt).getTime() < cooldownMinutes * 60_000;
}

// ---------- URL safety (SSRF guard) ----------

const PRIVATE_V4 = [/^10\./, /^127\./, /^0\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

/** Reject URLs that would let a tenant make the server call internal/loopback/metadata addresses. */
export function validatePrometheusUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Not a valid URL" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "URL must start with http:// or https://" };
  if (u.username || u.password) return { ok: false, error: "Put credentials in the credential field, not the URL" };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local") || host === "metadata.google.internal")
    return { ok: false, error: "Internal hostnames are not allowed" };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && PRIVATE_V4.some((r) => r.test(host))) return { ok: false, error: "Private or loopback IP addresses are not allowed" };
  if (host.includes(":") && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host.startsWith("::ffff:")))
    return { ok: false, error: "Private or loopback IP addresses are not allowed" };
  u.search = "";
  u.hash = "";
  return { ok: true, url: u.toString().replace(/\/+$/, "") };
}
