# Frontend Orchestration

A Claude Code plugin that builds your entire frontend from a conversation. You describe what you want, it interviews you, writes tests, builds components, audits everything, and opens PRs — all in dependency order, all TDD, all with your approval at every gate.

## What to expect

You start by talking. `/ui-interview` asks about your pages, components, data flows, user stories, and edge cases. Be specific — everything it builds comes from what you say here.

Then it builds. `/build-pipeline` resolves your components into dependency waves (leaf nodes first, composites after), writes failing E2E and unit tests, builds each component to make the tests pass, and never touches a test to make it green. Each wave gets code review, code simplification, design audit, and a11y audit before PRs are opened.

You approve at every gate: the build plan, each wave's audit results, visual baseline promotion, and merging. Nothing ships without you saying so.

## Quick start

```sh
# 1. Clone into your workspace
git clone https://github.com/Jakemo136/frontend-orchestrator.git \
  .claude/plugins/frontend-orchestration

# 2. Install dependencies
cd .claude/plugins/frontend-orchestration/runner && npm install
cd ../mcp/a11y-scanner && npm install
cd ../screenshot-review && npm install

# 3. Install browsers
npx playwright install chromium

# 4. Create project config
cd /your/project && cat > orchestrator.config.yaml << 'YAML'
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
YAML
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

```
/ui-interview
    |
    v
UI_REQUIREMENTS.md + COMPONENT_INVENTORY.md
    |
    v
/build-pipeline
    |
    +---> Phase 1: E2E tests written (must fail initially)
    +---> Phase 2: Components grouped into dependency waves
    +---> Phase 3: Each wave built TDD, reviewed, audited, PR'd
    +---> Phase 4: E2E green, design audit, visual QA, baseline
    +---> Phase 5: Final review, merge to main
```

Each phase gates on the previous. The pipeline can resume from any checkpoint.

## What's inside

```
frontend-orchestration/
  commands/       9 plugin commands (the slash commands above)
  subagents/      8 specialized agents (component-builder, e2e-writer, etc.)
  runner/         DAG executor — state machine, evidence pipeline, step implementations
  mcp/            2 MCP servers (a11y-scanner, screenshot-review)
  standards/      Design, a11y, and UX quality checklists
  setup/          Recommended hooks and install guide
```

## Evidence pipeline

When E2E tests run, the orchestrator collects structured failure evidence:

- Playwright traces (`.zip` — open with `npx playwright show-trace`)
- Failure screenshots
- Machine-readable `evidence-manifest.json` per test run

Evidence is persisted to `.orchestrator/evidence/` and referenced in step results. See `setup/` for CI artifact upload patterns.

## Requirements

- Node.js 20+
- Claude Code
