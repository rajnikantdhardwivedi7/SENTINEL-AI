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
  { name: "api-gateway", ns: "edge", status: "healthy", pods: "6/6", cpu: 41 },
  { name: "checkout-svc", ns: "commerce", status: "degraded", pods: "3/4", cpu: 87 },
  { name: "payments-svc", ns: "commerce", status: "healthy", pods: "4/4", cpu: 52 },
  { name: "auth-svc", ns: "identity", status: "healthy", pods: "3/3", cpu: 34 },
  { name: "inventory-svc", ns: "commerce", status: "healthy", pods: "2/2", cpu: 28 },
  { name: "postgres-primary", ns: "data", status: "warning", pods: "1/1", cpu: 76 },
] as const;

export const clusters = [
  { name: "prod-us-east-1", nodes: 12, status: "healthy" },
  { name: "prod-eu-west-1", nodes: 8, status: "degraded" },
  { name: "staging-us-east-1", nodes: 4, status: "healthy" },
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
  { agent: "Monitoring", msg: "Ingested 14,220 metric samples from prod-us-east-1" },
  { agent: "Anomaly", msg: "CPU on checkout-svc exceeded 3σ baseline (87%)" },
  { agent: "Security", msg: "Flagged 23 failed logins from 203.0.113.42 on auth-svc" },
  { agent: "RCA", msg: "Correlated p95 latency spike with deploy checkout-svc@v2.14.1" },
  { agent: "Remediation", msg: "Proposed rollback checkout-svc → v2.14.0 (risk: low) — awaiting approval" },
  { agent: "Verification", msg: "Error rate on payments-svc back under SLO (0.3%)" },
  { agent: "Anomaly", msg: "Connection pool saturation on postgres-primary (92/100)" },
  { agent: "Security", msg: "Falco: unexpected shell spawned in inventory-svc pod" },
];

export type Activity = { id: number; agent: string; msg: string; at: string };

export function activityAt(i: number): Activity {
  const a = activityPool[i % activityPool.length]!;
  const d = new Date(Date.UTC(2026, 0, 1) + i * 37_000);
  return { id: i, ...a, at: d.toISOString().slice(11, 19) };
}

export function healthScore(p: MetricPoint) {
  return Math.max(0, Math.min(100, Math.round(100 - (p.cpu - 40) * 0.4 - p.errors * 6 - (p.p95 - 150) * 0.03)));
}
