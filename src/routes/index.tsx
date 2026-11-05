import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Brain, ShieldAlert, Wrench, FlaskConical, BarChart3, ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/sentinel/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SENTINEL AI — Autonomous Infrastructure Intelligence" },
      { name: "description", content: "AI-powered SRE and security platform that detects, investigates and remediates infrastructure incidents with human-governed automation." },
      { property: "og:title", content: "SENTINEL AI — Autonomous Infrastructure Intelligence" },
      { property: "og:description", content: "Multi-agent incident investigation, security operations and governed remediation for cloud-native infrastructure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Activity, title: "Command Center", body: "Health score, saturation, latency and error budgets across every cluster in one view." },
  { icon: Brain, title: "Multi-agent investigation", body: "Six specialized agents correlate metrics, logs, traces and events into an evidence-backed root cause." },
  { icon: ShieldAlert, title: "Security operations", body: "Falco runtime events, auth anomalies and API abuse mapped to MITRE ATT&CK when evidence supports it." },
  { icon: Wrench, title: "Governed remediation", body: "A policy engine sits between AI recommendations and execution. Risky actions require human approval." },
  { icon: FlaskConical, title: "Simulation lab", body: "Inject CPU exhaustion, crash loops or credential stuffing in an isolated sandbox and watch the full response." },
  { icon: BarChart3, title: "Reliability analytics", body: "MTTD, MTTR, remediation success and false-positive rates, exportable as PDF or JSON." },
];

const agents = ["Monitoring", "Anomaly Detection", "Security Analyst", "Root Cause", "Remediation Planner", "Verification"];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Platform</a>
            <a href="#architecture" className="hover:text-foreground">Architecture</a>
            <a href="#governance" className="hover:text-foreground">Governance</a>
          </nav>
          <Button asChild size="sm"><Link to="/dashboard">Launch demo</Link></Button>
        </div>
      </header>

      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success pulse-dot" /> Autonomous Infrastructure Intelligence
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Your on-call engineer that never sleeps — and always asks first.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground md:text-lg">
            SENTINEL AI detects anomalies, investigates incidents and threats with a team of AI agents, and executes only the remediation you approve.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/dashboard">Open Command Center <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#architecture">How it works</a></Button>
          </div>
          <TerminalPreview />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">One platform for reliability and security</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-background p-6">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="architecture" className="border-y bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Agent orchestration pipeline</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Telemetry flows through specialized agents. Each step records evidence separately from hypotheses.</p>
          <div className="mt-10 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            {agents.map((a, i) => (
              <div key={a} className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-md border bg-background p-4">
                  <div className="font-mono text-xs text-primary">0{i + 1}</div>
                  <div className="mt-1 text-sm font-medium">{a}</div>
                </div>
                {i < agents.length - 1 && <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="governance" className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2">
        <div>
          <Lock className="size-5 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">AI recommends. Policy decides. Humans approve.</h2>
          <p className="mt-3 text-muted-foreground">The model never runs shell commands. Every action is a typed, validated operation checked against policy and logged to an append-only audit trail.</p>
        </div>
        <ul className="space-y-3 text-sm">
          {["Role-based access: Admin, SRE, Security Analyst, Viewer", "Human approval required for risky actions", "Parameter validation and scoped credentials", "Post-execution verification and rollback steps", "Immutable-style audit log for every operation"].map((x) => (
            <li key={x} className="flex gap-3 rounded-md border p-3"><CheckCircle2 className="size-4 shrink-0 text-success" />{x}</li>
          ))}
        </ul>
      </section>

      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">See it respond to a live simulated incident</h2>
          <Button asChild size="lg"><Link to="/dashboard">Launch demo <ArrowRight /></Link></Button>
          <p className="text-xs text-muted-foreground">Demo runs entirely on simulated data.</p>
        </div>
      </section>
    </div>
  );
}

function TerminalPreview() {
  const lines = [
    ["MONITOR", "p95 latency checkout-svc 212ms → 1,840ms"],
    ["ANOMALY", "deviation 6.1σ above 7-day baseline"],
    ["RCA", "hypothesis: deploy v2.14.1 introduced N+1 query (conf 0.82)"],
    ["PLAN", "rollback checkout-svc → v2.14.0 · risk low · approval required"],
    ["VERIFY", "p95 back to 204ms · incident INC-1042 resolved"],
  ];
  return (
    <div className="mx-auto mt-14 max-w-3xl overflow-hidden rounded-lg border bg-surface text-left shadow-glow">
      <div className="flex items-center justify-between border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        <span>investigation · INC-1042</span>
        <span className="rounded border border-warning/40 px-1.5 text-warning">SIMULATED</span>
      </div>
      <div className="space-y-1.5 p-4 font-mono text-xs md:text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex gap-3"><span className="w-20 shrink-0 text-primary">{k}</span><span className="text-muted-foreground">{v}</span></div>
        ))}
      </div>
    </div>
  );
}
