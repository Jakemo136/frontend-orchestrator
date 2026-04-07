import { describe, it, expect, vi } from "vitest";
import { PreCommitReviewStep } from "../../src/steps/pre-commit-review.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("PreCommitReviewStep", () => {
  it("describe() returns component scope", () => {
    const step = new PreCommitReviewStep(makeDefinition({ type: "pre-commit-review" }));
    const desc = step.describe();
    expect(desc.type).toBe("pre-commit-review");
    expect(desc.scope).toBe("component");
  });

  it("preflight always ready", async () => {
    const step = new PreCommitReviewStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute passes when all checks green", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false }));
    const invokeCommand = vi.fn(async () => ({ success: true, output: "ok", artifacts: [] }));
    const ctx = makeMockContext({ exec, invokeCommand });
    const step = new PreCommitReviewStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(invokeCommand).toHaveBeenCalledTimes(2); // review + simplify
    expect(exec).toHaveBeenCalledTimes(3); // typecheck + client + e2e
  });

  it("execute fails when client tests fail", async () => {
    let execCount = 0;
    const exec = vi.fn(async () => {
      execCount++;
      // Second exec call is client tests
      return { exitCode: execCount === 2 ? 1 : 0, stdout: "", stderr: "test fail", timedOut: false };
    });
    const invokeCommand = vi.fn(async () => ({ success: true, output: "ok", artifacts: [] }));
    const ctx = makeMockContext({ exec, invokeCommand });
    const step = new PreCommitReviewStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("client tests failed");
  });
});
