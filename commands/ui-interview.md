---
description: Conduct an interactive UI requirements interview to produce UI_REQUIREMENTS.md and COMPONENT_INVENTORY.md
---

# /ui-interview

Conduct an interactive UI requirements interview with the user.

Protocol:
- Ask questions one section at a time, 3-4 questions max per message
- Wait for answers before proceeding to the next section
- Never ask all questions at once

Sections in order:
1. Pages and routes
   - What pages exist in the app?
   - What does a logged-out vs logged-in user see?
   - What is the landing page after login?

2. Per page (repeat for each page identified)
   - What is the primary purpose of this page?
   - What data does it display?
   - What actions can the user take?
   - What are the empty, loading, and error states?
   - Any modals, drawers, or overlays?

3. Navigation and layout
   - Global nav structure
   - Mobile vs desktop considerations
   - Any persistent UI (sidebars, headers, toasts)?

4. Key interactions
   - File upload flow — step by step from user perspective
   - Sharing flow
   - Comparison flow — how does the user select items to compare?
   - Any confirmation dialogs?

5. Visual and UX preferences
   - Any reference apps or designs to emulate?
   - Data density preference — compact or spacious?
   - Any strong opinions on specific UI patterns?

On completion, produce:

/docs/UI_REQUIREMENTS.md
  - Full page inventory with routes
  - Per-page component breakdown
  - Data requirements per component (GraphQL query/mutation)
  - All loading/error/empty states
  - Full user flow narratives for all key interactions
  - Open questions flagged for review

/docs/COMPONENT_INVENTORY.md
  One entry per component in this exact format:

  ## [ComponentName]
  - Page: [page name or "shared"]
  - Dependencies: [list of other components, or "none"]
  - GraphQL: [query or mutation name, or "none"]
  - Complexity: [low / medium / high]
  - Build status: [ ] not started

Do not build components until the user has reviewed and
approved both documents.
