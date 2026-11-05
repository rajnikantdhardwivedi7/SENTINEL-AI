import { describe, expect, it } from "vitest";
import { detectAnomaly, generateCpuSpike, ruleBasedProvider, simulateRecovery, verifyRecovery } from "@/lib/investigation-engine";

const svc = { name: "checkout-svc", replicas: 4, currentVersion: "v2.14.1", previousVersion: "v2.14.0" };

function scenario(cause: "bad_deploy" | "traffic_surge", seed = 42) {
  return generateCpuSpike({ baseline: 48, seed, currentVersion: "v2.14.1", previousVersion: "v2.14.0", cause });
}

describe("incident workflow engine", () => {
  it("detects a simulated CPU spike above the 85% floor", () => {
    const d = detectAnomaly(scenario("bad_deploy").telemetry);
    expect(d.detected).toBe(true);
    expect(d.threshold).toBeGreaterThanOrEqual(85);
    expect(d.peakCpu).toBeGreaterThan(d.threshold);
  });

  it("does not flag steady telemetry", () => {
    const flat = scenario("bad_deploy").telemetry.slice(0, 15);
    expect(detectAnomaly(flat).detected).toBe(false);
  });

  it("attributes a post-deploy spike to the deploy and proposes a rollback", () => {
    const s = scenario("bad_deploy");
    const r = ruleBasedProvider.analyze({ service: svc, telemetry: s.telemetry, detection: detectAnomaly(s.telemetry), deploy: s.deploy, securityEvents: [] });
    expect(r.plan.action).toBe("rollback");
    expect(r.rootCause).toContain("v2.14.1");
  });

  it("attributes a traffic-driven spike to load and proposes scaling out", () => {
    const s = scenario("traffic_surge");
    const r = ruleBasedProvider.analyze({ service: svc, telemetry: s.telemetry, detection: detectAnomaly(s.telemetry), deploy: s.deploy, securityEvents: [] });
    expect(r.plan.action).toBe("scale_out");
  });

  it("keeps observed evidence separate from hypotheses and runs all six stages", () => {
    const s = scenario("bad_deploy");
    const r = ruleBasedProvider.analyze({ service: svc, telemetry: s.telemetry, detection: detectAnomaly(s.telemetry), deploy: s.deploy, securityEvents: [] });
    expect(r.evidence.some((e) => e.kind === "observed")).toBe(true);
    expect(r.evidence.some((e) => e.kind === "hypothesis")).toBe(true);
    expect(r.evidence.filter((e) => e.kind === "hypothesis").every((e) => e.source === "rule-engine")).toBe(true);
    expect(r.stages.map((s) => s.key)).toEqual(["collect", "anomaly", "correlate", "hypothesis", "recommend", "verify"]);
  });

  it("verifies recovery only when CPU is under 70% and errors under 1%", () => {
    expect(simulateRecovery(48, 7).recovered).toBe(true);
    const hot = [{ i: 0, cpu: 90, mem: 60, p95: 200, errors: 0.3, rps: 1000 }];
    expect(verifyRecovery(hot).recovered).toBe(false);
  });
});
