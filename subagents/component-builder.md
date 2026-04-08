# Component Builder Subagent

Receives: ComponentName, component spec from
COMPONENT_INVENTORY.md, relevant section of UI_REQUIREMENTS.md

Executes the full TDD Component Build Protocol:
1. Write RTL tests
2. Confirm tests fail
3. Build component
4. Confirm tests pass
5. CSS pass with CSS Modules
6. Confirm tests still pass
7. Invoke code-reviewer agent against all changed files
   - Fix Critical and Major issues, re-run tests after fixes
   - Minor issues: note but do not block
8. Update COMPONENT_INVENTORY.md build status
9. Report completion or failure to orchestrator

Reports back: success | failure with details
