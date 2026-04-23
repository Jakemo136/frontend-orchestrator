import { describe, it, expect, vi } from "vitest";
import { DesignAuditStep } from "../../src/steps/design-audit.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("DesignAuditStep preflight", () => {
  it("passes when dev server returns 200 with no redirects", async () => {
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 0,
        stdout: "200|text/html|200|0",
        stderr: "",
        timedOut: false,
      })),
    });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("fails when dev server returns 401", async () => {
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 0,
        stdout: "401|text/html|401|0",
        stderr: "",
        timedOut: false,
      })),
    });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("401");
  });

  it("fails when dev server returns 403", async () => {
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 0,
        stdout: "403|text/html|403|0",
        stderr: "",
        timedOut: false,
      })),
    });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("403");
  });

  it("fails when dev server redirects (302)", async () => {
    // curl with --max-redirs 0 returns exit code 47 for redirects
    // Format: finalCode|contentType|initialCode|numRedirects
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 47,
        stdout: "302|text/html|302|0",
        stderr: "",
        timedOut: false,
      })),
    });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toMatch(/redirect/i);
  });

  it("fails when dev server is unreachable", async () => {
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 7,
        stdout: "",
        stderr: "Connection refused",
        timedOut: false,
      })),
    });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("not reachable");
  });

  it("fails for non-200 responses", async () => {
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 0,
        stdout: "500|text/html|500|0",
        stderr: "",
        timedOut: false,
      })),
    });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("500");
  });
});
