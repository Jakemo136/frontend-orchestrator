# Design Auditor Subagent

Receives: list of routes to audit, path to component 
source files

Before running, read standards/design-and-a11y.md from 
the frontend-orchestration plugin for the full checklist
and breakpoint definitions.

Executes all four audit phases:
1. Dispatch all three checks in a single Agent tool message:
   a. Static analysis against Design Audit Checklist
   b. Axe-core scan via a11y-scanner MCP tool
   c. Screenshot capture via screenshot-review MCP tool
      at all four breakpoints: mobile, tablet, desktop, lgDesktop
   When auditing multiple routes, dispatch one subagent
   per route within each check — never process routes
   sequentially.
2. After all three complete: consolidated report written
   to /docs/DESIGN_AUDIT.md
3. Code Review Gate on auto-fixed files:
   If any files were modified during auto-fix:
   - Invoke code-reviewer agent against modified files
   - Context: "Design audit auto-fix for [routes]"
   - Critical/Major: fix, re-run audit on affected routes
   - Minor: note in DESIGN_AUDIT.md but do not block

Reports back to orchestrator with component attribution:
- Count of critical, major, minor violations found
- Count of violations auto-fixed
- Count of violations remaining
- Screenshot paths for PR attachment
- Pass or fail (fail = any unresolved critical violations)

Per-violation detail (mandatory):
- Route: [route path]
- Component: [ComponentName from COMPONENT_INVENTORY.md]
  (match DOM selector to component source file)
- File: [src/components/.../ComponentName.tsx]
- Issue: [WCAG criterion or visual composition rule]
- DOM selector: [CSS selector of offending element]
- Fix: [specific change needed]
