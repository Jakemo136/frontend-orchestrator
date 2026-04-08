---
description: Run a UX quality review — Nielsen's heuristics, Gestalt principles, interaction quality, frustration signals
---

# /visual-qa [route?]

Run a UX quality and visual composition review.
If route provided, review that route only.
If no route provided, review all routes in the app.

This is a separate concern from /design-audit.
/design-audit focuses on accessibility compliance,
token adherence, and technical correctness.
/visual-qa focuses on usability, user experience,
and whether the app makes sense to a human.

Before running, read both standards files:
- standards/design-and-a11y.md (Visual Composition)
- standards/ux-quality.md (full UX checklist)

Requires dev server to be running. If not running,
instruct user to start it before proceeding.

## Phase 1: Screenshot capture

Capture all routes at all 4 breakpoints using the
screenshot-review MCP tool (or Playwright fallback).

## Phase 2: Visual composition review

For each route at each breakpoint, perform the
discovery-oriented visual review defined in
standards/design-and-a11y.md under "Visual
Composition". This catches structural issues like
duplicate elements, misalignment, broken layouts.

## Phase 3: UX quality evaluation

Using the captured screenshots AND the live app,
evaluate against every section in
standards/ux-quality.md:

1. **Nielsen's 10 Heuristics** (H1-H10)
   - Walk each heuristic against every route
   - For each violation, note the heuristic number,
     the route, and what specifically fails

2. **Gestalt Principles**
   - Proximity, similarity, continuity, figure-ground,
     common fate
   - Look at grouping, visual flow, and whether
     related elements feel related

3. **Interaction Quality**
   - Touch targets (measure against 44x44px minimum)
   - Affordances (do interactive things look
     interactive?)
   - Microcopy (are labels clear and actionable?)
   - Form UX (validation, error handling, tab order)
   - Loading & perceived performance

4. **Cognitive Load & Comprehension**
   - Information density (too much? too little?)
   - Visual scanning (can users find what they need?)
   - Discoverability (can users figure it out?)
   - First-time user experience

5. **Frustration Signals**
   - Walk the full frustration checklist from
     standards/ux-quality.md
   - For each signal found, describe what would
     frustrate the user and why

## Phase 4: Interactive testing

For routes that can be tested interactively (via
Playwright or browser automation):

- Click every interactive element — does it
  respond with visible feedback?
- Submit forms with valid and invalid data —
  are errors helpful?
- Navigate between pages — is back/forward
  behavior correct?
- Test at mobile viewport — are touch targets
  large enough? Do dropdowns fit on screen?
- Trigger empty states, error states, loading
  states — are they all handled gracefully?
- Try to break it — rapid clicks, empty submits,
  very long text inputs

## Report: /docs/VISUAL_QA.md

Organize findings by severity:

### Critical UX Issues (fix before merge)
- Frustration signals that would cause users to
  abandon the app
- Dead-end states with no escape
- Data loss scenarios
- Core task flows that are broken or confusing

### Major UX Issues (fix in same sprint)
- Heuristic violations that degrade usability
- Missing feedback on user actions
- Confusing or misleading microcopy
- Interaction quality problems at mobile

### Minor UX Issues (fix when touching the area)
- Polish items (microcopy improvements, spacing
  refinements)
- Gestalt principle violations that are noticeable
  but not confusing
- Enhancement opportunities (shortcuts, progressive
  disclosure)

### Passes
- What's working well from a UX perspective
- Patterns worth preserving and reusing

### Frustration Assessment
- Summary of frustration signals found
- For each: what happens, why it's frustrating,
  and suggested fix

For each finding, always answer:
> "Would this frustrate or confuse a real user?
> If so, how badly and how often?"

Auto-fix Critical and Major issues following the
same fix → re-test → confirm cycle as /design-audit.

Do not auto-fix Minor issues — flag for human review.

## When to run

- After /design-audit (a11y first, then UX quality)
- After major feature additions
- After any page-level layout changes
- Before merge to main on any PR that touches UI
