# Static Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 bugs and 3 doc/implementation mismatches identified in the static audit.

**Architecture:** Each task is independent — no ordering dependencies between them. Tasks 1-3 are code changes with tests. Tasks 4-6 are docs/config alignment. Tasks 7-9 are docs-only.

**Tech Stack:** TypeScript (runner), JavaScript (MCP server), Bash (setup), Markdown (commands/docs)

---

## Phase 1: Bug Fixes

### Task 1: Fix `generateDefaultPipeline()` for page/app scopes

The `if (s === "component" || s === "feature")` guard at `defaults.ts:33` means the core build/test/review/PR wave cycle only exists for component and feature scopes. For page and app, the DAG jumps from `dependency-resolve` directly to `e2e-green`, skipping the entire build phase.

**Files:**
- Modify: `runner/src/config/defaults.ts:32-39`
- Modify: `runner/tests/config/defaults.test.ts`

- [ ] **Step 1: Read the current defaults.test.ts to understand existing test patterns**

Read `runner/tests/config/defaults.test.ts` in full to understand the test structure and existing assertions.

- [ ] **Step 2: Write failing tests for page/app scope wave generation**

Add tests to `runner/tests/config/defaults.test.ts`:

```typescript
it("generates build-wave steps for page scope", () => {
  const config = { ...BASE_CONFIG, scope: { type: "page" as const, target: null } };
  const steps = generateDefaultPipeline(config);
  const buildWave = steps.find((s) => s.id === "build-wave:0");
  expect(buildWave).toBeDefined();
  expect(buildWave!.type).toBe("build-wave");
  // Wave should depend on dependency-resolve for page/app scope
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd runner && npx vitest run tests/config/defaults.test.ts`
Expected: new tests FAIL because `build-wave:0` doesn't exist for page scope.

- [ ] **Step 4: Fix generateDefaultPipeline to add build waves for all scopes**

In `runner/src/config/defaults.ts`, replace the scope-gated wave block (lines 32-39) with unconditional wave generation. The key difference: for component/feature scope, waves depend on `ui-interview` (no planning phase). For page/app scope, waves depend on `dependency-resolve` (planning phase produces BUILD_PLAN.md first).

Also update Phase 4's `e2e-green` deps: for page/app scope, it should depend on `await-merge:0` (build must complete before E2E verification), not just `dependency-resolve`.

```typescript
// Phase 3: Build waves
const waveDep =
  s === "component" || s === "feature" ? "ui-interview" : "dependency-resolve";
add("build-wave:0", "build-wave", [waveDep], { wave: 0 }, "component");
add("test-suite:0", "test-suite", ["build-wave:0"], { wave: 0, e2e_blocking: false }, "component");
add("post-wave-review:0", "post-wave-review", ["test-suite:0"], { wave: 0 }, "component");
add("open-prs:0", "open-prs", ["post-wave-review:0"], { wave: 0 }, "component");
add("await-merge:0", "await-merge", ["open-prs:0"], { wave: 0 }, "component");

// Phase 4: Quality — e2e-green depends on build completion for broader scopes
const qualityDep =
  s === "component" || s === "feature" ? "await-merge:0" : "await-merge:0";
add("e2e-green", "e2e-green", [qualityDep], {}, "page");
```

Wait — both branches resolve to the same value. The actual distinction is: for component/feature scopes, the wave steps exist so `await-merge:0` is a valid dep. For page/app, the wave steps now also exist, so `await-merge:0` is also valid. Simplify:

```typescript
// Phase 3: Build waves
const waveDep =
  s === "component" || s === "feature" ? "ui-interview" : "dependency-resolve";
add("build-wave:0", "build-wave", [waveDep], { wave: 0 }, "component");
add("test-suite:0", "test-suite", ["build-wave:0"], { wave: 0, e2e_blocking: false }, "component");
add("post-wave-review:0", "post-wave-review", ["test-suite:0"], { wave: 0 }, "component");
add("open-prs:0", "open-prs", ["post-wave-review:0"], { wave: 0 }, "component");
add("await-merge:0", "await-merge", ["open-prs:0"], { wave: 0 }, "component");

// Phase 4: Quality
add("e2e-green", "e2e-green", ["await-merge:0"], {}, "page");
add("design-audit", "design-audit", ["e2e-green"], {}, "page");
add("visual-qa", "visual-qa", ["design-audit"], {}, "page");
add("set-baseline", "set-baseline", ["design-audit"], {}, "page");
```

Note: `e2e-green` dep changes from `["dependency-resolve"]` to `["await-merge:0"]`. This is correct — E2E should run after components are built, not after dependency resolution.

Also note: for component/feature scopes, the Phase 4 steps are filtered out by `scopeMeetsThreshold` (they have threshold `"page"`), so changing `e2e-green`'s dep from `dependency-resolve` to `await-merge:0` doesn't affect those scopes.

Also update Phase 5 `shipDeps`: since wave steps now exist for all scopes, the conditional is unnecessary. But keep it for clarity in case someone adds a scope where waves don't exist.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd runner && npx vitest run tests/config/defaults.test.ts`
Expected: all new tests PASS. Check that existing tests still pass (the pre-existing failure in `wires dependency-resolve after user-story-generation` may need updating since the deps structure changed).

- [ ] **Step 6: Commit**

```bash
git -C <repo-root> add runner/src/config/defaults.ts runner/tests/config/defaults.test.ts
git -C <repo-root> commit -m "fix: generate build waves for page and app scopes"
```

---

### Task 2: Fix missing command references — delegate to existing plugins, create orchestrator-specific commands

Four commands are invoked via `ctx.invokeCommand()` but have no corresponding `.md` spec files. Investigation shows:

- **`/code-review`** → should dispatch the `superpowers:code-reviewer` agent (installed plugin at `.claude/plugins/cache/claude-plugins-official/superpowers/`)
- **`/code-simplify`** → should dispatch the `code-simplifier:code-simplifier` agent (installed plugin at `.claude/plugins/cache/claude-plugins-official/code-simplifier/`)
- **`/wiring-audit`** → orchestrator-specific, no existing plugin handles this
- **`/user-story-generation`** → orchestrator-specific, no existing plugin handles this

For code-review and code-simplify: the steps should document that these delegate to existing plugin agents, not redefine the behavior. The command files act as thin dispatchers that tell the Claude session which agent to invoke when the runner pauses.

For wiring-audit and user-story-generation: these are orchestrator-specific and need full command specs.

**Files:**
- Create: `commands/code-review.md`
- Create: `commands/code-simplify.md`
- Create: `commands/wiring-audit.md`
- Create: `commands/user-story-generation.md`

- [ ] **Step 1: Create commands/code-review.md**

This is a thin dispatcher to the `superpowers:code-reviewer` agent. Referenced by `pre-commit-review.ts:24` and `post-wave-review.ts:25`. The subagent specs (`component-builder.md:48`, `e2e-writer.md:20`) also reference "code-reviewer agent."

```markdown
---
description: Dispatch the superpowers code-reviewer agent against recently changed files
---

# /code-review

Dispatch the `superpowers:code-reviewer` agent against all
files changed since the last commit (or since the branch
diverged from main if no commits yet).

The agent reviews for:
- Correctness, security, and convention adherence
- Plan alignment (if a plan document exists)
- Test quality and coverage

This command delegates entirely to the superpowers
code-reviewer plugin — see its agent definition for the
full review protocol.

Return success if the reviewer reports zero Critical
issues. Return failure if any Critical issues are found.
```

- [ ] **Step 2: Create commands/code-simplify.md**

Thin dispatcher to the `code-simplifier:code-simplifier` agent. Referenced by `pre-commit-review.ts:25` and `post-wave-review.ts:26`.

```markdown
---
description: Dispatch the code-simplifier agent to clean up recently changed code
---

# /code-simplify

Dispatch the `code-simplifier:code-simplifier` agent against
all files changed since the last commit.

The agent simplifies code for clarity, consistency, and
maintainability while preserving all functionality. It focuses
on recently modified code unless instructed otherwise.

This command delegates entirely to the code-simplifier
plugin — see its agent definition for the full protocol.

Return success if simplification completed without breaking
tests. Return failure if unable to simplify without test
regressions.
```

- [ ] **Step 3: Create commands/wiring-audit.md**

Orchestrator-specific. Referenced by `post-wave-review.ts:28`. The quality matrix describes this as checking parent-child rendering edges.

```markdown
---
description: Verify integration test coverage for all parent-child component relationships
---

# /wiring-audit

Audit that every parent-child component rendering edge
has a corresponding integration test.

For every component built in the current wave:

1. **Identify parent components** — which components render
   this component?
2. **Check for wiring tests** — does an integration test
   exist that renders the parent and exercises the child's
   features through it?
3. **Verify test quality:**
   - Test renders the parent, not the child in isolation
   - Test exercises at least one interactive feature of the
     child through the parent's interface
   - Test uses userEvent, not fireEvent
   - Test uses MSW for data, not hand-written JSON mocks

Report format:
- For each component: parent name, test file path, pass/fail
- Missing wiring tests listed as failures

Return success if all parent-child edges have wiring tests.
Return failure listing each missing edge with the parent
and child component names.
```

- [ ] **Step 4: Create commands/user-story-generation.md**

Orchestrator-specific. Referenced by `user-story-generation.ts:31`.

```markdown
---
description: Generate PM-voice user stories with data flow annotations for all interactive flows
---

# /user-story-generation

Generate docs/USER_STORIES.md with PM-voice interaction
sequences for every form, modal, and multi-step flow
found in UI_REQUIREMENTS.md and COMPONENT_INVENTORY.md.

For each interactive flow:

1. **User story** — "As a [role], I [action] so that
   [outcome]" followed by step-by-step interaction
   sequence in plain language
2. **Data flow annotation** — trace the prop/data chain
   across component boundaries for each step:
   - Which component owns the state?
   - How does the event propagate? (callback props,
     context, store)
   - What API calls fire and when?
   - What loading/error/empty states does the user see?

Coverage requirements:
- Every form in the inventory
- Every modal in the inventory
- Every multi-step flow (wizard, checkout, onboarding)
- Every CRUD operation

Write the output to docs/USER_STORIES.md.

Return success with the path to USER_STORIES.md as an
artifact. Return failure if source docs are missing or
coverage is incomplete.
```

- [ ] **Step 5: Verify symlinks will pick up new commands**

The setup script symlinks `commands/` into `.claude/commands/frontend-orchestration/`. Since it's a directory symlink, new `.md` files are automatically included. Verify:

Run: `ls -la <workspace>/.claude/commands/frontend-orchestration/code-review.md`
Expected: file visible through the symlink.

If the symlink doesn't exist (plugin not installed via setup.sh in this workspace), this verification can be skipped — the files are correct regardless.

- [ ] **Step 6: Commit**

```bash
git -C <repo-root> add commands/code-review.md commands/code-simplify.md commands/wiring-audit.md commands/user-story-generation.md
git -C <repo-root> commit -m "feat: add command specs — delegate code-review/simplify to plugins, create wiring-audit and user-story-generation"
```

---

### Task 3: Remove broken interactive approval mode

`createApprovalHandler("interactive")` throws `NeedsApprovalSignal`, but no executor code catches it. This means interactive mode crashes the pipeline with an uncaught error. Rather than wiring up a full signal chain for a feature that's redundant with Claude Code's conversational model (the user is already in the loop via `NeedsCommandSignal`), remove the broken path entirely.

**What stays:**
- `auto` mode (default) — logs approval and continues. Correct for conversational use where the user sees step results and can stop the pipeline.
- `ci` mode — throws `ApprovalDeniedError`, caught by step-level try/catch blocks. Correct for CI where no human is present.

**What goes:**
- `interactive` mode — broken, redundant with CC's conversational model
- `NeedsApprovalSignal` class — dead code, never caught
- `approval_mode` config field — only two modes remain; `auto` is always correct for CC, `ci` can be inferred from environment or a simpler flag

**Files:**
- Modify: `runner/src/runner/approval.ts`
- Modify: `runner/src/types.ts`
- Modify: `runner/src/config/schema.ts`
- Modify: `runner/tests/runner/approval.test.ts`

- [ ] **Step 1: Read the current approval.test.ts**

Read `runner/tests/runner/approval.test.ts` to understand the existing test structure.

- [ ] **Step 2: Update the test to remove interactive mode test and verify removal**

Remove the test for interactive mode (the one that expects `NeedsApprovalSignal`). Add a test that verifies `"interactive"` is no longer accepted:

```typescript
it("rejects interactive mode", () => {
  expect(() => createApprovalHandler("interactive" as any, state, "s")).toThrow();
});
```

Actually, since we're removing the type entirely, TypeScript will prevent passing `"interactive"` at compile time. A runtime test isn't needed — just remove the interactive test case.

- [ ] **Step 3: Run tests to confirm the interactive test exists and passes currently**

Run: `cd runner && npx vitest run tests/runner/approval.test.ts`
Expected: 3 tests pass (auto, ci, interactive).

- [ ] **Step 4: Remove NeedsApprovalSignal and interactive mode from approval.ts**

Replace the contents of `runner/src/runner/approval.ts`. Remove `NeedsApprovalSignal` class. Remove `"interactive"` case from the switch. The `"ci"` case already throws `ApprovalDeniedError` which step-level try/catch blocks handle correctly.

```typescript
import type { ApprovalMode, WorkflowState, ApprovalRecord } from "../types.js";

export class ApprovalDeniedError extends Error {
  constructor(prompt: string) {
    super(`Approval denied in CI mode: ${prompt}`);
    this.name = "ApprovalDeniedError";
  }
}

function recordApproval(state: WorkflowState, stepId: string, prompt: string, mode: ApprovalMode): void {
  if (!state.approvals) state.approvals = [];
  const record: ApprovalRecord = { stepId, prompt, mode, approved_at: new Date().toISOString() };
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
    }
  };
}
```

- [ ] **Step 5: Update ApprovalMode type in types.ts**

Change line 121 from:
```typescript
export type ApprovalMode = "interactive" | "auto" | "ci";
```
to:
```typescript
export type ApprovalMode = "auto" | "ci";
```

- [ ] **Step 6: Update schema.ts**

Change the approval_mode schema from:
```typescript
z.enum(["interactive", "auto", "ci"]).default("auto")
```
to:
```typescript
z.enum(["auto", "ci"]).default("auto")
```

- [ ] **Step 7: Update approval.test.ts**

Remove the `"throws NeedsApprovalSignal in interactive mode"` test. Remove the `NeedsApprovalSignal` import. Keep auto and ci tests.

- [ ] **Step 8: Run tests**

Run: `cd runner && npx vitest run tests/runner/approval.test.ts`
Expected: 2 tests pass (auto, ci).

Run: `cd runner && npx vitest run`
Expected: no new failures introduced. TypeScript compile should also pass (`npx tsc --noEmit`).

- [ ] **Step 9: Commit**

```bash
git -C <repo-root> add runner/src/runner/approval.ts runner/src/types.ts runner/src/config/schema.ts runner/tests/runner/approval.test.ts
git -C <repo-root> commit -m "fix: remove broken interactive approval mode, keep auto and ci"
```

---

## Phase 2: Implementation Alignment

### Task 4: Fix test-suite.ts description to match implementation

The `describe()` method claims "unit tests, component tests, integration tests" but `execute()` runs exactly 3 things: `typecheck`, `test_client`, and `test_e2e`. The description should match.

**Files:**
- Modify: `runner/src/steps/test-suite.ts:7-17`

- [ ] **Step 1: Update the describe() return value**

Change the `summary` and `passCondition` fields to accurately reflect what the step runs:

```typescript
describe(): StepDescription {
  return {
    id: this.definition.id,
    type: "test-suite",
    summary: "Runs typecheck, client test suite, and E2E suite for the current wave.",
    prerequisites: [],
    artifacts: [],
    passCondition: "Typecheck and client tests pass. E2E is informational unless e2e_blocking is true.",
    failCondition: "Typecheck or client tests fail, or E2E fails when e2e_blocking is true.",
    scope: "component",
  };
}
```

- [ ] **Step 2: Run tests**

Run: `cd runner && npx vitest run`
Expected: no failures (describe() is metadata, doesn't affect test logic).

- [ ] **Step 3: Commit**

```bash
git -C <repo-root> add runner/src/steps/test-suite.ts
git -C <repo-root> commit -m "fix: align test-suite step description with actual execution"
```

---

### Task 5: Implement set-baseline metadata.json in MCP server

The command spec at `commands/set-baseline.md:22-37` describes writing `screenshots/baseline/metadata.json` with component hashes and warning when components changed since last baseline. The MCP `setBaseline` tool only copies PNGs.

**Files:**
- Modify: `mcp/screenshot-review/index.js:88-117`

- [ ] **Step 1: Update setBaseline tool to write metadata.json**

After copying PNGs, write a `metadata.json` to the baseline directory. The metadata records when each route was baselined. Component hash tracking requires knowing which source files correspond to which routes — this depends on the project's structure and can't be determined generically by the MCP server. Instead, record the baseline timestamp per route and let the command spec handle component-hash logic (it has access to the project context).

Update the `setBaseline` handler in `mcp/screenshot-review/index.js`:

```javascript
server.tool(
  'setBaseline',
  'Promote current screenshots to visual regression baseline',
  {
    route: z.string().describe('Route name to baseline')
  },
  async ({ route }) => {
    const screenshotsDir = path.join(process.cwd(), 'screenshots')
    const baselineDir = path.join(process.cwd(), 'screenshots/baseline')
    const routeDir = path.join(screenshotsDir, route)
    const baselineRouteDir = path.join(baselineDir, route)

    fs.mkdirSync(baselineRouteDir, { recursive: true })

    const baselined = []
    for (const breakpoint of Object.keys(DEFAULT_BREAKPOINTS)) {
      const src = path.join(routeDir, `${breakpoint}.png`)
      const dest = path.join(baselineRouteDir, `${breakpoint}.png`)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
        baselined.push(breakpoint)
      }
    }

    // Write/update metadata.json
    const metadataPath = path.join(baselineDir, 'metadata.json')
    let metadata = { baselined_at: '', routes: {} }
    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      } catch {
        // Corrupted metadata — start fresh
      }
    }

    const now = new Date().toISOString()
    metadata.baselined_at = now
    if (!metadata.routes) metadata.routes = {}
    metadata.routes[route] = {
      baselined_at: now,
      breakpoints: baselined
    }

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n')

    const output = {
      baselined: route,
      breakpoints: baselined,
      metadata_path: metadataPath
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }]
    }
  }
)
```

- [ ] **Step 2: Update commands/set-baseline.md to match implementation**

The command spec claims `component_hashes` with short file hashes per component. The MCP server can't know which source files map to which routes — that's project-specific knowledge. Update the spec to remove the component hash promise and describe what actually ships:

Replace lines 22-42 of `commands/set-baseline.md` with:

```markdown
After baselining, the MCP server writes metadata to
screenshots/baseline/metadata.json:

{
  "baselined_at": "ISO timestamp",
  "routes": {
    "[route]": {
      "baselined_at": "ISO timestamp",
      "breakpoints": ["mobile", "tablet", "desktop", "lgDesktop"]
    }
  }
}

On subsequent baselines, check git status for files in
the component directory related to this route. If any
component source files have been modified since the
baseline timestamp, warn:
"⚠️ Component files modified since last baseline.
Review screenshots before promoting."
```

Note: the component-level file change check is handled by the command prompt (which has access to git and project context), not by the MCP server (which is a generic screenshot tool).

- [ ] **Step 3: Commit**

```bash
git -C <repo-root> add mcp/screenshot-review/index.js commands/set-baseline.md
git -C <repo-root> commit -m "feat: write baseline metadata.json from setBaseline MCP tool"
```

---

### Task 6: Automate hook installation in setup.sh

`setup.sh` installs deps, browsers, and command symlinks, but does not install the quality gate hooks from `setup/recommended-hooks.json`. Add an installation step with user confirmation. Also update the README to mention hooks as a recommended dependency.

**Files:**
- Modify: `setup.sh`
- Modify: `README.md`

- [ ] **Step 1: Add hook installation to setup.sh**

Append a hook installation block before the "Done" message. The script should:
1. Check if `.claude/settings.json` exists in the workspace
2. If it does, check if hooks are already present (avoid clobbering)
3. Prompt the user for confirmation before modifying settings
4. If confirmed, merge the hooks from `recommended-hooks.json` into settings

Add before the final `echo "Done"` block in `setup.sh`:

```bash
# Install quality gate hooks (optional, with confirmation)
SETTINGS_FILE="$WORKSPACE/.claude/settings.json"
HOOKS_SOURCE="$PLUGIN_DIR/setup/recommended-hooks.json"

echo ""
echo "  Quality gate hooks enforce code-review and code-simplify"
echo "  before every git commit. Recommended for full pipeline use."

if [[ -f "$SETTINGS_FILE" ]]; then
  # Check if hooks already present
  if grep -q '"hooks"' "$SETTINGS_FILE" 2>/dev/null; then
    echo "  ⚠ .claude/settings.json already has hooks configured."
    echo "  Skipping hook installation to avoid clobbering."
    echo "  See setup/install-hooks.md to merge manually."
  else
    echo -n "  Install quality gate hooks? [y/N] "
    read -r INSTALL_HOOKS
    if [[ "$INSTALL_HOOKS" =~ ^[Yy]$ ]]; then
      # Merge hooks into existing settings using jq if available, else python
      if command -v jq &>/dev/null; then
        jq -s '.[0] * {"hooks": .[1].hooks}' "$SETTINGS_FILE" "$HOOKS_SOURCE" > "${SETTINGS_FILE}.tmp" \
          && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"
        echo "  ✓ Hooks installed into .claude/settings.json"
      elif command -v python3 &>/dev/null; then
        python3 -c "
import json, sys
with open('$SETTINGS_FILE') as f: settings = json.load(f)
with open('$HOOKS_SOURCE') as f: hooks = json.load(f)
settings['hooks'] = hooks['hooks']
with open('$SETTINGS_FILE', 'w') as f: json.dump(settings, f, indent=2)
print('  ✓ Hooks installed into .claude/settings.json')
"
      else
        echo "  ✗ Neither jq nor python3 found. Install hooks manually."
        echo "  See setup/install-hooks.md for instructions."
      fi
    else
      echo "  Skipped. Run later with: see setup/install-hooks.md"
    fi
  fi
else
  echo -n "  Install quality gate hooks? [y/N] "
  read -r INSTALL_HOOKS
  if [[ "$INSTALL_HOOKS" =~ ^[Yy]$ ]]; then
    mkdir -p "$(dirname "$SETTINGS_FILE")"
    if command -v jq &>/dev/null; then
      jq '{hooks: .hooks}' "$HOOKS_SOURCE" > "$SETTINGS_FILE"
    else
      python3 -c "
import json
with open('$HOOKS_SOURCE') as f: hooks = json.load(f)
with open('$SETTINGS_FILE', 'w') as f: json.dump({'hooks': hooks['hooks']}, f, indent=2)
" 2>/dev/null || echo '{"hooks":{}}' > "$SETTINGS_FILE"
    fi
    echo "  ✓ Hooks installed into .claude/settings.json"
  else
    echo "  Skipped. Run later with: see setup/install-hooks.md"
  fi
fi
```

- [ ] **Step 2: Update README.md installation section**

Add a note about hooks after the setup step. In the "Quick start" section, after the `setup.sh` line, add:

```markdown
Setup installs dependencies, Playwright browsers, and symlinks
commands into `.claude/commands/` for discovery. It also offers
to install **quality gate hooks** that block `git commit` until
code-review and code-simplify have run in the current session.
Hooks are recommended but optional — decline during setup or
install later via `setup/install-hooks.md`.
```

Also update the "What's inside" section to mention hooks:

```markdown
  setup/          Hooks, install script, quality gate config
```

- [ ] **Step 3: Commit**

```bash
git -C <repo-root> add setup.sh README.md
git -C <repo-root> commit -m "feat: automate quality gate hook installation in setup.sh"
```

---

## Phase 3: Documentation Clarifications

### Task 7: Clarify approval semantics in README and docs

Audit finding #2: README says "your approval at every gate" but `approval_mode` defaults to `auto`. This isn't a bug — `auto` is correct for conversational use — but the README should be precise about what "approval" means.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README language**

Find the line "Nothing ships without your sign-off" (or similar approval-related language) and clarify:

Replace with something like:

```markdown
Nothing ships without your sign-off — the pipeline pauses
at every gate (requirements, build plan, baseline, merge)
and returns control to your Claude Code session. You review
the output and decide whether to continue. In CI mode
(`approval_mode: ci`), approval gates reject automatically.
```

- [ ] **Step 2: Commit**

```bash
git -C <repo-root> add README.md
git -C <repo-root> commit -m "docs: clarify approval gate semantics in README"
```

---

### Task 8: Add framework compatibility note to top-level README

Audit finding #11: The runner README already has a detailed "Compatibility" section distinguishing framework-agnostic runner from opinionated conventions, but the top-level README doesn't mention this.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add compatibility note**

After the "Requirements" section (near the end of README.md), add:

```markdown
## Compatibility

The runner is framework-agnostic — it executes shell commands
from your config and tracks state in JSON. The testing
conventions (post-wave review, wiring audit) are designed
for React + GraphQL + Vitest + RTL + Playwright + MSW. Other
stacks work with the runner but need adapted command specs.
See `runner/README.md` for the full compatibility matrix.
```

- [ ] **Step 2: Commit**

```bash
git -C <repo-root> add README.md
git -C <repo-root> commit -m "docs: add framework compatibility note to top-level README"
```

---

### Task 9: Document E2E fixture test gap

Audit finding #12: No true end-to-end fixture test proving the plugin works against a real project. This is a known gap, not a bug. Document it so it's tracked.

**Files:**
- Modify: `docs/QUALITY_MATRIX.md`

- [ ] **Step 1: Add E2E fixture test row to quality matrix**

Read `docs/QUALITY_MATRIX.md` and add a row to the appropriate table:

```markdown
| End-to-end fixture test | Manual-only | Not yet implemented — runner tests validate mechanics, not operational completeness against a real project |
```

- [ ] **Step 2: Commit**

```bash
git -C <repo-root> add docs/QUALITY_MATRIX.md
git -C <repo-root> commit -m "docs: document E2E fixture test gap in quality matrix"
```
