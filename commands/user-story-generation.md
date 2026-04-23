---
description: Generate PM-voice user stories with data flow annotations for all interactive flows
---

# /user-story-generation

Generate docs/USER_STORIES.md with PM-voice interaction
sequences for every form, modal, and multi-step flow
found in UI_REQUIREMENTS.md and COMPONENT_INVENTORY.md.

For each interactive flow:

1. **User story** — "As a [role], I [action] so that
   [outcome]" followed by step-by-step interaction
   sequence in plain language
2. **Data flow annotation** — trace the prop/data chain
   across component boundaries for each step:
   - Which component owns the state?
   - How does the event propagate? (callback props,
     context, store)
   - What API calls fire and when?
   - What loading/error/empty states does the user see?

Coverage requirements:
- Every form in the inventory
- Every modal in the inventory
- Every multi-step flow (wizard, checkout, onboarding)
- Every CRUD operation

Write the output to docs/USER_STORIES.md.

Return success with the path to USER_STORIES.md as an
artifact. Return failure if source docs are missing or
coverage is incomplete.
