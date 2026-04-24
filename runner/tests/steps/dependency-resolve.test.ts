import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, vi } from "vitest";
import { DependencyResolveStep, countWaves, parseWavePlan, isValidWavePlan } from "../../src/steps/dependency-resolve.js";
import { ApprovalDeniedError } from "../../src/runner/approval.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("DependencyResolveStep", () => {
  it("describe() includes BUILD_PLAN.md artifact", () => {
    const step = new DependencyResolveStep(makeDefinition({ type: "dependency-resolve" }));
    const desc = step.describe();
    expect(desc.artifacts).toContain("BUILD_PLAN.md");
    expect(desc.scope).toBe("page");
  });

  it("preflight fails when inventory missing", async () => {
    const step = new DependencyResolveStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => false) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
  });

  it("execute passes when plan generated and user approves", async () => {
    const tmpDir = join(tmpdir(), `dep-resolve-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    try {
      const exists = vi.fn(async () => true);
      const readFile = vi.fn(async () => "## Wave 0\ncomponents");
      const awaitApproval = vi.fn(async () => {});
      const ctx = makeMockContext({ exists, readFile, awaitApproval, resolve: (p: string) => join(tmpDir, p), projectRoot: tmpDir });
      const step = new DependencyResolveStep(makeDefinition());
      const result = await step.execute(ctx);
      expect(result.status).toBe("passed");
      expect(result.artifacts).toContain("docs/BUILD_PLAN.md");
      expect(result.metrics.wave_count).toBeDefined();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("execute fails when plan not generated", async () => {
    const exists = vi.fn(async () => false);
    const ctx = makeMockContext({ exists });
    const step = new DependencyResolveStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("not generated");
  });

  it("execute fails when user rejects plan", async () => {
    const exists = vi.fn(async () => true);
    const awaitApproval = vi.fn(async () => { throw new ApprovalDeniedError("build plan"); });
    const ctx = makeMockContext({ exists, awaitApproval });
    const step = new DependencyResolveStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("rejected");
  });

  it("countWaves counts wave headers", () => {
    const content = "## Wave 0\nstuff\n## Wave 1\nmore\n## Wave 2\nend";
    expect(countWaves(content)).toBe(3);
  });

  it("countWaves returns 1 when no wave headers found", () => {
    expect(countWaves("no waves here")).toBe(1);
  });

  it("countWaves handles mixed case", () => {
    const content = "## wave 0\n## Wave 1\n## WAVE 2";
    expect(countWaves(content)).toBe(3);
  });

  it("execute returns wave_count in metrics", async () => {
    const tmpDir = join(tmpdir(), `dep-resolve-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    try {
      const planContent = "## Wave 0\ncomp A\n## Wave 1\ncomp B\n## Wave 2\ncomp C";
      const exists = vi.fn(async () => true);
      const readFile = vi.fn(async () => planContent);
      const awaitApproval = vi.fn(async () => {});
      const ctx = makeMockContext({ exists, readFile, awaitApproval, resolve: (p: string) => join(tmpDir, p), projectRoot: tmpDir });
      const step = new DependencyResolveStep(makeDefinition());
      const result = await step.execute(ctx);
      expect(result.status).toBe("passed");
      expect(result.metrics.wave_count).toBe(3);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("execute includes wave-plan.json in artifacts", async () => {
    const tmpDir = join(tmpdir(), `dep-resolve-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    try {
      const exists = vi.fn(async () => true);
      const readFile = vi.fn(async () => "## Wave 0\n- Header\n## Wave 1\n- NavBar");
      const awaitApproval = vi.fn(async () => {});
      const ctx = makeMockContext({ exists, readFile, awaitApproval, resolve: (p: string) => join(tmpDir, p), projectRoot: tmpDir });
      const step = new DependencyResolveStep(makeDefinition());
      const result = await step.execute(ctx);
      expect(result.artifacts).toContain(".orchestrator/wave-plan.json");
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("parseWavePlan extracts component assignments", () => {
    const content = "## Wave 0\n- Header\n- Footer\n## Wave 1\n- NavBar\n- Sidebar\n## Wave 2\n- Dashboard";
    const plan = parseWavePlan(content);
    expect(plan.wave_count).toBe(3);
    expect(plan.waves["0"]).toEqual(["Header", "Footer"]);
    expect(plan.waves["1"]).toEqual(["NavBar", "Sidebar"]);
    expect(plan.waves["2"]).toEqual(["Dashboard"]);
  });

  it("parseWavePlan handles empty waves", () => {
    const content = "## Wave 0\n## Wave 1\n- OnlyComponent";
    const plan = parseWavePlan(content);
    expect(plan.waves["0"]).toEqual([]);
    expect(plan.waves["1"]).toEqual(["OnlyComponent"]);
  });

  it("parseWavePlan handles asterisk bullet points", () => {
    const content = "## Wave 0\n* CompA\n* CompB";
    const plan = parseWavePlan(content);
    expect(plan.waves["0"]).toEqual(["CompA", "CompB"]);
  });

  it("isValidWavePlan returns true for valid plan", () => {
    expect(isValidWavePlan({ wave_count: 2, waves: { "0": ["A"], "1": ["B"] } })).toBe(true);
  });

  it("isValidWavePlan returns false for missing wave_count", () => {
    expect(isValidWavePlan({ waves: { "0": ["A"] } })).toBe(false);
  });

  it("isValidWavePlan returns false for non-array waves entry", () => {
    expect(isValidWavePlan({ wave_count: 1, waves: { "0": "not-array" } })).toBe(false);
  });

  it("isValidWavePlan returns false for null", () => {
    expect(isValidWavePlan(null)).toBe(false);
  });

  it("execute prefers existing wave-plan.json over markdown parsing", async () => {
    const tmpDir = join(tmpdir(), `dep-resolve-json-${Date.now()}`);
    mkdirSync(join(tmpDir, ".orchestrator"), { recursive: true });
    const wavePlan = { wave_count: 2, waves: { "0": ["Header"], "1": ["NavBar"] } };
    writeFileSync(join(tmpDir, ".orchestrator/wave-plan.json"), JSON.stringify(wavePlan));
    try {
      const exists = vi.fn(async () => true);
      const readFile = vi.fn(async () => "should not be called for parsing");
      const awaitApproval = vi.fn(async () => {});
      const ctx = makeMockContext({ exists, readFile, awaitApproval, resolve: (p: string) => join(tmpDir, p), projectRoot: tmpDir });
      const step = new DependencyResolveStep(makeDefinition());
      const result = await step.execute(ctx);
      expect(result.status).toBe("passed");
      expect(result.metrics.wave_count).toBe(2);
      expect(readFile).not.toHaveBeenCalled();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("execute falls back to markdown when wave-plan.json is invalid", async () => {
    const tmpDir = join(tmpdir(), `dep-resolve-invalid-${Date.now()}`);
    mkdirSync(join(tmpDir, ".orchestrator"), { recursive: true });
    writeFileSync(join(tmpDir, ".orchestrator/wave-plan.json"), '{"bad": true}');
    try {
      const exists = vi.fn(async () => true);
      const readFile = vi.fn(async () => "## Wave 0\n- CompA\n## Wave 1\n- CompB");
      const awaitApproval = vi.fn(async () => {});
      const ctx = makeMockContext({ exists, readFile, awaitApproval, resolve: (p: string) => join(tmpDir, p), projectRoot: tmpDir });
      const step = new DependencyResolveStep(makeDefinition());
      const result = await step.execute(ctx);
      expect(result.status).toBe("passed");
      expect(result.metrics.wave_count).toBe(2);
      expect(readFile).toHaveBeenCalled();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("execute falls back to markdown when wave-plan.json has malformed JSON", async () => {
    const tmpDir = join(tmpdir(), `dep-resolve-malformed-${Date.now()}`);
    mkdirSync(join(tmpDir, ".orchestrator"), { recursive: true });
    writeFileSync(join(tmpDir, ".orchestrator/wave-plan.json"), "not json at all");
    try {
      const exists = vi.fn(async () => true);
      const readFile = vi.fn(async () => "## Wave 0\n- X");
      const awaitApproval = vi.fn(async () => {});
      const ctx = makeMockContext({ exists, readFile, awaitApproval, resolve: (p: string) => join(tmpDir, p), projectRoot: tmpDir });
      const step = new DependencyResolveStep(makeDefinition());
      const result = await step.execute(ctx);
      expect(result.status).toBe("passed");
      expect(readFile).toHaveBeenCalled();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
