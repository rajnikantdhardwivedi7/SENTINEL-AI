// Deterministic simulated telemetry for demonstration mode.
// Nothing here comes from real infrastructure.

export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type MetricPoint = { t: string; cpu: number; mem: number; p95: number; errors: number };

export function metricPoint(i: number): MetricPoint {
  const r = seeded(i * 7919 + 13);
  const base = Math.sin(i / 6) * 8;
  const d = new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + i * 60_000);
  return {
    t: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
    cpu: Math.round(48 + base + r() * 10),
    mem: Math.round(62 + base / 2 + r() * 6),
    p95: Math.round(180 + base * 4 + r() * 40),
    errors: Number((0.4 + Math.max(0, base / 20) + r() * 0.5).toFixed(2)),
  };
}

export function metricWindow(end: number, size = 40): MetricPoint[] {
  return Array.from({ length: size }, (_, k) => metricPoint(end - size + 1 + k));
}

export const services = [
  { name: "api-gateway", ns: "edge", env: "prod-us-east-1", status: "healthy", pods: "6/6", cpu: 41, mem: 58, heartbeat: 4 },
  { name: "checkout-svc", ns: "commerce", env: "prod-us-east-1", status: "degraded", pods: "3/4", cpu: 87, mem: 81, heartbeat: 12 },
  { name: "payments-svc", ns: "commerce", env: "prod-us-east-1", status: "healthy", pods: "4/4", cpu: 52, mem: 63, heartbeat: 3 },
  { name: "auth-svc", ns: "identity", env: "prod-eu-west-1", status: "healthy", pods: "3/3", cpu: 34, mem: 47, heartbeat: 6 },
  { name: "inventory-svc", ns: "commerce", env: "prod-eu-west-1", status: "healthy", pods: "2/2", cpu: 28, mem: 39, heartbeat: 5 },
  { name: "postgres-primary", ns: "data", env: "prod-us-east-1", status: "warning", pods: "1/1", cpu: 76, mem: 88, heartbeat: 2 },
] as const;

export const clusters = [
  { name: "prod-us-east-1", nodes: 12, status: "healthy", cpu: 61, mem: 67, heartbeat: 3 },
  { name: "prod-eu-west-1", nodes: 8, status: "degraded", cpu: 72, mem: 70, heartbeat: 5 },
  { name: "staging-us-east-1", nodes: 4, status: "healthy", cpu: 22, mem: 35, heartbeat: 9 },
] as const;

export const demoIncidents = [
  { ref: "INC-1042", title: "p95 latency regression after deploy", severity: "sev2", service: "checkout-svc", detected: "02:01", status: "awaiting_approval", agent: "Remediation" },
  { ref: "INC-1041", title: "Connection pool saturation", severity: "sev3", service: "postgres-primary", detected: "01:47", status: "investigating", agent: "Root Cause" },
  { ref: "INC-1039", title: "Credential stuffing from 203.0.113.42", severity: "sev2", service: "auth-svc", detected: "00:58", status: "monitoring", agent: "Security Analyst" },
  { ref: "INC-1036", title: "Unexpected shell in container", severity: "sev3", service: "inventory-svc", detected: "Yesterday", status: "resolved", agent: "Verification" },
] as const;

export const incidentTrend = [
  { day: "Mon", sev1: 0, sev2: 2, sev3: 5 },
  { day: "Tue", sev1: 1, sev2: 1, sev3: 4 },
  { day: "Wed", sev1: 0, sev2: 3, sev3: 6 },
  { day: "Thu", sev1: 0, sev2: 1, sev3: 3 },
  { day: "Fri", sev1: 1, sev2: 2, sev3: 7 },
  { day: "Sat", sev1: 0, sev2: 0, sev3: 2 },
  { day: "Sun", sev1: 0, sev2: 1, sev3: 3 },
];

const activityPool = [
  { agent: "Monitoring", msg: "Ingested 14,220 metric samples from prod-us-east-1", incident: null, state: "completed" },
  { agent: "Anomaly", msg: "CPU on checkout-svc exceeded 3σ baseline (87%)", incident: "INC-1042", state: "completed" },
  { agent: "Security", msg: "Flagged 23 failed logins from 203.0.113.42 on auth-svc", incident: "INC-1039", state: "completed" },
  { agent: "RCA", msg: "Correlated p95 latency spike with deploy checkout-svc@v2.14.1", incident: "INC-1042", state: "completed" },
  { agent: "Remediation", msg: "Proposed rollback checkout-svc → v2.14.0 (risk: low)", incident: "INC-1042", state: "pending_approval" },
  { agent: "Verification", msg: "Error rate on payments-svc back under SLO (0.3%)", incident: null, state: "completed" },
  { agent: "Anomaly", msg: "Connection pool saturation on postgres-primary (92/100)", incident: "INC-1041", state: "running" },
  { agent: "Security", msg: "Falco: unexpected shell spawned in inventory-svc pod", incident: "INC-1036", state: "completed" },
];

export type Activity = { id: number; agent: string; msg: string; at: string; incident: string | null; state: string };

export function activityAt(i: number): Activity {
  const a = activityPool[i % activityPool.length]!;
  const d = new Date(Date.UTC(2026, 0, 1) + i * 37_000);
  return { id: i, ...a, at: d.toISOString().slice(11, 19) };
}

export function healthScore(p: MetricPoint) {
  return Math.max(0, Math.min(100, Math.round(100 - (p.cpu - 40) * 0.4 - p.errors * 6 - (p.p95 - 150) * 0.03)));
}
