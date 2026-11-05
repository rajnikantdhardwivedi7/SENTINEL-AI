# Development notes

Status log, verification notes and limitations. See also [ARCHITECTURE.md](ARCHITECTURE.md) and [SECURITY.md](SECURITY.md).

## Commands

```bash
npm install        # or: bun install
npm run dev        # prints the local URL
npm run build
npm test           # vitest run
npm run lint
```


## Phase 3: Prometheus integration (done)

**Verified against a real Prometheus instance** (`https://demo.promlabs.com`, the public PromLabs demo):
- Connection test: 6/6 targets up.
- Scrape pulled real CPU (~10%), memory (~11%), request rate (~167 req/s), 5xx rate (~0.9%), p95 latency (~54 ms), target health and availability.
- With the CPU threshold lowered to 5%, a genuine reading (9.86%) opened incident INC-7C9CF6 (`source = real`).
- A repeat scrape inside the 30-minute cooldown was suppressed (no duplicate incident).
- Unreachable host → "Could not reach Prometheus"; cloud metadata URL → rejected.

### Architecture
- `src/lib/monitoring.ts`: pure logic, no I/O. Covers PromQL defaults, response validation, normalization, threshold rules, cooldown and the URL guard.
- `src/lib/prometheus.server.ts`: server-only HTTP client (8 s timeout, 1 retry on network/5xx, no redirects) plus the scrape → snapshot → rules → dedup → incident → audit pipeline.
- `src/lib/monitoring.functions.ts`: authenticated server functions. Admins configure/test; admins and SREs can scrape.
- `/api/public/jobs/scrape-prometheus`: scheduled every 5 minutes, protected by the managed cron secret.
- Database tables:
  - `monitoring_connections`: org-readable, never contains secrets.
  - `monitoring_credentials`: no browser access at all; verified with an HTTP 403.
  - `metric_snapshots`, `alert_states`: org-readable.
- Command Center has a DEMO/REAL switch. REAL shows only Prometheus data, with source, status, last scrape, per-metric timestamps and errors. When disconnected it shows a disconnected state and never substitutes simulated values. DEMO hides real incidents.

### Tests
42 automated tests cover:
- Parsing, missing metrics and malformed responses.
- Threshold rules and cooldown.
- The URL guard.
- The client against mocked success, 401, unreachable and non-Prometheus responses.
- Permissions and the remediation state machine.

## Known limitations (not production-ready)
- **Single cluster-wide view.** One connection per organization. Metrics are aggregate, not per service, so real incidents have no linked service.
- **Investigations don't run on real data.** The investigation step only runs on simulated telemetry. Real incidents can be triaged but not auto-investigated yet.
- **Remediation is still simulated.** By design for this phase.
- **Credential storage.** Credentials sit in a locked database table with server-only access. They are not encrypted with a separate key (no KMS/Vault).
- **URL guard gaps.** It blocks private IPs and internal hostnames, but not DNS names that resolve to private IPs (DNS rebinding).
- **Default queries need adjusting.** They assume `node_exporter` and `http_requests_total` / `http_request_duration_seconds`. Other setups must edit the PromQL in Settings.
- **Scheduled scraping runs only on the published app.** The 5-minute job calls the published URL, so it does nothing until the app is published.
- **No retention policy yet** for metric snapshots.
- **Kubernetes, OpenTelemetry, Grafana and Falco are not implemented.** Adding one means a new `kind` on `monitoring_connections` and a sibling `*.server.ts` adapter.
- **Earlier review items still open:** separation of duties, transactional lifecycle, audit ordering, invite-code expiry, rate limits.
