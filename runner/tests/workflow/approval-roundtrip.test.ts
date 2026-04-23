import { describe, it, expect } from "vitest";
import { Executor } from "../../src/runner/executor.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { OrchestratorConfig, StepDefinition } from "../../src/types.js";

// Import steps to trigger registration
import "../../src/steps/dependency-resolve.js";

function makeTempProject(): string {
  const dir = join(tmpdir(), `approval-roundtrip-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const CONFIG: OrchestratorConfig = {
  project: "approval-test",
  scope: { type: "page", target: null },
  branches: { main: "main", feature: null },
  artifacts: {
    requirements: "docs/UI_REQUIREMENTS.md",
    inventory: "docs/COMPONENT_INVENTORY.md",
    build_plan: "docs/BUILD_PLAN.md",
    build_status: "docs/BUILD_STATUS.md",
    design_audit: "docs/DESIGN_AUDIT.md",
    visual_qa: "docs/VISUAL_QA.md",
  },
  commands: {
    test_client: "echo pass",
    test_server: "echo pass",
    test_e2e: "echo pass",
    build_client: "echo pass",
    dev_server: "echo pass",
    typecheck: "echo pass",
  },
  ci: { required_on_main: [], required_on_feature: [], informational_on_feature: [] },
  evidence: {
    playwright_config: "playwright.config.ts",
    output_dir: "test-results",
    json_report: "test-results/results.json",
    collect_to: ".orchestrator/evidence",
  },
  dev_server_url: "http://localhost:3000",
  approval_mode: "interactive",
};

describe("Approval round-trip", () => {
  it("interactive mode returns needs_approval for approval-gated step", async () => {
    const dir = makeTempProject();
    // dependency-resolve is an approval-gated step
    // It first needs a command result for /build-pipeline:resolve-deps
    const cmdKey = "/build-pipeline:resolve-deps";
    const commandResults = new Map([[cmdKey, { success: true, output: "done", artifacts: [] }]]);

    // Create the BUILD_PLAN.md and COMPONENT_INVENTORY.md so preflight passes
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/BUILD_PLAN.md"), "## Wave 0\n- CompA\n");
    writeFileSync(join(dir, "docs/COMPONENT_INVENTORY.md"), "inventory");

    // Run just the dependency-resolve step
    const steps: StepDefinition[] = [
      { id: "dependency-resolve", type: "dependency-resolve", deps: [], params: {} },
    ];

    const executor = new Executor(CONFIG, steps, dir, commandResults);
    const output = await executor.runNext();

    expect(output.type).toBe("needs_approval");
    if (output.type === "needs_approval") {
      expect(output.stepId).toBe("dependency-resolve");
      expect(output.prompt).toContain("BUILD_PLAN.md");
    }

    rmSync(dir, { recursive: true });
  });

  it("re-invoke with approved result completes the step", async () => {
    const dir = makeTempProject();
    const cmdKey = "/build-pipeline:resolve-deps";
    const commandResults = new Map([[cmdKey, { success: true, output: "done", artifacts: [] }]]);

    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/BUILD_PLAN.md"), "## Wave 0\n- CompA\n## Wave 1\n- CompB\n");
    writeFileSync(join(dir, "docs/COMPONENT_INVENTORY.md"), "inventory");

    const steps: StepDefinition[] = [
      { id: "dependency-resolve", type: "dependency-resolve", deps: [], params: {} },
    ];

    // First call: gets needs_approval
    const executor1 = new Executor(CONFIG, steps, dir, commandResults);
    const output1 = await executor1.runNext();
    expect(output1.type).toBe("needs_approval");

    // Second call: provide approval result
    const approvalResults = new Map([["dependency-resolve", true]]);
    const executor2 = new Executor(CONFIG, steps, dir, commandResults, approvalResults);
    const output2 = await executor2.runNext();

    expect(output2.type).toBe("step_complete");
    if (output2.type === "step_complete") {
      expect(output2.stepId).toBe("dependency-resolve");
      expect(output2.result.status).toBe("passed");
      expect(output2.result.metrics.wave_count).toBe(2);
    }

    rmSync(dir, { recursive: true });
  });

  it("re-invoke with rejected result fails the step", async () => {
    const dir = makeTempProject();
    const cmdKey = "/build-pipeline:resolve-deps";
    const commandResults = new Map([[cmdKey, { success: true, output: "done", artifacts: [] }]]);

    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/BUILD_PLAN.md"), "## Wave 0\n- CompA\n");
    writeFileSync(join(dir, "docs/COMPONENT_INVENTORY.md"), "inventory");

    const steps: StepDefinition[] = [
      { id: "dependency-resolve", type: "dependency-resolve", deps: [], params: {} },
    ];

    // Provide rejection
    const approvalResults = new Map([["dependency-resolve", false]]);
    const executor = new Executor(CONFIG, steps, dir, commandResults, approvalResults);
    const output = await executor.runNext();

    expect(output.type).toBe("pipeline_failed");
    if (output.type === "pipeline_failed") {
      expect(output.result.message).toContain("rejected");
    }

    rmSync(dir, { recursive: true });
  });

  it("auto mode does not pause for approval", async () => {
    const dir = makeTempProject();
    const autoConfig = { ...CONFIG, approval_mode: "auto" as const };
    const cmdKey = "/build-pipeline:resolve-deps";
    const commandResults = new Map([[cmdKey, { success: true, output: "done", artifacts: [] }]]);

    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/BUILD_PLAN.md"), "## Wave 0\n- CompA\n");
    writeFileSync(join(dir, "docs/COMPONENT_INVENTORY.md"), "inventory");

    const steps: StepDefinition[] = [
      { id: "dependency-resolve", type: "dependency-resolve", deps: [], params: {} },
    ];

    const executor = new Executor(autoConfig, steps, dir, commandResults);
    const output = await executor.runNext();

    // Auto mode should complete the step without pausing
    expect(output.type).toBe("step_complete");

    rmSync(dir, { recursive: true });
  });
});
