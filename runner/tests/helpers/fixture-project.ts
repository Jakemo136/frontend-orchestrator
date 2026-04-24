import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { OrchestratorConfig } from "../../src/types.js";
import type { WavePlan } from "../../src/steps/dependency-resolve.js";

const DEFAULT_CONFIG: OrchestratorConfig = {
  project: "fixture",
  scope: { type: "app", target: null },
  branches: { main: "main", feature: "feat/test" },
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
  dev_server_url: "http://localhost:3000",
  evidence: {
    playwright_config: "playwright.config.ts",
    output_dir: "test-results",
    json_report: "test-results/results.json",
    collect_to: ".orchestrator/evidence",
  },
};

interface FixtureArtifacts {
  requirements?: string;
  inventory?: string;
  buildPlan?: string;
  wavePlan?: WavePlan;
}

export interface FixtureProject {
  dir: string;
  config: OrchestratorConfig;
  cleanup: () => void;
}

export function createFixtureProject(
  configOverrides: Partial<OrchestratorConfig> = {},
  artifacts: FixtureArtifacts = {},
): FixtureProject {
  const dir = join(tmpdir(), `orchestrator-fixture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(dir, "docs"), { recursive: true });
  mkdirSync(join(dir, ".orchestrator"), { recursive: true });

  const config: OrchestratorConfig = { ...DEFAULT_CONFIG, ...configOverrides };

  if (artifacts.requirements) {
    writeFileSync(join(dir, config.artifacts.requirements), artifacts.requirements);
  }
  if (artifacts.inventory) {
    writeFileSync(join(dir, config.artifacts.inventory), artifacts.inventory);
  }
  if (artifacts.buildPlan) {
    writeFileSync(join(dir, config.artifacts.build_plan), artifacts.buildPlan);
  }
  if (artifacts.wavePlan) {
    writeFileSync(join(dir, ".orchestrator/wave-plan.json"), JSON.stringify(artifacts.wavePlan, null, 2));
  }

  return {
    dir,
    config,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
