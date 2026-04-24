import { describe, it, expect } from "vitest";
import { Executor } from "../src/runner/executor.js";
import { generateDefaultPipeline } from "../src/config/defaults.js";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createFixtureProject } from "./helpers/fixture-project.js";
import type { OrchestratorConfig, StepDefinition, CommandResult } from "../src/types.js";

// Import steps to trigger registration
import "../src/steps/session-start.js";
import "../src/steps/requirements-gate.js";
import "../src/steps/build-wave.js";
import "../src/steps/test-suite.js";
import "../src/steps/build-client.js";
import "../src/steps/dependency-resolve.js";

function makeTempProject(): string {
  const dir = join(tmpdir(), `orchestrator-int-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const CONFIG: OrchestratorConfig = {
  project: "integration-test",
  scope: { type: "component", target: "TestWidget" },
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
    test_client: "echo 'Tests: 5 passed'",
    test_server: "echo pass",
    test_e2e: "echo pass",
    build_client: "echo pass",
    dev_server: "echo pass",
    typecheck: "echo pass",
  },
  ci: {
    required_on_main: ["server", "client", "e2e"],
    required_on_feature: ["server", "client"],
    informational_on_feature: ["e2e"],
  },
  evidence: {
    playwright_config: "playwright.config.ts",
    output_dir: "test-results",
    json_report: "test-results/results.json",
    collect_to: ".orchestrator/evidence",
  },
  dev_server_url: "http://localhost:3000",
};

describe("Integration: component-scope pipeline", () => {
  it("runs session-start as first step for component scope", async () => {
    const dir = makeTempProject();
    const steps = generateDefaultPipeline(CONFIG);
    const executor = new Executor(CONFIG, steps, dir);

    const result = await executor.runNext();
    // session-start calls invokeCommand("/session-start"), so without a pre-supplied
    // command result it signals needs_command — that's the correct behavior.
    expect(result.type).toBe("needs_command");
    if (result.type === "needs_command") {
      expect(result.stepId).toBe("session-start");
      expect(result.command).toBe("/session-start");
    }

    rmSync(dir, { recursive: true });
  });

  it("skips steps below component scope threshold", async () => {
    const dir = makeTempProject();
    const steps = generateDefaultPipeline(CONFIG);
    // Component scope should NOT include e2e-scaffold, design-audit, etc.
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain("e2e-scaffold");
    expect(ids).not.toContain("design-audit");
    rmSync(dir, { recursive: true });
  });
});

describe("Integration: multi-step flows", () => {
  it("build-wave preflight passes when fixture has inventory and wave-plan.json", async () => {
    const fixture = createFixtureProject({}, {
      inventory: "## Components\n- Header\n- Footer",
      wavePlan: { wave_count: 1, waves: { "0": ["Header", "Footer"] } },
    });
    try {
      const steps: StepDefinition[] = [
        { id: "build-wave:0", type: "build-wave", deps: [], params: { wave: 0 } },
      ];
      const commandResults = new Map<string, CommandResult>([
        ["/build-component --wave 0", { success: true, output: "built", artifacts: ["Header.tsx", "Footer.tsx"] }],
      ]);
      const executor = new Executor(fixture.config, steps, fixture.dir, commandResults);
      const result = await executor.runNext();
      expect(result.type).toBe("step_complete");
      if (result.type === "step_complete") {
        expect(result.result.status).toBe("passed");
        expect(result.result.message).toContain("Wave 0");
      }
    } finally {
      fixture.cleanup();
    }
  });

  it("test-suite runs through exec (not invokeCommand) and passes with echo commands", async () => {
    const fixture = createFixtureProject();
    try {
      const steps: StepDefinition[] = [
        { id: "test-suite:0", type: "test-suite", deps: [], params: {} },
      ];
      const executor = new Executor(fixture.config, steps, fixture.dir);
      const result = await executor.runNext();
      expect(result.type).toBe("step_complete");
      if (result.type === "step_complete") {
        expect(result.result.status).toBe("passed");
        expect(result.result.metrics.typecheck).toBe(0);
        expect(result.result.metrics.client_tests).toBe(0);
      }
    } finally {
      fixture.cleanup();
    }
  });

  it("pipeline fails on preflight when required artifact is missing", async () => {
    const fixture = createFixtureProject();
    try {
      const steps: StepDefinition[] = [
        { id: "build-wave:0", type: "build-wave", deps: [], params: { wave: 0 } },
      ];
      const executor = new Executor(fixture.config, steps, fixture.dir);
      const result = await executor.runNext();
      expect(result.type).toBe("pipeline_failed");
      if (result.type === "pipeline_failed") {
        expect(result.result.message).toContain("Missing");
      }
    } finally {
      fixture.cleanup();
    }
  });
});
