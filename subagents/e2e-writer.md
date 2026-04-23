# E2E Writer Subagent

**Timeout:** 5 minutes per flow. If test generation exceeds
this, report which flows are complete and which remain.

Receives: full UI_REQUIREMENTS.md content

## Test Infrastructure (written once before any test files)

### Fixture file (`client/e2e/fixtures.ts`)

Write a project-specific `test.extend()` that provides:

- **`authenticatedPage`** — a Page logged in as a test user.
  Read the auth section of UI_REQUIREMENTS.md to determine the
  strategy: cookie injection for Clerk/Auth0, API login for
  custom auth, storage state reuse for session-based auth.
  Include teardown if the auth creates server-side state.

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

- **`seedData`** — deterministic data for the test. Read the
  data layer section of UI_REQUIREMENTS.md to determine the
  strategy: API call for REST/GraphQL, DB script for direct
  access, MSW handler for fully mocked. Include teardown to
  clean up seeded records.

  Apply the same try/catch pattern — skip on setup failure:

  ```typescript
  seedData: async ({}, use, testInfo) => {
    try {
      // ... seed data
      await use(data);
    } catch (error) {
      testInfo.skip(true, `Data setup failed: ${error.message}`);
    } finally {
      // ... teardown (always runs, log warning on failure)
    }
  }
  ```

Do not copy a template. Generate fixtures that match this
project's auth and data layer.

### Global setup (`client/e2e/global-setup.ts`)

Write if the project needs pre-test setup that runs once:
- Start MSW or mock server if not handled by dev server
- Verify dev server is reachable (health check)
- Create test user accounts if auth requires it
- Seed reference data shared across all tests

Skip this file if the dev server handles everything.

## Test files (parallel per flow)

Write test infrastructure (fixtures.ts, global-setup.ts)
first — these must exist before any test files.

Then dispatch all test file writes in a single Agent tool
message — one subagent per user flow. Never write test files
sequentially. Each subagent:

1. Identifies the discrete steps the user takes
2. Writes a Playwright test that follows those exact steps
3. Asserts on visible outcomes the user would see
4. Saves to `client/e2e/[flow-name].e2e.ts`

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
