import { vi } from "vitest";
import type { StepDefinition, RunContext } from "../../src/types.js";

export function makeDefinition(overrides: Partial<StepDefinition> = {}): StepDefinition {
  return {
    id: overrides.id ?? "test-step",
    type: overrides.type ?? "test",
    deps: overrides.deps ?? [],
    params: overrides.params ?? {},
  };
}

export function makeMockContext(overrides: Partial<RunContext> = {}): RunContext {
  return {
    config: {
      project: "test",
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
        test_client: "npm run test:client",
        test_server: "npm run test:server",
        test_e2e: "npm run test:e2e",
        build_client: "npm run build",
        dev_server: "npm run dev",
        typecheck: "npx tsc --noEmit",
      },
      ci: { required_on_main: [], required_on_feature: [], informational_on_feature: [] },
      evidence: {
        playwright_config: "playwright.config.ts",
        output_dir: "test-results",
        json_report: "test-results/results.json",
        collect_to: ".orchestrator/evidence",
      },
    },
    state: { project: "test", scope: { type: "app", target: null }, started_at: "", updated_at: "", steps: {} },
    projectRoot: "/tmp/test",
    scope: { type: "app", target: null },
    resolve: (p) => `/tmp/test/${p}`,
    exists: vi.fn(async () => false),
    exec: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false })),
    invokeCommand: vi.fn(async () => ({ success: true, output: "", artifacts: [] })),
    awaitApproval: vi.fn(async () => {}),
    updateState: vi.fn(),
    ...overrides,
  };
}
