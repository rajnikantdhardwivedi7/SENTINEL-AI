import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateRules, inCooldown, parseInstantQuery, parseTargets, resolveThresholds, validatePrometheusUrl, DEFAULT_THRESHOLDS } from "@/lib/monitoring";
import { scrapePrometheus, testPrometheus } from "@/lib/prometheus.server";
import { can } from "@/lib/permissions";

const vec = (v: string) => ({ status: "success", data: { resultType: "vector", result: [{ metric: {}, value: [1700000000, v] }] } });
const targets = (h: string[]) => ({ status: "success", data: { activeTargets: h.map((x, i) => ({ labels: { job: "node", instance: `n${i}` }, health: x })) } });

describe("Prometheus response parsing", () => {
  it("reads a numeric sample", () => expect(parseInstantQuery(vec("42.129")).value).toBe(42.13));
  it("missing metric gives null, not zero", () => {
    const r = parseInstantQuery({ status: "success", data: { resultType: "vector", result: [] } });
    expect(r.value).toBeNull();
    expect(r.error).toMatch(/missing/);
  });
  it("malformed body is rejected", () => expect(parseInstantQuery({ foo: 1 }).error).toMatch(/Malformed/));
  it("NaN is not treated as a value", () => expect(parseInstantQuery(vec("NaN")).value).toBeNull());
  it("parses target health", () => expect(parseTargets(targets(["up", "down"])).targets.map((t) => t.health)).toEqual(["up", "down"]));
});

describe("threshold rules", () => {
  const th = DEFAULT_THRESHOLDS;
  it("CPU above 85% fires, at 85% does not", () => {
    expect(evaluateRules({ cpu: { value: 85.5, at: null } }, [], th).map((v) => v.rule)).toEqual(["cpu_high"]);
    expect(evaluateRules({ cpu: { value: 85, at: null } }, [], th)).toEqual([]);
  });
  it("memory above 90%, 5xx above 5%, unhealthy target fire", () => {
    const v = evaluateRules({ mem: { value: 91, at: null }, errors: { value: 6, at: null } }, parseTargets(targets(["down"])).targets, th);
    expect(v.map((x) => x.rule).sort()).toEqual(["error_rate_high", "memory_high", "targets_unhealthy"]);
  });
  it("missing metrics never fire", () => expect(evaluateRules({ cpu: { value: null, at: null } }, [], th)).toEqual([]));
  it("custom thresholds apply", () => expect(evaluateRules({ cpu: { value: 9, at: null } }, [], resolveThresholds({ cpu: 5 })).length).toBe(1));
});

describe("duplicate alert suppression", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("suppresses within the cooldown", () => expect(inCooldown("2026-01-01T11:45:00Z", 30, now)).toBe(true));
  it("allows after the cooldown", () => expect(inCooldown("2026-01-01T11:00:00Z", 30, now)).toBe(false));
  it("first alert is never suppressed", () => expect(inCooldown(null, 30, now)).toBe(false));
});

describe("URL safety", () => {
  it("allows public https", () => expect(validatePrometheusUrl("https://demo.promlabs.com/").ok).toBe(true));
  it.each(["http://localhost:9090", "http://127.0.0.1", "http://10.0.0.5", "http://169.254.169.254", "http://192.168.1.1", "ftp://x.com", "https://u:p@x.com"])("blocks %s", (u) =>
    expect(validatePrometheusUrl(u).ok).toBe(false),
  );
});

describe("Prometheus client", () => {
  afterEach(() => vi.unstubAllGlobals());
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

  it("successful connection", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (String(u).includes("targets") ? json(targets(["up", "up"])) : json(vec("1")))));
    await expect(testPrometheus("https://prom.example.com", { type: "none", secret: null })).resolves.toEqual({ targets: 2, up: 2 });
  });
  it("invalid credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    await expect(testPrometheus("https://prom.example.com", { type: "bearer", secret: "bad" })).rejects.toThrow(/credentials/);
  });
  it("unavailable instance retries then fails", async () => {
    const f = vi.fn(async () => { throw new TypeError("fetch failed"); });
    vi.stubGlobal("fetch", f);
    await expect(testPrometheus("https://prom.example.com", { type: "none", secret: null })).rejects.toThrow(/reach/);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("non-Prometheus endpoint is reported as malformed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    await expect(testPrometheus("https://example.com", { type: "none", secret: null })).rejects.toThrow(/not JSON/);
  });
  it("missing metrics are reported per metric without failing the scrape", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (String(u).includes("targets") ? json(targets(["up"])) : json({ status: "success", data: { resultType: "vector", result: [] } }))));
    const r = await scrapePrometheus({ base_url: "https://prom.example.com", queries: {} }, { type: "none", secret: null });
    expect(r.metrics.cpu?.value).toBeNull();
    expect(r.errors.length).toBe(5);
    expect(r.availability).toBe(100);
  });
});

describe("monitoring permissions", () => {
  it("only admins configure; admins and SREs scrape; viewers neither", () => {
    expect(can("admin", "monitoring.manage")).toBe(true);
    expect(can("sre", "monitoring.manage")).toBe(false);
    expect(can("sre", "monitoring.scrape")).toBe(true);
    expect(can("viewer", "monitoring.scrape")).toBe(false);
  });
});
