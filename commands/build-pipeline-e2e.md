---
description: Scaffold E2E test files from user requirements
---

# /build-pipeline:e2e

Write Playwright E2E tests for all user flows before building any components.

## Inputs

- `/docs/UI_REQUIREMENTS.md` — user stories and user flows

## Behavior

1. Read UI_REQUIREMENTS.md
2. For each major user flow in the requirements:
   - Create one Playwright test file: `/client/e2e/[flow-name].spec.ts`
   - Name the test after the flow (e.g., "user logs in", "creates a post")
3. For each test file:
   - Write test(s) that follow the exact user flow narrative
   - Assert on visible UI elements (roles, text, element queries)
   - Never assert on implementation details (classes, data-testid, etc.)
   - Use realistic test data via MSW fixtures or test database
   - Include setup/teardown hooks as needed
4. Run all E2E tests:
   - Expect them to fail (components don't exist yet)
   - Capture failure dossiers (traces, screenshots)
5. Log E2E test status to BUILD_STATUS.md:
   - Count of test files created
   - Count of test cases per file
   - Overall status: all failing (expected at this stage)

## Expected Outputs

- `/client/e2e/[flow-name].spec.ts` — one test file per major flow
  - Multiple test cases per file are acceptable (grouped by feature)
  - Each test must have at least one `expect()` assertion
  - Must reference visible UI elements
  
Example structure:
```typescript
import { test, expect } from '@playwright/test';

test.describe('User Login Flow', () => {
  test('user logs in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Welcome, User')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });
});
```

## Success Criteria

- One test file created per major flow
- Each test file has at least one test case
- Each test case has at least one `expect()` assertion
- Tests reference visible UI elements (roles, text)
- All tests are executable with Playwright
- All tests fail before components are built (expected)
- Test file count and status logged to BUILD_STATUS.md

## Failure Criteria

- UI_REQUIREMENTS.md missing or unparseable
- No test files created
- Tests assert on implementation details instead of visible UI
- Test files cannot be executed by Playwright
