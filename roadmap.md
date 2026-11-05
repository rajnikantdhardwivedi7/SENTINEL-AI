# SENTINEL AI roadmap

- [x] Design system, landing page, Command Center (simulated data, demo banner)
- [x] Phase 2: Lovable Cloud, sign-in (email, Google, Lovable), forgot/reset password, protected pages
- [x] Roles (Admin/SRE/Security Analyst/Viewer) enforced by database policies + server checks; invite code joins as Viewer
- [x] Database: orgs, workspaces, profiles, infra, incidents, security events, investigations, evidence, remediation plans/approvals, audit logs, simulation runs
- [x] Incidents list (search/filter) + detail (assign, severity, status, evidence, timeline, plans)
- [x] Rule-based investigation engine (observed vs hypothesis), pluggable for an AI provider later
- [x] End-to-end CPU spike lifecycle: detect → incident → investigate → approve → execute → verify → resolve, audited
- [x] Command Center shows saved incidents + audit trail when signed in
- [x] Tests: permissions matrix, investigation engine
- [ ] AI provider for investigations (Lovable AI) alongside rule engine
- [ ] Infrastructure explorer with dependency graph
- [x] Premium enterprise UI redesign (palette, sidebar, Command Center, landing, all pages)
- [ ] Security operations, remediation, analytics, audit log, infrastructure pages (sidebar shows "Soon")
- [ ] Real telemetry ingestion

## Principal-engineer review follow-ups
- [x] DB-enforced remediation state machine, single approval per plan, attributed audit rows
- [x] Atomic approve/execute claims; lifecycle writes fail loudly
- [ ] Separation of duties (approver ≠ proposer/executor) — needs product decision
- [ ] Wrap lifecycle steps in a single DB transaction (RPC) to avoid partial states
- [x] Real Prometheus ingestion, REAL/DEMO switch, threshold incidents with cooldown
- [ ] Per-service real metrics + run investigations on real snapshots
- [ ] Kubernetes / OpenTelemetry / Grafana / Falco adapters
- [ ] Real executor for remediation (currently simulated) and independent recovery verification
- [ ] Audit log ordering (sequence column) and immutability review
- [ ] Join-code rotation/expiry; invite by email
- [ ] Rate limiting on simulation/investigation endpoints
