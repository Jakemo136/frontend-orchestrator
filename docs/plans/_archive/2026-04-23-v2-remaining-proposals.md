# V2 Remaining Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden PR/merge resilience (#4), classify step verification trust levels (#5), and add multi-step integration tests (#2).

**Architecture:** Three independent phases — each ships as its own PR. Phase 1 tightens defensive checks in the two GitHub-facing steps. Phase 2 adds a `verification` field to step descriptions so consumers can distinguish machine-verifiable results from agent judgment. Phase 3 adds a fixture-project test helper and multi-step pipeline integration tests.

**Tech Stack:** TypeScript, Vitest, gh CLI

---

## Phase 1: PR/merge failure hardening

### Task 1: Add git branch and gh CLI preflight checks to merge-to-main

**Files:**
- Modify: `runner/src/steps/merge-to-main.ts:20-26`
- Test: `runner/tests/steps/merge-to-main.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("preflight fails when git branch does not exist", async () => {
  const exec = vi.fn(async () => ({ exitCode: 128, stdout: "", stderr: "fatal: not a valid ref", timedOut: false }));
  const ctx = makeMockContext({ exec });
  const step = new MergeToMainStep(makeDefinition());
  const result = await step.preflight(ctx);
  expect(result.ready).toBe(false);
  expect(result.issues[0]).toContain("does not exist");
});

it("preflight fails when gh CLI is not authenticated", async () => {
  const exec = vi.fn(async (cmd: string) => {
    if (cmd.includes("git rev-parse")) return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
    return { exitCode: 1, stdout: "", stderr: "not logged in", timedOut: false };
  });
  const ctx = makeMockContext({ exec });
  const step = new MergeToMainStep(makeDefinition());
  const result = await step.preflight(ctx);
  expect(result.ready).toBe(false);
  expect(result.issues[0]).toContain("gh");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd runner && npx vitest run tests/steps/merge-to-main.test.ts`
Expected: 2 FAIL — preflight currently does no exec calls.

- [ ] **Step 3: Update preflight to validate branch and gh auth**

In `merge-to-main.ts`, replace the preflight method:

```ts
async preflight(ctx: RunContext): Promise<PreflightResult> {
  const branch = ctx.config.branches.feature;
  if (!branch) {
    return { ready: false, issues: ["No feature branch configured in config.branches.feature"] };
  }
  const issues: string[] = [];
  const branchCheck = await ctx.exec(`git rev-parse --verify refs/heads/${branch}`);
  if (branchCheck.exitCode !== 0) {
    issues.push(`Feature branch "${branch}" does not exist in git`);
  }
  const ghCheck = await ctx.exec("gh auth status");
  if (ghCheck.exitCode !== 0) {
    issues.push("gh CLI is not authenticated — run 'gh auth login' first");
  }
  return { ready: issues.length === 0, issues };
}
```

- [ ] **Step 4: Update existing preflight tests**

The existing `"preflight passes when feature branch exists"` test now needs exec mocks. Update it:

```ts
it("preflight passes when feature branch exists and gh is authed", async () => {
  const exec = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false }));
  const ctx = makeMockContext({ exec });
  const step = new MergeToMainStep(makeDefinition());
  const result = await step.preflight(ctx);
  expect(result.ready).toBe(true);
});
```

- [ ] **Step 5: Run tests**

Run: `cd runner && npx vitest run tests/steps/merge-to-main.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```
feat(runner): add git branch and gh auth validation to merge-to-main preflight
```

---

### Task 2: Handle missing required checks and extract first line from PR URL

**Files:**
- Modify: `runner/src/steps/merge-to-main.ts:76-99`
- Test: `runner/tests/steps/merge-to-main.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("execute warns when required check is missing from CI results", async () => {
  const checks = [{ name: "build", state: "SUCCESS" }];
  const exec = vi.fn()
    .mockResolvedValueOnce({ exitCode: 0, stdout: "[]", stderr: "", timedOut: false })
    .mockResolvedValueOnce({ exitCode: 0, stdout: "https://github.com/test/pr/1", stderr: "", timedOut: false })
    .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify(checks), stderr: "", timedOut: false });
  const awaitApproval = vi.fn(async () => {});
  const ctx = makeMockContext({ exec, awaitApproval });
  ctx.config.ci.required_on_main = ["build", "nonexistent-check"];
  const step = new MergeToMainStep(makeDefinition());
  const result = await step.execute(ctx);
  expect(result.status).toBe("failed");
  expect(result.message).toContain("nonexistent-check");
  expect(result.message).toContain("missing");
});

it("execute extracts first line from multi-line gh pr create output", async () => {
  const exec = vi.fn()
    .mockResolvedValueOnce({ exitCode: 0, stdout: "[]", stderr: "", timedOut: false })
    .mockResolvedValueOnce({ exitCode: 0, stdout: "https://github.com/test/pr/1\nsome extra output\n", stderr: "", timedOut: false });
  const awaitApproval = vi.fn(async () => {});
  const ctx = makeMockContext({ exec, awaitApproval });
  const step = new MergeToMainStep(makeDefinition());
  const result = await step.execute(ctx);
  expect(result.status).toBe("passed");
  const approvalPrompt = awaitApproval.mock.calls[0]![0] as string;
  expect(approvalPrompt).toContain("https://github.com/test/pr/1");
  expect(approvalPrompt).not.toContain("extra output");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd runner && npx vitest run tests/steps/merge-to-main.test.ts`
Expected: 2 FAIL

- [ ] **Step 3: Fix PR URL extraction**

On lines 58 and 72 (both places `prUrl` is set from `prResult.stdout`), change:

```ts
// Before
prUrl = prResult.stdout.trim();
// After
prUrl = prResult.stdout.trim().split("\n")[0]!;
```

- [ ] **Step 4: Add missing-check detection**

After the `failing` filter (line 86), add detection for required checks that weren't found in the results at all:

```ts
const checks = JSON.parse(checksResult.stdout) as Array<{ name: string; state: string }>;
const checkNames = new Set(checks.map((c) => c.name));
const missing = requiredChecks.filter((name) => !checkNames.has(name));
const failing = checks
  .filter((c) => requiredChecks.includes(c.name))
  .filter((c) => c.state !== "SUCCESS" && c.state !== "SKIPPED");
if (failing.length > 0 || missing.length > 0) {
  const parts: string[] = [];
  if (failing.length > 0) parts.push(failing.map((c) => `${c.name} (${c.state})`).join(", "));
  if (missing.length > 0) parts.push(missing.map((name) => `${name} (missing)`).join(", "));
  return {
    status: "failed",
    artifacts: [],
    metrics: { failing_checks: failing.length + missing.length },
    message: `Required CI checks not passing: ${parts.join("; ")}`,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `cd runner && npx vitest run tests/steps/merge-to-main.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```
fix(runner): detect missing required checks, extract first line from PR URL
```

---

### Task 3: Guard against undefined statusCheckRollup in await-merge

**Files:**
- Modify: `runner/src/steps/await-merge.ts:92`
- Test: `runner/tests/steps/await-merge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("handles PR with undefined statusCheckRollup gracefully", async () => {
  const prs = [{ number: 1, state: "MERGED", title: "A" }]; // no statusCheckRollup
  const exec = vi.fn(async () => ({
    exitCode: 0, stdout: JSON.stringify(prs), stderr: "", timedOut: false,
  }));
  const ctx = makeMockContext({ exec });
  ctx.config.ci.required_on_feature = ["build"];
  const step = new AwaitMergeStep(makeDefinition({ params: { wave: 0 } }));
  const result = await step.execute(ctx);
  expect(result.status).toBe("failed");
  expect(result.message).toContain("missing");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd runner && npx vitest run tests/steps/await-merge.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'map')` on line 92.

- [ ] **Step 3: Add null guard**

On line 92, change:

```ts
// Before
const checksByName = new Map(pr.statusCheckRollup.map((c) => [c.name, c.state]));
// After
const checksByName = new Map((pr.statusCheckRollup ?? []).map((c) => [c.name, c.state]));
```

- [ ] **Step 4: Run tests**

Run: `cd runner && npx vitest run tests/steps/await-merge.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```
fix(runner): guard against undefined statusCheckRollup in await-merge
```

---

## Phase 2: Step verification classification

### Task 4: Add verification field to StepDescription

**Files:**
- Modify: `runner/src/types.ts:75-86`
- Test: `runner/tests/config/defaults.test.ts`

- [ ] **Step 1: Add the type**

In `runner/src/types.ts`, add the verification type and field to `StepDescription`:

```ts
export type VerificationBasis =
  | "exit-code"
  | "file-check"
  | "ci-check"
  | "approval"
  | "command-result";

export interface StepDescription {
  id: string;
  type: string;
  summary: string;
  prerequisites: string[];
  artifacts: string[];
  passCondition: string;
  failCondition: string;
  scope: ScopeThreshold;
  verification: VerificationBasis;
}
```

- [ ] **Step 2: Run typecheck to see all steps that need updating**

Run: `cd runner && npx tsc --noEmit 2>&1 | head -60`
Expected: TS2741 errors on every step's `describe()` — `verification` missing.

- [ ] **Step 3: Classify and update every step**

Add `verification` to each step's `describe()` return:

| Step file | verification value |
|---|---|
| `session-start.ts` | `"command-result"` |
| `requirements-gate.ts` | `"file-check"` |
| `user-story-generation.ts` | `"command-result"` |
| `dependency-resolve.ts` | `"file-check"` |
| `build-wave.ts` | `"command-result"` |
| `test-suite.ts` | `"exit-code"` |
| `build-client.ts` | `"exit-code"` |
| `post-wave-review.ts` | `"command-result"` |
| `open-prs.ts` | `"command-result"` |
| `await-merge.ts` | `"ci-check"` |
| `e2e-scaffold.ts` | `"command-result"` |
| `e2e-green.ts` | `"exit-code"` |
| `design-audit.ts` | `"command-result"` |
| `visual-qa.ts` | `"command-result"` |
| `set-baseline.ts` | `"approval"` |
| `pre-commit-review.ts` | `"exit-code"` |
| `review-requirements.ts` | `"command-result"` |
| `merge-to-main.ts` | `"approval"` |

- [ ] **Step 4: Run typecheck**

Run: `cd runner && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 5: Write test that verification field is populated**

In `runner/tests/config/defaults.test.ts`, add:

```ts
it("every step description has a verification field", () => {
  const steps = generateDefaultPipeline(APP_CONFIG);
  const registry = getRegistry();
  for (const def of steps) {
    const StepClass = registry.get(def.type);
    if (!StepClass) continue;
    const step = new StepClass(def);
    const desc = step.describe();
    expect(desc.verification, `${def.type} missing verification`).toBeTruthy();
  }
});
```

Note: you'll need to export `getRegistry` from `runner/src/steps/registry.ts` (or import the step classes directly). Check how the existing test file imports things and follow that pattern.

- [ ] **Step 6: Run tests**

Run: `cd runner && npm test`
Expected: All PASS

- [ ] **Step 7: Commit**

```
feat(runner): add verification classification to step descriptions
```

---

## Phase 3: Multi-step integration tests

### Task 5: Create fixture-project test helper

**Files:**
- Create: `runner/tests/helpers/fixture-project.ts`
- Test: `runner/tests/helpers/fixture-project.test.ts`

- [ ] **Step 1: Write the test for the fixture helper**

```ts
import { describe, it, expect } from "vitest";
import { createFixtureProject } from "./fixture-project.js";

describe("createFixtureProject", () => {
  it("creates directory with required structure", () => {
    const fixture = createFixtureProject();
    try {
      expect(fixture.dir).toBeTruthy();
      expect(fixture.config.project).toBe("fixture");
      // Check dirs exist
      const { existsSync } = await import("fs");
      expect(existsSync(join(fixture.dir, "docs"))).toBe(true);
      expect(existsSync(join(fixture.dir, ".orchestrator"))).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("accepts config overrides", () => {
    const fixture = createFixtureProject({ project: "custom" });
    try {
      expect(fixture.config.project).toBe("custom");
    } finally {
      fixture.cleanup();
    }
  });

  it("can pre-populate artifacts", () => {
    const fixture = createFixtureProject({}, {
      inventory: "## Components\n- Header\n- Footer",
      wavePlan: { wave_count: 1, waves: { "0": ["Header", "Footer"] } },
    });
    try {
      const { readFileSync } = await import("fs");
      const inv = readFileSync(join(fixture.dir, "docs/COMPONENT_INVENTORY.md"), "utf-8");
      expect(inv).toContain("Header");
      const plan = JSON.parse(readFileSync(join(fixture.dir, ".orchestrator/wave-plan.json"), "utf-8"));
      expect(plan.wave_count).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd runner && npx vitest run tests/helpers/fixture-project.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { OrchestratorConfig } from "../../src/types.js";
import type { WavePlan } from "../../src/steps/dependency-resolve.js";

const DEFAULT_CONFIG: OrchestratorConfig = {
  project: "fixture",
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
    test_client: "echo pass",
    test_server: "echo pass",
    test_e2e: "echo pass",
    build_client: "echo pass",
    dev_server: "echo pass",
    typecheck: "echo pass",
  },
  ci: { required_on_main: [], required_on_feature: [], informational_on_feature: [] },
  dev_server_url: "http://localhost:3000",
  evidence: {
    playwright_config: "playwright.config.ts",
    output_dir: "test-results",
    json_report: "test-results/results.json",
    collect_to: ".orchestrator/evidence",
  },
};

interface FixtureArtifacts {
  requirements?: string;
  inventory?: string;
  buildPlan?: string;
  wavePlan?: WavePlan;
}

interface FixtureProject {
  dir: string;
  config: OrchestratorConfig;
  cleanup: () => void;
}

export function createFixtureProject(
  configOverrides: Partial<OrchestratorConfig> = {},
  artifacts: FixtureArtifacts = {},
): FixtureProject {
  const dir = join(tmpdir(), `orchestrator-fixture-${Date.now()}`);
  mkdirSync(join(dir, "docs"), { recursive: true });
  mkdirSync(join(dir, ".orchestrator"), { recursive: true });

  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  if (artifacts.requirements) {
    writeFileSync(join(dir, config.artifacts.requirements), artifacts.requirements);
  }
  if (artifacts.inventory) {
    writeFileSync(join(dir, config.artifacts.inventory), artifacts.inventory);
  }
  if (artifacts.buildPlan) {
    writeFileSync(join(dir, config.artifacts.build_plan), artifacts.buildPlan);
  }
  if (artifacts.wavePlan) {
    writeFileSync(join(dir, ".orchestrator/wave-plan.json"), JSON.stringify(artifacts.wavePlan, null, 2));
  }

  return {
    dir,
    config,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd runner && npx vitest run tests/helpers/fixture-project.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```
test(runner): add fixture-project test helper
```

---

### Task 6: Add multi-step pipeline integration tests

**Files:**
- Modify: `runner/tests/integration.test.ts`
- (Uses fixture helper from Task 5)

This task adds three integration tests that exercise multi-step flows through the executor. Each test pre-populates command results so steps don't block on `needs_command`. The goal is to test step sequencing, state propagation, and failure handling across step boundaries — not individual step logic.

- [ ] **Step 1: Write the test — dependency-resolve through build-wave**

This test validates that when dependency-resolve passes, its wave-plan.json is available for build-wave's preflight.

```ts
import { createFixtureProject } from "./helpers/fixture-project.js";
// Import steps needed for registration
import "../src/steps/dependency-resolve.js";
import "../src/steps/build-wave.js";
import "../src/steps/test-suite.js";
import "../src/steps/build-client.js";

describe("Integration: multi-step flows", () => {
  it("dependency-resolve output satisfies build-wave preflight", async () => {
    const fixture = createFixtureProject({}, {
      inventory: "## Components\n- Header\n- Footer",
      buildPlan: "## Wave 0\n- Header\n- Footer",
      wavePlan: { wave_count: 1, waves: { "0": ["Header", "Footer"] } },
    });
    try {
      const steps: StepDefinition[] = [
        { id: "build-wave:0", type: "build-wave", deps: [], params: { wave: 0 } },
      ];
      const commandResults = new Map([
        ["build-wave:0", { success: true, output: "built", artifacts: ["Header.tsx", "Footer.tsx"] }],
      ]);
      const executor = new Executor(fixture.config, steps, fixture.dir, commandResults);
      const result = await executor.runNext();
      expect(result.type).toBe("step_complete");
      if (result.type === "step_complete") {
        expect(result.result.status).toBe("passed");
      }
    } finally {
      fixture.cleanup();
    }
  });
});
```

- [ ] **Step 2: Write the test — step failure stops pipeline**

```ts
it("pipeline stops when a step fails", async () => {
  const fixture = createFixtureProject({}, { inventory: "## Components\n- X" });
  try {
    const steps: StepDefinition[] = [
      { id: "test-suite:0", type: "test-suite", deps: [], params: {} },
      { id: "build-wave:0", type: "build-wave", deps: ["test-suite:0"], params: { wave: 0 } },
    ];
    const executor = new Executor(fixture.config, steps, fixture.dir);
    // test-suite will exec typecheck — which actually runs "echo pass" from config
    const first = await executor.runNext();
    expect(first.type).toBe("step_complete");
    // Now build-wave should be next, but it will signal needs_command
    const second = await executor.runNext();
    expect(second.type).toBe("needs_command");
  } finally {
    fixture.cleanup();
  }
});
```

- [ ] **Step 3: Write the test — approval signal pauses pipeline**

```ts
it("pipeline pauses on approval signal in interactive mode", async () => {
  const fixture = createFixtureProject({
    approval_mode: "interactive",
  }, {
    inventory: "## Components\n- Header",
    buildPlan: "## Wave 0\n- Header",
  });
  try {
    const steps: StepDefinition[] = [
      { id: "dependency-resolve", type: "dependency-resolve", deps: [], params: {} },
    ];
    const commandResults = new Map<string, CommandResult>();
    const executor = new Executor(fixture.config, steps, fixture.dir, commandResults);
    // dependency-resolve calls invokeCommand first
    const result = await executor.runNext();
    expect(result.type).toBe("needs_command");
    if (result.type === "needs_command") {
      expect(result.command).toBe("/build-pipeline:resolve-deps");
    }
  } finally {
    fixture.cleanup();
  }
});
```

- [ ] **Step 4: Run all integration tests**

Run: `cd runner && npx vitest run tests/integration.test.ts`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `cd runner && npm test`
Expected: All PASS

- [ ] **Step 6: Commit**

```
test(runner): add multi-step pipeline integration tests
```

---

## Summary

| Phase | Tasks | What ships | PR scope |
|-------|-------|------------|----------|
| 1 | Tasks 1–3 | Branch/auth preflight, missing check detection, URL parsing, statusCheckRollup guard | `fix/merge-hardening` |
| 2 | Task 4 | `verification` field on all 18 step descriptions | `feat/verification-classification` |
| 3 | Tasks 5–6 | Fixture helper + 3 multi-step integration tests | `test/pipeline-integration` |

Total: 6 tasks, ~9 new tests, touching ~22 files.
