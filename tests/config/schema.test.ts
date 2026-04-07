import { describe, it, expect } from "vitest";
import { configSchema } from "../../src/config/schema.js";

const VALID_CONFIG = {
  project: "test-project",
  scope: { type: "app", target: null },
  branches: { main: "main", feature: "feat/rebuild" },
  artifacts: {
    requirements: "docs/UI_REQUIREMENTS.md",
    inventory: "docs/COMPONENT_INVENTORY.md",
    build_plan: "docs/BUILD_PLAN.md",
    build_status: "docs/BUILD_STATUS.md",
    design_audit: "docs/DESIGN_AUDIT.md",
    visual_qa: "docs/VISUAL_QA.md",
  },
  commands: {
    test_client: "npm test",
    test_server: "cd server && npm test",
    test_e2e: "npx playwright test",
    build_client: "npm run build",
    dev_server: "npm run dev",
    typecheck: "npx tsc --noEmit",
  },
  ci: {
    required_on_main: ["server", "client", "e2e"],
    required_on_feature: ["server", "client"],
    informational_on_feature: ["e2e"],
  },
};

describe("configSchema", () => {
  it("accepts a valid full config", () => {
    const result = configSchema.safeParse(VALID_CONFIG);
    expect(result.success).toBe(true);
  });

  it("rejects missing project name", () => {
    const { project, ...rest } = VALID_CONFIG;
    const result = configSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid scope type", () => {
    const config = { ...VALID_CONFIG, scope: { type: "universe", target: null } };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("accepts null feature branch", () => {
    const config = {
      ...VALID_CONFIG,
      branches: { main: "main", feature: null },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("accepts config without steps (uses defaults)", () => {
    const result = configSchema.safeParse(VALID_CONFIG);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.steps).toBeUndefined();
    }
  });

  it("accepts config with explicit steps", () => {
    const config = {
      ...VALID_CONFIG,
      steps: [
        { id: "session-start", type: "session-start", deps: [], params: {} },
        { id: "ui-interview", type: "requirements-gate", deps: [], params: {} },
      ],
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});
