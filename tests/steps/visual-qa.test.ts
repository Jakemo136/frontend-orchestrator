import { describe, it, expect, vi } from "vitest";
import { VisualQaStep } from "../../src/steps/visual-qa.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("VisualQaStep", () => {
  it("describe() returns page scope with prerequisites", () => {
    const step = new VisualQaStep(makeDefinition({ type: "visual-qa" }));
    const desc = step.describe();
    expect(desc.type).toBe("visual-qa");
    expect(desc.scope).toBe("page");
    expect(desc.prerequisites).toContain("DESIGN_AUDIT.md");
  });

  it("preflight fails when design audit missing", async () => {
    const exists = vi.fn(async () => false);
    const ctx = makeMockContext({ exists });
    const step = new VisualQaStep(makeDefinition());
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("design-audit");
  });

  it("preflight passes when design audit exists", async () => {
    const exists = vi.fn(async () => true);
    const ctx = makeMockContext({ exists });
    const step = new VisualQaStep(makeDefinition());
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
  });

  it("execute passes on command success", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "qa done", artifacts: ["docs/VISUAL_QA.md"] }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new VisualQaStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(invokeCommand).toHaveBeenCalledWith("/visual-qa");
  });
});
