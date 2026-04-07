import { describe, it, expect, vi } from "vitest";
import { DependencyResolveStep } from "../../src/steps/dependency-resolve.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("DependencyResolveStep", () => {
  it("describe() includes BUILD_PLAN.md artifact", () => {
    const step = new DependencyResolveStep(makeDefinition({ type: "dependency-resolve" }));
    const desc = step.describe();
    expect(desc.artifacts).toContain("BUILD_PLAN.md");
    expect(desc.scope).toBe("page");
  });

  it("preflight fails when inventory missing", async () => {
    const step = new DependencyResolveStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => false) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
  });

  it("execute passes when plan generated and user approves", async () => {
    const exists = vi.fn(async () => true);
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ exists, awaitApproval });
    const step = new DependencyResolveStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.artifacts).toContain("docs/BUILD_PLAN.md");
  });

  it("execute fails when plan not generated", async () => {
    const exists = vi.fn(async () => false);
    const ctx = makeMockContext({ exists });
    const step = new DependencyResolveStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("not generated");
  });

  it("execute fails when user rejects plan", async () => {
    const exists = vi.fn(async () => true);
    const awaitApproval = vi.fn(async () => { throw new Error("rejected"); });
    const ctx = makeMockContext({ exists, awaitApproval });
    const step = new DependencyResolveStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("rejected");
  });
});
