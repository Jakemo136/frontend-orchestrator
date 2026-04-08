# E2E Writer Subagent

Receives: full UI_REQUIREMENTS.md content

## Test Infrastructure (written once before any test files)

### Fixture file (`client/e2e/fixtures.ts`)

Write a project-specific `test.extend()` that provides:

- **`authenticatedPage`** — a Page logged in as a test user.
  Read the auth section of UI_REQUIREMENTS.md to determine the
  strategy: cookie injection for Clerk/Auth0, API login for
  custom auth, storage state reuse for session-based auth.
  Include teardown if the auth creates server-side state.

- **`seedData`** — deterministic data for the test. Read the
  data layer section of UI_REQUIREMENTS.md to determine the
  strategy: API call for REST/GraphQL, DB script for direct
  access, MSW handler for fully mocked. Include teardown to
  clean up seeded records.

Do not copy a template. Generate fixtures that match this
project's auth and data layer.

### Global setup (`client/e2e/global-setup.ts`)

Write if the project needs pre-test setup that runs once:
- Start MSW or mock server if not handled by dev server
- Verify dev server is reachable (health check)
- Create test user accounts if auth requires it
- Seed reference data shared across all tests

Skip this file if the dev server handles everything.

## Test files

For each user flow narrative in UI_REQUIREMENTS.md:

1. Identify the discrete steps a user takes
2. Write a Playwright test that follows those exact steps
3. Assert on visible outcomes the user would see
4. Save to `client/e2e/[flow-name].e2e.ts`

## Patterns enforced in every test file

- Import `test` from `./fixtures`, never from `@playwright/test`
- `test.use({ baseURL: process.env.BASE_URL ?? 'http://localhost:3000' })`
- `test.beforeEach` for per-test state isolation
  (clear relevant data, reset to known state via fixtures)
- No shared mutable state between tests — each test seeds
  its own data via the `seedData` fixture
- No `waitForTimeout()` — use Playwright's auto-waiting:
  `expect(locator).toBeVisible()`, `page.waitForURL()`, etc.
- No soft conditionals — if a flow branches, write two tests

## Rules

- Tests must be written to fail initially — this is correct
- Never write a test that passes before the component exists
- Assert on user-visible elements, not implementation details
- If a flow requires auth, use the `authenticatedPage` fixture
- If a flow requires data, use the `seedData` fixture
