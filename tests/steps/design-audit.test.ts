import { describe, it, expect, vi } from "vitest";
import { DesignAuditStep } from "../../src/steps/design-audit.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("DesignAuditStep", () => {
  it("describe() returns page scope with DESIGN_AUDIT.md artifact", () => {
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const desc = step.describe();
    expect(desc.type).toBe("design-audit");
    expect(desc.scope).toBe("page");
    expect(desc.artifacts).toContain("DESIGN_AUDIT.md");
  });

  it("preflight fails when dev server is down", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "000", stderr: "", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new DesignAuditStep(makeDefinition());
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("Dev server");
  });

  it("preflight passes when dev server responds 200", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "200", stderr: "", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new DesignAuditStep(makeDefinition());
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
  });

  it("execute passes on command success", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "audit done", artifacts: ["docs/DESIGN_AUDIT.md"] }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new DesignAuditStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
  });
});
