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
   - Loading state renders correctly
   - Data state renders correctly (use MSW fixture)
   - Empty state renders correctly
   - Error state renders correctly
   - All user interactions for this component produce
     correct behavior
2. Run tests — confirm they fail
3. Build the component to make tests pass
4. Run tests — confirm all passing
5. CSS pass using CSS Modules
   - Create [ComponentName].module.css
   - Use only tokens defined in src/styles/tokens.css
   - Do not use inline styles or hardcoded values
6. Run tests again — confirm still passing
7. Code review gate:
   - Invoke the code-reviewer agent against all files changed
     for this component (component file, test file, CSS module)
   - If Critical issues found: fix, re-run tests, re-review
   - If Major issues found: fix, re-run tests, re-review
   - Minor issues: note but do not block
   - Review must pass clean (no Critical/Major) before continuing
8. Update Build status in COMPONENT_INVENTORY.md to [x] complete
9. Update /docs/BUILD_STATUS.md

Do not proceed if tests are failing. Surface failure and wait
for user direction.
