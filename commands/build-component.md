---
description: Build a single component using TDD protocol with tests first
---

# /build-component [ComponentName]

Build a single component using the TDD protocol.

Pre-flight:
- Read /docs/UI_REQUIREMENTS.md
- Read /docs/COMPONENT_INVENTORY.md
- Confirm [ComponentName] exists in inventory
- Confirm all its dependencies have Build status: [x] complete
- If any dependency is incomplete, stop and report which ones

TDD Protocol:
1. Write RTL tests first based on UI_REQUIREMENTS.md:
   - Each test must contain at least one expect() assertion
   - Loading state renders correctly
   - Data state renders correctly (use MSW fixture)
   - Empty state renders correctly
   - Error state renders correctly
   - All user interactions for this component produce
     correct behavior
2. Verify test quality before running:
   - Count expect() calls in the test file — must be > 0
   - Each test case (it/test block) must have at least
     one assertion
   - If any test case has zero assertions, add them
3. Run tests — confirm they fail
   - If ALL tests pass before the component exists, STOP
     and report: "Tests pass before component exists —
     tests are not asserting correctly"
4. Build the component to make tests pass
5. Run tests — confirm all passing
6. CSS pass using CSS Modules
   - Create [ComponentName].module.css
   - Use only tokens defined in the project's token file
     (default: src/styles/tokens.css)
   - Token naming: --color-[intent], --spacing-[size],
     --font-[property]
   - If a needed token doesn't exist, add it to the token
     file with a comment, don't use a hardcoded value
   - Do not use inline styles or hardcoded values
7. Run tests again — confirm still passing
8. Code review gate:
   - Invoke the code-reviewer agent against all files changed
     for this component (component file, test file, CSS module)
   - If Critical issues found: fix, re-run tests, re-review
   - If Major issues found: fix, re-run tests, re-review
   - Minor issues: note but do not block
   - Review must pass clean (no Critical/Major) before continuing
9. Update Build status in COMPONENT_INVENTORY.md to [x] complete
10. Update /docs/BUILD_STATUS.md

Do not proceed if tests are failing. Surface failure and wait
for user direction.
