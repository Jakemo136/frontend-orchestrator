---
description: Fully autonomous parallelized build of the entire frontend from requirements docs
---

# /build-pipeline

Fully autonomous parallelized build of the entire frontend.
Requires /docs/UI_REQUIREMENTS.md and
/docs/COMPONENT_INVENTORY.md to exist and be approved.

Phase 1 — E2E Test Generation
Invoke e2e-writer subagent to write Playwright tests for
every user flow in UI_REQUIREMENTS.md before any components
are built.

One test file per major flow, saved to /client/e2e/:
- auth.e2e.ts
- upload.e2e.ts
- roast-detail.e2e.ts (or equivalent for this project)
- comparison.e2e.ts
- sharing.e2e.ts

Each test must:
- Follow exact user flow narrative in UI_REQUIREMENTS.md
- Assert on visible UI elements and user-facing outcomes
- Never be modified to pass — components are fixed instead
- Use realistic data via MSW or test DB

Run all E2E tests. Confirm they fail. Log to BUILD_STATUS.md.

Phase 2 — Dependency Graph Resolution
Invoke dependency-resolver subagent to:
- Read COMPONENT_INVENTORY.md
- Group all components into build waves
- Wave 0: no dependencies
- Wave N: all dependencies in earlier waves
- Flag circular dependencies as errors
- Write full wave plan to /docs/BUILD_PLAN.md

Present BUILD_PLAN.md to user. Wait for explicit approval
before Phase 3.

Phase 3 — Parallel Build by Wave
Invoke wave-executor subagent for each wave in sequence.
Within each wave, spin up parallel component-builder
subagents — one per component.

After each wave:
- Run full RTL suite
- Run full E2E suite
- Log results to BUILD_STATUS.md
- Stop if failures exist, surface to user

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
