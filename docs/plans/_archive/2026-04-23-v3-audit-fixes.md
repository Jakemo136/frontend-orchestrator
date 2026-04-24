# V3 Audit Fixes

Source: `v3-frontend-orchestrator-concise-audit-findings.md` (static audit at HEAD `817dd39`)

## Problem Statement

10 findings from a third-party static audit. After triage, 7 are actionable code changes grouped into 3 phases. 3 are acknowledged truths (markdown brittleness, test_server gap, prompt-quality limits) that don't warrant code changes now.

## Findings Not Addressed (and why)

- **Finding 4** (wave state from markdown scraping): Real brittleness, but fixing it means restructuring how dependency-resolve works. The current regex approach is documented and tested. Would be an architectural change, not a fix.
- **Finding 8** (`test_server` not enforced): Config declares it, no step uses it. Same pattern as Finding 2, but server-side test enforcement is out of scope for a frontend orchestrator. Removing the field would break configs. Leave it.
- **Finding 10** (prompt-quality-limited): Acknowledged truth already documented in QUALITY_MATRIX.md. Not a code fix.

---

## Phase 1: Pipeline DAG and Config Fixes

Independent fixes to the pipeline shape and config enforcement. All three tasks can run in parallel — they touch different files with no overlap.

### Task 1: Fix `set-baseline` dependency ordering

**Effort:** XS
**Finding:** 5
**Files:** `runner/src/config/defaults.ts`, new test in `runner/tests/config/`

The default pipeline has `set-baseline` depending on `design-audit`, which lets it run in parallel with `visual-qa`. A baseline should never be promoted before visual QA passes.

**Change:** `defaults.ts:53` — change `set-baseline`'s dependency from `["design-audit"]` to `["visual-qa"]`.

**Test:** Assert that `set-baseline` depends on `visual-qa` in the generated pipeline.

### Task 2: Add `build-client` runner step

**Effort:** S
**Finding:** 2
**Files:** `runner/src/steps/build-client.ts` (new), `runner/src/config/defaults.ts`, test file

`build_client` is defined in config/schema (`npm run build`) but no step executes it. Code can typecheck and pass unit tests while the production build is broken.

**Step behavior:**
- Runs `ctx.config.commands.build_client`
- Fails the step if exit code is non-zero
- Placed after `test-suite:N` and before `post-wave-review:N` in each wave

**Pipeline change:** Insert `build-client:N` into each wave between `test-suite:N` and `post-wave-review:N`:
```
build-wave:N → test-suite:N → build-client:N → post-wave-review:N → open-prs:N
```

**Tests:**
- Step passes when build command exits 0
- Step fails when build command exits non-zero
- Pipeline contains `build-client:N` for each wave with correct deps

### Task 3: Enforce `required_on_feature` in `await-merge`

**Effort:** M
**Findings:** 3, 6
**Files:** `runner/src/steps/await-merge.ts`, test file

`await-merge` currently checks only whether PRs have state `MERGED`. It does not verify that configured feature-branch CI checks actually passed before the merge. `required_on_feature` and `informational_on_feature` exist in the config but are never read by any step.

**Change:** After confirming all PRs are merged, check `statusCheckRollup` from the `gh pr list` JSON output against `ctx.config.ci.required_on_feature`. If any required check was not `SUCCESS` or `SKIPPED`, fail the step with a message listing which checks failed on which PR.

`informational_on_feature` checks: log warnings but don't fail the step.

**Tests:**
- All PRs merged + all required checks passed → step passes
- All PRs merged + required check failed → step fails with message naming the check
- Informational check failed → step passes with warning in message
- No `required_on_feature` configured (empty array) → step passes (backwards compatible)

---

## Phase 2: Defensive Fixes and Subcommand Contracts

Depends on Phase 1 completing (the `build-client` step and await-merge changes need to be stable before touching adjacent code). Tasks 4 and 5 can run in parallel.

### Task 4: Fix `merge-to-main` bare catch and defensive checks

**Effort:** S
**Finding:** 9
**Files:** `runner/src/steps/merge-to-main.ts`, test file

Two issues:
1. Line 78: bare `catch {}` around `awaitApproval` swallows all errors including `NeedsApprovalSignal` — same bug pattern fixed in `dependency-resolve.ts` (PR #6). Fix: `catch (err) { if (!(err instanceof ApprovalDeniedError)) throw err; }`.
2. Line 62: bare `catch {}` around PR checks JSON parse silently proceeds on parse failure. Fix: log a warning via message and still proceed, but make it visible.

**Additional defensive check:** Before creating the PR, verify the feature branch exists and has commits ahead of main via `gh pr list --head ${feature} --state open`. If a PR already exists, skip creation and use the existing one.

**Tests:**
- NeedsApprovalSignal is re-thrown (not swallowed)
- ApprovalDeniedError is caught and returns failed status
- Existing open PR is reused instead of creating a duplicate

### Task 5: Ship subcommand spec files

**Effort:** S
**Finding:** 1
**Files:** `commands/build-pipeline-resolve-deps.md` (new), `commands/build-pipeline-open-prs.md` (new), `commands/build-pipeline-e2e.md` (new)

Three runner steps invoke pseudo-subcommands via `ctx.invokeCommand()`:
- `dependency-resolve.ts` → `/build-pipeline:resolve-deps`
- `open-prs.ts` → `/build-pipeline:open-prs --wave N`
- `e2e-scaffold.ts` → `/build-pipeline:e2e`

These have no corresponding command spec files. The runner's contract with Claude Code is that `invokeCommand("/foo")` causes Claude Code to find and execute `commands/foo.md`. The colon-suffixed names are conventions — they need formal specs.

**Spec content:** Extract the relevant behavior from `commands/build-pipeline.md` into each subcommand spec. Each spec should describe inputs, expected outputs/artifacts, and success/failure criteria. Use the existing `build-component.md` as the template.

**Note:** No runner code changes — this is purely adding missing command spec files. No tests needed (command specs are markdown consumed by Claude Code, not by the runner).

---

## Phase 3: Documentation Precision

Depends on Phase 2 completing (README should reflect the final state after all code changes).

### Task 6: README and docs precision pass

**Effort:** S
**Finding:** 7
**Files:** `README.md`

The README opening line still says "your approval at every gate" which implies interactive mode is the default. The second paragraph is better but the first line sets the wrong expectation.

**Changes:**
- Line 2: Rewrite opening sentence to not imply interactive is default. Something like: "Describe what you want, it interviews you, writes tests, builds components, audits everything, and opens PRs — dependency order, TDD, configurable approval gates."
- Verify the rest of the README is consistent with the new `build-client` step and feature-branch enforcement
- Add `build_client` to the config example if not already shown
- Add `required_on_feature` to the config example if not already shown
- Update command count if the 3 new subcommand specs change it

---

## Subagent Dispatch Strategy

```
Phase 1 ─── Task 1 (XS) ──┐
            Task 2 (S)  ───┤→ verify → Phase 2 ─── Task 4 (S) ──┐
            Task 3 (M)  ───┘                        Task 5 (S) ──┤→ verify → Phase 3 ─── Task 6 (S)
```

- **Phase 1:** 3 implementer subagents in parallel, then spec review, then quality review
- **Phase 2:** 2 implementer subagents in parallel, then spec review, then quality review
- **Phase 3:** 1 implementer subagent, then final review of entire branch

Each phase gate: `npm test` passes, `npx tsc --noEmit` clean.

## Success Criteria

1. `npm test` passes (all existing + new tests green)
2. `npx tsc --noEmit` clean
3. `set-baseline` depends on `visual-qa` in the generated pipeline
4. `build-client:N` step exists in each wave, fails the wave on build error
5. `await-merge` validates `required_on_feature` checks against PR status
6. `merge-to-main` re-throws `NeedsApprovalSignal` instead of swallowing it
7. Three subcommand spec files exist for the pseudo-subcommands
8. README opening line doesn't imply interactive mode is default
9. No regressions in existing tests
