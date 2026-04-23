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
    const invokeCommand = vi.fn(async (cmd: string) => {
      if (cmd === "/code-simplify") {
        return { success: false, output: "", artifacts: [], error: "issues" };
      }
      return { success: true, output: "", artifacts: [] };
    });
    const ctx = makeMockContext({ invokeCommand });
    const step = new PostWaveReviewStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("code-simplify");
  });

  it("execute fails when wiring audit fails", async () => {
    const invokeCommand = vi.fn(async (cmd: string) => {
      if (cmd === "/wiring-audit") {
        return { success: false, output: "", artifacts: [], error: "missing wiring" };
      }
      return { success: true, output: "", artifacts: [] };
    });
    const ctx = makeMockContext({ invokeCommand });
    const step = new PostWaveReviewStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("wiring-audit");
  });
});
