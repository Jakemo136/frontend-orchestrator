# Frontend Orchestration Plugin

A Claude Code plugin that manages the full lifecycle of building frontend components — from requirements gathering through tested, audited pull requests.

## How to use

Start with `/ui-interview`. The plugin will ask about what you're building: pages, components, data requirements, user flows, edge cases. Everything it builds afterward is driven by your answers, so come in with a clear picture of what you want. The more specific you are, the better the output.

Once requirements are locked, use `/build-page` or `/build-pipeline` to kick off the build. The plugin follows strict TDD — it writes tests first, then builds components to pass them. If a test fails, it fixes the component, never the test.

Components are built in waves based on dependency order. Leaf components (buttons, inputs, cards) go first. Components that compose those come next, and so on up the tree. Each wave goes through code review, design audit (`/design-audit`), and accessibility audit before any PRs are opened.

You stay in control throughout. The plugin pauses for your approval at key points: the build plan, audit results, baseline promotion (`/set-baseline`), and merging. Nothing gets merged without you saying so.

For smaller tasks, `/build-component` lets you build a single component TDD-style. `/review-requirements` gives you a summary of where the build stands and what to do next. `/visual-qa` runs a UX quality review after the design audit passes. `/session-start` reorients the plugin at the beginning of a new session.

## Setup

### Prerequisites

- Node.js 20+
- Claude Code CLI

### Installation

1. Clone or copy the plugin to `.claude/plugins/frontend-orchestration/` in your workspace.

2. Install dependencies in three directories:

   ```
   cd .claude/plugins/frontend-orchestration/runner && npm install
   cd .claude/plugins/frontend-orchestration/mcp/a11y-scanner && npm install
   cd .claude/plugins/frontend-orchestration/mcp/screenshot-review && npm install
   ```

3. Install Playwright browsers:

   ```
   npx playwright install chromium
   ```

### Project config

Create `orchestrator.config.yaml` in your project root, or run `orchestrate init` to generate one interactively. Minimal example:

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

### MCP servers

The plugin registers `a11y-scanner` and `screenshot-review` MCP servers through `plugin.json`. Claude Code should discover them automatically when the plugin is loaded. If they don't appear, verify the plugin is loaded in your Claude Code settings.

## Commands

- `/session-start` — reorient at the start of a session
- `/ui-interview` — requirements interview, produces UI_REQUIREMENTS.md and COMPONENT_INVENTORY.md
- `/build-component [Name]` — build one component TDD-style
- `/build-page [PageName]` — build all components for a page, parallelized by wave
- `/build-pipeline` — fully autonomous frontend build with E2E
- `/review-requirements` — summarize build state, suggest next step
- `/design-audit [route?]` — accessibility and design audit at all breakpoints
- `/visual-qa [route?]` — UX quality review (run after /design-audit)
- `/set-baseline [route?]` — promote screenshots to visual regression baseline
