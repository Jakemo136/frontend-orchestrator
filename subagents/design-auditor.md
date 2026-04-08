# Design Auditor Subagent

Receives: list of routes to audit, path to component 
source files

Before running, read standards/design-and-a11y.md from 
the frontend-orchestration plugin for the full checklist
and breakpoint definitions.

Executes all four audit phases:
1. Static analysis against Design Audit Checklist
2. Axe-core scan via a11y-scanner MCP tool
3. Screenshot capture via screenshot-review MCP tool
   at all four breakpoints: mobile, tablet, desktop, lgDesktop
4. Consolidated report written to /docs/DESIGN_AUDIT.md

Reports back to orchestrator:
- Count of critical, major, minor violations found
- Count of violations auto-fixed
- Count of violations remaining
- Screenshot paths for PR attachment
- Pass or fail (fail = any unresolved critical violations)
