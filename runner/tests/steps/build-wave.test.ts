import { describe, it, expect, vi } from "vitest";
import { BuildWaveStep } from "../../src/steps/build-wave.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("BuildWaveStep", () => {
  it("describe() includes wave number in summary", () => {
    const step = new BuildWaveStep(makeDefinition({ params: { wave: 2 } }));
    const desc = step.describe();
    expect(desc.summary).toContain("wave 2");
    expect(desc.scope).toBe("component");
  });

  it("preflight fails when inventory missing", async () => {
    const step = new BuildWaveStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => false) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues).toContainEqual(expect.stringContaining("COMPONENT_INVENTORY"));
  });

  it("preflight fails when wave-plan.json missing", async () => {
    const step = new BuildWaveStep(makeDefinition());
    const exists = vi.fn(async (path: string) => path !== ".orchestrator/wave-plan.json");
    const ctx = makeMockContext({ exists });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues).toContainEqual(expect.stringContaining("wave-plan.json"));
  });

  it("preflight passes when both inventory and wave-plan.json exist", async () => {
    const step = new BuildWaveStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => true) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("execute passes on success", async () => {
    const exists = vi.fn(async () => true);
    const invokeCommand = vi.fn(async () => ({ success: true, output: "built", artifacts: ["Header.tsx"] }));
    const ctx = makeMockContext({ exists, invokeCommand });
    const step = new BuildWaveStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(invokeCommand).toHaveBeenCalledWith("/build-component", "--wave 1");
    expect(result.metrics.wave).toBe(1);
  });

  it("execute fails on command failure", async () => {
    const invokeCommand = vi.fn(async () => ({ success: false, output: "", artifacts: [], error: "build error" }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new BuildWaveStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
  });
});
