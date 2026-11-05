// Remediation plan state machine. Mirrors the `enforce_remediation_transition`
// database trigger, which is the authoritative check.
export type PlanStatus = "pending_approval" | "approved" | "rejected" | "executing" | "executed" | "verified" | "failed";

const NEXT: Record<PlanStatus, readonly PlanStatus[]> = {
  pending_approval: ["approved", "rejected"],
  approved: ["executing"],
  executing: ["verified", "failed"],
  rejected: [],
  executed: [],
  verified: [],
  failed: [],
};

export function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return NEXT[from].includes(to);
}
