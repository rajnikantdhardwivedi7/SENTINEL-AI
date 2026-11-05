import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled scrape for every enabled Prometheus connection. Caller is verified by the managed cron secret.
export const Route = createFileRoute("/api/public/jobs/scrape-prometheus")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runScrape } = await import("@/lib/prometheus.server");
        const { data: conns } = await supabaseAdmin.from("monitoring_connections").select("*").eq("enabled", true).limit(50);
        const results = [];
        for (const c of conns ?? []) {
          const r = await runScrape(supabaseAdmin, c, null);
          results.push({ id: c.id, ok: r.ok, created: r.created.length, suppressed: r.suppressed });
        }
        return Response.json({ success: true, results });
      },
    },
  },
});
