import { describe, it, expect, vi } from "vitest";
import { ReviewRequirementsStep } from "../../src/steps/review-requirements.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("ReviewRequirementsStep", () => {
  it("describe() returns page scope and informational pass condition", () => {
    const step = new ReviewRequirementsStep(makeDefinition({ type: "review-requirements" }));
    const desc = step.describe();
    expect(desc.type).toBe("review-requirements");
    expect(desc.scope).toBe("page");
    expect(desc.failCondition).toBe("never");
  });

  it("preflight fails when artifacts missing", async () => {
    const step = new ReviewRequirementsStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => false) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it("preflight passes when artifacts exist", async () => {
    const step = new ReviewRequirementsStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => true) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
  });

  it("execute always passes (informational)", async () => {
    const invokeCommand = vi.fn(async () => ({ success: false, output: "", artifacts: [], error: "oops" }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new ReviewRequirementsStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(invokeCommand).toHaveBeenCalledWith("/review-requirements");
  });
});
