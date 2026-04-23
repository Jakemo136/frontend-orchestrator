# Design & Accessibility Standards

## Conformance Target
All UI work must meet WCAG 2.2 AA minimum.
AAA is the target where achievable without significant tradeoff.

## Design Principles (priority order)
1. WCAG 2.2 AA — non-negotiable, tested on every component
2. Nielsen's 10 Heuristics — inform interaction patterns
3. Material Design — reference for spacing, elevation, motion
4. Apple HIG — inform interaction feedback, gesture patterns
5. Polaris/Atlassian — reference for SaaS-specific patterns

## Breakpoints
- mobile:     375px
- tablet:     768px
- desktop:    1280px
- lg-desktop: 1440px

All components must be reviewed and tested at every breakpoint.

## Design Audit Checklist

### Visual Composition (discovery-oriented)
- No duplicate or redundant page elements (e.g. a page
  rendering its own header inside a shared layout)
- Visual hierarchy is clear — primary, secondary, and
  tertiary content are visually distinct
- Related elements are aligned (baselines, edges, centers)
- Navigation is consistent across all routes
- Empty states are helpful, not blank
- Nothing looks unintentional, duplicated, or confusing
- Review as a first-time user, not as someone checking
  a list

### Spacing + Layout
- Design token scale exclusively — no magic numbers
- No layout shift sources (fixed heights on dynamic content)
- Responsive at all four breakpoints
- Content never overflows or clips at any breakpoint

### Interactive States
- hover, focus, active, disabled defined for every 
  interactive element
- Focus indicators meet 3:1 contrast ratio (WCAG 2.2)
- Keyboard navigation order is logical
- No focus traps except intentional ones (modals, drawers)

### Motion + Transitions
- Elements that appear/disappear have transitions
- Motion respects prefers-reduced-motion media query
- No layout-triggering animations (transform/opacity only)

### Color + Typography
- Text contrast minimum 4.5:1 (AA) — flag anything below
- Large text (18pt+) minimum 3:1
- Non-text UI elements minimum 3:1
- Color is never the sole means of conveying information
- Typography uses token scale — no hardcoded font sizes

### Accessibility
- ARIA roles and labels on all non-semantic elements
- Images have meaningful alt text or aria-hidden if decorative
- Form inputs have associated labels
- Error messages programmatically associated with inputs
- Live regions used for dynamic content updates
- Landmark regions present (main, nav, header, footer)

## Scope and Relationship to Other Standards

This document covers:
- WCAG 2.2 AA/AAA compliance (hard requirements)
- Visual composition (layout, alignment, hierarchy)
- Interactive states (hover, focus, active, disabled)
- Typography, spacing, and color tokens

It does NOT cover:
- User experience quality → see standards/ux-quality.md
- Task flow efficiency or discoverability → see ux-quality.md
- Gestalt principles → see ux-quality.md
- Frustration signals → see ux-quality.md

Used by: /design-audit command
