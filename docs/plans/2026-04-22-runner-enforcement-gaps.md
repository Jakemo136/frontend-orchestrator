# Runner Enforcement Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 7 trust gaps where the runner's TypeScript code enforces less than the documentation claims — targeted step execution, approval gates, parallel execution, visual regression diffing, merge validation, quality check transparency, and preflight robustness.

**Architecture:** All changes target the runner at `runner/src/`. The executor gets a new `runStep(stepId)` method and parallel execution support. The approval system becomes environment-configurable with provenance tracking. MCP servers gain image diffing. Merge steps validate actual PR/CI state via `gh` CLI. Preflight checks become auth- and redirect-aware. A quality matrix document makes enforcement boundaries explicit.

**Tech Stack:** TypeScript (runner), Vitest (tests), Node.js crypto (hashing), pixelmatch + pngjs (image diffing), `gh` CLI (PR/CI validation)

---

## Progress

| Phase | Status | Commit | Tasks |
|-------|--------|--------|-------|
| 1 | DONE | 4f0960c, e527420, fc10674 | 1-2 (code bugs) |
| 2 | DONE | 5d27535, 014945e | 3-4 (enforcement gaps) |
| 3 | DONE | 7678520, 93684a6 | 5-6 (feature gaps) |
| 4 | DONE | 2fd4623 | 7 (transparency) |

---

## File Map

### New files
- `runner/src/runner/approval.ts` — approval strategy (interactive, auto, CI)
- `runner/src/runner/parallel.ts` — parallel step fan-out/fan-in
- `mcp/screenshot-review/diff.js` — pixelmatch-based image diffing
- `docs/QUALITY_MATRIX.md` — what is enforced vs. delegated vs. manual

### Modified files
- `runner/src/runner/executor.ts` — add `runStep()`, parallel dispatch
- `runner/src/cli.ts` — wire `run-step` to `executor.runStep()`
- `runner/src/runner/context.ts` — replace `awaitApproval` with strategy
- `runner/src/types.ts` — add approval types, parallel tracking types
- `runner/src/steps/await-merge.ts` — validate PR merged state + CI
- `runner/src/steps/merge-to-main.ts` — validate CI checks before approval
- `runner/src/steps/design-audit.ts` — expand preflight for auth/redirects
- `runner/src/steps/post-wave-review.ts` — parallelize independent commands
- `runner/src/evidence/preflight.ts` — add auth/redirect detection
- `mcp/screenshot-review/index.js` — add `compare` tool, integrate diffing
- `mcp/screenshot-review/package.json` — add pixelmatch, pngjs deps

### Test files
- `runner/tests/runner/executor-run-step.test.ts`
- `runner/tests/runner/approval.test.ts`
- `runner/tests/runner/parallel.test.ts`
- `runner/tests/steps/await-merge.test.ts` (modify existing)
- `runner/tests/steps/design-audit-preflight.test.ts`

---

## Phase 1 — Code Bugs (Quick Wins)

These are straightforward fixes to existing logic. Both tasks are independent and can run in parallel.

---

### Task 1: Fix `run <step-id>` to execute the requested step

**Finding:** #1 — CLI parses step ID correctly but calls `executor.runNext()` which ignores it and runs whatever the DAG picks.

**Files:**
- Modify: `runner/src/runner/executor.ts`
- Modify: `runner/src/cli.ts:196-217`
- Create: `runner/tests/runner/executor-run-step.test.ts`

- [ ] **Step 1: Write the failing test**

In `runner/tests/runner/executor-run-step.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Executor } from "../../src/runner/executor.js";
import { BaseStep } from "../../src/steps/base.js";
import { registerStep } from "../../src/steps/registry.js";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type {
  StepDescription,
  PreflightResult,
  StepResult,
  OrchestratorConfig,
} from "../../src/types.js";

class TrackingStep extends BaseStep {
  static lastExecutedId: string | null = null;
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "tracking",
      summary: "Tracks which step ran",
      prerequisites: [],
      artifacts: [],
      passCondition: "always",
      failCondition: "never",
      scope: "component",
    };
  }
  async preflight(): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }
  async execute(): Promise<StepResult> {
    TrackingStep.lastExecutedId = this.definition.id;
    return { status: "passed", artifacts: [], metrics: {}, message: "ok" };
  }
}

registerStep("tracking", TrackingStep);

const config: OrchestratorConfig = {
  project: "test",
  scope: { type: "app", target: null },
  branches: { main: "main", feature: null },
  artifacts: {
    requirements: "r.md", inventory: "i.md", build_plan: "b.md",
    build_status: "s.md", design_audit: "d.md", visual_qa: "v.md",
  },
  commands: {
    test_client: "true", test_server: "true", test_e2e: "true",
    build_client: "true", dev_server: "true", typecheck: "true",
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

describe("Executor.runStep", () => {
  it("executes the requested step, not the first runnable", () => {
    const dir = join(tmpdir(), `run-step-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    const steps = [
      { id: "step-a", type: "tracking", deps: [], params: {} },
      { id: "step-b", type: "tracking", deps: [], params: {} },
    ];

    const executor = new Executor(config, steps, dir);
    TrackingStep.lastExecutedId = null;

    const output = await executor.runStep("step-b");

    expect(output.type).toBe("step_complete");
    expect(output.stepId).toBe("step-b");
    expect(TrackingStep.lastExecutedId).toBe("step-b");

    rmSync(dir, { recursive: true, force: true });
  });

  it("returns pipeline_failed for unknown step ID", async () => {
    const dir = join(tmpdir(), `run-step-unknown-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    const steps = [{ id: "step-a", type: "tracking", deps: [], params: {} }];
    const executor = new Executor(config, steps, dir);

    const output = await executor.runStep("nonexistent");
    expect(output.type).toBe("pipeline_failed");

    rmSync(dir, { recursive: true, force: true });
  });

  it("skips dependency check when force-running a step", async () => {
    const dir = join(tmpdir(), `run-step-force-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    const steps = [
      { id: "dep", type: "tracking", deps: [], params: {} },
      { id: "child", type: "tracking", deps: ["dep"], params: {} },
    ];

    const executor = new Executor(config, steps, dir);
    TrackingStep.lastExecutedId = null;

    const output = await executor.runStep("child");
    expect(output.type).toBe("step_complete");
    expect(TrackingStep.lastExecutedId).toBe("child");

    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd runner && npx vitest run tests/runner/executor-run-step.test.ts
```

Expected: FAIL — `executor.runStep is not a function`

- [ ] **Step 3: Add `runStep()` to Executor**

In `runner/src/runner/executor.ts`, add after the `runNext()` method (after line 99):

```typescript
  async runStep(stepId: string): Promise<RunnerOutput> {
    const stepDef = this.steps.find((s) => s.id === stepId);
    if (!stepDef) {
      const result: StepResult = {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Unknown step: ${stepId}`,
      };
      return { type: "pipeline_failed", stepId, result };
    }

    const StepClass = getStepClass(stepDef.type);
    if (!StepClass) {
      const result: StepResult = {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Unknown step type: ${stepDef.type}`,
      };
      this.persistAndFail(stepDef.id, result);
      return { type: "pipeline_failed", stepId: stepDef.id, result };
    }

    const step = new StepClass(stepDef);

    if (step.shouldSkip(this.config.scope.type)) {
      const result: StepResult = {
        status: "skipped",
        artifacts: [],
        metrics: {},
        message: `Skipped — below scope threshold for ${this.config.scope.type}`,
      };
      this.persistAndComplete(stepDef.id, result);
      return this.completeStep(stepDef.id, result);
    }

    const ctx = createRunContext(
      this.config,
      this.state,
      this.projectRoot,
      this.stateManager,
      this.commandResults,
    );

    const preflight = await step.preflight(ctx);
    if (!preflight.ready) {
      const result: StepResult = {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Preflight failed: ${preflight.issues.join("; ")}`,
      };
      this.persistAndFail(stepDef.id, result);
      return { type: "pipeline_failed", stepId: stepDef.id, result };
    }

    this.stateManager.markInProgress(this.state, stepDef.id);
    this.stateManager.save(this.state);

    try {
      const result = await step.execute(ctx);
      this.persistAndComplete(stepDef.id, result);

      if (result.status === "failed") {
        return { type: "pipeline_failed", stepId: stepDef.id, result };
      }

      return this.completeStep(stepDef.id, result);
    } catch (err) {
      if (isNeedsCommandSignal(err)) {
        return { type: "needs_command", stepId: stepDef.id, command: err.command, args: err.args };
      }
      throw err;
    }
  }
```

- [ ] **Step 4: Wire CLI `run-step` to `executor.runStep()`**

In `runner/src/cli.ts`, replace lines 196-217 (`case "run-step"` block):

```typescript
    case "run-step": {
      if (!cmd.stepId) {
        process.stderr.write("Usage: orchestrate run <step-id>\n");
        process.exit(1);
      }
      const config = loadConfig(projectRoot);
      const steps = config.steps ?? generateDefaultPipeline(config);
      const executor = new Executor(config, steps, projectRoot, cmd.commandResults);

      const output = await executor.runStep(cmd.stepId);
      process.stdout.write(JSON.stringify(output) + "\n");

      if (output.type === "pipeline_failed") {
        process.exit(1);
      }
      break;
    }
```

- [ ] **Step 5: Run tests**

```bash
cd runner && npx vitest run tests/runner/executor-run-step.test.ts
```

Expected: PASS — all 3 tests green

- [ ] **Step 6: Run full test suite**

```bash
cd runner && npx vitest run
```

Expected: All existing tests still pass

- [ ] **Step 7: Rebuild and commit**

```bash
cd runner && npx tsc
git add runner/src/runner/executor.ts runner/src/cli.ts runner/tests/runner/executor-run-step.test.ts
git commit -m "fix: implement runStep() for targeted step execution"
```

---

### Task 2: Make approval gates real

**Finding:** #2 — `awaitApproval()` always succeeds, prints "(auto-approved in development mode)", never blocks.

**Files:**
- Create: `runner/src/runner/approval.ts`
- Modify: `runner/src/runner/context.ts:76-79`
- Modify: `runner/src/types.ts`
- Create: `runner/tests/runner/approval.test.ts`

- [ ] **Step 1: Add approval types to types.ts**

In `runner/src/types.ts`, after the `ExecResult` interface (after line 107), add:

```typescript
// ─── Approval ───────────────────────────────────
export type ApprovalMode = "interactive" | "auto" | "ci";

export interface ApprovalRecord {
  stepId: string;
  prompt: string;
  mode: ApprovalMode;
  approved_at: string;
}
```

Add to `WorkflowState` interface (after `artifact_hashes`):

```typescript
  approvals?: ApprovalRecord[];
```

Add to `OrchestratorConfig` interface (after `evidence`):

```typescript
  approval_mode?: ApprovalMode;
```

- [ ] **Step 2: Write the approval module tests**

In `runner/tests/runner/approval.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createApprovalHandler, ApprovalDeniedError } from "../../src/runner/approval.js";
import type { WorkflowState } from "../../src/types.js";

describe("createApprovalHandler", () => {
  it("auto mode approves and records provenance", async () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {},
    };

    const handler = createApprovalHandler("auto", state, "step-1");
    await handler("Approve build plan?");

    expect(state.approvals).toHaveLength(1);
    expect(state.approvals![0]!.mode).toBe("auto");
    expect(state.approvals![0]!.stepId).toBe("step-1");
    expect(state.approvals![0]!.prompt).toBe("Approve build plan?");
  });

  it("ci mode rejects with ApprovalDeniedError", async () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {},
    };

    const handler = createApprovalHandler("ci", state, "step-1");
    await expect(handler("Approve?")).rejects.toThrow(ApprovalDeniedError);
  });

  it("interactive mode throws NeedsApproval signal", async () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {},
    };

    const handler = createApprovalHandler("interactive", state, "step-1");
    await expect(handler("Approve?")).rejects.toThrow("needs_approval");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd runner && npx vitest run tests/runner/approval.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 4: Implement approval module**

Create `runner/src/runner/approval.ts`:

```typescript
import type { ApprovalMode, WorkflowState, ApprovalRecord } from "../types.js";

export class ApprovalDeniedError extends Error {
  constructor(prompt: string) {
    super(`Approval denied in CI mode: ${prompt}`);
    this.name = "ApprovalDeniedError";
  }
}

export class NeedsApprovalSignal extends Error {
  readonly __type = "needs_approval";
  constructor(
    public readonly prompt: string,
    public readonly stepId: string,
  ) {
    super("needs_approval");
    this.name = "NeedsApprovalSignal";
  }
}

function recordApproval(
  state: WorkflowState,
  stepId: string,
  prompt: string,
  mode: ApprovalMode,
): void {
  if (!state.approvals) state.approvals = [];
  const record: ApprovalRecord = {
    stepId,
    prompt,
    mode,
    approved_at: new Date().toISOString(),
  };
  state.approvals.push(record);
}

export function createApprovalHandler(
  mode: ApprovalMode,
  state: WorkflowState,
  stepId: string,
): (prompt: string) => Promise<void> {
  return async (prompt: string): Promise<void> => {
    switch (mode) {
      case "auto":
        console.log(`\n⏸  APPROVAL (auto-approved): ${prompt}\n`);
        recordApproval(state, stepId, prompt, "auto");
        return;

      case "ci":
        throw new ApprovalDeniedError(prompt);

      case "interactive":
        throw new NeedsApprovalSignal(prompt, stepId);
    }
  };
}
```

- [ ] **Step 5: Run approval tests**

```bash
cd runner && npx vitest run tests/runner/approval.test.ts
```

Expected: PASS — all 3 tests green

- [ ] **Step 6: Wire approval into context.ts**

In `runner/src/runner/context.ts`, add import at top:

```typescript
import { createApprovalHandler } from "./approval.js";
```

Update `createRunContext` signature to accept `stepId` and `approvalMode`:

```typescript
export function createRunContext(
  config: OrchestratorConfig,
  state: WorkflowState,
  projectRoot: string,
  stateManager: StateManager,
  commandResults?: Map<string, CommandResult>,
  stepId?: string,
): RunContext {
```

Replace `awaitApproval` (lines 76-79) with:

```typescript
    awaitApproval: createApprovalHandler(
      config.approval_mode ?? "auto",
      state,
      stepId ?? "unknown",
    ),
```

- [ ] **Step 7: Update executor to pass stepId to context**

In `runner/src/runner/executor.ts`, update both `runNext()` (line 61) and `runStep()` context creation to pass `stepDef.id`:

```typescript
    const ctx = createRunContext(
      this.config,
      this.state,
      this.projectRoot,
      this.stateManager,
      this.commandResults,
      stepDef.id,
    );
```

- [ ] **Step 8: Add approval_mode to config schema**

In `runner/src/config/schema.ts`, add after the `designAuditConfigSchema`:

```typescript
const approvalModeSchema = z.enum(["interactive", "auto", "ci"]).default("auto");
```

And add to `configSchema` (after `design_audit`):

```typescript
  approval_mode: approvalModeSchema,
```

- [ ] **Step 9: Run full test suite and rebuild**

```bash
cd runner && npx vitest run && npx tsc
```

Expected: All tests pass, clean compile

- [ ] **Step 10: Commit**

```bash
git add runner/src/runner/approval.ts runner/src/runner/context.ts runner/src/runner/executor.ts runner/src/types.ts runner/src/config/schema.ts runner/tests/runner/approval.test.ts
git commit -m "feat: add configurable approval gates with provenance tracking"
```

---

## Phase 2 — Enforcement Gaps

These close gaps where steps claim to validate but actually trust the user. Both tasks are independent and can run in parallel.

---

### Task 3: Validate PR merged state and CI checks in merge steps

**Finding:** #5 — `await-merge` lists PRs but never validates merged state or CI success. `merge-to-main` creates a PR but doesn't check CI. Config defines `ci.required_on_main` but nothing reads it.

**Files:**
- Modify: `runner/src/steps/await-merge.ts`
- Modify: `runner/src/steps/merge-to-main.ts`
- Modify: `runner/tests/steps/await-merge.test.ts`

- [ ] **Step 1: Write failing test for await-merge PR validation**

Replace `runner/tests/steps/await-merge.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { AwaitMergeStep } from "../../src/steps/await-merge.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("AwaitMergeStep", () => {
  it("passes when all wave PRs are merged", async () => {
    const step = new AwaitMergeStep(makeDefinition({ id: "await-merge:0", params: { wave: 0 } }));
    const prListOutput = JSON.stringify([
      { number: 1, state: "MERGED" },
      { number: 2, state: "MERGED" },
    ]);

    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 0,
        stdout: prListOutput,
        stderr: "",
        timedOut: false,
      })),
    });

    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.metrics.merged_count).toBe(2);
  });

  it("fails when some wave PRs are not merged", async () => {
    const step = new AwaitMergeStep(makeDefinition({ id: "await-merge:0", params: { wave: 0 } }));
    const prListOutput = JSON.stringify([
      { number: 1, state: "MERGED" },
      { number: 2, state: "OPEN" },
    ]);

    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 0,
        stdout: prListOutput,
        stderr: "",
        timedOut: false,
      })),
    });

    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("PR #2");
  });

  it("fails when no PRs found for wave", async () => {
    const step = new AwaitMergeStep(makeDefinition({ id: "await-merge:0", params: { wave: 0 } }));
    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 0,
        stdout: "[]",
        stderr: "",
        timedOut: false,
      })),
    });

    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("No PRs found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd runner && npx vitest run tests/steps/await-merge.test.ts
```

Expected: FAIL — metrics.merged_count undefined, no PR validation logic

- [ ] **Step 3: Implement PR validation in await-merge**

Replace `runner/src/steps/await-merge.ts` execute method (lines 24-47):

```typescript
  async execute(ctx: RunContext): Promise<StepResult> {
    const wave = (this.definition.params.wave as number) ?? 0;
    const prList = await ctx.exec(
      `gh pr list --label "wave-${wave}" --json number,state,title,statusCheckRollup`,
    );

    if (prList.exitCode !== 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave },
        message: `Failed to list PRs: ${prList.stderr}`,
      };
    }

    let prs: Array<{ number: number; state: string; title?: string }>;
    try {
      prs = JSON.parse(prList.stdout);
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave },
        message: `Failed to parse PR list output`,
      };
    }

    if (prs.length === 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave },
        message: `No PRs found for wave ${wave}. Expected labeled PRs.`,
      };
    }

    const unmerged = prs.filter((pr) => pr.state !== "MERGED");
    if (unmerged.length > 0) {
      const list = unmerged.map((pr) => `PR #${pr.number} (${pr.state})`).join(", ");
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave, merged_count: prs.length - unmerged.length, total_count: prs.length },
        message: `Not all wave ${wave} PRs are merged: ${list}`,
      };
    }

    return {
      status: "passed",
      artifacts: [],
      metrics: { wave, merged_count: prs.length, total_count: prs.length },
      message: `All ${prs.length} wave ${wave} PRs merged.`,
    };
  }
```

- [ ] **Step 4: Run tests**

```bash
cd runner && npx vitest run tests/steps/await-merge.test.ts
```

Expected: PASS — all 3 tests green

- [ ] **Step 5: Add CI check validation to merge-to-main**

In `runner/src/steps/merge-to-main.ts`, after the PR creation block and before `awaitApproval`, add CI check validation:

```typescript
    // Validate required CI checks
    const requiredChecks = ctx.config.ci.required_on_main;
    if (requiredChecks.length > 0) {
      const checksResult = await ctx.exec(
        `gh pr checks --json name,state --required`,
      );

      if (checksResult.exitCode === 0) {
        try {
          const checks = JSON.parse(checksResult.stdout) as Array<{ name: string; state: string }>;
          const failing = checks.filter((c) => c.state !== "SUCCESS" && c.state !== "SKIPPED");
          if (failing.length > 0) {
            const list = failing.map((c) => `${c.name} (${c.state})`).join(", ");
            return {
              status: "failed",
              artifacts: [],
              metrics: { failing_checks: failing.length },
              message: `Required CI checks failing: ${list}`,
            };
          }
        } catch {
          // Parse failure — proceed to approval with warning
        }
      }
    }
```

- [ ] **Step 6: Run full test suite and rebuild**

```bash
cd runner && npx vitest run && npx tsc
```

Expected: All tests pass, clean compile

- [ ] **Step 7: Commit**

```bash
git add runner/src/steps/await-merge.ts runner/src/steps/merge-to-main.ts runner/tests/steps/await-merge.test.ts
git commit -m "fix: validate PR merged state and CI checks in merge steps"
```

---

### Task 4: Expand preflight checks for auth and redirects

**Finding:** #7 — design-audit preflight only checks HTTP 200. Auth walls (401), redirects (302), and JS-based login redirects all produce misleading results.

**Files:**
- Modify: `runner/src/steps/design-audit.ts:19-28`
- Modify: `runner/src/evidence/preflight.ts`
- Create: `runner/tests/steps/design-audit-preflight.test.ts`

- [ ] **Step 1: Write failing tests for expanded preflight**

In `runner/tests/steps/design-audit-preflight.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { DesignAuditStep } from "../../src/steps/design-audit.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("DesignAuditStep preflight", () => {
  it("passes when dev server returns 200 with content", async () => {
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const ctx = makeMockContext({
      exec: vi.fn(async (cmd: string) => {
        if (cmd.includes("curl")) {
          return { exitCode: 0, stdout: "200|text/html|200|0", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      }),
    });

    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
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

  it("fails when dev server redirects (302)", async () => {
    const step = new DesignAuditStep(makeDefinition({ type: "design-audit" }));
    const ctx = makeMockContext({
      exec: vi.fn(async () => ({
        exitCode: 0,
        stdout: "200|text/html|302|1",
        stderr: "",
        timedOut: false,
      })),
    });

    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("redirect");
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd runner && npx vitest run tests/steps/design-audit-preflight.test.ts
```

Expected: FAIL — current preflight doesn't parse extended curl output

- [ ] **Step 3: Expand design-audit preflight**

In `runner/src/steps/design-audit.ts`, replace the preflight method (lines 19-28):

```typescript
  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const url = ctx.config.dev_server_url;
    const health = await ctx.exec(
      `curl -s -o /dev/null -w '%{http_code}|%{content_type}|%{response_code}|%{num_redirects}' --max-time 10 --max-redirs 0 ${url}`,
    );

    if (health.exitCode !== 0 && health.exitCode !== 47) {
      return {
        ready: false,
        issues: [`Dev server not reachable at ${url} (exit code ${health.exitCode})`],
      };
    }

    const parts = health.stdout.trim().split("|");
    const finalCode = parseInt(parts[0] ?? "0", 10);
    const initialCode = parseInt(parts[2] ?? "0", 10);
    const redirectCount = parseInt(parts[3] ?? "0", 10);

    const issues: string[] = [];

    if (initialCode >= 300 && initialCode < 400) {
      issues.push(
        `Dev server at ${url} returned ${initialCode} (redirect). This may indicate an auth wall or misconfigured route. Set dev_server_url to the final destination or configure auth.`,
      );
    } else if (initialCode === 401 || initialCode === 403) {
      issues.push(
        `Dev server at ${url} returned ${initialCode} (auth required). Configure authentication before running audit.`,
      );
    } else if (finalCode !== 200) {
      issues.push(`Dev server at ${url} returned HTTP ${finalCode}, expected 200.`);
    }

    if (redirectCount > 0 && issues.length === 0) {
      issues.push(
        `Dev server at ${url} redirected ${redirectCount} time(s). Audit may run against wrong page.`,
      );
    }

    return { ready: issues.length === 0, issues };
  }
```

- [ ] **Step 4: Run tests**

```bash
cd runner && npx vitest run tests/steps/design-audit-preflight.test.ts
```

Expected: PASS — all 4 tests green

- [ ] **Step 5: Run full test suite and rebuild**

```bash
cd runner && npx vitest run && npx tsc
```

Expected: All tests pass, clean compile

- [ ] **Step 6: Commit**

```bash
git add runner/src/steps/design-audit.ts runner/tests/steps/design-audit-preflight.test.ts
git commit -m "fix: expand design-audit preflight to detect auth walls and redirects"
```

---

## Phase 3 — Feature Gaps

These add new capabilities. Both tasks are independent and can run in parallel.

---

### Task 5: Add image diffing to screenshot-review MCP

**Finding:** #4 — screenshot system can capture and baseline but has zero image comparison logic.

**Files:**
- Create: `mcp/screenshot-review/diff.js`
- Modify: `mcp/screenshot-review/index.js`
- Modify: `mcp/screenshot-review/package.json`

- [ ] **Step 1: Install diffing dependencies**

```bash
cd mcp/screenshot-review && npm install pixelmatch pngjs
```

- [ ] **Step 2: Create diff module**

Create `mcp/screenshot-review/diff.js`:

```javascript
const fs = require('fs')
const { PNG } = require('pngjs')
const pixelmatch = require('pixelmatch')

function diffImages(baselinePath, currentPath, diffOutputPath) {
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath))
  const current = PNG.sync.read(fs.readFileSync(currentPath))

  const width = Math.max(baseline.width, current.width)
  const height = Math.max(baseline.height, current.height)

  // Resize if dimensions differ
  const baselineResized = resizeToFit(baseline, width, height)
  const currentResized = resizeToFit(current, width, height)

  const diff = new PNG({ width, height })

  const mismatchedPixels = pixelmatch(
    baselineResized.data,
    currentResized.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  )

  const totalPixels = width * height
  const diffPercentage = (mismatchedPixels / totalPixels) * 100

  if (diffOutputPath) {
    fs.mkdirSync(require('path').dirname(diffOutputPath), { recursive: true })
    fs.writeFileSync(diffOutputPath, PNG.sync.write(diff))
  }

  return {
    mismatchedPixels,
    totalPixels,
    diffPercentage: Math.round(diffPercentage * 100) / 100,
    dimensionMismatch: baseline.width !== current.width || baseline.height !== current.height,
    baseline: { width: baseline.width, height: baseline.height },
    current: { width: current.width, height: current.height },
  }
}

function resizeToFit(img, targetWidth, targetHeight) {
  if (img.width === targetWidth && img.height === targetHeight) return img
  const resized = new PNG({ width: targetWidth, height: targetHeight, fill: true })
  PNG.bitblt(img, resized, 0, 0, img.width, img.height, 0, 0)
  return resized
}

module.exports = { diffImages }
```

- [ ] **Step 3: Add `compare` tool to MCP server**

In `mcp/screenshot-review/index.js`, add import at top (after line 6):

```javascript
const { diffImages } = require('./diff.js')
```

Then add the `compare` tool after the `setBaseline` tool (before the `main()` function):

```javascript
server.tool(
  'compare',
  'Compare current screenshots against baseline — returns pixel diff percentage per breakpoint',
  {
    route: z.string().describe('Route name to compare'),
    threshold: z.number().default(0.5).describe('Max allowed diff percentage before flagging regression'),
    saveDiffs: z.boolean().default(true).describe('Save diff images to screenshots/diffs/')
  },
  async ({ route, threshold, saveDiffs }) => {
    const screenshotsDir = path.join(process.cwd(), 'screenshots')
    const routeDir = path.join(screenshotsDir, route)
    const baselineDir = path.join(screenshotsDir, 'baseline', route)
    const diffDir = path.join(screenshotsDir, 'diffs', route)

    const results = {}
    let hasRegression = false

    for (const breakpoint of Object.keys(DEFAULT_BREAKPOINTS)) {
      const currentPath = path.join(routeDir, `${breakpoint}.png`)
      const baselinePath = path.join(baselineDir, `${breakpoint}.png`)

      if (!fs.existsSync(currentPath)) {
        results[breakpoint] = { status: 'missing', error: 'Current screenshot not found' }
        continue
      }

      if (!fs.existsSync(baselinePath)) {
        results[breakpoint] = { status: 'no_baseline', error: 'No baseline to compare against' }
        continue
      }

      try {
        const diffPath = saveDiffs ? path.join(diffDir, `${breakpoint}-diff.png`) : null
        const diff = diffImages(baselinePath, currentPath, diffPath)

        const regressed = diff.diffPercentage > threshold
        if (regressed) hasRegression = true

        results[breakpoint] = {
          status: regressed ? 'regression' : 'pass',
          diffPercentage: diff.diffPercentage,
          mismatchedPixels: diff.mismatchedPixels,
          totalPixels: diff.totalPixels,
          dimensionMismatch: diff.dimensionMismatch,
          diffImage: diffPath,
        }
      } catch (err) {
        results[breakpoint] = { status: 'error', error: err.message }
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          route,
          threshold,
          hasRegression,
          breakpoints: results
        }, null, 2)
      }]
    }
  }
)
```

- [ ] **Step 4: Commit**

```bash
git add mcp/screenshot-review/diff.js mcp/screenshot-review/index.js mcp/screenshot-review/package.json mcp/screenshot-review/package-lock.json
git commit -m "feat: add pixelmatch-based visual regression diffing to screenshot-review"
```

---

### Task 6: Add parallel step execution to runner

**Finding:** #3 — executor takes `runnable[0]` only; independent steps run sequentially; `post-wave-review` awaits 4 commands in series.

**Files:**
- Create: `runner/src/runner/parallel.ts`
- Modify: `runner/src/runner/executor.ts`
- Modify: `runner/src/steps/post-wave-review.ts:23-35`
- Modify: `runner/src/types.ts`
- Create: `runner/tests/runner/parallel.test.ts`

- [ ] **Step 1: Add parallel output type**

In `runner/src/types.ts`, extend the `RunnerOutput` union (line 137-140):

```typescript
export type RunnerOutput =
  | { type: "step_complete"; stepId: string; result: StepResult; nextStepId: string | null }
  | { type: "steps_complete"; results: Array<{ stepId: string; result: StepResult }>; nextStepId: string | null }
  | { type: "needs_command"; stepId: string; command: string; args?: string }
  | { type: "pipeline_done" }
  | { type: "pipeline_failed"; stepId: string; result: StepResult };
```

- [ ] **Step 2: Write failing test for parallel execution**

Create `runner/tests/runner/parallel.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fanOutSteps } from "../../src/runner/parallel.js";

describe("fanOutSteps", () => {
  it("runs independent steps concurrently", async () => {
    const executionOrder: string[] = [];

    const tasks = [
      {
        id: "a",
        run: async () => {
          executionOrder.push("a-start");
          await new Promise((r) => setTimeout(r, 50));
          executionOrder.push("a-end");
          return { status: "passed" as const, artifacts: [], metrics: {}, message: "ok" };
        },
      },
      {
        id: "b",
        run: async () => {
          executionOrder.push("b-start");
          await new Promise((r) => setTimeout(r, 10));
          executionOrder.push("b-end");
          return { status: "passed" as const, artifacts: [], metrics: {}, message: "ok" };
        },
      },
    ];

    const results = await fanOutSteps(tasks);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.result.status === "passed")).toBe(true);
    // b should finish before a due to shorter delay
    expect(executionOrder.indexOf("b-end")).toBeLessThan(executionOrder.indexOf("a-end"));
  });

  it("collects failures without aborting other steps", async () => {
    const tasks = [
      {
        id: "pass",
        run: async () => ({ status: "passed" as const, artifacts: [], metrics: {}, message: "ok" }),
      },
      {
        id: "fail",
        run: async () => ({ status: "failed" as const, artifacts: [], metrics: {}, message: "broke" }),
      },
    ];

    const results = await fanOutSteps(tasks);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.stepId === "pass")!.result.status).toBe("passed");
    expect(results.find((r) => r.stepId === "fail")!.result.status).toBe("failed");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd runner && npx vitest run tests/runner/parallel.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 4: Implement parallel module**

Create `runner/src/runner/parallel.ts`:

```typescript
import type { StepResult } from "../types.js";

export interface ParallelTask {
  id: string;
  run: () => Promise<StepResult>;
}

export interface ParallelResult {
  stepId: string;
  result: StepResult;
}

export async function fanOutSteps(tasks: ParallelTask[]): Promise<ParallelResult[]> {
  const settled = await Promise.allSettled(
    tasks.map(async (task) => {
      const result = await task.run();
      return { stepId: task.id, result };
    }),
  );

  return settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") return outcome.value;
    return {
      stepId: tasks[i]!.id,
      result: {
        status: "failed" as const,
        artifacts: [],
        metrics: {},
        message: `Uncaught error: ${outcome.reason}`,
      },
    };
  });
}
```

- [ ] **Step 5: Run tests**

```bash
cd runner && npx vitest run tests/runner/parallel.test.ts
```

Expected: PASS — all tests green

- [ ] **Step 6: Add `runParallel()` to Executor**

In `runner/src/runner/executor.ts`, add import:

```typescript
import { fanOutSteps } from "./parallel.js";
import type { ParallelTask } from "./parallel.js";
```

Add method after `runStep()`:

```typescript
  async runParallel(): Promise<RunnerOutput> {
    const runnable = getRunnable(this.steps, this.state);
    if (runnable.length === 0) return { type: "pipeline_done" };
    if (runnable.length === 1) return this.runNext();

    const tasks: ParallelTask[] = [];
    for (const stepDef of runnable) {
      const StepClass = getStepClass(stepDef.type);
      if (!StepClass) continue;

      const step = new StepClass(stepDef);
      if (step.shouldSkip(this.config.scope.type)) {
        const result: StepResult = {
          status: "skipped",
          artifacts: [],
          metrics: {},
          message: `Skipped — below scope threshold`,
        };
        this.persistAndComplete(stepDef.id, result);
        continue;
      }

      const ctx = createRunContext(
        this.config,
        this.state,
        this.projectRoot,
        this.stateManager,
        this.commandResults,
        stepDef.id,
      );

      this.stateManager.markInProgress(this.state, stepDef.id);

      tasks.push({
        id: stepDef.id,
        run: async () => {
          const preflight = await step.preflight(ctx);
          if (!preflight.ready) {
            return {
              status: "failed" as const,
              artifacts: [],
              metrics: {},
              message: `Preflight failed: ${preflight.issues.join("; ")}`,
            };
          }
          return step.execute(ctx);
        },
      });
    }

    if (tasks.length === 0) return { type: "pipeline_done" };

    this.stateManager.save(this.state);
    const results = await fanOutSteps(tasks);

    for (const { stepId, result } of results) {
      this.persistAndComplete(stepId, result);
    }

    const failed = results.find((r) => r.result.status === "failed");
    if (failed) {
      return { type: "pipeline_failed", stepId: failed.stepId, result: failed.result };
    }

    const nextRunnable = getRunnable(this.steps, this.state);
    const nextStepId = nextRunnable.length > 0 ? nextRunnable[0]!.id : null;
    return { type: "steps_complete", results, nextStepId };
  }
```

- [ ] **Step 7: Parallelize post-wave-review commands**

In `runner/src/steps/post-wave-review.ts`, replace the execute method (lines 23-52):

```typescript
  async execute(ctx: RunContext): Promise<StepResult> {
    const [review, simplify, audit, wiringAudit] = await Promise.all([
      ctx.invokeCommand("/code-review"),
      ctx.invokeCommand("/code-simplify"),
      ctx.invokeCommand("/design-audit"),
      ctx.invokeCommand("/wiring-audit"),
    ]);

    const failures: string[] = [];
    if (!review.success) failures.push("code-review");
    if (!simplify.success) failures.push("code-simplify");
    if (!audit.success) failures.push("design-audit");
    if (!wiringAudit.success) failures.push("wiring-audit");

    if (failures.length > 0) {
      return {
        status: "failed",
        artifacts: audit.artifacts,
        metrics: { review_issues: failures.length },
        message: `Issues found in: ${failures.join(", ")}.`,
      };
    }

    return {
      status: "passed",
      artifacts: audit.artifacts,
      metrics: { review_issues: 0 },
      message: "Post-wave review passed. Code quality, design, and wiring audit clean.",
    };
  }
```

- [ ] **Step 8: Run full test suite and rebuild**

```bash
cd runner && npx vitest run && npx tsc
```

Expected: All tests pass, clean compile

- [ ] **Step 9: Commit**

```bash
git add runner/src/runner/parallel.ts runner/src/runner/executor.ts runner/src/steps/post-wave-review.ts runner/src/types.ts runner/tests/runner/parallel.test.ts
git commit -m "feat: add parallel step execution and fan-out/fan-in tracking"
```

---

## Phase 4 — Transparency

This makes the enforcement boundaries explicit so users know what to trust.

---

### Task 7: Create quality matrix document

**Finding:** #6 — users can't distinguish runner-enforced checks from prompt-guided checks from manual-only checks.

**Files:**
- Create: `docs/QUALITY_MATRIX.md`

- [ ] **Step 1: Write the quality matrix**

Create `docs/QUALITY_MATRIX.md`:

```markdown
# Quality Matrix — What Is Actually Enforced

This document maps every quality claim to its enforcement
mechanism so users know exactly what to trust.

## Enforcement Levels

| Level | Meaning |
|-------|---------|
| **Runner-enforced** | TypeScript code executes the check. Failure blocks the pipeline. |
| **Prompt-delegated** | Runner invokes a slash command. The check runs inside the LLM session, not runner code. Quality depends on prompt adherence. |
| **User-gated** | Runner pauses for user confirmation. No automated validation — user is the check. |
| **Manual-only** | Documented as best practice. Not executed by any automation. |

## Check Matrix

### Build Phase

| Check | Level | Runner Code | Notes |
|-------|-------|-------------|-------|
| TypeScript typecheck | Runner-enforced | `test-suite.ts` runs `config.commands.typecheck` | Fails pipeline on non-zero exit |
| Client unit tests | Runner-enforced | `test-suite.ts` runs `config.commands.test_client` | Fails pipeline on non-zero exit |
| E2E tests | Runner-enforced | `test-suite.ts` / `e2e-green.ts` runs `config.commands.test_e2e` | Fails pipeline on non-zero exit |
| Component TDD protocol | Prompt-delegated | `build-wave.ts` → `/build-component` | TDD steps are prompt instructions, not verified by runner |
| Code review | Prompt-delegated | `post-wave-review.ts` → `/code-review` | LLM performs review; runner checks pass/fail signal |
| Code simplification | Prompt-delegated | `post-wave-review.ts` → `/code-simplify` | LLM performs cleanup; runner checks pass/fail signal |

### Quality Phase

| Check | Level | Runner Code | Notes |
|-------|-------|-------------|-------|
| Dev server health | Runner-enforced | `design-audit.ts` preflight | Checks HTTP status, redirects, auth |
| Playwright config | Runner-enforced | `preflight.ts` validates config | Regex-based — checks settings exist, not correctness |
| Design audit (a11y) | Prompt-delegated | `design-audit.ts` → `/design-audit` | Axe-core scan runs in MCP server; analysis is prompt-guided |
| Visual QA | Prompt-delegated | `visual-qa.ts` → `/visual-qa` | Screenshot capture is MCP; evaluation is prompt-guided |
| Visual regression | Runner-enforced (with diffing) | `screenshot-review` MCP `compare` tool | Pixel-level diff with configurable threshold |
| Wiring audit | Prompt-delegated | `post-wave-review.ts` → `/wiring-audit` | Integration test existence checked by prompt |

### Ship Phase

| Check | Level | Runner Code | Notes |
|-------|-------|-------------|-------|
| PR creation | Runner-enforced | `merge-to-main.ts` runs `gh pr create` | Fails on non-zero exit |
| CI check validation | Runner-enforced | `merge-to-main.ts` runs `gh pr checks` | Validates required checks pass |
| PR merge verification | Runner-enforced | `await-merge.ts` runs `gh pr list` | Validates all wave PRs have MERGED state |
| Build plan approval | User-gated | `dependency-resolve.ts` → `awaitApproval` | User reviews BUILD_PLAN.md |
| Baseline promotion | User-gated | `set-baseline.ts` → `awaitApproval` | User confirms visual state is acceptable |

### Not Automated

| Check | Level | Where Documented |
|-------|-------|-----------------|
| Security review | Manual-only | Not in pipeline |
| Performance testing | Manual-only | Not in pipeline |
| Cross-browser testing | Manual-only | Not in pipeline |
| Content review | Manual-only | Not in pipeline |
| Server-side test coverage | Manual-only | `config.commands.test_server` exists but not wired into default pipeline |

## How to Read This

- **Runner-enforced** checks are your safety net. They run deterministically.
- **Prompt-delegated** checks depend on LLM adherence to instructions. They are valuable but not deterministic — treat their output as advisory, not guaranteed.
- **User-gated** checks are only as strong as the human reviewing them.
- If a check is not in this matrix, it is not automated.
```

- [ ] **Step 2: Commit**

```bash
git add docs/QUALITY_MATRIX.md
git commit -m "docs: add quality matrix documenting enforcement levels for all checks"
```

---

## Summary

| Phase | Tasks | Parallelizable | Findings Covered |
|-------|-------|---------------|-----------------|
| 1 | Tasks 1-2 | Yes (both) | #1 (run step-id), #2 (approval gates) |
| 2 | Tasks 3-4 | Yes (both) | #5 (merge gating), #7 (brittle preflights) |
| 3 | Tasks 5-6 | Yes (both) | #4 (visual regression), #3 (parallelism) |
| 4 | Task 7 | N/A | #6 (quality transparency) |

**Total:** 7 tasks covering all 7 findings. Each phase's tasks are independent and can be dispatched as parallel subagents.
