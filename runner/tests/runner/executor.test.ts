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
  CommandResult,
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

class CommandNeedingStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "needs-command",
      summary: "Needs a command",
      prerequisites: [],
      artifacts: [],
      passCondition: "command result provided",
      failCondition: "no command result",
      scope: "component",
    };
  }
  async preflight(): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }
  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.invokeCommand("/test-command", "some-arg");
    return { status: "passed", artifacts: [], metrics: {}, message: `Got: ${result.output}` };
  }
}

// Register test step types
registerStep("passing", PassingStep);
registerStep("failing-preflight", FailingPreflightStep);
registerStep("needs-command", CommandNeedingStep);

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
  evidence: {
    playwright_config: "playwright.config.ts",
    output_dir: "test-results",
    json_report: "test-results/results.json",
    collect_to: ".orchestrator/evidence",
  },
  dev_server_url: "http://localhost:3000",
};

describe("Executor", () => {
  it("runs the next available step and updates state", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "passing", deps: [], params: {} },
    ];
    const executor = new Executor(CONFIG, steps, dir);
    const result = await executor.runNext();
    expect(result.type).toBe("step_complete");
    if (result.type === "step_complete") {
      expect(result.stepId).toBe("step-a");
      expect(result.result.status).toBe("passed");
    }
    rmSync(dir, { recursive: true });
  });

  it("returns pipeline_done when no steps are runnable", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "passing", deps: ["nonexistent"], params: {} },
    ];
    const executor = new Executor(CONFIG, steps, dir);
    const result = await executor.runNext();
    expect(result.type).toBe("pipeline_done");
    rmSync(dir, { recursive: true });
  });

  it("fails step when preflight fails", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "failing-preflight", deps: [], params: {} },
    ];
    const executor = new Executor(CONFIG, steps, dir);
    const result = await executor.runNext();
    expect(result.type).toBe("pipeline_failed");
    if (result.type === "pipeline_failed") {
      expect(result.result.status).toBe("failed");
      expect(result.result.message).toContain("Something is missing");
    }
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
    expect(r1.type).toBe("step_complete");
    if (r1.type === "step_complete") {
      expect(r1.stepId).toBe("first");
    }

    const r2 = await executor.runNext();
    expect(r2.type).toBe("step_complete");
    if (r2.type === "step_complete") {
      expect(r2.stepId).toBe("second");
    }

    const r3 = await executor.runNext();
    expect(r3.type).toBe("pipeline_done");

    rmSync(dir, { recursive: true });
  });

  it("returns needs_command when step calls invokeCommand", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "needs-command", deps: [], params: {} },
    ];
    const executor = new Executor(CONFIG, steps, dir);
    const result = await executor.runNext();
    expect(result.type).toBe("needs_command");
    if (result.type === "needs_command") {
      expect(result.command).toBe("/test-command");
      expect(result.args).toBe("some-arg");
    }
    rmSync(dir, { recursive: true });
  });

  it("returns step_complete when command result is pre-supplied", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "needs-command", deps: [], params: {} },
    ];
    const commandResults = new Map<string, CommandResult>();
    commandResults.set("/test-command some-arg", {
      success: true,
      output: "hello from skill",
      artifacts: [],
    });
    const executor = new Executor(CONFIG, steps, dir, commandResults);
    const result = await executor.runNext();
    expect(result.type).toBe("step_complete");
    if (result.type === "step_complete") {
      expect(result.result.message).toContain("hello from skill");
    }
    rmSync(dir, { recursive: true });
  });

  it("resumes in_progress step with command result on second invocation", async () => {
    const dir = makeTempDir();
    const steps: StepDefinition[] = [
      { id: "step-a", type: "needs-command", deps: [], params: {} },
    ];

    // First run — no command results, should yield needs_command
    const executor1 = new Executor(CONFIG, steps, dir);
    const r1 = await executor1.runNext();
    expect(r1.type).toBe("needs_command");

    // Second run — same directory, with command result pre-supplied
    const commandResults = new Map<string, CommandResult>();
    commandResults.set("/test-command some-arg", {
      success: true,
      output: "resumed successfully",
      artifacts: [],
    });
    const executor2 = new Executor(CONFIG, steps, dir, commandResults);
    const r2 = await executor2.runNext();
    expect(r2.type).toBe("step_complete");
    if (r2.type === "step_complete") {
      expect(r2.result.message).toContain("resumed successfully");
    }

    rmSync(dir, { recursive: true });
  });
});
