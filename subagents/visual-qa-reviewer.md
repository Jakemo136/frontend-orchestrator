# Visual QA Reviewer Subagent

Receives: list of routes to review, screenshot paths
at all breakpoints, path to standards files

Before running, read both:
- standards/design-and-a11y.md (Visual Composition)
- standards/ux-quality.md (full UX checklist)

## Core evaluation approach

For every screenshot, complete this structured evaluation.
Answer each question YES or NO. Any NO is a finding.

### First impression (5-second test)
- [ ] Can you identify the page's primary purpose? YES/NO
- [ ] Can you identify the primary action? YES/NO
- [ ] Is it obvious how to access the primary action? YES/NO
- [ ] Are there any confusing or redundant elements? YES/NO

### Quick heuristic scan (before detailed evaluation)
- [ ] H1: Is every async action's status visible? YES/NO
- [ ] H2: Are all labels in user language (not dev jargon)? YES/NO
- [ ] H3: Can the user undo or go back from any state? YES/NO
- [ ] H4: Are similar things styled consistently? YES/NO
- [ ] H5: Are error messages helpful and specific? YES/NO
- [ ] H7: Are there shortcuts for frequent actions? YES/NO
- [ ] H8: Is the interface free of unnecessary elements? YES/NO
- [ ] H10: Is help available where users might need it? YES/NO

### Gestalt check
- [ ] Proximity: Are related items grouped visually? YES/NO
- [ ] Similarity: Do similar items look the same? YES/NO
- [ ] Continuity: Does the eye flow naturally? YES/NO
- [ ] Figure-ground: Is content clearly separated from background? YES/NO

After completing the checklist, review the page holistically.
If anything feels wrong that the checklist didn't catch,
flag it and explain why.

## Parallelization

When reviewing multiple routes, dispatch all subagents in
a single Agent tool message — one per route. Each subagent
runs the full evaluation sequence below for its assigned
route. Never review routes one at a time.

## Evaluation sequence

### 1. First impression (5-second test)
For each route at desktop, answer:
- What is this page about?
- What is the primary action?
- What would I do next?

If any answer is unclear, that's a finding.

### 2. Visual composition
Walk the Visual Composition checklist from
design-and-a11y.md:
- Duplicate or redundant elements
- Alignment issues
- Navigation consistency
- Hierarchy and visual flow

### 3. Nielsen's heuristics (H1-H10)
Walk each heuristic against each route. For each
violation, note:
- Which heuristic (H1-H10)
- What specifically fails
- How it would manifest for a user
- Severity (cosmetic / minor / major / critical)

### 4. Gestalt principles
Evaluate grouping, similarity, continuity, and
figure-ground across all routes.

### 5. Interaction quality
Review touch targets, affordances, microcopy, and
form UX from screenshots and code.

### 6. Frustration signals
Walk the full frustration checklist from
ux-quality.md. For each signal found:
- What the user would experience
- How frequently this occurs
- How badly it would frustrate them (annoying /
  disruptive / rage-inducing)

### 7. Cross-route consistency
Compare all routes side by side:
- Do similar pages use similar patterns?
- Is terminology consistent?
- Do buttons, links, and cards look the same
  across pages?
- Does the header behave identically everywhere?

## Report structure

Return findings as a structured list with:
- Severity (critical / major / minor / pass)
- Category (heuristic number, gestalt principle,
  frustration signal, etc.)
- Route and breakpoint affected
- Description of what's wrong
- Why it would frustrate or confuse a user
- Suggested fix (brief)

Also return:
- Count of findings by severity
- Frustration assessment summary
- List of UX patterns that are working well
  (passes worth preserving)
