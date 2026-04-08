import { describe, it, expect, vi } from "vitest";
import { E2eGreenStep } from "../../src/steps/e2e-green.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("E2eGreenStep", () => {
  it("describe() returns page scope", () => {
    const step = new E2eGreenStep(makeDefinition({ type: "e2e-green" }));
    const desc = step.describe();
    expect(desc.type).toBe("e2e-green");
    expect(desc.scope).toBe("page");
  });

  it("preflight always ready", async () => {
    const step = new E2eGreenStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute passes when e2e exit code 0", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "12 passed", stderr: "", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new E2eGreenStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.metrics.e2e_exit_code).toBe(0);
  });

  it("execute fails when e2e tests fail", async () => {
    const exec = vi.fn(async () => ({ exitCode: 1, stdout: "", stderr: "3 failed", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new E2eGreenStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("E2E tests failed");
  });

  it("populates evidence field after e2e run", async () => {
    const exec = vi.fn(async () => ({ exitCode: 1, stdout: "", stderr: "3 failed", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new E2eGreenStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result).toHaveProperty("evidence");
  });
});
