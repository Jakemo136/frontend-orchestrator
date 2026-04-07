import { describe, it, expect, vi } from "vitest";
import { MergeToMainStep } from "../../src/steps/merge-to-main.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

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
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "https://github.com/test/pr/1", stderr: "", timedOut: false }));
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ exec, awaitApproval });
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.message).toContain("merged");
  });

  it("execute fails when PR creation fails", async () => {
    const exec = vi.fn(async () => ({ exitCode: 1, stdout: "", stderr: "not found", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("Failed to create PR");
  });

  it("execute fails when user declines merge", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "pr url", stderr: "", timedOut: false }));
    const awaitApproval = vi.fn(async () => { throw new Error("declined"); });
    const ctx = makeMockContext({ exec, awaitApproval });
    const step = new MergeToMainStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("declined");
  });
});
