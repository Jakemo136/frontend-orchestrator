// tests/steps/base.test.ts
import { describe, it, expect } from "vitest";
import { BaseStep } from "../../src/steps/base.js";
import { getStepClass, registerStep } from "../../src/steps/registry.js";
import type {
  StepDefinition,
  StepDescription,
  PreflightResult,
  StepResult,
  RunContext,
} from "../../src/types.js";

class TestStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: this.definition.type,
      summary: "A test step",
      prerequisites: [],
      artifacts: [],
      passCondition: "always",
      failCondition: "never",
      scope: "component",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(_ctx: RunContext): Promise<StepResult> {
    return { status: "passed", artifacts: [], metrics: {}, message: "done" };
  }
}

describe("BaseStep", () => {
  it("stores definition and exposes id and type", () => {
    const def: StepDefinition = { id: "test-1", type: "test", deps: [], params: {} };
    const step = new TestStep(def);
    expect(step.definition.id).toBe("test-1");
    expect(step.definition.type).toBe("test");
  });

  it("shouldSkip returns false when scope meets threshold", () => {
    const def: StepDefinition = { id: "test-1", type: "test", deps: [], params: {} };
    const step = new TestStep(def);
    // TestStep has scope "component" which is the lowest — never skipped
    expect(step.shouldSkip("component")).toBe(false);
    expect(step.shouldSkip("app")).toBe(false);
  });
});

describe("stepRegistry", () => {
  it("returns undefined for unknown type", () => {
    expect(getStepClass("nonexistent")).toBeUndefined();
  });

  it("registers and retrieves a step class", () => {
    registerStep("test-step", TestStep);
    const cls = getStepClass("test-step");
    expect(cls).toBe(TestStep);
  });
});
