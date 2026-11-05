// Role → permission matrix. The database enforces the same rules with RLS
// policies; server functions check these first to return clear errors.

export const ROLES = ["admin", "sre", "security_analyst", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  sre: "SRE Engineer",
  security_analyst: "Security Analyst",
  viewer: "Viewer",
};

export type Permission =
  | "incident.view"
  | "incident.update"
  | "investigation.run"
  | "simulation.run"
  | "remediation.approve"
  | "remediation.execute"
  | "workspace.manage"
  | "members.manage";

const MATRIX: Record<Role, readonly Permission[]> = {
  admin: [
    "incident.view",
    "incident.update",
    "investigation.run",
    "simulation.run",
    "remediation.approve",
    "remediation.execute",
    "workspace.manage",
    "members.manage",
  ],
  sre: [
    "incident.view",
    "incident.update",
    "investigation.run",
    "simulation.run",
    "remediation.approve",
    "remediation.execute",
  ],
  security_analyst: ["incident.view", "incident.update", "investigation.run"],
  viewer: ["incident.view"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
