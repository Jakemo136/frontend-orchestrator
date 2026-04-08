import { describe, it, expect, vi } from "vitest";
import { TestSuiteStep } from "../../src/steps/test-suite.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("TestSuiteStep", () => {
  it("describe() returns component scope", () => {
    const step = new TestSuiteStep(makeDefinition({ type: "test-suite" }));
    const desc = step.describe();
    expect(desc.type).toBe("test-suite");
    expect(desc.scope).toBe("component");
  });

  it("preflight always ready", async () => {
    const step = new TestSuiteStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute passes when all tests pass", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "ok", stderr: "", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new TestSuiteStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(exec).toHaveBeenCalledTimes(3); // typecheck, client, e2e
  });

  it("execute fails on typecheck failure", async () => {
    const exec = vi.fn(async () => ({ exitCode: 1, stdout: "error TS2345", stderr: "", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new TestSuiteStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("Typecheck failed");
  });

  it("execute passes with e2e failure when not blocking", async () => {
    let callCount = 0;
    const exec = vi.fn(async () => {
      callCount++;
      // Third call is e2e
      return { exitCode: callCount === 3 ? 1 : 0, stdout: "", stderr: "e2e fail", timedOut: false };
    });
    const ctx = makeMockContext({ exec });
    const step = new TestSuiteStep(makeDefinition({ params: { e2e_blocking: false } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.metrics.e2e).toBe(1);
  });

  it("execute fails with e2e failure when blocking", async () => {
    let callCount = 0;
    const exec = vi.fn(async () => {
      callCount++;
      return { exitCode: callCount === 3 ? 1 : 0, stdout: "", stderr: "e2e fail", timedOut: false };
    });
    const ctx = makeMockContext({ exec });
    const step = new TestSuiteStep(makeDefinition({ params: { e2e_blocking: true } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("E2E tests failed (blocking)");
  });

  it("populates evidence field after e2e run", async () => {
    let callCount = 0;
    const exec = vi.fn(async () => {
      callCount++;
      return { exitCode: callCount === 3 ? 1 : 0, stdout: "", stderr: "", timedOut: false };
    });
    const ctx = makeMockContext({ exec });
    const step = new TestSuiteStep(makeDefinition({ params: { e2e_blocking: true } }));
    const result = await step.execute(ctx);
    expect(result).toHaveProperty("evidence");
  });
});
