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
- [ ] Security operations, remediation, analytics pages
- [ ] Real telemetry ingestion
