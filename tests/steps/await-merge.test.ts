import { describe, it, expect, vi } from "vitest";
import { AwaitMergeStep } from "../../src/steps/await-merge.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("AwaitMergeStep", () => {
  it("describe() includes wave in summary", () => {
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 2 } }));
    const desc = step.describe();
    expect(desc.summary).toContain("wave 2");
    expect(desc.scope).toBe("component");
  });

  it("preflight always ready", async () => {
    const step = new AwaitMergeStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute passes when user confirms merges", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "[]", stderr: "", timedOut: false }));
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ exec, awaitApproval });
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(awaitApproval).toHaveBeenCalled();
  });

  it("execute fails when user declines", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "[{\"number\":1}]", stderr: "", timedOut: false }));
    const awaitApproval = vi.fn(async () => { throw new Error("declined"); });
    const ctx = makeMockContext({ exec, awaitApproval });
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("declined");
  });
});
