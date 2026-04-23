// tests/runner/executor-run-step.test.ts
import { describe, it, expect } from "vitest";
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
  OrchestratorConfig,
} from "../../src/types.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `orchestrator-run-step-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

class TrackingStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "tracking",
      summary: "Records which step ran",
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
    return {
      status: "passed",
      artifacts: [],
      metrics: { ran: 1 },
      message: `step ${this.definition.id} executed`,
    };
  }
}

class FailingPreflightStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "failing-preflight",
      summary: "Always fails preflight",
      prerequisites: [],
      artifacts: [],
      passCondition: "never",
      failCondition: "always",
      scope: "component",
    };
  }
  async preflight(): Promise<PreflightResult> {
    return { ready: false, issues: ["missing required artifact", "config invalid"] };
  }
  async execute(): Promise<StepResult> {
    return { status: "passed", artifacts: [], metrics: {}, message: "should not reach here" };
  }
}

// Register the test step types
registerStep("tracking", TrackingStep);
registerStep("failing-preflight", FailingPreflightStep);

const CONFIG: OrchestratorConfig = {
  project: "test-run-step",
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
  evidence: {
    playwright_config: "playwright.config.ts",
    output_dir: "test-results",
    json_report: "test-results/results.json",
    collect_to: ".orchestrator/evidence",
  },
  dev_server_url: "http://localhost:3000",
};

describe("Executor.runStep()", () => {
  it("executes the requested step even when another step would be first in DAG order", async () => {
    const dir = makeTempDir();
    try {
      const steps: StepDefinition[] = [
        { id: "step-a", type: "tracking", deps: [], params: {} },
        { id: "step-b", type: "tracking", deps: [], params: {} },
      ];
      const executor = new Executor(CONFIG, steps, dir);

      // runStep("step-b") should run step-b, not step-a (which would be first runnable)
      const result = await executor.runStep("step-b");

      expect(result.type).toBe("step_complete");
      if (result.type === "step_complete") {
        expect(result.stepId).toBe("step-b");
        expect(result.result.status).toBe("passed");
        expect(result.result.message).toContain("step-b");
      }
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("returns pipeline_failed for an unknown step ID", async () => {
    const dir = makeTempDir();
    try {
      const steps: StepDefinition[] = [
        { id: "step-a", type: "tracking", deps: [], params: {} },
      ];
      const executor = new Executor(CONFIG, steps, dir);

      const result = await executor.runStep("nonexistent");

      expect(result.type).toBe("pipeline_failed");
      if (result.type === "pipeline_failed") {
        expect(result.stepId).toBe("nonexistent");
        expect(result.result.status).toBe("failed");
        expect(result.result.message).toContain("nonexistent");
      }
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("executes a child step even when its parent dep has not run (force mode)", async () => {
    const dir = makeTempDir();
    try {
      const steps: StepDefinition[] = [
        { id: "parent", type: "tracking", deps: [], params: {} },
        { id: "child", type: "tracking", deps: ["parent"], params: {} },
      ];
      const executor = new Executor(CONFIG, steps, dir);

      // child depends on parent, but runStep bypasses DAG dependency checks
      const result = await executor.runStep("child");

      expect(result.type).toBe("step_complete");
      if (result.type === "step_complete") {
        expect(result.stepId).toBe("child");
        expect(result.result.status).toBe("passed");
      }
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("returns pipeline_failed when a step's preflight returns ready: false", async () => {
    const dir = makeTempDir();
    try {
      const steps: StepDefinition[] = [
        { id: "needs-preflight", type: "failing-preflight", deps: [], params: {} },
      ];
      const executor = new Executor(CONFIG, steps, dir);

      const result = await executor.runStep("needs-preflight");

      expect(result.type).toBe("pipeline_failed");
      if (result.type === "pipeline_failed") {
        expect(result.stepId).toBe("needs-preflight");
        expect(result.result.status).toBe("failed");
        expect(result.result.message).toContain("Preflight failed");
        expect(result.result.message).toContain("missing required artifact");
      }
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
