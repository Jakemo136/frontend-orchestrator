# Frontend Orchestration Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 30 findings from the frontend-orchestration plugin audit — 10 critical, 10 major, 10 minor — organized into 4 waves with parallelizable tasks within each wave.

**Architecture:** All changes target this repo. Changes are to markdown skill files (commands, subagents), TypeScript runner code, and JavaScript MCP servers. No new dependencies needed. Each task is a focused edit to 1-3 files.

**Tech Stack:** Markdown (skill files), TypeScript (runner), JavaScript/Node.js (MCP servers), Zod (schema validation)

---

## Progress

| Wave | Status | Commit | Findings covered |
|------|--------|--------|-----------------|
| 1 | **DONE** | `632ba02` | #1-9, #11, #13, #14, #20, #22, #24 |
| 2 | TODO | — | #6, #8, #10 |
| 3 | TODO | — | #12, #15, #16, #17, #18, #19 |
| 4 | TODO | — | #21, #23, #25, #26, #27, #28, #29, #30 |

**Note:** Wave 1 was broader than planned — it covered 17/30 findings by consolidating overlapping fixes. Tasks 6 (result condensing) and 14 (fixture error handling) were partially addressed in Wave 1. Wave 2 tasks 6 and 8 have remaining work. Task 7 (state invalidation) is fully outstanding.

---

## Wave 1 — Critical Fixes (Blocking) — COMPLETE

Committed as `632ba02`. These fix the seams between phases. All 4 tasks completed.

---

### Task 1: Structure the interview output for E2E writer consumption

**Audit findings:** #1 (interview output is prose), #11 (no responsive design capture), #20 (interview output format not validated)

**Files:**
- Modify: `commands/ui-interview.md`

- [ ] **Step 1: Add Test Specification section to interview output**

Append after line 51 (the `Full user flow narratives` line) in the `On completion, produce:` section for `/docs/UI_REQUIREMENTS.md`:

```markdown
  - Test specification block (structured, not prose):

  ## Test Specification

  ### Authentication
  - Type: [none | cookie | token | storage | OAuth]
  - Provider: [Clerk | Auth0 | custom endpoint | none]
  - Fixture setup: [server call | token injection | storage state | none]

  ### Data Layer
  - Type: [GraphQL | REST | local-only]
  - Mock strategy: [MSW | test DB | API seeding | none]
  - Schema location: [path if applicable]

  ### Per-Flow Error Scenarios
  For each flow identified in Section 4:
  - [Flow name]: [list error cases: network timeout, validation failure, auth expired, empty response]

  ### Responsive Behavior
  - Mobile layout: [stack | collapse nav | bottom sheet | full-width]
  - Tablet layout: [sidebar changes | grid adjustments | same as desktop]
  - Desktop-only features: [drag-drop | multi-pane | keyboard shortcuts]
  - Touch-specific interactions: [swipe | long-press | none]
```

- [ ] **Step 2: Add responsive design questions to interview Section 3**

Replace the existing Section 3 block (lines 27-30) with:

```markdown
3. Navigation and layout
   - Global nav structure
   - Mobile vs desktop navigation (hamburger? bottom nav? sidebar collapse?)
   - Any persistent UI (sidebars, headers, toasts)?
   - What changes between mobile, tablet, and desktop?
   - Any features mobile-only or desktop-only?
   - Touch-specific interactions? (swipe, long-press)
```

- [ ] **Step 3: Add required fields list to COMPONENT_INVENTORY.md format**

After line 62 (`Build status: [ ] not started`), add:

```markdown
  Required fields per component (all must be present):
  - Page, Dependencies, GraphQL, Complexity, Build status
  If any field is missing, downstream steps will fail.
  Validate before approving.
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add commands/ui-interview.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: structure interview output for e2e-writer and add responsive capture"
```

---

### Task 2: Give component builder file paths and convention context

**Audit findings:** #2 (component builder lacks context), #24 (token system undocumented)

**Files:**
- Modify: `commands/ui-interview.md` (COMPONENT_INVENTORY format)
- Modify: `subagents/component-builder.md`
- Modify: `commands/build-component.md`

- [ ] **Step 1: Extend COMPONENT_INVENTORY.md format with build config**

In `commands/ui-interview.md`, replace the component inventory format (lines 54-62) with:

```markdown
  ## [ComponentName]
  - Page: [page name or "shared"]
  - Dependencies: [list of other components, or "none"]
  - GraphQL: [query or mutation name, or "none"]
  - Complexity: [low / medium / high]
  - Build config:
    - File: src/components/[Page]/[ComponentName].tsx
    - Test: src/components/[Page]/[ComponentName].test.tsx
    - Styles: src/components/[Page]/[ComponentName].module.css
    - Test utilities: src/test-utils.ts
    - GraphQL imports: src/graphql/[queries|mutations].ts
    - Test runner: vitest
    - CSS approach: CSS Modules
    - Token file: src/styles/tokens.css
  - Build status: [ ] not started
```

- [ ] **Step 2: Update component-builder subagent to consume build config**

Replace the entire content of `subagents/component-builder.md` with:

```markdown
# Component Builder Subagent

Receives: ComponentName, component spec from
COMPONENT_INVENTORY.md (including Build config section),
relevant section of UI_REQUIREMENTS.md

## File Paths (from Build config)

Read the `Build config` section of the component's inventory
entry. Use these exact paths — do not guess:
- Component file: `Build config → File`
- Test file: `Build config → Test`
- CSS module: `Build config → Styles`
- Test utilities import: `Build config → Test utilities`
- GraphQL imports: `Build config → GraphQL imports`
- Test runner: `Build config → Test runner`
- Token file: `Build config → Token file`

If any Build config field is missing, STOP and report:
"ComponentName is missing Build config fields in
COMPONENT_INVENTORY.md. Cannot build without file paths."

## TDD Protocol

Executes the full TDD Component Build Protocol:
1. Write RTL tests to the exact Test path
   - Import test utilities from the path in Build config
   - Use the test runner specified in Build config
2. Run tests — confirm they fail
   - Verify test file contains at least one expect() call
   - If tests pass before component exists, STOP and report:
     "Tests must fail before component is built"
3. Build component to the exact File path
   - Import CSS module from the exact Styles path
   - Use only tokens from the Token file path
   - Import GraphQL operations from GraphQL imports path
4. Confirm tests pass
5. CSS pass with CSS Modules at the exact Styles path
   - No inline styles or hardcoded values
6. Confirm tests still pass
7. Invoke code-reviewer agent against all changed files
   - Fix Critical and Major issues, re-run tests after fixes
   - Minor issues: note but do not block
8. Update COMPONENT_INVENTORY.md build status
9. Report completion or failure to orchestrator

Reports back: success | failure with details
```

- [ ] **Step 3: Add token system documentation to build-component**

In `commands/build-component.md`, replace line 29 (`Use only tokens defined in src/styles/tokens.css`) with:

```markdown
   - Use only tokens defined in the project's token file
     (default: src/styles/tokens.css)
   - Token naming: --color-[intent], --spacing-[size],
     --font-[property]
   - If a needed token doesn't exist, add it to the token
     file with a comment, don't use a hardcoded value
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add commands/ui-interview.md subagents/component-builder.md commands/build-component.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: give component builder explicit file paths and token docs"
```

---

### Task 3: Fix E2E infrastructure race condition and enforce TDD

**Audit findings:** #4 (e2e-scaffold/writer race), #5 (TDD not verified), #9 (shallow E2E assertions)

**Files:**
- Modify: `runner/src/config/defaults.ts`
- Modify: `subagents/e2e-writer.md`
- Modify: `commands/build-component.md`

- [ ] **Step 1: Make e2e-scaffold sequential before dependency-resolve**

In `runner/src/config/defaults.ts`, change line 29-30 from:

```typescript
  add("e2e-scaffold", "e2e-scaffold", ["user-story-generation"], {}, "page");
  add("dependency-resolve", "dependency-resolve", ["user-story-generation"], {}, "page");
```

to:

```typescript
  add("e2e-scaffold", "e2e-scaffold", ["user-story-generation"], {}, "page");
  add("dependency-resolve", "dependency-resolve", ["e2e-scaffold"], {}, "page");
```

This makes dependency-resolve wait for e2e-scaffold, which guarantees playwright.config.ts exists before any tests are written or run.

- [ ] **Step 2: Add assertion enforcement to e2e-writer**

In `subagents/e2e-writer.md`, replace lines 62-68 (the Rules section) with:

```markdown
## Rules

- Tests must be written to fail initially — this is correct
- Never write a test that passes before the component exists
- Assert on user-visible elements, not implementation details
- If a flow requires auth, use the `authenticatedPage` fixture
- If a flow requires data, use the `seedData` fixture

## Assertion Requirements (mandatory)

Every test MUST include at least one assertion that verifies
visible content on the page. Navigation alone is not sufficient.

Anti-pattern (NEVER write this):
```typescript
test('user can view roasts', async ({ page }) => {
  await page.goto('/roasts');
  await page.waitForURL('/roasts');
  // NO — test passes even if page is blank
});
```

Required pattern:
```typescript
test('user can view roasts', async ({ page }) => {
  await page.goto('/roasts');
  await expect(page.getByRole('heading', { name: /roasts/i })).toBeVisible();
  await expect(page.getByRole('list')).toBeVisible();
});
```

Every test must have:
1. At least one `expect(locator).toBeVisible()` on expected content
2. Interaction tests must verify the RESULT of the interaction
3. Form tests must verify both success AND error states

## Fixture Error Handling

- If auth fixture setup fails: skip test with message
  "[test-name] skipped: auth setup failed — [error]"
- If seed data setup fails: skip test with message
  "[test-name] skipped: data setup failed — [error]"
- If teardown fails: log warning but don't fail the test
  (prevents cascade failures across the suite)
```

- [ ] **Step 3: Add TDD verification gate to build-component**

In `commands/build-component.md`, replace lines 17-18:

```markdown
1. Write RTL tests first based on UI_REQUIREMENTS.md:
   - Loading state renders correctly
```

with:

```markdown
1. Write RTL tests first based on UI_REQUIREMENTS.md:
   - Each test must contain at least one expect() assertion
   - Loading state renders correctly
```

And after line 21 (`correct behavior`), before line 22 (`2. Run tests`), add:

```markdown
2. Verify test quality before running:
   - Count expect() calls in the test file — must be > 0
   - Each test case (it/test block) must have at least
     one assertion
   - If any test case has zero assertions, add them
3. Run tests — confirm they fail
   - If ALL tests pass before the component exists, STOP
     and report: "Tests pass before component exists —
     tests are not asserting correctly"
```

Then renumber subsequent steps (old step 2 becomes step 3, etc. through step 9 becoming step 10).

- [ ] **Step 4: Rebuild runner**

```bash
cd /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration/runner && npx tsc
```

Expected: Clean compile, no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add runner/src/config/defaults.ts runner/dist/config/defaults.js runner/dist/config/defaults.js.map subagents/e2e-writer.md commands/build-component.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: resolve e2e scaffold race condition and enforce TDD verification"
```

---

### Task 4: Wire post-wave-review into the pipeline and add circular dep gate

**Audit findings:** #3 (post-wave audit not enforced), #7 (circular dep no gate)

**Files:**
- Modify: `runner/src/config/defaults.ts`
- Modify: `commands/build-pipeline.md`
- Modify: `subagents/dependency-resolver.md`

- [ ] **Step 1: Add post-wave-review steps to defaults.ts**

In `runner/src/config/defaults.ts`, after the component/feature scope block (after line 38, `}`), add:

```typescript
  // Phase 3b: Post-wave review (page+ scope gets review after each dynamic wave)
  // For page/app scope, post-wave-review is injected dynamically by the executor
  // after each build-wave completes. This static entry covers component/feature scope.
  if (s === "component" || s === "feature") {
    add("post-wave-review:0", "post-wave-review", ["test-suite:0"], { wave: 0 }, "component");
  }
```

And update the ship dependencies for component/feature scope (line 48):

```typescript
  const shipDeps =
    s === "component" || s === "feature"
      ? ["post-wave-review:0"]
      : ["visual-qa", "set-baseline"];
```

- [ ] **Step 2: Add circular dependency enforcement to build-pipeline**

In `commands/build-pipeline.md`, replace lines 32-37 (the "Wait for both" block):

```markdown
Wait for both to complete. When subagents return, do NOT
dump their full output into the conversation. Read each
result, extract only what matters (pass/fail, key findings,
file paths), and present a condensed summary to the user.
Present BUILD_PLAN.md to user. Wait for explicit approval
before Phase 3.
```

with:

```markdown
Wait for both to complete. When subagents return, extract
key findings (pass/fail, wave assignments, file paths) and
present a condensed summary.

**Circular dependency gate (mandatory):**
Check BUILD_PLAN.md for any components flagged as circular
dependencies. If ANY circular dependencies exist:
1. STOP the pipeline
2. Surface the specific cycles to the user:
   "Circular dependency detected: ComponentA ↔ ComponentB
    Fix COMPONENT_INVENTORY.md to break the cycle and
    re-run /build-pipeline"
3. Do NOT proceed to Phase 3

If no circular dependencies:
Present BUILD_PLAN.md to user. Wait for explicit approval
before Phase 3.
```

- [ ] **Step 3: Add cycle reporting to dependency-resolver**

In `subagents/dependency-resolver.md`, replace lines 10-11:

```markdown
4. Detect circular dependencies — report as errors,
   do not assign to any wave
```

with:

```markdown
4. Detect circular dependencies:
   - Report each cycle with the specific component chain
     (e.g., "Button → Icon → Button")
   - Mark cyclic components with `⚠️ CIRCULAR` in BUILD_PLAN.md
   - Do not assign cyclic components to any wave
   - If cycles exist, add a ## Circular Dependencies section
     at the top of BUILD_PLAN.md listing all cycles
```

- [ ] **Step 4: Rebuild runner**

```bash
cd /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration/runner && npx tsc
```

Expected: Clean compile, no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add runner/src/config/defaults.ts runner/dist/config/defaults.js runner/dist/config/defaults.js.map commands/build-pipeline.md subagents/dependency-resolver.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: wire post-wave-review into pipeline and add circular dep gate"
```

---

## Wave 2 — Critical Fixes (Robustness)

Depends on Wave 1 completing. Tasks 5-8 are independent and can run in parallel.

---

### Task 5: Add auto-fix rollback mechanism

**Audit finding:** #8 (no auto-fix rollback)

**Files:**
- Modify: `commands/design-audit.md`
- Modify: `commands/visual-qa.md`

- [ ] **Step 1: Add rollback protocol to design-audit Phase 3**

In `commands/design-audit.md`, replace lines 114-123 (Phase 3) with:

```markdown
## Phase 3: Auto-fix Critical and Major issues

Rollback-safe auto-fix protocol:

1. **Checkpoint:** Before any fix, record the list of files
   that will be modified. Use `git stash push -m "pre-autofix"` 
   or copy files to a temp location if not in a git repo.

2. **Apply fixes** for Critical issues first, then Major.

3. **Verify fixes:**
   a. Re-run a11y-scanner on fixed routes
   b. Re-capture screenshots at all breakpoints
   c. Re-run visual composition review on new screenshots
   d. Run full RTL test suite — no new failures allowed

4. **Evaluate results:**
   - If re-scan shows zero new violations AND RTL tests pass:
     fixes are good. Update DESIGN_AUDIT.md.
   - If re-scan shows NEW violations not in the original report:
     ROLLBACK. Restore from checkpoint. Mark the original
     violation as "auto-fix attempted, caused regression —
     manual fix required" in DESIGN_AUDIT.md.
   - If RTL tests fail after fix: ROLLBACK. Restore from
     checkpoint. Mark as "auto-fix broke RTL tests — manual
     fix required" in DESIGN_AUDIT.md.

5. **Escalate unfixable issues:** Surface to user with:
   - What the violation is
   - What fix was attempted
   - Why it failed (new violation or broken test)
   - Suggested manual approach

Do not auto-fix Minor issues — flag for human review.
```

- [ ] **Step 2: Add rollback protocol to visual-qa**

In `commands/visual-qa.md`, replace lines 143-146 with:

```markdown
Auto-fix Critical and Major issues following the same
rollback-safe protocol as /design-audit Phase 3:

1. Checkpoint files before fix
2. Apply fix
3. Re-run affected checks (screenshot, interaction test)
4. Run RTL tests — no new failures
5. If fix causes regression: rollback and escalate
6. If fix is clean: update VISUAL_QA.md

Do not auto-fix Minor issues — flag for human review.
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add commands/design-audit.md commands/visual-qa.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: add rollback-safe auto-fix protocol to design-audit and visual-qa"
```

---

### Task 6: Fix result condensing — keep structured data

**Audit finding:** #6 (condensing discards evidence)

**Files:**
- Modify: `commands/build-pipeline.md`
- Modify: `commands/design-audit.md`
- Modify: `commands/visual-qa.md`
- Modify: `subagents/wave-executor.md`

- [ ] **Step 1: Replace condensing instructions in build-pipeline**

In `commands/build-pipeline.md`, replace lines 32-35:

```markdown
Wait for both to complete. When subagents return, do NOT
dump their full output into the conversation. Read each
result, extract only what matters (pass/fail, key findings,
file paths), and present a condensed summary to the user.
```

with:

```markdown
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
```

- [ ] **Step 2: Replace condensing instructions in wave-executor**

In `subagents/wave-executor.md`, replace lines 13-16:

```markdown
3. Collect results — read each subagent's output but do NOT
   relay full reports. Extract pass/fail, test counts, and
   key issues per component into a condensed wave summary.
```

with:

```markdown
3. Collect results and present in two layers:

   **Summary table** (always shown):
   | Component | Status | RTL Tests | Issues |
   |-----------|--------|-----------|--------|
   | Button    | pass   | 12/12     | 0      |
   | Card      | fail   | 8/10     | 1 Critical |

   **Per-component details** (always shown for failures):
   For each failed component:
   - Which tests failed and the assertion that failed
   - Code reviewer findings (severity, file, description)
   - Exact error message from test runner

   Do NOT hide failure details in a summary.
```

- [ ] **Step 3: Replace condensing in design-audit**

In `commands/design-audit.md`, replace lines 29-31:

```markdown
When subagents return, condense their results into a
unified summary. Do NOT paste each subagent's full output
into the conversation — extract violations by severity,
affected routes, and screenshot paths.
```

with:

```markdown
When subagents return, present results in two layers:

**Summary:** violation counts by severity, routes affected
**Structured violations** (one per line, always shown):
- Severity | WCAG criterion | Route | DOM selector | Description

Keep every violation visible. Condense narrative explanation
around the violations, not the violations themselves.
```

- [ ] **Step 4: Replace condensing in visual-qa**

In `commands/visual-qa.md`, replace lines 99-103:

```markdown
When per-route subagents return, condense all results into
a unified report. Do NOT paste each subagent's full output
into the conversation — extract findings by severity, merge
duplicates across routes, and present a single summary.
```

with:

```markdown
When per-route subagents return, merge into a unified report:

**Summary:** finding counts by severity, routes affected
**Structured findings** (one per line, always shown):
- Severity | Category (H1-H10 / Gestalt / Frustration) | Route | Description

Merge exact duplicates across routes (same issue, same
element). Keep every unique finding visible.
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add commands/build-pipeline.md commands/design-audit.md commands/visual-qa.md subagents/wave-executor.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: preserve structured findings in subagent result summaries"
```

---

### Task 7: Add state invalidation when requirements change

**Audit finding:** #10 (no state invalidation)

**Files:**
- Modify: `runner/src/state/state.ts`
- Modify: `runner/src/types.ts`
- Modify: `commands/session-start.md`

- [ ] **Step 1: Add file hash tracking to WorkflowState type**

In `runner/src/types.ts`, add to the `WorkflowState` interface (after line 182, before the closing `}`):

```typescript
  artifact_hashes?: Record<string, string>;
```

- [ ] **Step 2: Add hash tracking and invalidation to StateManager**

In `runner/src/state/state.ts`, add the import at the top (after line 1):

```typescript
import { createHash } from "crypto";
```

Then add these methods to the `StateManager` class (after the `update` method, before the closing `}`):

```typescript
  computeFileHash(filePath: string): string {
    if (!existsSync(filePath)) return "";
    const content = readFileSync(filePath, "utf-8");
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  checkForStaleState(
    state: WorkflowState,
    artifactPaths: Record<string, string>,
  ): string[] {
    if (!state.artifact_hashes) return [];
    const staleArtifacts: string[] = [];
    for (const [name, path] of Object.entries(artifactPaths)) {
      const currentHash = this.computeFileHash(path);
      const savedHash = state.artifact_hashes[name];
      if (savedHash && currentHash !== savedHash) {
        staleArtifacts.push(name);
      }
    }
    return staleArtifacts;
  }

  updateArtifactHashes(
    state: WorkflowState,
    artifactPaths: Record<string, string>,
  ): void {
    state.artifact_hashes = {};
    for (const [name, path] of Object.entries(artifactPaths)) {
      state.artifact_hashes[name] = this.computeFileHash(path);
    }
  }

  invalidateDownstream(
    state: WorkflowState,
    fromStepId: string,
    allSteps: Array<{ id: string; deps: string[] }>,
  ): string[] {
    const invalidated: string[] = [];
    const queue = [fromStepId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const step of allSteps) {
        if (step.deps.includes(current) && !invalidated.includes(step.id)) {
          invalidated.push(step.id);
          delete state.steps[step.id];
          queue.push(step.id);
        }
      }
    }
    return invalidated;
  }
```

- [ ] **Step 3: Add staleness check to session-start command**

In `commands/session-start.md`, after line 19 (the `Produce a concise briefing` line), add:

```markdown

7. Check for stale state:
   Compare hashes of UI_REQUIREMENTS.md and
   COMPONENT_INVENTORY.md against saved hashes in
   WORKFLOW_STATE.json. If either file changed since
   the last pipeline run:
   - Warn: "⚠️ [filename] has changed since the last
     pipeline run. Downstream steps may be using stale
     specs. Run /build-pipeline to re-plan, or manually
     reset with: delete .orchestrator/WORKFLOW_STATE.json"
   - List which steps would be invalidated
```

- [ ] **Step 4: Rebuild runner**

```bash
cd /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration/runner && npx tsc
```

Expected: Clean compile, no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add runner/src/state/state.ts runner/src/types.ts runner/dist/ commands/session-start.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "feat: add state invalidation when requirements files change"
```

---

### Task 8: Standardize code-reviewer invocation across all subagents

**Audit finding:** #13 (code-reviewer not standardized)

**Files:**
- Modify: `subagents/e2e-writer.md`
- Modify: `subagents/design-auditor.md`

- [ ] **Step 1: Add code review gate to e2e-writer**

In `subagents/e2e-writer.md`, add a new section after the `## Rules` section (after the last rule):

```markdown
## Code Review Gate (required)

After all test files are written:
1. Collect all files created: fixtures.ts, global-setup.ts,
   and all *.e2e.ts files
2. Invoke the code-reviewer agent with:
   - File list: [all created files]
   - Context: "E2E test suite for [project name]"
3. Parse the result:
   - Critical/Major issues: fix and re-verify test structure
   - Minor issues: log but do not block
4. Confirm code review passed before reporting completion
```

- [ ] **Step 2: Add code review gate to design-auditor**

In `subagents/design-auditor.md`, add after line 27 (before `Reports back`):

```markdown
3. Code Review Gate on auto-fixed files:
   If any files were modified during auto-fix:
   - Invoke code-reviewer agent against modified files
   - Context: "Design audit auto-fix for [routes]"
   - Critical/Major: fix, re-run audit on affected routes
   - Minor: note in DESIGN_AUDIT.md but do not block
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add subagents/e2e-writer.md subagents/design-auditor.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: standardize code-reviewer invocation across all subagents"
```

---

## Wave 3 — Major Fixes (Quality)

Depends on Wave 2 completing. Tasks 9-14 are independent and can run in parallel.

---

### Task 9: Attribute design audit violations to components

**Audit finding:** #12 (violations not attributed to components)

**Files:**
- Modify: `subagents/design-auditor.md`
- Modify: `commands/design-audit.md`

- [ ] **Step 1: Add component attribution to design-auditor output**

In `subagents/design-auditor.md`, replace lines 22-27 (the report format):

```markdown
Reports back to orchestrator:
- Count of critical, major, minor violations found
- Count of violations auto-fixed
- Count of violations remaining
- Screenshot paths for PR attachment
- Pass or fail (fail = any unresolved critical violations)
```

with:

```markdown
Reports back to orchestrator with component attribution:
- Count of critical, major, minor violations found
- Count of violations auto-fixed
- Count of violations remaining
- Screenshot paths for PR attachment
- Pass or fail (fail = any unresolved critical violations)

Per-violation detail (mandatory):
- Route: [route path]
- Component: [ComponentName from COMPONENT_INVENTORY.md]
  (match DOM selector to component source file)
- File: [src/components/.../ComponentName.tsx]
- Issue: [WCAG criterion or visual composition rule]
- DOM selector: [CSS selector of offending element]
- Fix: [specific change needed]
```

- [ ] **Step 2: Update DESIGN_AUDIT.md report format**

In `commands/design-audit.md`, replace lines 86-88:

```markdown
## Critical (fix before merge)
- WCAG AA violations
- Broken layouts at any breakpoint
```

with:

```markdown
## Critical (fix before merge)
Each violation must include:
- Route, Component name, Source file path, DOM selector
- WCAG AA violations
- Broken layouts at any breakpoint
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add subagents/design-auditor.md commands/design-audit.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: attribute design audit violations to specific components"
```

---

### Task 10: Make visual-qa evaluation structured instead of subjective

**Audit finding:** #15 (trust your gut doesn't scale)

**Files:**
- Modify: `subagents/visual-qa-reviewer.md`

- [ ] **Step 1: Replace subjective evaluation with structured checklist**

In `subagents/visual-qa-reviewer.md`, replace lines 10-19 (the "Core evaluation approach" section):

```markdown
## Core evaluation approach

For every screenshot, apply this filter first:

> "If I were a real user seeing this for the first
> time, would anything frustrate or confuse me?"

This is not a checklist pass. Look at the page as a
whole before checking individual items. Trust your
gut — if something feels off, flag it and explain why.
```

with:

```markdown
## Core evaluation approach

For every screenshot, complete this structured evaluation.
Answer each question YES or NO. Any NO is a finding.

### First impression (5-second test)
- [ ] Can you identify the page's primary purpose? YES/NO
- [ ] Can you identify the primary action? YES/NO
- [ ] Is it obvious how to access the primary action? YES/NO
- [ ] Are there any confusing or redundant elements? YES/NO

### Quick heuristic scan (before detailed evaluation)
- [ ] H1: Is every async action's status visible? YES/NO
- [ ] H2: Are all labels in user language (not dev jargon)? YES/NO
- [ ] H3: Can the user undo or go back from any state? YES/NO
- [ ] H4: Are similar things styled consistently? YES/NO
- [ ] H5: Are error messages helpful and specific? YES/NO
- [ ] H7: Are there shortcuts for frequent actions? YES/NO
- [ ] H8: Is the interface free of unnecessary elements? YES/NO
- [ ] H10: Is help available where users might need it? YES/NO

### Gestalt check
- [ ] Proximity: Are related items grouped visually? YES/NO
- [ ] Similarity: Do similar items look the same? YES/NO
- [ ] Continuity: Does the eye flow naturally? YES/NO
- [ ] Figure-ground: Is content clearly separated from background? YES/NO

After completing the checklist, review the page holistically.
If anything feels wrong that the checklist didn't catch,
flag it and explain why.
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add subagents/visual-qa-reviewer.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: replace subjective visual-qa with structured checklist"
```

---

### Task 11: Fix build-page / build-pipeline BUILD_PLAN.md conflict

**Audit finding:** #16 (both write to same file)

**Files:**
- Modify: `commands/build-page.md`

- [ ] **Step 1: Make build-page write to a page-scoped plan file**

In `commands/build-page.md`, replace lines 13-14:

```markdown
3. Invoke the dependency-resolver subagent to produce
   a wave plan for this page's components
4. Write wave plan to /docs/BUILD_PLAN.md
```

with:

```markdown
3. Invoke the dependency-resolver subagent to produce
   a wave plan for this page's components
4. Write wave plan to /docs/BUILD_PLAN_[PageName].md
   (e.g., /docs/BUILD_PLAN_Dashboard.md)
   This avoids overwriting the full-app BUILD_PLAN.md
   if /build-pipeline was run previously.
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add commands/build-page.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: scope build-page plan to page-specific file"
```

---

### Task 12: Add baseline metadata and violation acknowledgment

**Audit findings:** #17 (baseline never invalidated), #19 (no mechanism to skip violations)

**Files:**
- Modify: `commands/set-baseline.md`
- Modify: `commands/design-audit.md`

- [ ] **Step 1: Add baseline metadata to set-baseline**

In `commands/set-baseline.md`, replace lines 7-20 with:

```markdown
Promote current screenshots to visual regression baseline.
Use after a design audit passes and you are satisfied
with the current visual state.

If route provided: baseline that route only.
If no route: baseline all routes.

Baselines all four breakpoints:
mobile, tablet, desktop, lg-desktop.

Confirm with user before promoting — this overwrites
the previous baseline.

Uses screenshot-review MCP setBaseline method.

After baselining, write metadata to
screenshots/baseline/metadata.json:

```json
{
  "baselined_at": "ISO timestamp",
  "routes": {
    "[route]": {
      "baselined_at": "ISO timestamp",
      "component_hashes": {
        "[ComponentName]": "short file hash"
      }
    }
  }
}
```

On subsequent baselines, warn if any component file
has changed since the baseline was set:
"⚠️ [ComponentName] was modified since baseline was set.
Review screenshots before promoting."
```

- [ ] **Step 2: Add acknowledged issues section to design-audit report**

In `commands/design-audit.md`, after line 112 (`[what is already correct]`), add:

```markdown

## Acknowledged Issues (user-approved to ship)

If the user has previously acknowledged a minor or major
issue, record it here:

- Issue: [description]
  Acknowledged: [date]
  Reason: "[user's stated reason]"
  Tracked: [issue URL if applicable]

On re-run, skip checking acknowledged issues unless:
- The component source file has changed since acknowledgment
- The WCAG criterion was upgraded from Minor to Critical
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add commands/set-baseline.md commands/design-audit.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "feat: add baseline metadata tracking and violation acknowledgment"
```

---

### Task 13: Add MCP server resilience

**Audit finding:** #18 (MCP servers fail silently)

**Files:**
- Modify: `mcp/a11y-scanner/index.js`
- Modify: `mcp/screenshot-review/index.js`

- [ ] **Step 1: Add health checks and timeout to a11y-scanner**

In `mcp/a11y-scanner/index.js`, replace lines 20-27:

```javascript
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.goto(url)

      const results = await new AxePuppeteer(page)
        .withTags([standard.toLowerCase()])
        .analyze()
```

with:

```javascript
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()

      const response = await page.goto(url, { timeout: 30000 })
      if (!response) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: `Failed to navigate to ${url}`,
            violations: [], passes: 0, incomplete: 0, inapplicable: 0
          }, null, 2) }]
        }
      }

      const results = await new AxePuppeteer(page)
        .withTags([standard.toLowerCase()])
        .analyze()

      if (!results.violations && !results.passes) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: 'axe-core did not return valid results — page may not have loaded correctly',
            violations: [], passes: 0, incomplete: 0, inapplicable: 0
          }, null, 2) }]
        }
      }
```

- [ ] **Step 2: Add timeout handling to screenshot-review**

In `mcp/screenshot-review/index.js`, replace lines 36-37:

```javascript
        await page.goto(url)
        await page.waitForLoadState('networkidle')
```

with:

```javascript
        const response = await page.goto(url, { timeout: 30000 })
        if (!response) {
          results[breakpoint] = { path: null, size, error: `Failed to navigate to ${url}` }
          await page.close()
          continue
        }

        try {
          await page.waitForLoadState('networkidle', { timeout: 10000 })
        } catch {
          // Page didn't reach networkidle in 10s — proceed with current state
        }
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add mcp/a11y-scanner/index.js mcp/screenshot-review/index.js
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: add timeout and health checks to MCP servers"
```

---

### Task 14: Add E2E fixture error handling

**Audit finding:** #14 (no error handling for fixture failures)

**Files:**
- Modify: `subagents/e2e-writer.md`

- [ ] **Step 1: Update fixture documentation with error handling**

This was already partially addressed in Task 3 Step 2 (the fixture error handling section added to e2e-writer.md). Verify that the following is present in the file. If not present (because Task 3 ran in a different subagent), add it after the `## Rules` section:

```markdown
## Fixture Error Handling

- If auth fixture setup fails: skip test with message
  "[test-name] skipped: auth setup failed — [error]"
- If seed data setup fails: skip test with message
  "[test-name] skipped: data setup failed — [error]"
- If teardown fails: log warning but don't fail the test
  (prevents cascade failures across the suite)
```

Also update the fixture file section (lines 7-24) to include explicit error handling in the generated fixture pattern. After line 15 (`Include teardown if the auth creates server-side state.`), add:

```markdown
  Wrap fixture setup in try/catch. On failure, call
  test.skip() with the error message rather than letting
  the test hang or fail cryptically:

  ```typescript
  authenticatedPage: async ({}, use, testInfo) => {
    try {
      // ... auth setup
      await use(page);
    } catch (error) {
      testInfo.skip(true, `Auth setup failed: ${error.message}`);
    } finally {
      // ... teardown (always runs)
    }
  }
  ```
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add subagents/e2e-writer.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: add explicit error handling for E2E fixture setup failures"
```

---

## Wave 4 — Minor Fixes (Polish)

Depends on Wave 3 completing. Tasks 15-20 are independent and can run in parallel.

---

### Task 15: Cross-reference standards documents

**Audit finding:** #21 (standards don't reference each other)

**Files:**
- Modify: `standards/design-and-a11y.md`
- Modify: `standards/ux-quality.md`

- [ ] **Step 1: Add scope section to design-and-a11y.md**

At the end of `standards/design-and-a11y.md`, add:

```markdown

## Scope and Relationship to Other Standards

This document covers:
- WCAG 2.2 AA/AAA compliance (hard requirements)
- Visual composition (layout, alignment, hierarchy)
- Interactive states (hover, focus, active, disabled)
- Typography, spacing, and color tokens

It does NOT cover:
- User experience quality → see standards/ux-quality.md
- Task flow efficiency or discoverability → see ux-quality.md
- Gestalt principles → see ux-quality.md
- Frustration signals → see ux-quality.md

Used by: /design-audit command
```

- [ ] **Step 2: Add scope section to ux-quality.md**

At the end of `standards/ux-quality.md`, add:

```markdown

## Scope and Relationship to Other Standards

This document covers:
- Nielsen's 10 usability heuristics
- Gestalt principles (visual grouping)
- Interaction quality (touch targets, affordances, microcopy)
- Cognitive load and comprehension
- Frustration signals

It does NOT cover:
- WCAG compliance → see standards/design-and-a11y.md
- Color contrast ratios → see design-and-a11y.md
- ARIA roles and landmarks → see design-and-a11y.md
- Token adherence → see design-and-a11y.md

Used by: /visual-qa command
Prerequisite: /design-audit should pass before running /visual-qa
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add standards/design-and-a11y.md standards/ux-quality.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "docs: cross-reference standards documents"
```

---

### Task 16: Add wiring audit guidance to component-builder

**Audit finding:** #22 (no guidance for complex component relationships)

**Files:**
- Modify: `subagents/component-builder.md`

- [ ] **Step 1: Add wiring audit section**

In `subagents/component-builder.md`, add before the `Reports back:` line:

```markdown
## Wiring Audit (for components with dependencies)

If this component imports or renders other components
(check the Dependencies field in COMPONENT_INVENTORY.md):

1. Write an integration test that renders this component
   with its real child components (not mocked)
2. Verify child components receive correct props
3. Verify interaction flows work across parent-child
   boundary (e.g., clicking child button triggers parent
   callback)

Example for a Form component that uses Button:
```typescript
test('Form submits when Button is clicked', () => {
  const onSubmit = vi.fn();
  render(<Form onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalledOnce();
});
```

Skip wiring audit if Dependencies is "none".
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add subagents/component-builder.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: add wiring audit guidance to component-builder"
```

---

### Task 17: Fix setup script portability

**Audit findings:** #23 (setup assumes directory structure), #26 (stale MCP deps), #27 (hardcoded /tmp/)

**Files:**
- Modify: `setup.sh`
- Modify: `setup/recommended-hooks.json`

- [ ] **Step 1: Add diagnostic output to setup.sh on failure**

In `setup.sh`, replace lines 18-20:

```bash
if [[ "$WORKSPACE" == "/" ]]; then
  echo "Error: Could not find workspace root. Is this plugin inside .claude/plugins/?"
  exit 1
fi
```

with:

```bash
if [[ "$WORKSPACE" == "/" ]]; then
  echo "Error: Could not find workspace root."
  echo "Expected structure: /path/to/workspace/.claude/plugins/frontend-orchestration/"
  echo "Found plugin at: $PLUGIN_DIR"
  echo "Parent directory: $(dirname "$PLUGIN_DIR")"
  echo ""
  echo "Make sure this plugin is installed inside a .claude/plugins/ directory."
  exit 1
fi
```

- [ ] **Step 2: Add explicit npm ci for MCP servers**

In `setup.sh`, replace lines 31-33:

```bash
echo "  a11y-scanner..."
(cd mcp/a11y-scanner && npm install --silent)
echo "  screenshot-review..."
(cd mcp/screenshot-review && npm install --silent)
```

with:

```bash
echo "  a11y-scanner..."
(cd mcp/a11y-scanner && npm ci --silent 2>/dev/null || npm install --silent)
echo "  screenshot-review..."
(cd mcp/screenshot-review && npm ci --silent 2>/dev/null || npm install --silent)
```

- [ ] **Step 3: Fix hardcoded /tmp/ in recommended-hooks.json**

In `setup/recommended-hooks.json`, replace line 16:

```json
            "command": "rm -rf /tmp/claude-commit-gates && mkdir -p /tmp/claude-commit-gates",
```

with:

```json
            "command": "GATE_DIR=\"${TMPDIR:-${TEMP:-/tmp}}/claude-commit-gates\" && rm -rf \"$GATE_DIR\" && mkdir -p \"$GATE_DIR\"",
```

And replace all other occurrences of `/tmp/claude-commit-gates` in the file with `\"${TMPDIR:-${TEMP:-/tmp}}/claude-commit-gates\"`.

- [ ] **Step 4: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add setup.sh setup/recommended-hooks.json
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: improve setup portability and MCP dependency management"
```

---

### Task 18: Clean up dead subagent and add wave rollup to BUILD_STATUS

**Audit findings:** #25 (dead wave-executor.md), #29 (no wave rollup), #30 (no wave reasoning)

**Files:**
- Delete: `subagents/wave-executor.md` (if confirmed unused)
- Modify: `subagents/dependency-resolver.md`
- Modify: `commands/build-pipeline.md`

- [ ] **Step 1: Verify wave-executor.md is unused**

Check if wave-executor.md is referenced anywhere:

```bash
grep -r "wave-executor" /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration/ --include="*.md" --include="*.ts" --include="*.js" -l
```

If only referenced by build-pipeline.md line 40 ("Invoke wave-executor subagent") and build-page.md line 18 ("invoke wave-executor subagent"), the subagent IS used — it's the orchestrating subagent dispatched by the commands. **Do NOT delete it.**

If it is used, instead update it to include the wave summary table format from Task 6. Skip the deletion.

- [ ] **Step 2: Add wave reasoning to dependency-resolver output**

In `subagents/dependency-resolver.md`, replace lines 12-13:

```markdown
5. Within each wave, sort by complexity ascending
   (low before high)
6. Write plan to /docs/BUILD_PLAN.md
```

with:

```markdown
5. Within each wave, sort by complexity ascending
   (low before high)
6. Write plan to /docs/BUILD_PLAN.md with wave explanations:

   ## Wave 0 (Leaf components — no dependencies)
   - Button: no dependencies
   - Input: no dependencies

   ## Wave 1 (depends on Wave 0)
   - Form: depends on Button, Input
     Reason: needs Button and Input to be built first

   ## Wave 2 (depends on Wave 0 + 1)
   - Dashboard: depends on Form
     Reason: must wait for Form
```

- [ ] **Step 3: Add wave rollup format to build-pipeline**

In `commands/build-pipeline.md`, after Phase 3 (line 53, `Stop if failures exist`), add:

```markdown

Update BUILD_STATUS.md with wave-level rollup:

## Wave [N] Progress
- [x] ComponentA (RTL: 12/12 passing)
- [x] ComponentB (RTL: 8/8 passing)
- [ ] ComponentC (in progress)

Wave [N]: 2/3 complete (67%)
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add subagents/dependency-resolver.md commands/build-pipeline.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "fix: add wave reasoning and rollup tracking to build status"
```

---

### Task 19: Make screenshot breakpoints configurable

**Audit finding:** #7 from minor list (hardcoded breakpoints)

**Files:**
- Modify: `runner/src/config/schema.ts`
- Modify: `mcp/screenshot-review/index.js`
- Modify: `subagents/screenshot-reviewer.md`

- [ ] **Step 1: Add breakpoints to config schema**

In `runner/src/config/schema.ts`, add after the `evidenceConfigSchema` (after line 15):

```typescript
const breakpointSchema = z.object({
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const designAuditConfigSchema = z.object({
  breakpoints: z.array(breakpointSchema).default([
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
    { name: "lgDesktop", width: 1440, height: 900 },
  ]),
  wcag_target: z.string().default("WCAG22AA"),
});
```

And add to the `configSchema` (after `evidence`):

```typescript
  design_audit: designAuditConfigSchema.default({}),
```

- [ ] **Step 2: Update screenshot-review MCP to accept breakpoints param**

In `mcp/screenshot-review/index.js`, replace lines 8-13 (the hardcoded BREAKPOINTS) with:

```javascript
const DEFAULT_BREAKPOINTS = {
  mobile:     { width: 375,  height: 812  },
  tablet:     { width: 768,  height: 1024 },
  desktop:    { width: 1280, height: 900  },
  lgDesktop:  { width: 1440, height: 900  }
}
```

And update the `capture` tool schema to accept optional breakpoints:

In the tool definition (line 26), add to the schema:

```javascript
    breakpoints: z.record(z.object({
      width: z.number(),
      height: z.number()
    })).optional().describe('Custom breakpoints (overrides defaults)')
```

And update the handler (line 28) to use them:

```javascript
  async ({ url, route, baselineDir, breakpoints }) => {
    const activeBreakpoints = breakpoints ?? DEFAULT_BREAKPOINTS
    const browser = await chromium.launch()
    try {
      const results = {}

      for (const [breakpoint, size] of Object.entries(activeBreakpoints)) {
```

- [ ] **Step 3: Update screenshot-reviewer subagent docs**

In `subagents/screenshot-reviewer.md`, replace lines 5-8:

```markdown
Uses screenshot-review MCP tool to capture the route at
all four breakpoints defined in standards/design-and-a11y.md:
mobile (375px), tablet (768px), desktop (1280px),
lg-desktop (1440px).
```

with:

```markdown
Uses screenshot-review MCP tool to capture the route at
breakpoints. Default breakpoints match
standards/design-and-a11y.md: mobile (375px), tablet
(768px), desktop (1280px), lg-desktop (1440px).

Custom breakpoints can be configured in
orchestrator.config.yaml under design_audit.breakpoints.
```

- [ ] **Step 4: Rebuild runner**

```bash
cd /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration/runner && npx tsc
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add runner/src/config/schema.ts runner/dist/ mcp/screenshot-review/index.js subagents/screenshot-reviewer.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "feat: make screenshot breakpoints and WCAG target configurable"
```

---

### Task 20: Add timeout documentation

**Audit finding:** #28 (no timeout configuration)

**Files:**
- Modify: `subagents/component-builder.md`
- Modify: `subagents/e2e-writer.md`
- Modify: `subagents/design-auditor.md`

- [ ] **Step 1: Add timeout expectations to each subagent**

Add to the top of `subagents/component-builder.md` (after the title):

```markdown
**Timeout:** 10 minutes per component. If build exceeds
this, report partial progress and surface to orchestrator.
```

Add to the top of `subagents/e2e-writer.md` (after the title):

```markdown
**Timeout:** 5 minutes per flow. If test generation exceeds
this, report which flows are complete and which remain.
```

Add to the top of `subagents/design-auditor.md` (after the title):

```markdown
**Timeout:** 5 minutes per route. If audit exceeds this,
report partial results and which routes remain unaudited.
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration add subagents/component-builder.md subagents/e2e-writer.md subagents/design-auditor.md
git -C /Users/jakemosher/Workspace/.claude/plugins/frontend-orchestration commit -m "docs: add timeout expectations to all subagents"
```

---

## Summary

| Wave | Tasks | Parallelizable | Audit Findings Covered |
|------|-------|---------------|----------------------|
| 1 | Tasks 1-4 | All 4 in parallel | #1, #2, #3, #4, #5, #7, #9, #11, #20, #24 |
| 2 | Tasks 5-8 | All 4 in parallel | #6, #8, #10, #13 |
| 3 | Tasks 9-14 | All 6 in parallel | #12, #14, #15, #16, #17, #18, #19 |
| 4 | Tasks 15-20 | All 6 in parallel | #21, #22, #23, #25, #26, #27, #28, #29, #30 |

**Total:** 20 tasks covering all 30 findings.
