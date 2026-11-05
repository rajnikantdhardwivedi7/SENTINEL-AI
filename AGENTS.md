<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Server logic lives in `src/lib/sentinel.functions.ts` (createServerFn + requireSupabaseAuth, zod-validated); it uses the caller's RLS client so DB policies are the final permission check.
- Role→permission matrix lives in `src/lib/permissions.ts` and must mirror the RLS policies; roles are in `user_roles`, never on profiles.
- Investigation logic is pure TS in `src/lib/investigation-engine.ts` behind `InvestigationProvider`, so an LLM provider can be swapped in and tests run without I/O.
- Every record carries `organization_id`; RLS scopes reads to `current_org()`.
- App pages render inside `AppShell` (src/components/sentinel/AppShell.tsx), which owns sidebar nav sections, page header, and shared Panel/StatusPill/SeverityBadge/SourceTag/EmptyState primitives, so every page stays visually consistent.
- Remediation plan state transitions and approval preconditions are enforced by DB triggers (mirrored in `src/lib/remediation-state.ts`); server code uses conditional updates to claim transitions, because RLS alone let operators skip approval via the API.
