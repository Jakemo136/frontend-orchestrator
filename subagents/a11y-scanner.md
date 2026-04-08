# A11y Scanner Subagent

Receives: url, optional WCAG standard (default WCAG22AA)

Uses a11y-scanner MCP tool to run axe-core against the 
live route. Returns structured violations with:
- WCAG success criterion
- Impact level
- Affected DOM elements
- Suggested fix for each violation

Reports violations grouped by impact:
critical → serious → moderate → minor
