# Security model

## Authentication
- Supabase Auth via Lovable Cloud: email/password (with confirmation and reset), Google, and Sign in with Lovable.
- Protected pages live under `src/routes/_authenticated/`. The real boundary is the server: every server function uses `requireSupabaseAuth`, which validates the bearer token.

## Roles

Roles are stored in `user_roles` (never on profiles) and checked with `SECURITY DEFINER` helpers (`has_role`, `has_any_role`).

| Capability | Administrator | SRE Engineer | Security Analyst | Viewer |
|---|:-:|:-:|:-:|:-:|
| View incidents, telemetry, audit trail | yes | yes | yes | yes |
| Triage / update incidents | yes | yes | yes | – |
| Run investigations | yes | yes | yes | – |
| Run simulations | yes | yes | – | – |
| Approve / reject remediation | yes | yes | – | – |
| Execute remediation (simulated) | yes | yes | – | – |
| Trigger Prometheus scrape | yes | yes | – | – |
| Configure monitoring connection | yes | – | – | – |
| Manage workspaces and member roles | yes | – | – | – |

- The first user of a new organization becomes Administrator.
- Users joining with an invite code start as Viewer.

## Enforcement layers
1. **Server functions:** these check `can(role, permission)` first, so callers get clear errors.
2. **Row-level security:** every table is organization-scoped and write policies require the matching roles. The browser cannot bypass this by calling the Data API directly.
3. **Database triggers on `remediation_plans`:**
   - A plan must start as `pending_approval`.
   - Only `pending_approval → approved | rejected`, `approved → executing` and `executing → verified | failed` are allowed.
   - `approved` / `rejected` require a matching `remediation_approvals` row.
   - Finished plans are immutable.
   - Approvals carry a unique index (one decision per plan), and the insert trigger requires the plan to still be pending.
4. **Duplicate-action prevention:** approve and execute use conditional updates (`... WHERE status = 'pending_approval'` / `'approved'`), so double-clicks or concurrent requests can't run a step twice.
5. **Audit attribution:** browser inserts into `audit_logs` must set `actor_id = auth.uid()`. Viewers cannot write. There is no UPDATE or DELETE grant.

These were verified in the preview by calling the Data API directly as a signed-in Administrator:
- Skipping approval → rejected by trigger.
- Forged unattributed audit row → rejected by RLS.
- Re-executing a finished plan → rejected by trigger.
- Reading `monitoring_credentials` from the browser → HTTP 403.

## Secrets
- Prometheus credentials live in `monitoring_credentials`. This table has no grants to `anon` or `authenticated` and is read only by server code using the service role, after a role check.
- The service role key is server-only and read inside handlers.
- The scheduled scrape endpoint requires the managed cron bearer secret.
- **SSRF guard:** configured Prometheus URLs must be http(s), carry no embedded credentials, and must not be localhost, `.internal` / `.local`, private, loopback, link-local or cloud-metadata IPs. Redirects are refused.

## Known limitations
- **No two-person approval.** The same Administrator or SRE can propose, approve and execute a plan.
- **Lifecycle steps are not wrapped in a single database transaction.** A failure mid-way stops with an error but leaves earlier steps saved.
- **Monitoring credentials are not encrypted** with a separate key (no KMS/Vault).
- **The SSRF guard does not resolve DNS,** so a public hostname that resolves to a private IP is not blocked.
- **Invite codes never expire.**
- **No rate limiting** on simulations, investigations or scrapes.
- **Audit rows written in the same millisecond have no guaranteed order.**
- The non-admin roles, Google sign-in and email flows have not been verified end-to-end.
