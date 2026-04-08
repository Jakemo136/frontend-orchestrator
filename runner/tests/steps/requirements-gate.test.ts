import { describe, it, expect, vi } from "vitest";
import { RequirementsGateStep } from "../../src/steps/requirements-gate.js";
import type { StepDefinition, RunContext } from "../../src/types.js";

function makeDefinition(): StepDefinition {
  return { id: "ui-interview", type: "requirements-gate", deps: [], params: {} };
}

function makeMockContext(overrides: Partial<RunContext> = {}): RunContext {
  return {
    config: {
      project: "test",
      scope: { type: "app", target: null },
      branches: { main: "main", feature: null },
      artifacts: { requirements: "docs/UI_REQUIREMENTS.md", inventory: "docs/COMPONENT_INVENTORY.md", build_plan: "docs/BUILD_PLAN.md", build_status: "docs/BUILD_STATUS.md", design_audit: "docs/DESIGN_AUDIT.md", visual_qa: "docs/VISUAL_QA.md" },
      commands: { test_client: "", test_server: "", test_e2e: "", build_client: "", dev_server: "", typecheck: "" },
      ci: { required_on_main: [], required_on_feature: [], informational_on_feature: [] },
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

describe("RequirementsGateStep", () => {
  it("describe() requires user approval", () => {
    const step = new RequirementsGateStep(makeDefinition());
    const desc = step.describe();
    expect(desc.passCondition).toContain("approved");
  });

  it("execute invokes /ui-interview then checks artifacts exist", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "interview done", artifacts: ["docs/UI_REQUIREMENTS.md", "docs/COMPONENT_INVENTORY.md"] }));
    const exists = vi.fn(async () => true);
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ invokeCommand, exists, awaitApproval });

    const step = new RequirementsGateStep(makeDefinition());
    const result = await step.execute(ctx);

    expect(invokeCommand).toHaveBeenCalledWith("/ui-interview");
    expect(awaitApproval).toHaveBeenCalled();
    expect(result.status).toBe("passed");
    expect(result.artifacts).toContain("docs/UI_REQUIREMENTS.md");
  });

  it("execute fails if artifacts don't exist after interview", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "interview done", artifacts: [] }));
    const exists = vi.fn(async () => false);
    const ctx = makeMockContext({ invokeCommand, exists });

    const step = new RequirementsGateStep(makeDefinition());
    const result = await step.execute(ctx);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("missing");
  });

  it("execute fails if user rejects approval", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "interview done", artifacts: [] }));
    const exists = vi.fn(async () => true);
    const awaitApproval = vi.fn(async () => { throw new Error("User rejected"); });
    const ctx = makeMockContext({ invokeCommand, exists, awaitApproval });

    const step = new RequirementsGateStep(makeDefinition());
    const result = await step.execute(ctx);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("rejected");
  });
});
