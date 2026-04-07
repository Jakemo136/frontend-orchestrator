// tests/runner/executor.test.ts
import { describe, it, expect, vi } from "vitest";
import { Executor } from "../../src/runner/executor.js";
import { BaseStep } from "../../src/steps/base.js";
import { registerStep } from "../../src/steps/registry.js";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type {
  StepDefinition,
  StepDescription,
  PreflightResult,
  StepResult,
  RunContext,
  OrchestratorConfig,
} from "../../src/types.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `orchestrator-exec-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

class PassingStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "passing",
      summary: "Always passes",
      prerequisites: [],
      artifacts: [],
      passCondition: "always",
      failCondition: "never",
      scope: "component",
    };
  }
  async preflight(): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }
  async execute(): Promise<StepResult> {
    return { status: "passed", artifacts: [], metrics: { ran: 1 }, message: "passed" };
  }
}

class FailingPreflightStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "failing-preflight",
      summary: "Preflight fails",
      prerequisites: [],
      artifacts: [],
      passCondition: "never",
      failCondition: "always",
      scope: "component",
    };
  }
  async preflight(): Promise<PreflightResult> {
    return { ready: false, issues: ["Something is missing"] };
  }
  async execute(): Promise<StepResult> {
    return { status: "passed", artifacts: [], metrics: {}, message: "should not run" };
  }
}

// Register test step types
registerStep("passing", PassingStep);
registerStep("failing-preflight", FailingPreflightStep);

const CONFIG: OrchestratorConfig = {
  project: "test",
  scope: { type: "app", target: null },
  branches: { main: "main", feature: null },
  artifacts: {
    requirements: "docs/reqs.md",
    inventory: "docs/inv.md",
    build_plan: "docs/plan.md",
    build_status: "docs/status.md",
    design_audit: "docs/audit.md",
    visual_qa: "docs/qa.md",
  },
  commands: {
    test_client: "echo pass",
    test_server: "echo pass",
    test_e2e: "echo pass",
    build_client: "echo pass",
    dev_server: "echo pass",
    typecheck: "echo pass",
  },
  ci: {
    required_on_main: [],
    required_on_feature: [],
    informational_on_feature: [],
  },
};

describe("Executor", () => {
  it("runs the next available step and updates state", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "passing", deps: [], params: {} },
    ];
    const executor = new Executor(CONFIG, steps, dir);
    const result = await executor.runNext();
    expect(result).not.toBeNull();
    expect(result!.stepId).toBe("step-a");
    expect(result!.result.status).toBe("passed");
    rmSync(dir, { recursive: true });
  });

  it("returns null when no steps are runnable", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "passing", deps: ["nonexistent"], params: {} },
    ];
    const executor = new Executor(CONFIG, steps, dir);
    const result = await executor.runNext();
    expect(result).toBeNull();
    rmSync(dir, { recursive: true });
  });

  it("fails step when preflight fails", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "failing-preflight", deps: [], params: {} },
    ];
    const executor = new Executor(CONFIG, steps, dir);
    const result = await executor.runNext();
    expect(result).not.toBeNull();
    expect(result!.result.status).toBe("failed");
    expect(result!.result.message).toContain("Something is missing");
    rmSync(dir, { recursive: true });
  });

  it("runs steps in dependency order across multiple runNext calls", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "first", type: "passing", deps: [], params: {} },
      { id: "second", type: "passing", deps: ["first"], params: {} },
    ];
    const executor = new Executor(CONFIG, steps, dir);

    const r1 = await executor.runNext();
    expect(r1!.stepId).toBe("first");

    const r2 = await executor.runNext();
    expect(r2!.stepId).toBe("second");

    const r3 = await executor.runNext();
    expect(r3).toBeNull(); // nothing left

    rmSync(dir, { recursive: true });
  });
});
