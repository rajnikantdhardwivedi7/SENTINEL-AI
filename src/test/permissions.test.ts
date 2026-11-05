import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("role permissions", () => {
  it("viewers can only view incidents", () => {
    expect(can("viewer", "incident.view")).toBe(true);
    expect(can("viewer", "incident.update")).toBe(false);
    expect(can("viewer", "investigation.run")).toBe(false);
    expect(can("viewer", "remediation.approve")).toBe(false);
  });

  it("security analysts can triage and investigate but not approve or execute", () => {
    expect(can("security_analyst", "incident.update")).toBe(true);
    expect(can("security_analyst", "investigation.run")).toBe(true);
    expect(can("security_analyst", "remediation.approve")).toBe(false);
    expect(can("security_analyst", "remediation.execute")).toBe(false);
    expect(can("security_analyst", "simulation.run")).toBe(false);
  });

  it("SRE engineers can approve and execute remediation but not manage members", () => {
    expect(can("sre", "remediation.approve")).toBe(true);
    expect(can("sre", "remediation.execute")).toBe(true);
    expect(can("sre", "simulation.run")).toBe(true);
    expect(can("sre", "members.manage")).toBe(false);
    expect(can("sre", "workspace.manage")).toBe(false);
  });

  it("only administrators manage workspaces and members", () => {
    expect(can("admin", "workspace.manage")).toBe(true);
    expect(can("admin", "members.manage")).toBe(true);
  });

  it("no role means no access", () => {
    expect(can(null, "incident.view")).toBe(false);
  });
});
