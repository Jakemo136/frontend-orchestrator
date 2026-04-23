---
description: Fully autonomous parallelized build of the entire frontend from requirements docs
---

# /build-pipeline

Fully autonomous parallelized build of the entire frontend.
Requires /docs/UI_REQUIREMENTS.md and
/docs/COMPONENT_INVENTORY.md to exist and be approved.

Phase 1 + 2 — E2E Tests AND Dependency Resolution (PARALLEL)
These two phases are independent. Dispatch both as subagents
in a single Agent tool message:

Subagent A: e2e-writer
- Write Playwright tests for every user flow in
  UI_REQUIREMENTS.md before any components are built
- One test file per major flow, saved to /client/e2e/
- Each test must follow exact user flow narrative, assert
  on visible UI elements, never be modified to pass, use
  realistic data via MSW or test DB
- Run all E2E tests. Confirm they fail. Log to BUILD_STATUS.md.

Subagent B: dependency-resolver
- Read COMPONENT_INVENTORY.md
- Group all components into build waves
- Wave 0: no dependencies
- Wave N: all dependencies in earlier waves
- Flag circular dependencies as errors
- Write full wave plan to /docs/BUILD_PLAN.md

Wait for both to complete. When subagents return, present
results in two layers:

**Summary** (always shown):
- Overall pass/fail per subagent
- Count of tests written / waves planned
- Any blockers (circular deps, missing requirements)

**Structured findings** (always shown, one per line):
- Each E2E test: file path, flow name, assertion count
- Each wave: component list, estimated complexity
- Each error: severity, location, description

Do NOT condense the structured findings — these are the
evidence the user needs to make approval decisions. Condense
narrative explanation only.

**Circular dependency gate (mandatory):**
Check BUILD_PLAN.md for any components flagged as circular
dependencies. If ANY circular dependencies exist:
1. STOP the pipeline
2. Surface the specific cycles to the user:
   "Circular dependency detected: ComponentA -> ComponentB
    Fix COMPONENT_INVENTORY.md to break the cycle and
    re-run /build-pipeline"
3. Do NOT proceed to Phase 3

If no circular dependencies:
Present BUILD_PLAN.md to user. Wait for explicit approval
before Phase 3.

Phase 3 — Parallel Build by Wave
Invoke wave-executor subagent for each wave in sequence.
Within each wave, dispatch all component-builder subagents
in a single Agent tool message — one per component, all
in parallel. Never build components one at a time.

After each wave, present component-builder results in two layers:

**Summary table** (always shown):
| Component | Status | RTL Tests | Issues |
|-----------|--------|-----------|--------|

**Per-component details** (always shown for failures):
For each failed component: which tests failed, the
assertion that failed, code reviewer findings. Do NOT
hide failure details in a summary.

Then:
- Run full RTL suite
- Run full E2E suite
- Log results to BUILD_STATUS.md
- Stop if failures exist, surface to user

Update BUILD_STATUS.md with wave-level rollup:

## Wave [N] Progress
- [x] ComponentA (RTL: 12/12 passing)
- [x] ComponentB (RTL: 8/8 passing)
- [ ] ComponentC (in progress)

Wave [N]: 2/3 complete (67%)

Phase 4 — E2E Green
After all waves complete, for any still-failing E2E tests:
- Diagnose root cause
- Fix without modifying test assertions
- Re-run until green

Phase 5 — Final Report
Update BUILD_STATUS.md with:
- All components with RTL test status
- All E2E tests with pass/fail
- Any open issues
- Suggested next steps

Approval gate: user must explicitly approve BUILD_PLAN.md
before Phase 3 begins. No autonomous building starts without
this confirmation.
