import { describe, it, expect } from "vitest";
import { createApprovalHandler, ApprovalDeniedError } from "../../src/runner/approval.js";
import { isNeedsApprovalSignal } from "../../src/types.js";
import type { WorkflowState } from "../../src/types.js";

function makeState(): WorkflowState {
  return {
    project: "test",
    scope: { type: "app", target: null },
    started_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    steps: {},
  };
}

describe("createApprovalHandler", () => {
  it("auto mode: approves immediately and records provenance", async () => {
    const state = makeState();
    const handler = createApprovalHandler("auto", state, "my-step");
    await handler("Please approve this");

    expect(state.approvals).toHaveLength(1);
    const record = state.approvals![0]!;
    expect(record.stepId).toBe("my-step");
    expect(record.prompt).toBe("Please approve this");
    expect(record.mode).toBe("auto");
    expect(typeof record.approved_at).toBe("string");
    expect(new Date(record.approved_at).toISOString()).toBe(record.approved_at);
  });

  it("ci mode: throws ApprovalDeniedError", async () => {
    const state = makeState();
    const handler = createApprovalHandler("ci", state, "ci-step");
    await expect(handler("Needs approval")).rejects.toThrow(ApprovalDeniedError);
    await expect(handler("Needs approval")).rejects.toThrow("CI mode");
    expect(state.approvals).toBeUndefined();
  });

  it("interactive mode throws NeedsApprovalSignal when no cached result", async () => {
    const state = makeState();
    const handler = createApprovalHandler("interactive", state, "test-step");
    try {
      await handler("Approve this?");
      expect.fail("should have thrown");
    } catch (err) {
      expect(isNeedsApprovalSignal(err)).toBe(true);
      if (isNeedsApprovalSignal(err)) {
        expect(err.stepId).toBe("test-step");
        expect(err.prompt).toBe("Approve this?");
      }
    }
  });

  it("interactive mode approves when cached result is true", async () => {
    const state = makeState();
    const approvalResults = new Map([["test-step", true]]);
    const handler = createApprovalHandler("interactive", state, "test-step", approvalResults);
    await handler("Approve this?");
    expect(state.approvals).toHaveLength(1);
    expect(state.approvals![0]!.mode).toBe("interactive");
  });

  it("interactive mode throws ApprovalDeniedError when cached result is false", async () => {
    const state = makeState();
    const approvalResults = new Map([["test-step", false]]);
    const handler = createApprovalHandler("interactive", state, "test-step", approvalResults);
    await expect(handler("Approve this?")).rejects.toThrow(ApprovalDeniedError);
  });

});
