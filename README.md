# Frontend Orchestrator

Config-driven DAG runner that enforces a frontend build workflow: requirements, planning, build, quality, ship. Each step gates on the previous — no skipping, no forgetting.

## Quick Start

```bash
# Initialize config in your project
orchestrate init

# Edit orchestrator.config.yaml with your project's commands and paths

# Run the pipeline (starts or resumes where you left off)
orchestrate

# See the full pipeline with current progress
orchestrate --explain

# Check status
orchestrate status

# Re-run a specific step
orchestrate reset <step-id>
orchestrate run <step-id>
```

## Config

Create `orchestrator.config.yaml` in your project root:

```yaml
project: my-app
scope:
  type: app        # app | page | component | feature
  target: null     # null for app, "BeanLibrary" for page, etc.
branches:
  main: main
  feature: feat/my-feature
artifacts:
  requirements: docs/UI_REQUIREMENTS.md
  inventory: docs/COMPONENT_INVENTORY.md
  build_plan: docs/BUILD_PLAN.md
  build_status: docs/BUILD_STATUS.md
  design_audit: docs/DESIGN_AUDIT.md
  visual_qa: docs/VISUAL_QA.md
commands:
  test_client: "cd client && npm test"
  test_server: "cd server && npm test"
  test_e2e: "npx playwright test"
  build_client: "cd client && npm run build"
  dev_server: "npm run dev"
  typecheck: "cd client && npx tsc --noEmit"
ci:
  required_on_main: [server, client, e2e]
  required_on_feature: [server, client]
  informational_on_feature: [e2e]
```

Scope determines which steps run. Smaller scopes skip steps that don't apply:

| Scope | What it builds | Steps skipped |
|-------|---------------|---------------|
| **app** | Entire frontend | None |
| **page** | One page + its components | merge-to-main |
| **feature** | Feature addition | set-baseline |
| **component** | Single component | e2e-scaffold, design-audit, visual-qa, set-baseline, merge-to-main |

## Pipeline

```
Phase 1: Requirements
  session-start ──> ui-interview ──> review-requirements
                         |
Phase 2: Planning        v
                    user-story-generation
                      /              \
              e2e-scaffold    dependency-resolve
                                     |
Phase 3: Build                       v
               ┌─────────────────────────────────────┐
               │  For each wave (sequential):         │
               │                                      │
               │  build-wave:N ──> test-suite:N       │
               │       |               |              │
               │       v               v              │
               │  post-wave-review:N ──> open-prs:N   │
               │                            |         │
               │                      await-merge:N   │
               └─────────────────────────────────────┘
                                     |
Phase 4: Quality                     v
                    e2e-green ──> design-audit ──> visual-qa
                                      |
                                 set-baseline
                                      |
Phase 5: Ship                         v
                            pre-commit-review
                                      |
                                merge-to-main
```

## Steps

### Phase 1: Requirements

| Step | What it does | Pass | Fail |
|------|-------------|------|------|
| **session-start** | Reads project docs, produces a briefing of current state. | Always passes (informational). | Never fails. |
| **ui-interview** | Interactive Q&A to produce UI_REQUIREMENTS.md and COMPONENT_INVENTORY.md. | Both docs exist, user approves. | User cancels or docs incomplete. |
| **review-requirements** | Summarizes what's built, what's next, what's blocked. | Summary generated (informational). | Required docs missing. |

### Phase 2: Planning

| Step | What it does | Pass | Fail |
|------|-------------|------|------|
| **user-story-generation** | Generates USER_STORIES.md with PM-voice interaction sequences. Cross-component stories include Data flow annotations tracing prop chains. | USER_STORIES.md exists with Data flow annotations, user approves. | Missing source docs or user rejects. |
| **e2e-scaffold** | Writes Playwright test files for every user flow. Runs them — expects all to fail (nothing built yet). | Test files exist, all tests fail. | Tests unexpectedly pass or writer errors. |
| **dependency-resolve** | Groups components into build waves by dependency order. Writes BUILD_PLAN.md. | BUILD_PLAN.md exists, no circular deps, user approves. | Circular dependency or user rejects. |

### Phase 3: Build (repeats per wave)

| Step | What it does | Pass | Fail |
|------|-------------|------|------|
| **build-wave:N** | Builds all components in wave N in parallel. Each runs TDD protocol + code review + code simplify + wiring audit. | All components marked complete. Integration tests verify parent-child prop chains. | Any component fails TDD, review, or wiring audit. |
| **test-suite:N** | Runs typecheck, unit tests, component tests, integration tests, and E2E. | Typecheck clean, RTL zero failures, E2E monotonically improving. | New typecheck errors, new RTL failures, or E2E regression. |
| **post-wave-review:N** | Runs code-reviewer + code-simplifier + design-audit + wiring audit on the wave's diff. | No critical issues. Wiring tests exist for every parent-child edge. Schema-driven MSW, no hand-written JSON mocks. | Unresolved critical issues or missing wiring tests. |
| **open-prs:N** | Creates a branch and PR per component, targeting the feature branch. | All PRs opened, Server + Client CI green. | CI failures. |
| **await-merge:N** | Waits for all wave PRs to be merged. | All PRs merged. | User closes PR without merging. |

### Phase 4: Quality

| Step | What it does | Pass | Fail |
|------|-------------|------|------|
| **e2e-green** | Fixes components until the E2E suite passes 100%. Never modifies test assertions. | E2E: zero failures. | Can't fix without modifying tests (escalate to user). |
| **design-audit** | Full a11y + design audit at all breakpoints (375, 768, 1280, 1440px). Auto-fixes critical and major violations. | Zero critical, zero major. DESIGN_AUDIT.md written. | Unresolved critical/major after auto-fix. |
| **visual-qa** | UX quality review: Nielsen's heuristics, Gestalt principles, frustration signals. Auto-fixes critical/major. | Zero critical UX issues. VISUAL_QA.md written. | Unresolved critical UX issues. |
| **set-baseline** | Promotes screenshots to visual regression baseline. | User confirms. | User rejects. |

### Phase 5: Ship

| Step | What it does | Pass | Fail |
|------|-------------|------|------|
| **pre-commit-review** | Final code-reviewer + code-simplifier + all test suites on the full diff. | All tests pass, no critical/major findings. | Test failures or unresolved findings. |
| **merge-to-main** | Opens PR from feature branch to main. All CI (Server, Client, E2E) must be green. | All CI green, PR merged. | CI failures. |

## State

Progress is tracked in `.orchestrator/WORKFLOW_STATE.json`. The runner reads this on startup and resumes where it left off. If a step fails, fix the issue and run `orchestrate` again — it picks up from the failed step.

```bash
# See current state
orchestrate status

# Reset a step to re-run it
orchestrate reset build-wave:2
```

## Testing Conventions

The orchestrator enforces these at every build step:

- **Schema-driven MSW** — mocks import the real server `typeDefs`, not hand-written JSON
- **`userEvent.type()`** for text inputs — never `fireEvent.change`
- **Button state machine** — tested through full lifecycle (empty → partial → complete → clear)
- **Dead-end detection** — every modal state has an exit path assertion
- **Wiring audit** — for every parent-child rendering edge, an integration test renders the parent and exercises the child's features through it
- **No soft conditionals in E2E** — if a flow branches, write two tests

## Compatibility

### What's framework-agnostic (the runner)

The orchestrator itself has **no framework dependencies**. It runs shell commands from your config, tracks state in JSON, and resolves a dependency graph. It doesn't import React, Angular, Vue, or any UI library. The `commands:` section in config accepts any shell command — `npm test`, `yarn build`, `make lint`, whatever your project uses.

Works with any:
- **UI framework** — React, Vue, Angular, Svelte, Solid, vanilla
- **Build tool** — Vite, Webpack, esbuild, Turbopack, Rollup
- **Package manager** — npm, yarn, pnpm, bun
- **Monorepo tool** — Turborepo, Nx, Lerna, or none

### What's opinionated (the conventions)

The **testing conventions** enforced by the step descriptions and post-wave-review are opinionated toward a specific stack:

| Convention | Assumes | Alternatives would require |
|-----------|---------|---------------------------|
| Schema-driven MSW | GraphQL + MSW | Adapting for REST (MSW still works) or tRPC |
| `userEvent.type()` over `fireEvent` | React Testing Library | Different assertion patterns for other test libs |
| Wiring audit (prop flow) | Component-based UI (React, Vue, Svelte) | Adaptation for template-based frameworks (Angular) |
| Playwright for E2E | Playwright | Config change only — use Cypress, WebdriverIO, etc. |
| `typeDefs` import for mock validation | GraphQL with a schema file | REST: OpenAPI schema validation. tRPC: router type inference. |

**Bottom line:** The runner works anywhere. The testing conventions were designed for **React + GraphQL + Vitest + RTL + Playwright + MSW** and would need adaptation for other stacks. The adaptation is in the step descriptions and plugin commands, not the runner itself.

### What's NOT supported

- **Backend-only projects** — this is a frontend build orchestrator
- **No-build static sites** — the pipeline assumes a component-based architecture with a build step
- **Non-JS/TS projects** — the testing conventions assume a JavaScript ecosystem

## License

MIT
