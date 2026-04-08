import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/config/loader.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function makeTempDir(): string {
  const dir = join(tmpdir(), `orchestrator-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const VALID_YAML = `
project: test-project
scope:
  type: app
  target: null
branches:
  main: main
  feature: feat/rebuild
artifacts:
  requirements: docs/UI_REQUIREMENTS.md
  inventory: docs/COMPONENT_INVENTORY.md
  build_plan: docs/BUILD_PLAN.md
  build_status: docs/BUILD_STATUS.md
  design_audit: docs/DESIGN_AUDIT.md
  visual_qa: docs/VISUAL_QA.md
commands:
  test_client: "npm test"
  test_server: "cd server && npm test"
  test_e2e: "npx playwright test"
  build_client: "npm run build"
  dev_server: "npm run dev"
  typecheck: "npx tsc --noEmit"
ci:
  required_on_main: [server, client, e2e]
  required_on_feature: [server, client]
  informational_on_feature: [e2e]
`;

describe("loadConfig", () => {
  it("loads and validates a YAML config file", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "orchestrator.config.yaml"), VALID_YAML);
    const config = loadConfig(dir);
    expect(config.project).toBe("test-project");
    expect(config.scope.type).toBe("app");
    rmSync(dir, { recursive: true });
  });

  it("throws if config file is missing", () => {
    const dir = makeTempDir();
    expect(() => loadConfig(dir)).toThrow(/not found/i);
    rmSync(dir, { recursive: true });
  });

  it("throws if config is invalid YAML", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "orchestrator.config.yaml"), "project: ");
    expect(() => loadConfig(dir)).toThrow();
    rmSync(dir, { recursive: true });
  });
});
