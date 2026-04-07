import { describe, it, expect, vi } from "vitest";
import { E2eScaffoldStep } from "../../src/steps/e2e-scaffold.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("E2eScaffoldStep", () => {
  it("describe() returns page scope", () => {
    const step = new E2eScaffoldStep(makeDefinition({ type: "e2e-scaffold" }));
    const desc = step.describe();
    expect(desc.type).toBe("e2e-scaffold");
    expect(desc.scope).toBe("page");
  });

  it("preflight fails when requirements missing", async () => {
    const step = new E2eScaffoldStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => false) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
  });

  it("execute passes on success", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "done", artifacts: ["e2e/test.spec.ts"] }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new E2eScaffoldStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(invokeCommand).toHaveBeenCalledWith("/build-pipeline:e2e");
  });

  it("execute fails on command failure", async () => {
    const invokeCommand = vi.fn(async () => ({ success: false, output: "", artifacts: [], error: "scaffold error" }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new E2eScaffoldStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("scaffold error");
  });
});
