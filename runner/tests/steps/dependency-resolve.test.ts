import { describe, it, expect, vi } from "vitest";
import { DependencyResolveStep, countWaves } from "../../src/steps/dependency-resolve.js";
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
    const readFile = vi.fn(async () => "## Wave 0\ncomponents");
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ exists, readFile, awaitApproval });
    const step = new DependencyResolveStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.artifacts).toContain("docs/BUILD_PLAN.md");
    expect(result.metrics.wave_count).toBeDefined();
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

  it("countWaves counts wave headers", () => {
    const content = "## Wave 0\nstuff\n## Wave 1\nmore\n## Wave 2\nend";
    expect(countWaves(content)).toBe(3);
  });

  it("countWaves returns 1 when no wave headers found", () => {
    expect(countWaves("no waves here")).toBe(1);
  });

  it("countWaves handles mixed case", () => {
    const content = "## wave 0\n## Wave 1\n## WAVE 2";
    expect(countWaves(content)).toBe(3);
  });

  it("execute returns wave_count in metrics", async () => {
    const planContent = "## Wave 0\ncomp A\n## Wave 1\ncomp B\n## Wave 2\ncomp C";
    const exists = vi.fn(async () => true);
    const readFile = vi.fn(async () => planContent);
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ exists, readFile, awaitApproval });
    const step = new DependencyResolveStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.metrics.wave_count).toBe(3);
  });
});
