import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/remediation-state";

describe("remediation state machine", () => {
  it("cannot execute without approval", () => {
    expect(canTransition("pending_approval", "executing")).toBe(false);
  });
  it("cannot jump straight to verified", () => {
    expect(canTransition("pending_approval", "verified")).toBe(false);
    expect(canTransition("approved", "verified")).toBe(false);
  });
  it("follows approve -> execute -> verify", () => {
    expect(canTransition("pending_approval", "approved")).toBe(true);
    expect(canTransition("approved", "executing")).toBe(true);
    expect(canTransition("executing", "verified")).toBe(true);
  });
  it("rejected and verified plans are final", () => {
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("verified", "executing")).toBe(false);
  });
});
