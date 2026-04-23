# Frontend Orchestration

A Claude Code plugin that builds your entire frontend from a conversation. Describe what you want, it interviews you, writes tests, builds components, audits everything, and opens PRs — dependency order, TDD, your approval at every gate.

`/ui-interview` asks about pages, components, data flows, and edge cases. `/build-pipeline` resolves components into dependency waves (leaf nodes first), writes failing tests, builds to green, and audits each wave before opening PRs. Nothing ships without your sign-off.

## Quick start

From your workspace root (the directory you open Claude Code in):

```sh
# 1. Clone — the target directory name matters, don't change it
git clone https://github.com/Jakemo136/frontend-orchestrator.git \
  .claude/plugins/frontend-orchestration

# 2. Install deps, browsers, and register commands
.claude/plugins/frontend-orchestration/setup.sh
```

The plugin **must** live at `.claude/plugins/frontend-orchestration/` relative to your workspace root.

Setup installs dependencies, Playwright browsers, and symlinks commands into `.claude/commands/` for discovery. It also offers to install **quality gate hooks** that block `git commit` until code-review and code-simplify have run in the current session. Hooks are recommended but optional — decline during setup or install later via `setup/install-hooks.md`. Restart Claude Code after install, then verify with `/session-start`.

Create `orchestrator.config.yaml` in your project root:

```yaml
project: my-app
scope:
  type: app
  target: null
branches:
  main: main
  feature: null
artifacts:
  requirements: docs/UI_REQUIREMENTS.md
  inventory: docs/COMPONENT_INVENTORY.md
  build_plan: docs/BUILD_PLAN.md
  build_status: docs/BUILD_STATUS.md
  design_audit: docs/DESIGN_AUDIT.md
  visual_qa: docs/VISUAL_QA.md
commands:
  test_client: npm test
  test_server: cd server && npm test
  test_e2e: npx playwright test
  build_client: npm run build
  dev_server: npm run dev
  typecheck: npx tsc --noEmit
ci:
  required_on_main: [client, e2e]
  required_on_feature: [client]
  informational_on_feature: [e2e]
```

## Commands

| Command | What it does |
|---|---|
| `/session-start` | Reorient at the start of a session |
| `/ui-interview` | Requirements interview — produces UI_REQUIREMENTS.md and COMPONENT_INVENTORY.md |
| `/build-component [Name]` | Build one component TDD-style |
| `/build-page [Page]` | Build all components for a page, parallelized by dependency wave |
| `/build-pipeline` | Full autonomous build: E2E tests, dependency waves, audits, PRs |
| `/review-requirements` | Summarize build state, suggest next step |
| `/design-audit [route?]` | A11y + design audit at all breakpoints, auto-fix critical issues |
| `/visual-qa [route?]` | UX quality review — Nielsen's heuristics, Gestalt, frustration signals |
| `/set-baseline [route?]` | Promote screenshots to visual regression baseline |

## How it works

```mermaid
graph TD
    A["/ui-interview"] --> B["UI_REQUIREMENTS.md +<br/>COMPONENT_INVENTORY.md"]
    B --> C["/build-pipeline"]
    C --> D["Phase 1+2 (parallel)"]
    D --> D1["E2E tests written<br/>(must fail initially)"]
    D --> D2["Components grouped<br/>into dependency waves"]
    D1 --> E["Phase 3: Wave build"]
    D2 --> E
    E --> E1["Wave 0: all components in parallel"]
    E1 --> E2["Wave 1: all components in parallel"]
    E2 --> E3["Wave N..."]
    E3 --> F["Phase 4: E2E green, design audit,<br/>visual QA, baseline"]
    F --> G["Phase 5: Final review, merge to main"]

    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#0f3460,color:#fff
    style F fill:#1a1a2e,stroke:#533483,color:#fff
```

Each phase gates on the previous. The pipeline resumes from any checkpoint. Within each wave, all components build in parallel via separate subagents — audits, screenshots, and reviews also parallelize per route.

## What's inside

```
frontend-orchestration/
  commands/       9 slash commands
  subagents/      8 specialized agents (component-builder, e2e-writer, etc.)
  runner/         DAG executor, state machine, evidence pipeline, step implementations
  mcp/            2 MCP servers (a11y-scanner, screenshot-review + visual regression)
  standards/      Design, a11y, and UX quality checklists
  docs/           Quality matrix, audit findings, implementation plans
  setup/          Hooks, install script, quality gate config
```

See [`docs/QUALITY_MATRIX.md`](docs/QUALITY_MATRIX.md) for which checks are runner-enforced vs. prompt-delegated vs. manual.

## Audit layers

The audits aren't an LLM guessing — automated tooling produces hard data, then agents review what the tools can't catch.

| Layer | What runs | How |
|-------|-----------|-----|
| **axe-core** | WCAG 2.2 AA scan against live DOM | a11y-scanner MCP → real Chromium |
| **Screenshots** | Full-page captures at 375/768/1280/1440px | screenshot-review MCP → Playwright |
| **Visual regression** | Pixel-level diff against baseline | pixelmatch with configurable threshold |
| **Composition review** | Agent reviews screenshots as a first-time user | Checklist: hierarchy, alignment, duplicates, empty states |
| **Codified standards** | WCAG AA, Nielsen's 10, Gestalt, contrast, touch targets | `standards/design-and-a11y.md`, `standards/ux-quality.md` |
| **Auto-fix + re-verify** | Fix Critical/Major → re-run full audit | Rollback-safe: git stash → fix → verify → rollback on regression |
| **UX quality** | Separate `/visual-qa` pass | Heuristics, interaction quality, 10 frustration signals |

Critical/Major issues are auto-fixed and re-verified. Minor issues are flagged for human review. `/visual-qa` runs after `/design-audit` — a11y compliance first, then UX.

## Evidence pipeline

E2E test runs collect Playwright traces, failure screenshots, and a machine-readable `evidence-manifest.json` — all persisted to `.orchestrator/evidence/`.

## Requirements

- Node.js 20+, Claude Code
