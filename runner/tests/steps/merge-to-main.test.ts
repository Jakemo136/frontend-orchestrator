import { describe, it, expect, vi } from "vitest";
import { MergeToMainStep } from "../../src/steps/merge-to-main.js";
import { ApprovalDeniedError } from "../../src/runner/approval.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

// Helper: mock exec that returns no existing open PRs on first call, then succeeds for pr create
function makeExecWithNoPrList(overrides: Record<number, Awaited<ReturnType<ReturnType<typeof makeMockContext>["exec"]>>> = {}) {
  let callCount = 0;
  return vi.fn(async (cmd: string) => {
    const idx = callCount++;
    if (idx in overrides) return overrides[idx];
    // pr list call returns empty array
    if (cmd.includes("pr list")) return { exitCode: 0, stdout: "[]", stderr: "", timedOut: false };
    // pr create call succeeds
    if (cmd.includes("pr create")) return { exitCode: 0, stdout: "https://github.com/test/pr/1", stderr: "", timedOut: false };
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
  });
}

describe("MergeToMainStep", () => {
  it("describe() returns app scope", () => {
    const step = new MergeToMainStep(makeDefinition({ type: "merge-to-main" }));
    const desc = step.describe();
    expect(desc.type).toBe("merge-to-main");
    expect(desc.scope).toBe("app");
  });

  it("preflight fails when no feature branch configured", async () => {
    const ctx = makeMockContext();
    ctx.config.branches.feature = null;
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("feature branch");
  });

  it("preflight passes when feature branch exists", async () => {
    const ctx = makeMockContext(); // default has feature: "feat/test"
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
  });

  it("execute passes when PR created and user merges", async () => {
    const exec = makeExecWithNoPrList();
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ exec, awaitApproval });
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.message).toContain("merged");
  });

  it("execute fails when PR creation fails", async () => {
    const exec = vi.fn()
      .mockResolvedValueOnce({ exitCode: 0, stdout: "[]", stderr: "", timedOut: false }) // pr list
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "not found", timedOut: false }); // pr create
    const ctx = makeMockContext({ exec });
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("Failed to create PR");
  });

  it("execute fails when user declines merge (ApprovalDeniedError)", async () => {
    const exec = makeExecWithNoPrList();
    const awaitApproval = vi.fn(async () => { throw new ApprovalDeniedError("merge to main"); });
    const ctx = makeMockContext({ exec, awaitApproval });
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("declined");
  });

  it("execute re-throws NeedsApprovalSignal (does not swallow it)", async () => {
    const signal = { __type: "needs_approval" as const, stepId: "test-step", prompt: "merge?" };
    const exec = makeExecWithNoPrList();
    const awaitApproval = vi.fn(async () => { throw signal; });
    const ctx = makeMockContext({ exec, awaitApproval });
    const step = new MergeToMainStep(makeDefinition());
    await expect(step.execute(ctx)).rejects.toBe(signal);
  });

  it("execute reuses existing open PR instead of creating a new one", async () => {
    const existingPr = [{ number: 42, url: "https://github.com/test/pr/42" }];
    const exec = vi.fn()
      .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify(existingPr), stderr: "", timedOut: false }); // pr list returns existing
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ exec, awaitApproval });
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    // gh pr create should NOT have been called
    const calls = exec.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes("pr create"))).toBe(false);
    expect(calls.some((c) => c.includes("pr list"))).toBe(true);
    // The approval prompt should contain the existing PR URL
    const approvalPrompt = awaitApproval.mock.calls[0][0] as string;
    expect(approvalPrompt).toContain("https://github.com/test/pr/42");
  });

  it("execute fails when required CI checks are failing", async () => {
    const failingChecks = [
      { name: "build", state: "FAILURE" },
      { name: "lint", state: "PENDING" },
    ];
    const exec = vi.fn()
      .mockResolvedValueOnce({ exitCode: 0, stdout: "[]", stderr: "", timedOut: false }) // pr list
      .mockResolvedValueOnce({ exitCode: 0, stdout: "https://github.com/test/pr/1", stderr: "", timedOut: false }) // pr create
      .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify(failingChecks), stderr: "", timedOut: false }); // pr checks
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ exec, awaitApproval });
    ctx.config.ci.required_on_main = ["build", "lint"];
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("build");
    expect(result.message).toContain("lint");
    expect(result.metrics).toMatchObject({ failing_checks: 2 });
  });
});
