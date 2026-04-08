---
description: Summarize build state from requirements and component inventory, suggest next step
---

# /review-requirements

Read /docs/UI_REQUIREMENTS.md and /docs/COMPONENT_INVENTORY.md
and produce a summary:

- Components complete vs remaining (from Build status fields)
- E2E test status from /docs/BUILD_STATUS.md if it exists
- Open questions flagged in UI_REQUIREMENTS.md
- Suggested next component to build based on dependency order
- Any components whose dependencies are now complete and
  are therefore unblocked
