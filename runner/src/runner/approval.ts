import type { ApprovalMode, WorkflowState, ApprovalRecord } from "../types.js";

export class ApprovalDeniedError extends Error {
  constructor(prompt: string) {
    super(`Approval denied in CI mode: ${prompt}`);
    this.name = "ApprovalDeniedError";
  }
}

function recordApproval(state: WorkflowState, stepId: string, prompt: string, mode: ApprovalMode): void {
  if (!state.approvals) state.approvals = [];
  const record: ApprovalRecord = { stepId, prompt, mode, approved_at: new Date().toISOString() };
  state.approvals.push(record);
}

export function createApprovalHandler(
  mode: ApprovalMode,
  state: WorkflowState,
  stepId: string,
): (prompt: string) => Promise<void> {
  return async (prompt: string): Promise<void> => {
    switch (mode) {
      case "auto":
        console.log(`\n⏸  APPROVAL (auto-approved): ${prompt}\n`);
        recordApproval(state, stepId, prompt, "auto");
        return;
      case "ci":
        throw new ApprovalDeniedError(prompt);
    }
  };
}
