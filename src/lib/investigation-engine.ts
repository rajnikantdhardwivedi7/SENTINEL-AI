// Deterministic, rule-based incident intelligence (engine "rule-based-v1").
// Pure functions: no I/O, so it runs on the server and in tests.
// An LLM provider can implement `InvestigationProvider` later; every result
// separates OBSERVED evidence (measured facts) from HYPOTHESES (inferences).

import { seeded } from "./demo-telemetry";

export type TelemetryPoint = { i: number; cpu: number; mem: number; p95: number; errors: number; rps: number };
export type SpikeCause = "bad_deploy" | "traffic_surge";

export type CpuSpikeScenario = {
  telemetry: TelemetryPoint[];
  cause: SpikeCause;
  deploy: { version: string; previous: string; atIndex: number } | null;
};

export const BASELINE_WINDOW = 15;
export const SPIKE_START = 18;
export const CPU_FLOOR = 85;

export function generateCpuSpike(opts: {
  baseline: number;
  seed: number;
  currentVersion: string;
  previousVersion: string;
  cause?: SpikeCause;
}): CpuSpikeScenario {
  const r = seeded(opts.seed);
  const cause: SpikeCause = opts.cause ?? (r() < 0.5 ? "bad_deploy" : "traffic_surge");
  const telemetry: TelemetryPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const spiking = i >= SPIKE_START;
    const ramp = spiking ? Math.min(1, (i - SPIKE_START + 1) / 3) : 0;
    const cpu = Math.round(opts.baseline + r() * 6 - 3 + ramp * (95 - opts.baseline));
    const rps = Math.round(1200 + r() * 80 + (cause === "traffic_surge" ? ramp * 2400 : 0));
    const errors = Number((0.3 + r() * 0.2 + (cause === "bad_deploy" ? ramp * 4.5 : ramp * 0.6)).toFixed(2));
    telemetry.push({
      i,
      cpu: Math.min(100, Math.max(0, cpu)),
      mem: Math.round(60 + r() * 5 + ramp * 15),
      p95: Math.round(180 + r() * 30 + ramp * 520),
      errors,
      rps,
    });
  }
  return {
    telemetry,
    cause,
    deploy:
      cause === "bad_deploy"
        ? { version: opts.currentVersion, previous: opts.previousVersion, atIndex: SPIKE_START - 2 }
        : null,
  };
}

export type Detection = {
  detected: boolean;
  baselineMean: number;
  baselineStd: number;
  threshold: number;
  peakCpu: number;
  zScore: number;
  startIndex: number | null;
  severity: "sev1" | "sev2" | "sev3" | "sev4";
};

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}
function std(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** CPU anomaly: 3 consecutive samples above max(mean + 3σ, 85%). */
export function detectAnomaly(points: TelemetryPoint[]): Detection {
  const base = points.slice(0, BASELINE_WINDOW).map((p) => p.cpu);
  const m = mean(base);
  const s = Math.max(1, std(base));
  const threshold = Math.max(m + 3 * s, CPU_FLOOR);
  let startIndex: number | null = null;
  for (let k = 0; k + 2 < points.length; k++) {
    if ([0, 1, 2].every((d) => points[k + d]!.cpu > threshold)) {
      startIndex = k;
      break;
    }
  }
  const peakCpu = Math.max(...points.map((p) => p.cpu));
  const zScore = Number(((peakCpu - m) / s).toFixed(1));
  const detected = startIndex !== null;
  const severity = !detected ? "sev4" : peakCpu >= 95 ? "sev2" : "sev3";
  return { detected, baselineMean: Number(m.toFixed(1)), baselineStd: Number(s.toFixed(1)), threshold: Number(threshold.toFixed(1)), peakCpu, zScore, startIndex, severity };
}

export type EvidenceItem = {
  kind: "observed" | "hypothesis";
  source: string;
  title: string;
  detail: string;
  weight: number;
  data?: Record<string, unknown>;
};

export type PlanDraft = {
  title: string;
  action: "scale_out" | "restart_pods" | "rollback";
  risk: "low" | "medium" | "high";
  rationale: string;
  steps: string[];
};

export type Stage = { key: string; label: string; status: "done" | "skipped"; note: string };

export type InvestigationInput = {
  service: { name: string; replicas: number; currentVersion: string | null; previousVersion: string | null };
  telemetry: TelemetryPoint[];
  detection: Detection;
  deploy: { version: string; previous: string; atIndex: number } | null;
  securityEvents: { event_type: string; severity: string; description: string }[];
};

export type InvestigationResult = {
  engine: string;
  stages: Stage[];
  evidence: EvidenceItem[];
  rootCause: string;
  confidence: number;
  summary: string;
  plan: PlanDraft;
};

export interface InvestigationProvider {
  name: string;
  analyze(input: InvestigationInput): InvestigationResult;
}

export const ruleBasedProvider: InvestigationProvider = {
  name: "rule-based-v1",
  analyze(input) {
    const { telemetry: t, detection: d, service } = input;
    const start = d.startIndex ?? SPIKE_START;
    const before = t.slice(0, BASELINE_WINDOW);
    const during = t.slice(start);
    const avg = (xs: TelemetryPoint[], k: keyof TelemetryPoint) => Number(mean(xs.map((p) => p[k])).toFixed(2));
    const rpsRatio = avg(during, "rps") / Math.max(1, avg(before, "rps"));
    const errRatio = avg(during, "errors") / Math.max(0.01, avg(before, "errors"));

    const evidence: EvidenceItem[] = [
      { kind: "observed", source: "metrics", title: `CPU peaked at ${d.peakCpu}%`, detail: `Baseline ${d.baselineMean}% ± ${d.baselineStd}; threshold ${d.threshold}%; z-score ${d.zScore}.`, weight: 1, data: { peak: d.peakCpu, threshold: d.threshold } },
      { kind: "observed", source: "metrics", title: `Request rate ×${rpsRatio.toFixed(2)}`, detail: `${avg(before, "rps")} → ${avg(during, "rps")} req/s during the anomaly window.`, weight: 0.8, data: { rpsRatio } },
      { kind: "observed", source: "metrics", title: `Error rate ×${errRatio.toFixed(1)}`, detail: `${avg(before, "errors")}% → ${avg(during, "errors")}% of requests.`, weight: 0.8, data: { errRatio } },
      { kind: "observed", source: "metrics", title: `p95 latency ${avg(during, "p95")} ms`, detail: `Up from ${avg(before, "p95")} ms before the anomaly.`, weight: 0.6 },
    ];
    if (input.deploy) {
      evidence.push({ kind: "observed", source: "deployments", title: `Deploy ${service.name}@${input.deploy.version}`, detail: `Rolled out ${start - input.deploy.atIndex} min before CPU crossed the threshold (previous ${input.deploy.previous}).`, weight: 0.9, data: input.deploy });
    }
    for (const e of input.securityEvents) {
      evidence.push({ kind: "observed", source: "security", title: `Security event: ${e.event_type}`, detail: e.description, weight: 0.5 });
    }

    // Hypothesis scoring rules
    const hyps: { cause: string; score: number; why: string; plan: PlanDraft }[] = [];
    if (input.deploy) {
      const score = 0.55 + (errRatio > 3 ? 0.25 : 0) + (rpsRatio < 1.3 ? 0.1 : 0);
      hyps.push({
        cause: `Regression in ${service.name}@${input.deploy.version}`,
        score,
        why: "A deploy preceded the spike, errors rose sharply, and traffic stayed flat.",
        plan: { title: `Roll back ${service.name} to ${input.deploy.previous}`, action: "rollback", risk: "low", rationale: "Restores the last known-good version.", steps: [`kubectl rollout undo deployment/${service.name}`, "Wait for all replicas to become ready", "Watch CPU and error rate for 5 minutes"] },
      });
    }
    if (rpsRatio >= 1.5) {
      const score = 0.5 + Math.min(0.35, (rpsRatio - 1.5) * 0.2) + (errRatio < 3 ? 0.1 : 0);
      const target = Math.min(service.replicas * 2, service.replicas + 6);
      hyps.push({
        cause: `Traffic surge saturating ${service.replicas} replicas`,
        score,
        why: "CPU rose in proportion to request rate with no recent deploy.",
        plan: { title: `Scale ${service.name} from ${service.replicas} to ${target} replicas`, action: "scale_out", risk: "low", rationale: "Adds capacity to absorb the higher request rate.", steps: [`kubectl scale deployment/${service.name} --replicas=${target}`, "Wait for new pods to pass readiness", "Confirm CPU per pod falls below 70%"] },
      });
    }
    const highSec = input.securityEvents.some((e) => e.severity === "high" || e.severity === "critical");
    if (highSec) {
      hyps.push({ cause: "Possible compromised workload", score: 0.45, why: "A high-severity security event targets the same service.", plan: { title: `Restart ${service.name} pods`, action: "restart_pods", risk: "medium", rationale: "Replaces potentially tampered containers.", steps: [`kubectl rollout restart deployment/${service.name}`, "Verify image digests", "Watch CPU for 5 minutes"] } });
    }
    if (hyps.length === 0) {
      hyps.push({ cause: "Runaway process in one or more pods", score: 0.35, why: "No deploy, traffic change or security signal explains the spike.", plan: { title: `Restart ${service.name} pods`, action: "restart_pods", risk: "low", rationale: "Clears stuck processes with a rolling restart.", steps: [`kubectl rollout restart deployment/${service.name}`, "Watch CPU for 5 minutes"] } });
    }
    hyps.sort((a, b) => b.score - a.score);
    for (const h of hyps) {
      evidence.push({ kind: "hypothesis", source: "rule-engine", title: h.cause, detail: h.why, weight: Number(Math.min(0.95, h.score).toFixed(2)) });
    }
    const best = hyps[0]!;
    const confidence = Number(Math.min(0.95, best.score).toFixed(2));

    const stages: Stage[] = [
      { key: "collect", label: "Event collection", status: "done", note: `${t.length} telemetry samples, ${input.deploy ? 1 : 0} deploys, ${input.securityEvents.length} security events` },
      { key: "anomaly", label: "Anomaly analysis", status: "done", note: `CPU ${d.peakCpu}% vs threshold ${d.threshold}%` },
      { key: "correlate", label: "Evidence correlation", status: "done", note: `${evidence.filter((e) => e.kind === "observed").length} observed signals correlated` },
      { key: "hypothesis", label: "Root-cause hypotheses", status: "done", note: `${hyps.length} hypotheses ranked; top confidence ${Math.round(confidence * 100)}%` },
      { key: "recommend", label: "Remediation recommendation", status: "done", note: best.plan.title },
      { key: "verify", label: "Verification", status: "skipped", note: "Runs after the approved remediation executes" },
    ];

    return {
      engine: "rule-based-v1",
      stages,
      evidence,
      rootCause: best.cause,
      confidence,
      summary: `${best.cause}. ${best.why}`,
      plan: best.plan,
    };
  },
};

/** Simulated post-remediation telemetry and recovery check. */
export function simulateRecovery(baseline: number, seed: number): { telemetry: TelemetryPoint[]; recovered: boolean; avgCpu: number; maxErrors: number } {
  const r = seeded(seed);
  const telemetry: TelemetryPoint[] = Array.from({ length: 10 }, (_, i) => ({
    i,
    cpu: Math.round(baseline + r() * 6 - 3),
    mem: Math.round(60 + r() * 5),
    p95: Math.round(180 + r() * 30),
    errors: Number((0.3 + r() * 0.2).toFixed(2)),
    rps: Math.round(1200 + r() * 80),
  }));
  return { telemetry, ...verifyRecovery(telemetry) };
}

export function verifyRecovery(points: TelemetryPoint[]) {
  const avgCpu = Number(mean(points.map((p) => p.cpu)).toFixed(1));
  const maxErrors = Math.max(...points.map((p) => p.errors));
  return { recovered: avgCpu < 70 && maxErrors < 1, avgCpu, maxErrors };
}
