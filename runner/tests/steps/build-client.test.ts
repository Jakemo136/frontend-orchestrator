import { describe, it, expect, vi } from "vitest";
import { BuildClientStep } from "../../src/steps/build-client.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("BuildClientStep", () => {
  it("describe() returns correct metadata", () => {
    const step = new BuildClientStep(makeDefinition({ id: "build-client:0" }));
    const desc = step.describe();
    expect(desc.type).toBe("build-client");
    expect(desc.scope).toBe("component");
    expect(desc.id).toBe("build-client:0");
  });

  it("preflight is always ready", async () => {
    const step = new BuildClientStep(makeDefinition());
    const ctx = makeMockContext();
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("execute passes when build command exits 0", async () => {
    const exec = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new BuildClientStep(makeDefinition({ id: "build-client:0" }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(exec).toHaveBeenCalledWith("npm run build");
    expect(result.message).toContain("succeeded");
  });

  it("execute fails when build command exits non-zero", async () => {
    const exec = vi.fn(async () => ({ exitCode: 1, stdout: "", stderr: "Build error", timedOut: false }));
    const ctx = makeMockContext({ exec });
    const step = new BuildClientStep(makeDefinition({ id: "build-client:0" }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("failed");
    expect(result.message).toContain("Build error");
  });
});
