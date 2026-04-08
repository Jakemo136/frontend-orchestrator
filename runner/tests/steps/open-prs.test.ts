import { describe, it, expect, vi } from "vitest";
import { OpenPrsStep } from "../../src/steps/open-prs.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("OpenPrsStep", () => {
  it("describe() includes wave in summary", () => {
    const step = new OpenPrsStep(makeDefinition({ params: { wave: 3 } }));
    const desc = step.describe();
    expect(desc.summary).toContain("wave 3");
    expect(desc.scope).toBe("component");
  });

  it("preflight always ready", async () => {
    const step = new OpenPrsStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute passes and reports PR count", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "PRs created", artifacts: ["#101", "#102"] }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new OpenPrsStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.metrics.pr_count).toBe(2);
  });

  it("execute fails on command failure", async () => {
    const invokeCommand = vi.fn(async () => ({ success: false, output: "", artifacts: [], error: "gh error" }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new OpenPrsStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
  });
});
