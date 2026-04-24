import { describe, it, expect } from "vitest";
import { generateDefaultPipeline } from "../../src/config/defaults.js";
import type { OrchestratorConfig } from "../../src/types.js";
import { TestSuiteStep } from "../../src/steps/test-suite.js";
import { BuildWaveStep } from "../../src/steps/build-wave.js";
import { MergeToMainStep } from "../../src/steps/merge-to-main.js";
import { AwaitMergeStep } from "../../src/steps/await-merge.js";
import { makeDefinition } from "../steps/helpers.js";

const BASE_CONFIG: OrchestratorConfig = {
  project: "test",
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

describe("generateDefaultPipeline", () => {
  it("generates all phases for app scope", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("session-start");
    expect(ids).toContain("ui-interview");
    expect(ids).toContain("e2e-scaffold");
    expect(ids).toContain("dependency-resolve");
    expect(ids).toContain("e2e-green");
    expect(ids).toContain("design-audit");
    expect(ids).toContain("visual-qa");
    expect(ids).toContain("set-baseline");
    expect(ids).toContain("pre-commit-review");
    expect(ids).toContain("merge-to-main");
  });

  it("skips e2e-scaffold, design-audit, visual-qa for component scope", () => {
    const config = { ...BASE_CONFIG, scope: { type: "component" as const, target: "StarRating" } };
    const steps = generateDefaultPipeline(config);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("ui-interview");
    expect(ids).toContain("pre-commit-review");
    expect(ids).not.toContain("e2e-scaffold");
    expect(ids).not.toContain("design-audit");
    expect(ids).not.toContain("visual-qa");
    expect(ids).not.toContain("set-baseline");
    expect(ids).not.toContain("merge-to-main");
  });

  it("wires dependency-resolve after e2e-scaffold", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG);
    const depResolve = steps.find((s) => s.id === "dependency-resolve")!;
    expect(depResolve.deps).toContain("e2e-scaffold");
  });

  it("wires e2e-scaffold after user-story-generation (parallel with dependency-resolve)", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG);
    const e2e = steps.find((s) => s.id === "e2e-scaffold")!;
    expect(e2e.deps).toContain("user-story-generation");
    expect(e2e.deps).not.toContain("dependency-resolve");
  });

  it("includes user-story-generation before e2e-scaffold", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("user-story-generation");
    const usg = steps.find((s) => s.id === "user-story-generation")!;
    expect(usg.deps).toContain("ui-interview");
    const e2e = steps.find((s) => s.id === "e2e-scaffold")!;
    expect(e2e.deps).toContain("user-story-generation");
  });

  it("generates build-wave steps for page scope", () => {
    const config = { ...BASE_CONFIG, scope: { type: "page" as const, target: null } };
    const steps = generateDefaultPipeline(config);
    const buildWave = steps.find((s) => s.id === "build-wave:0");
    expect(buildWave).toBeDefined();
    expect(buildWave!.type).toBe("build-wave");
    expect(buildWave!.deps).toContain("dependency-resolve");
  });

  it("generates test-suite, post-wave-review, open-prs, await-merge for page scope", () => {
    const config = { ...BASE_CONFIG, scope: { type: "page" as const, target: null } };
    const steps = generateDefaultPipeline(config);
    expect(steps.find((s) => s.id === "test-suite:0")).toBeDefined();
    expect(steps.find((s) => s.id === "post-wave-review:0")).toBeDefined();
    expect(steps.find((s) => s.id === "open-prs:0")).toBeDefined();
    expect(steps.find((s) => s.id === "await-merge:0")).toBeDefined();
  });

  it("wires e2e-green after await-merge:0 for page scope", () => {
    const config = { ...BASE_CONFIG, scope: { type: "page" as const, target: null } };
    const steps = generateDefaultPipeline(config);
    const e2eGreen = steps.find((s) => s.id === "e2e-green");
    expect(e2eGreen!.deps).toContain("await-merge:0");
  });

  it("waveCount=3 for app scope produces correct wave steps", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG, 3);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("build-wave:0");
    expect(ids).toContain("build-wave:1");
    expect(ids).toContain("build-wave:2");
    expect(ids).toContain("test-suite:0");
    expect(ids).toContain("test-suite:1");
    expect(ids).toContain("test-suite:2");
    expect(ids).toContain("await-merge:0");
    expect(ids).toContain("await-merge:1");
    expect(ids).toContain("await-merge:2");
  });

  it("inter-wave dependency chain", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG, 3);
    const w0 = steps.find((s) => s.id === "build-wave:0")!;
    const w1 = steps.find((s) => s.id === "build-wave:1")!;
    const w2 = steps.find((s) => s.id === "build-wave:2")!;
    expect(w0.deps).toContain("dependency-resolve");
    expect(w1.deps).toContain("await-merge:0");
    expect(w2.deps).toContain("await-merge:1");
  });

  it("e2e-green depends on last wave", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG, 3);
    const e2eGreen = steps.find((s) => s.id === "e2e-green")!;
    expect(e2eGreen.deps).toContain("await-merge:2");
  });

  it("ship phase depends on last wave (component scope)", () => {
    const config = { ...BASE_CONFIG, scope: { type: "component" as const, target: "MyComp" } };
    const steps = generateDefaultPipeline(config, 3);
    const preCommit = steps.find((s) => s.id === "pre-commit-review")!;
    expect(preCommit.deps).toContain("await-merge:2");
  });

  it("waveCount=0 clamps to 1", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG, 0);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("build-wave:0");
    expect(ids).not.toContain("build-wave:1");
  });

  it("backward compat — no waveCount same as waveCount=1", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("build-wave:0");
    expect(ids).not.toContain("build-wave:1");
  });

  it("component scope with waveCount=2", () => {
    const config = { ...BASE_CONFIG, scope: { type: "component" as const, target: "MyComp" } };
    const steps = generateDefaultPipeline(config, 2);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("build-wave:0");
    expect(ids).toContain("build-wave:1");
  });

  it("exit-code steps report verification as exit-code", () => {
    const step = new TestSuiteStep(makeDefinition({ type: "test-suite" }));
    expect(step.describe().verification).toBe("exit-code");
  });

  it("command-result steps report verification as command-result", () => {
    const step = new BuildWaveStep(makeDefinition({ type: "build-wave", params: { wave: 0 } }));
    expect(step.describe().verification).toBe("command-result");
  });

  it("approval steps report verification as approval", () => {
    const step = new MergeToMainStep(makeDefinition({ type: "merge-to-main" }));
    expect(step.describe().verification).toBe("approval");
  });

  it("ci-check steps report verification as ci-check", () => {
    const step = new AwaitMergeStep(makeDefinition({ type: "await-merge", params: { wave: 0 } }));
    expect(step.describe().verification).toBe("ci-check");
  });

  it("set-baseline depends on visual-qa", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG);
    const setBaseline = steps.find((s) => s.id === "set-baseline")!;
    expect(setBaseline.deps).toContain("visual-qa");
  });

  it("pipeline contains build-client:0 for single wave", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("build-client:0");
  });

  it("build-client:N depends on test-suite:N", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG, 3);
    for (let w = 0; w < 3; w++) {
      const buildClient = steps.find((s) => s.id === `build-client:${w}`)!;
      expect(buildClient).toBeDefined();
      expect(buildClient.deps).toContain(`test-suite:${w}`);
    }
  });

  it("post-wave-review:N depends on build-client:N", () => {
    const steps = generateDefaultPipeline(BASE_CONFIG, 3);
    for (let w = 0; w < 3; w++) {
      const postWave = steps.find((s) => s.id === `post-wave-review:${w}`)!;
      expect(postWave).toBeDefined();
      expect(postWave.deps).toContain(`build-client:${w}`);
      expect(postWave.deps).not.toContain(`test-suite:${w}`);
    }
  });
});
