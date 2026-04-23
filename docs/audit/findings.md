# Frontend Orchestration Plugin — Audit Report

**Date:** 2026-04-22
**Scope:** Full audit of `/Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration/`
**Verdict:** Architecturally sound, operationally fragile. The DAG model, parallel subagent dispatching, and standards coverage are strong. The gaps are in the seams — where one phase hands off to the next, where subagents need context they don't get, and where quality gates exist on paper but aren't enforced in the pipeline.

---

## Critical Findings (10)

### 1. Interview output is prose, not structured spec
**Files:** `commands/ui-interview.md`, `subagents/e2e-writer.md`

The interview produces narrative requirements ("users can upload a roast and view it"), but the e2e-writer needs structured input: auth mechanism, data layer type, seed data strategy, per-flow error scenarios. The subagent must parse prose and guess — output quality varies based on how much detail the user volunteered.

**Fix:** Add a mandatory `## Test Specification` block to UI_REQUIREMENTS.md output with fields for auth type, data layer, test data strategy, and per-flow error scenarios.

---

### 2. Component builder lacks file path and convention context
**Files:** `subagents/component-builder.md`, `commands/build-component.md`

The subagent receives a component name and spec but not: import paths, test file location, CSS module location, test utilities path, GraphQL import locations, or which test runner to use. It guesses, writes to wrong paths, and the code review gate catches it — after wasting tokens.

**Fix:** Extend COMPONENT_INVENTORY.md format to include explicit file path, test path, styles path, and test utility imports per component.

---

### 3. Post-wave design audit isn't enforced
**Files:** `hooks/post-wave.md`, `runner/src/steps/`

`post-wave.md` claims to invoke the design-auditor subagent after each wave, but `defaults.ts` doesn't include `post-wave-review` as a pipeline step. The hook file is aspirational documentation — it never runs. Design violations ship uncaught until the manual `/design-audit` phase (much later).

**Fix:** Either add `post-wave-review` as a mandatory step in `defaults.ts`, or remove `post-wave.md` and move its responsibilities to the design-audit phase explicitly.

---

### 4. E2E tests can't run before build — Playwright config may not exist
**Files:** `subagents/e2e-writer.md`, `commands/build-pipeline.md`

Phase 2 runs `e2e-writer` and `e2e-scaffold` in parallel, but e2e-writer tries to run tests while e2e-scaffold is still creating `playwright.config.ts`. Hidden dependency causes race condition.

**Fix:** Make e2e-scaffold sequential before e2e-writer, or have e2e-writer create playwright.config.ts as part of its test infrastructure step.

---

### 5. TDD discipline isn't verified
**Files:** `commands/build-component.md`, `subagents/component-builder.md`

The protocol says "run tests, confirm they fail" but nothing verifies that test files contain actual assertions. A subagent can write empty `describe` blocks (no `it()` calls), test runner exits with code 0, and "tests pass" before any component exists.

**Fix:** Before proceeding to build, verify test file contains at least one `expect()` call per requirement. If tests pass before the component exists, halt and report.

---

### 6. Subagent result condensing discards evidence
**Files:** `commands/build-pipeline.md`, `commands/design-audit.md`, `commands/visual-qa.md`

Commands instruct the orchestrator to condense subagent output and not relay full reports. This hides which tests failed and why, what the code reviewer found, and whether axe-core actually ran or returned empty results.

**Fix:** Keep structured findings (one per line: severity, type, location, raw evidence). Condense narrative, not data.

---

### 7. Circular dependency detection has no enforcement gate
**Files:** `subagents/dependency-resolver.md`, `commands/build-pipeline.md`

The resolver detects circular deps and marks them as errors, but the pipeline presents BUILD_PLAN.md for approval without blocking on unresolved cycles. User can approve a plan with missing components.

**Fix:** After Phase 2, check BUILD_PLAN.md for circular dependency markers. If any found, halt and require the user to fix COMPONENT_INVENTORY.md before proceeding.

---

### 8. No auto-fix rollback mechanism
**Files:** `commands/design-audit.md`, `commands/visual-qa.md`

Both commands auto-fix critical and major issues but have no rollback if the fix breaks something else. A contrast fix that changes a color could break an RTL test that asserts on computed styles. No checkpoint, no revert path.

**Fix:** Checkpoint source files before auto-fix. If re-scan finds new violations or RTL tests fail after fix, rollback and escalate to manual review.

---

### 9. E2E test assertions can be shallow
**Files:** `subagents/e2e-writer.md`

Tests are told to "assert on visible outcomes" but nothing prevents a test from navigating to a URL and ending without checking DOM content. A test that does `page.goto('/roasts')` and `waitForURL` passes even if the page renders empty.

**Fix:** Require every test to include at least one `expect(locator).toBeVisible()` assertion on expected content. Add anti-pattern examples to the subagent instructions.

---

### 10. No state invalidation when requirements change
**Files:** `runner/src/state/`, `commands/session-start.md`

WORKFLOW_STATE.json is persistent. If the user edits UI_REQUIREMENTS.md mid-pipeline, the runner skips already-completed phases on resume — using stale specs. Components get built to outdated requirements.

**Fix:** Track file hash of UI_REQUIREMENTS.md in workflow state. If hash changes, mark downstream steps as stale. Add `/reset-from [step]` command to manually invalidate.

---

## Major Findings (10)

### 11. Interview doesn't capture responsive design assumptions
No questions about mobile-specific behaviors, tablet layouts, or touch target sizes. Builders must guess.

### 12. Design audit violations aren't attributed to components
Violations report route and DOM selector but not which component is responsible. Fixing requires manual investigation.

### 13. Code-reviewer invocation isn't standardized across subagents
`component-builder` mentions it; `e2e-writer` and `design-auditor` don't. No instructions for how to invoke it or interpret results.

### 14. No error handling for fixture setup failures in E2E
Auth and seed data fixtures have no skip/retry logic. Tests hang silently on setup failure.

### 15. Visual QA "trust your gut" isn't actionable for subagents
Subjective evaluation produces inconsistent results across routes. Needs structured checklist (YES/NO per heuristic).

### 16. `/build-page` and `/build-pipeline` conflict on BUILD_PLAN.md
Both write to the same file. Running one mid-pipeline of the other overwrites the plan.

### 17. Visual baseline never invalidated
No metadata tracking which wave set the baseline. Stale baselines from early waves can mask regressions in later waves.

### 18. MCP servers fail silently
`a11y-scanner` doesn't validate that axe-core actually returned results (empty violations could mean the page didn't load). `screenshot-review` has no timeout handling for pages that never reach `networkidle`.

### 19. No mechanism to skip/acknowledge minor violations
Every minor issue blocks until manually reviewed. No way to say "accepted, ship it" and have the audit remember on re-run.

### 20. Interview output format isn't validated
If a user edits COMPONENT_INVENTORY.md and drops a required field (Dependencies, Complexity), the dependency resolver silently skips the component with no error.

---

## Minor Findings (10)

| # | Finding |
|---|---------|
| 21 | Standards files don't cross-reference each other — reviewers confuse a11y scope with UX scope |
| 22 | No guidance for testing complex component relationships (wiring audits mentioned but not explained to subagent) |
| 23 | Setup script assumes `.claude/` directory structure, fails silently if non-standard |
| 24 | Token system assumptions undocumented (naming convention, flat vs nested, how to handle missing tokens) |
| 25 | Possibly dead subagent: `wave-executor.md` exists but runner uses `build-wave.ts` step instead |
| 26 | MCP server dependencies can go stale — no npm ci in setup for individual servers |
| 27 | Hook shell commands use `/tmp/` hardcoded — not portable to Windows/WSL |
| 28 | No timeout configuration for subagents or MCP calls |
| 29 | Build status tracked per component but no wave-level rollup view |
| 30 | Dependency resolver doesn't explain wave assignment reasoning to user |

---

## What Works Well

- **DAG execution model** — topological sort with proper dependency tracking is well-designed
- **Parallel wave execution** — subagent dispatching within waves is the right architecture
- **Design standards are comprehensive** — WCAG AA, Nielsen heuristics, Gestalt, frustration signals all codified
- **MCP servers for a11y and screenshots** — good separation of concerns
- **Scope-based pipeline filtering** — component/feature/page/app scopes are sensible
- **TDD philosophy is correct** — the intent (red-to-green, tests are immutable) is right even where enforcement is weak

---

## Recommended Fix Phases

### Phase 1 — Blocking (do before next real build)
1. Fix E2E infrastructure race (scaffold before writer)
2. Add structured test-specification block to interview output
3. Add build config (paths, conventions) to COMPONENT_INVENTORY.md
4. Add TDD verification (assert count check before build step)

### Phase 2 — High Priority
5. Integrate post-wave-review as mandatory pipeline step
6. Add auto-fix rollback (checkpoint → fix → verify → rollback if worse)
7. Add state invalidation when requirements change (file hash tracking)
8. Standardize code-reviewer invocation across all subagents

### Phase 3 — Important
9. Make screenshot breakpoints configurable
10. Add baseline metadata and invalidation
11. Fix result condensing (keep structured data, summarize narrative only)
12. Add subagent output validation in runner

### Phase 4 — Polish
13. Create troubleshooting guide
14. Create onboarding / getting-started guide
15. Cross-reference standards documents
16. Add MCP server resilience (health checks, timeouts, validation)
17. Clean up dead/unused subagent files

---

## Bottom Line

The plugin is **architecturally right and operationally fragile**. The DAG model, the TDD philosophy, the parallel wave execution, and the standards coverage are all solid design choices. The problems are at the seams: handoffs between phases lose information, quality gates exist in documentation but not in the pipeline, and subagents don't get enough context to work reliably in isolation.

Phase 1 fixes are all about closing the gap between what the plugin promises and what it can actually deliver today. Phase 2 makes it robust. Phase 3-4 make it polished enough for someone else to use.
