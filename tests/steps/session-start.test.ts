import { describe, it, expect, vi } from "vitest";
import { SessionStartStep } from "../../src/steps/session-start.js";
import type { StepDefinition, RunContext } from "../../src/types.js";

function makeDefinition(): StepDefinition {
  return { id: "session-start", type: "session-start", deps: [], params: {} };
}

function makeMockContext(overrides: Partial<RunContext> = {}): RunContext {
  return {
    config: {
      project: "test",
      scope: { type: "app", target: null },
      branches: { main: "main", feature: null },
      artifacts: { requirements: "docs/reqs.md", inventory: "docs/inv.md", build_plan: "docs/plan.md", build_status: "docs/status.md", design_audit: "docs/audit.md", visual_qa: "docs/qa.md" },
      commands: { test_client: "", test_server: "", test_e2e: "", build_client: "", dev_server: "", typecheck: "" },
      ci: { required_on_main: [], required_on_feature: [], informational_on_feature: [] },
    },
    state: { project: "test", scope: { type: "app", target: null }, started_at: "", updated_at: "", steps: {} },
    projectRoot: "/tmp/test",
    scope: { type: "app", target: null },
    resolve: (p) => `/tmp/test/${p}`,
    exists: vi.fn(async () => false),
    exec: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false })),
    invokeCommand: vi.fn(async () => ({ success: true, output: "briefing", artifacts: [] })),
    awaitApproval: vi.fn(async () => {}),
    updateState: vi.fn(),
    ...overrides,
  };
}

describe("SessionStartStep", () => {
  it("describe() returns correct metadata", () => {
    const step = new SessionStartStep(makeDefinition());
    const desc = step.describe();
    expect(desc.id).toBe("session-start");
    expect(desc.scope).toBe("component");
    expect(desc.passCondition).toContain("briefing");
  });

  it("preflight always returns ready", async () => {
    const step = new SessionStartStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute invokes /session-start command", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "Session briefing content", artifacts: [] }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new SessionStartStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(invokeCommand).toHaveBeenCalledWith("/session-start");
    expect(result.status).toBe("passed");
  });

  it("execute passes even if command fails (informational only)", async () => {
    const invokeCommand = vi.fn(async () => ({ success: false, output: "", artifacts: [], error: "no docs found" }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new SessionStartStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
  });
});
