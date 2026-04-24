# Critical Findings Fixes

Source: `docs/frontend-orchestrator-critical-findings.md` (static audit at HEAD 8205d0a)

## Problem Statement

Five findings, in priority order:

1. **Approval behavior doesn't match README.** README says "your approval at every gate" / "Nothing ships without your sign-off" but default `approval_mode: auto` auto-passes all gates. No real pause exists.
2. **No `needs_approval` runner state.** `needs_command` has a full pause/resume signal cycle. Approvals have nothing equivalent — they auto-pass or hard-fail.
3. **Multi-wave stores only an integer.** `dependency-resolve` persists `wave_count: N` but not which components belong to which wave. Pipeline shape is derived from a single number.
4. **Workflow-semantic test coverage is thin.** Approval pause/resume, multi-wave execution, and retry paths have no tests.
5. **README overstates enforcement.** The quality matrix is honest about prompt-delegated vs. runner-enforced. The README isn't.

## Design: Interactive Approval (Findings 1-2)

Mirror the existing `needs_command` signal pattern:

```
Step calls awaitApproval(prompt)
  → interactive mode throws NeedsApprovalSignal
  → executor catches it, returns { type: "needs_approval", stepId, prompt }
  → CLI outputs JSON, exits
  → Claude Code session presents prompt to user
  → user approves or rejects
  → CLI re-invoked with --approval-result stepId=approved|rejected
  → approval handler finds cached result → resolves or throws ApprovalDeniedError
```

`auto` mode is unchanged (log + continue). `ci` mode is unchanged (throw ApprovalDeniedError). `interactive` is the new mode that actually pauses.

Default stays `auto` — changing it would break existing users. README gets updated to be precise about what each mode does.

## Tasks

### Task 1: NeedsApprovalSignal type infrastructure

**Files:** `runner/src/types.ts`

Add parallel to NeedsCommandSignal:

```typescript
export interface NeedsApprovalSignal {
  __type: "needs_approval";
  stepId: string;
  prompt: string;
}

export function isNeedsApprovalSignal(err: unknown): err is NeedsApprovalSignal {
  return (
    typeof err === "object" &&
    err !== null &&
    "__type" in err &&
    (err as NeedsApprovalSignal).__type === "needs_approval"
  );
}
```

Add `"interactive"` back to ApprovalMode:
```typescript
export type ApprovalMode = "auto" | "ci" | "interactive";
```

Add to RunnerOutput union:
```typescript
| { type: "needs_approval"; stepId: string; prompt: string }
```

**Tests:** type guard tests in a new or existing test file.

### Task 2: Interactive approval handler + schema

**Files:** `runner/src/runner/approval.ts`, `runner/src/config/schema.ts`

schema.ts: change `z.enum(["auto", "ci"])` to `z.enum(["auto", "ci", "interactive"])`.

approval.ts: add `interactive` case to the switch. It needs access to `stepId` (already available as a parameter) and checks cached approval results before throwing:

```typescript
case "interactive": {
  const cached = approvalResults?.get(stepId);
  if (cached === true) {
    recordApproval(state, stepId, prompt, "interactive");
    return;
  }
  if (cached === false) {
    throw new ApprovalDeniedError(prompt);
  }
  throw { __type: "needs_approval", stepId, prompt } satisfies NeedsApprovalSignal;
}
```

`createApprovalHandler` needs a new parameter: `approvalResults?: Map<string, boolean>`.

**Tests:** interactive mode throws NeedsApprovalSignal when no cached result; returns when cached true; throws ApprovalDeniedError when cached false.

### Task 3: Executor + parallel catch NeedsApprovalSignal

**Files:** `runner/src/runner/executor.ts`, `runner/src/runner/parallel.ts`

executor.ts `executeStepDef`: add catch for `isNeedsApprovalSignal`:
```typescript
if (isNeedsApprovalSignal(err)) {
  return { type: "needs_approval", stepId: stepDef.id, prompt: err.prompt };
}
```

parallel.ts `fanOutSteps`: handle NeedsApprovalSignal like NeedsCommandSignal — capture it in the result. Widen `ParallelResult.signal` to `NeedsCommandSignal | NeedsApprovalSignal`.

executor.ts `runParallel`: check for approval signals alongside command signals. Revert signaled steps so they're retryable.

**Tests:** executor returns `needs_approval` when step's approval handler throws signal; parallel captures approval signal without crashing other tasks.

### Task 4: CLI approval result handling

**Files:** `runner/src/cli.ts`, `runner/src/runner/context.ts`

cli.ts: parse `--approval-result stepId=approved|rejected` flags (parallel to `--command-result`). Store in `Map<string, boolean>`.

Pass `approvalResults` through Executor constructor → createRunContext → createApprovalHandler.

Executor constructor needs a new optional parameter: `approvalResults?: Map<string, boolean>`.

context.ts: pass `approvalResults` to `createApprovalHandler`.

**Tests:** parseArgs extracts approval results; getWaveCount still works; round-trip: step signals needs_approval → re-invoke with --approval-result → step completes.

### Task 5: Persist structured wave plan

**Files:** `runner/src/steps/dependency-resolve.ts`

After counting waves, also parse component assignments from BUILD_PLAN.md. Write `.orchestrator/wave-plan.json`:

```json
{
  "wave_count": 3,
  "waves": {
    "0": ["Header", "Footer", "Button"],
    "1": ["NavBar", "Sidebar"],
    "2": ["Dashboard"]
  }
}
```

Update `commands/build-component.md` wave mode to prefer reading `.orchestrator/wave-plan.json` over parsing COMPONENT_INVENTORY.md, falling back to inventory if the plan file doesn't exist.

**Tests:** countWaves + parseWavePlan tests with sample BUILD_PLAN.md content; wave-plan.json written on successful dependency-resolve.

### Task 6: README precision + workflow-semantic tests

**Files:** `README.md`, new/expanded test files

README changes:
- Replace "your approval at every gate" with precise language: "In interactive mode (`approval_mode: interactive`), the pipeline pauses at every gate for your explicit sign-off. In the default auto mode, gates are logged and auto-approved. In CI mode, gates reject automatically."
- Add `approval_mode` to the config example with a comment
- Keep the "Nothing ships without your sign-off" spirit but qualify it

Tests to add:
- Approval round-trip: interactive signal → cached approved → step passes
- Approval round-trip: interactive signal → cached rejected → step fails
- Auto mode doesn't signal (existing, but verify)
- CI mode throws ApprovalDeniedError (existing, but verify)
- Multi-wave generation from state: CLI with wave_count=3 in state → 15 wave steps in pipeline

## Success Criteria

1. `npm test` passes (all existing + new tests green)
2. `npx tsc --noEmit` clean
3. `approval_mode: interactive` causes steps to return `{ type: "needs_approval" }` instead of auto-passing
4. Re-invoking CLI with `--approval-result stepId=approved` causes the step to complete
5. Re-invoking CLI with `--approval-result stepId=rejected` causes the step to fail with ApprovalDeniedError
6. `auto` and `ci` modes are unchanged
7. `.orchestrator/wave-plan.json` written by dependency-resolve with component-to-wave mapping
8. README accurately describes all three approval modes
9. No references to "interactive" as broken/removed — it's now a working feature

## Execution Order

Task 1 first (types). Tasks 2 + 3 in parallel (both depend on 1). Task 4 depends on 2 + 3. Task 5 independent (can parallel with anything). Task 6 after 4.

```
Task 1 → Task 2 ─┐
         Task 3 ─┤→ Task 4 → Task 6
Task 5 ──────────┘
```
