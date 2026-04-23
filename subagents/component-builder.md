# Component Builder Subagent

**Timeout:** 10 minutes per component. If build exceeds
this, report partial progress and surface to orchestrator.

Receives: ComponentName, component spec from
COMPONENT_INVENTORY.md (including Build config section),
relevant section of UI_REQUIREMENTS.md

## File Paths (from Build config)

Read the `Build config` section of the component's inventory
entry. Use these exact paths — do not guess:
- Component file: `Build config → File`
- Test file: `Build config → Test`
- CSS module: `Build config → Styles`
- Test utilities import: `Build config → Test utilities`
- GraphQL imports: `Build config → GraphQL imports`
- Test runner: `Build config → Test runner`
- Token file: `Build config → Token file`

If any Build config field is missing, STOP and report:
"ComponentName is missing Build config fields in
COMPONENT_INVENTORY.md. Cannot build without file paths."

## TDD Protocol

Executes the full TDD Component Build Protocol:
1. Write RTL tests to the exact Test path
   - Import test utilities from the path in Build config
   - Use the test runner specified in Build config
   - Each test must contain at least one expect() assertion
2. Verify test quality:
   - Count expect() calls in the test file — must be > 0
   - Each test case (it/test block) must have at least one assertion
   - If any test case has zero assertions, add them
3. Run tests — confirm they fail
   - If ALL tests pass before the component exists, STOP
     and report: "Tests pass before component exists —
     tests are not asserting correctly"
4. Build component to the exact File path
   - Import CSS module from the exact Styles path
   - Use only tokens from the Token file path
   - Import GraphQL operations from GraphQL imports path
5. Confirm tests pass
6. CSS pass with CSS Modules at the exact Styles path
   - No inline styles or hardcoded values
   - Token naming: --color-[intent], --spacing-[size],
     --font-[property]
   - If a needed token doesn't exist, add it to the token
     file with a comment, don't use a hardcoded value
7. Confirm tests still pass
8. Invoke code-reviewer agent against all changed files
   - Fix Critical and Major issues, re-run tests after fixes
   - Minor issues: note but do not block
9. Update COMPONENT_INVENTORY.md build status
10. Report completion or failure to orchestrator

## Wiring Audit (for components with dependencies)

If this component imports or renders other components
(check the Dependencies field in COMPONENT_INVENTORY.md):

1. Write an integration test that renders this component
   with its real child components (not mocked)
2. Verify child components receive correct props
3. Verify interaction flows work across parent-child
   boundary (e.g., clicking child button triggers parent
   callback)

Example for a Form component that uses Button:
```typescript
test('Form submits when Button is clicked', () => {
  const onSubmit = vi.fn();
  render(<Form onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalledOnce();
});
```

Skip wiring audit if Dependencies is "none".

Reports back: success | failure with details
