import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { AppShell, Panel, SourceTag } from "@/components/sentinel/AppShell";
import { getMe, runCpuSpikeSimulation } from "@/lib/sentinel.functions";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation Lab — SENTINEL AI" },
      { name: "description", content: "Trigger a simulated CPU spike and watch SENTINEL detect, investigate and remediate it." },
      { property: "og:title", content: "Simulation Lab — SENTINEL AI" },
      { property: "og:description", content: "Run the full incident lifecycle on simulated infrastructure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SimulationPage,
});

const steps = ["Generate simulated CPU spike", "Detect anomaly", "Create and persist incident", "Investigate & collect evidence", "Identify probable root cause", "Generate remediation plan", "Request human approval", "Execute safe simulated remediation", "Verify recovery", "Resolve incident & save audit trail"];

function SimulationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const run = useServerFn(runCpuSpikeSimulation);
  const [cause, setCause] = useState<"random" | "bad_deploy" | "traffic_surge">("random");
  const m = useMutation({
    mutationFn: () => run({ data: { cause } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      if (r.incidentId) {
        toast.success("Anomaly detected — incident created");
        navigate({ to: "/incidents/$incidentId", params: { incidentId: r.incidentId } });
      } else toast.info("No anomaly crossed the threshold this time");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const allowed = can(me.data?.role, "simulation.run");

  return (
    <AppShell title="Simulation Lab">
      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-2">
        <Panel title="CPU spike scenario" sub={<SourceTag kind="simulated" />}>
          <p className="text-sm text-muted-foreground">Generates 30 minutes of simulated telemetry for <span className="font-mono text-foreground">checkout-svc</span> with a CPU spike. No real infrastructure is touched at any step.</p>
          <label className="mt-4 block text-xs text-muted-foreground">Underlying cause (hidden from the investigation engine)</label>
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={cause} onChange={(e) => setCause(e.target.value as typeof cause)}>
            <option value="random">Random</option>
            <option value="bad_deploy">Bad deploy</option>
            <option value="traffic_surge">Traffic surge</option>
          </select>
          <Button className="mt-4 w-full" onClick={() => m.mutate()} disabled={!allowed || m.isPending}>
            <FlaskConical className="size-4" />{m.isPending ? "Running…" : "Generate CPU spike"}
          </Button>
          {me.data && !allowed && <p className="mt-2 text-xs text-warning">Your role ({ROLE_LABELS[me.data.role]}) can't run simulations. Ask an Administrator or SRE Engineer.</p>}
        </Panel>
        <Panel title="Lifecycle" sub="each step is persisted and audited">
          <ol className="space-y-2 text-sm">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] text-muted-foreground">{i + 1}</span>{s}</li>
            ))}
          </ol>
        </Panel>
      </div>
    </AppShell>
  );
}
