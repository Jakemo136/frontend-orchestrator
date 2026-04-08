---
description: Run a full design and accessibility audit at all breakpoints, with auto-fix for critical and major issues
---

# /design-audit [route?]

Orchestrate a full design and accessibility audit.
If route provided, audit that route only.
If no route provided, audit all routes in the app.

Before running, read standards/design-and-a11y.md for
the full checklist and breakpoint definitions.

Requires dev server to be running. If not running,
instruct user to start it before proceeding.

## Phase 1: Automated checks (parallel)

Dispatch all three subagents in a single Agent tool message:
- design-auditor for static analysis
- a11y-scanner for axe-core scan (via Playwright if
  MCP tool fails)
- screenshot-reviewer for visual capture at all breakpoints

These are independent and must run in parallel to avoid
context bloat. Never run them sequentially.

When subagents return, condense their results into a
unified summary. Do NOT paste each subagent's full output
into the conversation — extract violations by severity,
affected routes, and screenshot paths.

## Phase 2: Visual composition review (after Phase 1)

After automated checks complete and screenshots are
captured, perform a discovery-oriented visual review
of every screenshot. This is NOT a checklist pass — it
is a critical design evaluation.

For each route at each breakpoint, examine the full
page composition and ask:

**Layout & structure:**
- Are there duplicate or redundant elements? (e.g. a
  page rendering its own header inside a layout that
  already provides one)
- Does the visual hierarchy make sense? Is it clear
  what's primary, secondary, tertiary?
- Is there wasted space or content that feels cramped?
- Do elements that should be aligned actually align?
  (baselines, edges, centers)

**Navigation & wayfinding:**
- Does the user know where they are? (active nav state,
  breadcrumbs, page title)
- Are there confusing or redundant navigation paths?
- Is there a clear path to the next action?

**Content & data:**
- Does placeholder/seed data look realistic at all
  breakpoints?
- Are empty states helpful or just blank?
- Do tables, cards, and lists degrade gracefully on
  mobile?

**Consistency:**
- Do similar pages use similar patterns? (e.g. detail
  pages should share layout structure)
- Are interactive elements styled consistently across
  pages? (buttons, links, toggles)
- Does the header/footer look correct on every page?

**"Would a user find this confusing?"**
- Look at each screenshot as if seeing the app for the
  first time
- Flag anything that looks unintentional, duplicated,
  misaligned, or confusing
- Err on the side of flagging — false positives are
  cheap, missed issues are expensive

Report visual composition issues alongside automated
findings in the appropriate severity bucket.

## Report: /docs/DESIGN_AUDIT.md

## Critical (fix before merge)
- WCAG AA violations
- Broken layouts at any breakpoint
- Missing focus indicators
- Missing alt text
- Duplicate or redundant page elements (headers, nav)

## Major (fix in same sprint)
- Incomplete interactive states
- Missing transitions on dynamic elements
- Contrast approaching but not failing AA
- Keyboard navigation issues
- Alignment issues between related elements
- Confusing visual hierarchy or navigation

## Minor (fix when touching the component)
- Spacing inconsistencies
- Typography scale deviations
- Motion not respecting prefers-reduced-motion
- AAA opportunities

## Screenshots
[paths to all captured screenshots, grouped by route 
then breakpoint: mobile / tablet / desktop / lg-desktop]

## Passes
[what is already correct]

## Phase 3: Auto-fix Critical and Major issues

1. Apply fixes
2. Re-run a11y-scanner on fixed routes
3. Re-capture screenshots at all breakpoints
4. Re-run visual composition review on new screenshots
5. Confirm violations resolved
6. Update DESIGN_AUDIT.md

Do not auto-fix Minor issues — flag for human review.
