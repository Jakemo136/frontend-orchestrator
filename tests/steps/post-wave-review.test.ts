import { describe, it, expect, vi } from "vitest";
import { PostWaveReviewStep } from "../../src/steps/post-wave-review.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("PostWaveReviewStep", () => {
  it("describe() returns page scope", () => {
    const step = new PostWaveReviewStep(makeDefinition({ type: "post-wave-review" }));
    const desc = step.describe();
    expect(desc.type).toBe("post-wave-review");
    expect(desc.scope).toBe("page");
  });

  it("preflight always ready", async () => {
    const step = new PostWaveReviewStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute passes when all reviews succeed", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "ok", artifacts: [] }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new PostWaveReviewStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(invokeCommand).toHaveBeenCalledTimes(4);
    expect(invokeCommand).toHaveBeenCalledWith("/wiring-audit");
  });

  it("execute fails when a reviewer finds critical issues", async () => {
    let callCount = 0;
    const invokeCommand = vi.fn(async () => {
      callCount++;
      return { success: callCount !== 2, output: "", artifacts: [], error: callCount === 2 ? "issues" : undefined };
    });
    const ctx = makeMockContext({ invokeCommand });
    const step = new PostWaveReviewStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("code-simplify");
  });

  it("execute fails when wiring audit fails", async () => {
    let callCount = 0;
    const invokeCommand = vi.fn(async () => {
      callCount++;
      // First 3 succeed (code-review, code-simplify, design-audit), 4th (wiring-audit) fails
      return { success: callCount !== 4, output: "", artifacts: [], error: callCount === 4 ? "missing wiring" : undefined };
    });
    const ctx = makeMockContext({ invokeCommand });
    const step = new PostWaveReviewStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("wiring-audit");
    expect(result.message).toContain("Missing wiring tests");
  });
});
