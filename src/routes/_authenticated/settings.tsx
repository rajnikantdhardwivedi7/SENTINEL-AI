import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/sentinel/AppShell";
import { createWorkspace, getMe, listMembers, updateMemberRole, updateOrganization, updateProfile } from "@/lib/sentinel.functions";
import { can, ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SENTINEL AI" },
      { name: "description", content: "Your profile, organization, workspaces and team roles." },
      { property: "og:title", content: "Settings — SENTINEL AI" },
      { property: "og:description", content: "Manage profile, workspaces and roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const members = useQuery({ queryKey: ["members"], queryFn: useServerFn(listMembers) });
  const onError = (e: unknown) => toast.error((e as Error).message);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [orgName, setOrgName] = useState("");
  const [wsName, setWsName] = useState("");
  const [wsEnv, setWsEnv] = useState<"production" | "staging" | "development">("staging");
  useEffect(() => {
    if (me.data) {
      setName(me.data.profile.display_name ?? "");
      setTitle(me.data.profile.job_title ?? "");
      setOrgName(me.data.organization.name);
    }
  }, [me.data]);

  const saveProfile = useServerFn(updateProfile);
  const saveOrg = useServerFn(updateOrganization);
  const addWs = useServerFn(createWorkspace);
  const setRole = useServerFn(updateMemberRole);
  const profM = useMutation({ mutationFn: () => saveProfile({ data: { display_name: name, job_title: title } }), onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["members"] }); }, onError });
  const orgM = useMutation({ mutationFn: () => saveOrg({ data: { name: orgName } }), onSuccess: () => { toast.success("Organization renamed"); qc.invalidateQueries({ queryKey: ["me"] }); }, onError });
  const wsM = useMutation({ mutationFn: () => addWs({ data: { name: wsName, environment: wsEnv } }), onSuccess: () => { toast.success("Workspace created"); setWsName(""); qc.invalidateQueries({ queryKey: ["me"] }); }, onError });
  const roleM = useMutation({ mutationFn: (d: { userId: string; role: Role }) => setRole({ data: d }), onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["me"] }); }, onError });

  if (me.isLoading) return <AppShell title="Settings"><div className="space-y-3 p-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div></AppShell>;
  if (me.error || !me.data) return <AppShell title="Settings"><p className="p-6 text-destructive">{(me.error as Error)?.message ?? "Could not load settings"}</p></AppShell>;
  const role = me.data.role;
  const manage = can(role, "workspace.manage");
  const manageMembers = can(role, "members.manage");

  return (
    <AppShell title="Settings" subtitle="Profile, organization, workspaces and team roles.">
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-2">
        <Panel title="Your profile" sub={ROLE_LABELS[role]}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); profM.mutate(); }}>
            <div className="text-xs text-muted-foreground">{me.data.profile.email}</div>
            <div className="space-y-1.5"><Label htmlFor="dn">Display name</Label><Input id="dn" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
            <div className="space-y-1.5"><Label htmlFor="jt">Job title</Label><Input id="jt" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></div>
            <Button type="submit" size="sm" disabled={profM.isPending}>Save profile</Button>
          </form>
        </Panel>

        <Panel title="Organization">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); orgM.mutate(); }}>
            <div className="space-y-1.5"><Label htmlFor="on">Name</Label><Input id="on" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!manage} maxLength={120} /></div>
            {manage && <Button type="submit" size="sm" disabled={orgM.isPending}>Rename</Button>}
            {me.data.organization.join_code && (
              <div className="rounded-md border p-3 text-sm">
                <div className="text-xs text-muted-foreground">Invite code — teammates enter this when creating an account and join as Viewers.</div>
                <div className="mt-1 font-mono text-lg tracking-widest text-foreground">{me.data.organization.join_code}</div>
              </div>
            )}
          </form>
        </Panel>

        <Panel title="Workspaces">
          <ul className="space-y-2">
            {me.data.workspaces.map((w) => <li key={w.id} className="flex justify-between rounded-md border p-2.5 text-sm"><span>{w.name}</span><span className="font-mono text-xs text-muted-foreground">{w.environment}</span></li>)}
          </ul>
          {manage ? (
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (wsName.trim()) wsM.mutate(); }}>
              <Input placeholder="New workspace" value={wsName} onChange={(e) => setWsName(e.target.value)} className="min-w-40 flex-1" maxLength={120} />
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={wsEnv} onChange={(e) => setWsEnv(e.target.value as typeof wsEnv)}>
                <option value="production">production</option><option value="staging">staging</option><option value="development">development</option>
              </select>
              <Button type="submit" size="sm" disabled={wsM.isPending}>Add</Button>
            </form>
          ) : <p className="mt-3 text-xs text-muted-foreground">Only Administrators can manage workspaces.</p>}
        </Panel>

        <Panel title="Team & roles">
          {members.isLoading ? <Skeleton className="h-24 w-full" /> : (
            <ul className="space-y-2">
              {members.data?.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                  <span className="min-w-0"><span className="block truncate">{m.display_name || m.email}</span><span className="block truncate text-xs text-muted-foreground">{m.email}</span></span>
                  <select aria-label={`Role for ${m.email}`} className="h-8 rounded-md border bg-background px-2 text-xs disabled:opacity-60" value={m.role} disabled={!manageMembers || roleM.isPending} onChange={(e) => roleM.mutate({ userId: m.id, role: e.target.value as Role })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
