import { describe, it, expect } from "vitest";
import { Executor } from "../src/runner/executor.js";
import { generateDefaultPipeline } from "../src/config/defaults.js";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { OrchestratorConfig } from "../src/types.js";

// Import steps to trigger registration
import "../src/steps/session-start.js";
import "../src/steps/requirements-gate.js";

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
