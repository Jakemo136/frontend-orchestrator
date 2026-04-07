import { describe, it, expect, vi } from "vitest";
import { SetBaselineStep } from "../../src/steps/set-baseline.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("SetBaselineStep", () => {
  it("describe() returns page scope with approval gate", () => {
    const step = new SetBaselineStep(makeDefinition({ type: "set-baseline" }));
    const desc = step.describe();
    expect(desc.type).toBe("set-baseline");
    expect(desc.scope).toBe("page");
    expect(desc.passCondition).toContain("approves");
  });

  it("preflight always ready", async () => {
    const step = new SetBaselineStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute passes when user approves and command succeeds", async () => {
    const awaitApproval = vi.fn(async () => {});
    const invokeCommand = vi.fn(async () => ({ success: true, output: "baseline set", artifacts: [] }));
    const ctx = makeMockContext({ awaitApproval, invokeCommand });
    const step = new SetBaselineStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(awaitApproval).toHaveBeenCalled();
    expect(invokeCommand).toHaveBeenCalledWith("/set-baseline");
  });

  it("execute fails when user declines", async () => {
    const awaitApproval = vi.fn(async () => { throw new Error("declined"); });
    const ctx = makeMockContext({ awaitApproval });
    const step = new SetBaselineStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("declined");
  });
});
