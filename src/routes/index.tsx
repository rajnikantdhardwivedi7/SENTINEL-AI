import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Eye, GitBranch, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/sentinel/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SENTINEL AI — Infrastructure intelligence for operational resilience" },
      { name: "description", content: "Monitor infrastructure, investigate incidents and coordinate governed remediation through a unified operational platform." },
      { property: "og:title", content: "SENTINEL AI — Infrastructure intelligence" },
      { property: "og:description", content: "Monitoring, incident investigation and human-approved remediation in one operational platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const pillars = [
  { icon: Eye, title: "Observe", body: "Health, saturation, latency and error rates across clusters and services, with anomaly detection against rolling baselines." },
  { icon: GitBranch, title: "Investigate", body: "Every investigation records observed evidence separately from generated hypotheses, each with a confidence score." },
  { icon: Workflow, title: "Remediate", body: "Typed, validated remediation plans that execute only after an authorized engineer approves — then verify recovery." },
];

const agents = [
  { name: "Monitoring", body: "Collects metrics, events and deploy history." },
  { name: "Anomaly Detection", body: "Flags deviations from statistical baselines." },
  { name: "Security Analyst", body: "Correlates auth, runtime and network signals." },
  { name: "Root Cause", body: "Ranks hypotheses against observed evidence." },
  { name: "Remediation Planner", body: "Drafts low-risk, reversible actions." },
  { name: "Verification", body: "Confirms recovery against target thresholds." },
];

const governance = [
  ["Detect", "Anomaly crosses threshold; incident opened automatically."],
  ["Investigate", "Evidence collected, root cause ranked with confidence."],
  ["Approve", "SRE or Administrator reviews the plan and its risk level."],
  ["Execute & verify", "Action runs, recovery is checked, audit trail is sealed."],
];

const integrations = ["Kubernetes", "Prometheus", "OpenTelemetry", "Falco", "AWS", "PagerDuty"];
const commandCenterScreenshot = "https://raw.githubusercontent.com/rajnikantdhardwivedi7/SENTINEL-AI/main/docs/assets/screenshots/command-center.png";

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden gap-7 text-[13px] text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-foreground">Platform</a>
            <a href="#architecture" className="transition-colors hover:text-foreground">Architecture</a>
            <a href="#governance" className="transition-colors hover:text-foreground">Governance</a>
            <a href="#simulation" className="transition-colors hover:text-foreground">Simulation</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex"><Link to="/auth">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/dashboard">Launch demo</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative border-b">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 text-center md:pt-28">
          <p className="text-[13px] font-medium tracking-wide text-muted-foreground">SENTINEL AI</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-[38px] font-semibold leading-[1.08] tracking-tight md:text-[52px]">
            Infrastructure intelligence.
            <span className="block text-muted-foreground">Built for operational resilience.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Monitor infrastructure, investigate incidents and coordinate intelligent remediation through a unified operational platform.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/dashboard">Open Command Center <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Create account</Link></Button>
          </div>
          <div className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-t-xl border border-b-0 bg-surface shadow-glow">
            <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-elevated" /><span className="size-2.5 rounded-full bg-elevated" /><span className="size-2.5 rounded-full bg-elevated" />
              <span className="ml-3 text-[11px] text-subtle-foreground">Command Center · simulated data</span>
            </div>
            <img src={commandCenterScreenshot} alt="SENTINEL Command Center showing health KPIs, utilization charts, incidents and agent activity" className="block w-full" loading="eager" />
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead eyebrow="Platform" title="One operational surface for reliability and security" body="SENTINEL connects detection, investigation and remediation into a single, auditable workflow." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title} className="bg-background p-6">
              <p.icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
              <h3 className="mt-4 text-[15px] font-medium">{p.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="architecture" className="border-y bg-surface/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHead eyebrow="Architecture" title="Six specialized agents, one evidence trail" body="Each agent has a narrow responsibility. Outputs are recorded and attributed, so every conclusion can be traced back to its evidence." />
          <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a, i) => (
              <li key={a.name} className="rounded-lg border bg-background p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-subtle-foreground">0{i + 1}</span>
                  {i < agents.length - 1 && <ArrowRight className="size-3.5 text-subtle-foreground" />}
                </div>
                <div className="mt-3 text-[14px] font-medium">{a.name}</div>
                <p className="mt-1 text-[13px] text-muted-foreground">{a.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="governance" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <ShieldCheck className="size-5 text-muted-foreground" strokeWidth={1.75} />
            <SectionHead eyebrow="Governance" title="Automation recommends. People approve." body="Remediation never runs without an authorized decision. Roles are enforced server-side, and every step lands in an append-only audit log." />
            <ul className="mt-6 space-y-2 text-[13px] text-muted-foreground">
              {["Administrator, SRE Engineer, Security Analyst and Viewer roles", "Approval required before any remediation executes", "Post-execution recovery verification", "Organization-level data isolation"].map((x) => (
                <li key={x} className="flex gap-2.5"><Check className="mt-0.5 size-3.5 shrink-0 text-success" />{x}</li>
              ))}
            </ul>
          </div>
          <ol className="relative space-y-0 overflow-hidden rounded-lg border">
            {governance.map(([t, b], i) => (
              <li key={t} className="flex gap-4 border-b bg-surface p-5 last:border-0">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                <div><div className="text-[14px] font-medium">{t}</div><p className="mt-0.5 text-[13px] text-muted-foreground">{b}</p></div>
                {t === "Approve" && <span className="ml-auto self-start rounded border border-warning/25 px-1.5 py-px text-[10.5px] text-warning">Human gate</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[15px] font-medium">Infrastructure integrations</div>
            <p className="mt-1 text-[13px] text-muted-foreground">Designed for cloud-native stacks. The current release runs on simulated telemetry.</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {integrations.map((n) => <li key={n} className="rounded-md border bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground">{n}</li>)}
          </ul>
        </div>
      </section>

      <section id="simulation" className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
        <div>
          <SectionHead eyebrow="Simulation Lab" title="Watch a full incident lifecycle in under a minute" body="Inject a CPU spike into a sandboxed service. SENTINEL detects it, opens an incident, ranks root causes, waits for your approval, executes a safe simulated fix and verifies recovery." />
          <Button asChild className="mt-6" variant="outline"><Link to="/simulation">Open Simulation Lab <ArrowRight /></Link></Button>
        </div>
        <TerminalPreview />
      </section>

      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-20 text-center">
          <h2 className="text-[26px] font-semibold tracking-tight">See SENTINEL respond to a simulated incident</h2>
          <p className="text-[13px] text-muted-foreground">No setup required. The demo runs entirely on simulated data.</p>
          <div className="mt-2 flex gap-3">
            <Button asChild size="lg"><Link to="/dashboard">Launch demo <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Create account</Link></Button>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-subtle-foreground">
          <Logo />
          <div className="flex flex-wrap items-center justify-end gap-4"><a href="https://rajnikantdhardwivedi.in/blog/building-sentinel-ai/" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">Engineering blog <ArrowRight className="ml-1 inline size-3" /></a><a href="https://github.com/rajnikantdhardwivedi7/SENTINEL-AI" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">GitHub</a><span>Demo environment · simulated telemetry</span></div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">{eyebrow}</p>
      <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight md:text-[30px]">{title}</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function TerminalPreview() {
  const lines = [
    ["MONITOR", "cpu checkout-svc 48% → 97%", "text-muted-foreground"],
    ["ANOMALY", "threshold 85% exceeded · z=32.3", "text-warning"],
    ["RCA", "regression in checkout-svc@v2.14.1 · conf 0.90", "text-foreground"],
    ["PLAN", "rollback → v2.14.0 · risk low · approval required", "text-foreground"],
    ["APPROVE", "approved by sre@acme", "text-primary"],
    ["VERIFY", "avg cpu 48.1% · errors 0.48% · resolved", "text-success"],
  ];
  return (
    <div className="overflow-hidden rounded-lg border bg-surface text-left">
      <div className="flex items-center justify-between border-b px-4 py-2.5 text-[11px] text-subtle-foreground">
        <span className="font-mono">investigation · INC-BD1BB7</span>
        <span className="rounded border border-warning/25 px-1.5 py-px text-warning">Simulated</span>
      </div>
      <div className="space-y-2 p-5 font-mono text-[12.5px]">
        {lines.map(([k, v, tone]) => (
          <div key={k} className="flex gap-4"><span className="w-16 shrink-0 text-subtle-foreground">{k}</span><span className={tone}>{v}</span></div>
        ))}
      </div>
    </div>
  );
}
