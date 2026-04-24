# Multi-Wave Pipeline & Build-Component Interface Fix

## Problem Statement

Two related issues, both identified in every prior audit:

1. **Single-wave hardcoding.** `generateDefaultPipeline()` hardcodes exactly one wave (wave 0). The README, `/build-pipeline` command spec, and `dependency-resolve` step all describe a multi-wave dependency-resolved build — but the DAG never materializes waves 1..N. A project with 3 dependency waves still gets a single `build-wave:0` step.

2. **build-component interface mismatch.** `build-wave.ts` invokes `/build-component --wave 0`, but `commands/build-component.md` declares `# /build-component [ComponentName]` and says "Confirm [ComponentName] exists in inventory." The runner sends a wave number; the command spec expects a component name.

## Design

### Key Architectural Constraint

The DAG is frozen per CLI invocation — `Executor` receives `StepDefinition[]` and never mutates it. But the CLI **regenerates the pipeline on every invocation** (`cli.ts:171`). This is the leverage point: after `dependency-resolve` completes and persists its wave count to state, all subsequent CLI invocations will generate a pipeline with the correct number of waves.

### Wave Count Flow

```
dependency-resolve completes
  → reads BUILD_PLAN.md, counts ## Wave N headers
  → stores wave_count in StepResult.metrics
  → StateManager persists to WORKFLOW_STATE.json

Next CLI invocation:
  → loads state
  → reads state.steps["dependency-resolve"].metrics.wave_count
  → passes to generateDefaultPipeline(config, waveCount)
  → pipeline now has N wave chains
```

### Multi-Wave DAG Shape

For waveCount=3:

```
dependency-resolve
  └→ build-wave:0 → test-suite:0 → post-wave-review:0 → open-prs:0 → await-merge:0
                                                                           └→ build-wave:1 → test-suite:1 → post-wave-review:1 → open-prs:1 → await-merge:1
                                                                                                                                                  └→ build-wave:2 → test-suite:2 → post-wave-review:2 → open-prs:2 → await-merge:2
                                                                                                                                                                                                                           └→ e2e-green → design-audit → visual-qa → set-baseline → pre-commit-review → merge-to-main
```

Each wave's `build-wave:N` depends on `await-merge:N-1`. Waves execute strictly in order — wave 1 can't start until wave 0's PRs are merged.

## Tasks

### Task 1: Multi-wave pipeline generation

**Files:** `runner/src/config/defaults.ts`

Add `waveCount` parameter (default 1) to `generateDefaultPipeline()`. Replace the hardcoded wave-0 block with a loop from 0 to waveCount-1:

```typescript
export function generateDefaultPipeline(
  config: OrchestratorConfig,
  waveCount: number = 1,
): StepDefinition[] {
  const effectiveWaves = Math.max(1, Math.floor(waveCount));
  // ...
  for (let w = 0; w < effectiveWaves; w++) {
    const dep = w === 0 ? waveDep : `await-merge:${w - 1}`;
    add(`build-wave:${w}`, "build-wave", [dep], { wave: w }, "component");
    add(`test-suite:${w}`, "test-suite", [`build-wave:${w}`], { wave: w, e2e_blocking: false }, "component");
    add(`post-wave-review:${w}`, "post-wave-review", [`test-suite:${w}`], { wave: w }, "component");
    add(`open-prs:${w}`, "open-prs", [`post-wave-review:${w}`], { wave: w }, "component");
    add(`await-merge:${w}`, "await-merge", [`open-prs:${w}`], { wave: w }, "component");
  }

  const lastWave = effectiveWaves - 1;
  add("e2e-green", "e2e-green", [`await-merge:${lastWave}`], {}, "page");
```

Ship deps also need to reference `lastWave`:
```typescript
  const shipDeps =
    s === "component" || s === "feature"
      ? [`await-merge:${lastWave}`]
      : ["visual-qa", "set-baseline"];
```

**Tests** (in `runner/tests/config/defaults.test.ts`):

| Test | Assertion |
|------|-----------|
| waveCount=1 backward compat | Same step IDs as current output |
| waveCount=3 produces 15 wave steps | 5 steps × 3 waves, correct IDs |
| Inter-wave dependency chain | build-wave:1 deps → await-merge:0; build-wave:2 deps → await-merge:1 |
| e2e-green depends on last wave | e2e-green deps → await-merge:2 (for waveCount=3) |
| Ship phase depends on last wave | pre-commit-review deps → await-merge:2 (component scope, waveCount=3) |
| waveCount=0 clamps to 1 | Same as waveCount=1 |
| Component scope still gets waves | component scope + waveCount=2 → build-wave:0 and build-wave:1 present |

### Task 2: Add `readFile` to RunContext

**Files:** `runner/src/types.ts`, `runner/src/runner/context.ts`, `runner/tests/steps/helpers.ts`

Add `readFile(path: string): Promise<string>` to the `RunContext` interface. This enables steps to read project files without importing `fs` directly, and is mockable in tests.

```typescript
// types.ts — RunContext interface
readFile(path: string): Promise<string>;

// context.ts — implementation
async readFile(path: string): Promise<string> {
  return readFileSync(join(projectRoot, path), "utf-8");
},

// helpers.ts — mock default
readFile: vi.fn(async () => ""),
```

**Tests:** No dedicated tests — covered by Task 3's tests of dependency-resolve.

### Task 3: Wave count extraction in dependency-resolve

**Files:** `runner/src/steps/dependency-resolve.ts`

After confirming BUILD_PLAN.md exists and before returning success, read the file and count wave sections. Export a pure `countWaves(content: string): number` function for direct testing.

```typescript
export function countWaves(planContent: string): number {
  const matches = planContent.match(/^##\s*[Ww]ave\s+\d+/gm);
  return Math.max(1, matches?.length ?? 1);
}
```

In `execute()`, after approval:
```typescript
const content = await ctx.readFile(planPath);
const waveCount = countWaves(content);

return {
  status: "passed",
  artifacts: [planPath],
  metrics: { wave_count: waveCount },
  message: `Build plan approved. ${waveCount} wave(s) identified.`,
};
```

**Tests** (in `runner/tests/steps/dependency-resolve.test.ts`):

| Test | Assertion |
|------|-----------|
| countWaves with 3 wave headers | Returns 3 |
| countWaves with no headers | Returns 1 |
| countWaves with mixed case | `## wave 0` and `## Wave 1` both count |
| execute returns wave_count in metrics | result.metrics.wave_count === N |
| existing tests still pass | No regressions |

### Task 4: Wire CLI to read wave count from state

**Files:** `runner/src/cli.ts`

Export a `getWaveCount(state: WorkflowState): number` helper. Before generating the pipeline in `run`, `run-step`, and `explain` cases, load state and extract wave count.

```typescript
export function getWaveCount(state: WorkflowState): number {
  const depResolve = state.steps["dependency-resolve"];
  if (depResolve?.status === "passed" && depResolve.metrics.wave_count) {
    return depResolve.metrics.wave_count;
  }
  return 1;
}
```

Each case that calls `generateDefaultPipeline` needs:
```typescript
const stateMgr = new StateManager(projectRoot);
const state = stateMgr.load(config.project, config.scope);
const waveCount = getWaveCount(state);
const steps = config.steps ?? generateDefaultPipeline(config, waveCount);
```

Note: the Executor also loads state internally. The CLI's load is read-only (just for wave count) and the Executor's is its mutable working copy. Two loads of a JSON file is fine.

**Tests** (in `runner/tests/cli.test.ts`):

| Test | Assertion |
|------|-----------|
| getWaveCount with no dep-resolve state | Returns 1 |
| getWaveCount with dep-resolve passed, wave_count=3 | Returns 3 |
| getWaveCount with dep-resolve failed | Returns 1 |
| getWaveCount with dep-resolve passed, no wave_count metric | Returns 1 |

### Task 5: Update build-component command spec

**Files:** `commands/build-component.md`

Add a `--wave N` calling convention at the top, before the existing single-component spec. When called with `--wave N`:

1. Read COMPONENT_INVENTORY.md
2. Find all components assigned to wave N
3. Build each component using the TDD protocol below
4. Report results per component

The single-component mode (`/build-component ComponentName`) remains unchanged for direct invocation.

This aligns the command spec with what `build-wave.ts:30` actually invokes: `ctx.invokeCommand("/build-component", "--wave ${wave}")`.

**No runner tests needed** — this is a prompt spec consumed by the LLM, not executable code. Verified by the existing `build-wave.test.ts:27` assertion that the invokeCommand call matches the spec.

## Success Criteria

All measurable:

1. `npm test` passes (all existing + new tests green)
2. `npx tsc --noEmit` clean
3. `generateDefaultPipeline(config, 3)` for app scope produces exactly `build-wave:0` through `await-merge:2` (15 wave steps) with correct inter-wave dependency chain
4. `generateDefaultPipeline(config)` (no wave count) produces identical output to current (backward compat)
5. `countWaves("## Wave 0\n...\n## Wave 1\n...\n## Wave 2\n...")` returns 3
6. `getWaveCount(stateWithPassedDepResolve)` returns the stored wave_count
7. `commands/build-component.md` documents both `[ComponentName]` and `--wave N` calling conventions
8. `build-wave.ts` invocation (`/build-component --wave N`) matches the documented command interface

## Execution Order

Tasks 1–3 can be parallelized (independent code paths). Task 4 depends on Task 1 (needs the `waveCount` parameter to exist). Task 5 is independent.

Recommended: 1 + 2 + 3 in parallel → 4 → 5.
