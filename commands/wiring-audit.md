---
description: Verify integration test coverage for all parent-child component relationships
---

# /wiring-audit

Audit that every parent-child component rendering edge
has a corresponding integration test.

For every component built in the current wave:

1. **Identify parent components** — which components render
   this component?
2. **Check for wiring tests** — does an integration test
   exist that renders the parent and exercises the child's
   features through it?
3. **Verify test quality:**
   - Test renders the parent, not the child in isolation
   - Test exercises at least one interactive feature of the
     child through the parent's interface
   - Test uses userEvent, not fireEvent
   - Test uses MSW for data, not hand-written JSON mocks

Report format:
- For each component: parent name, test file path, pass/fail
- Missing wiring tests listed as failures

Return success if all parent-child edges have wiring tests.
Return failure listing each missing edge with the parent
and child component names.
