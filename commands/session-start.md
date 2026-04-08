---
description: Reorient at the start of a new frontend session — reads project docs and produces a status briefing, or starts the interview if this is a fresh project
---

# /session-start

1. Read ~/.claude/CLAUDE.md
2. Read project-level CLAUDE.md if it exists
3. Check if /docs/UI_REQUIREMENTS.md exists

**If UI_REQUIREMENTS.md does NOT exist** (fresh project):
Begin /ui-interview immediately without asking.

**If UI_REQUIREMENTS.md exists** (returning session):
Continue reading:
4. Read /docs/UI_REQUIREMENTS.md
5. Read /docs/COMPONENT_INVENTORY.md if it exists
6. Read /docs/BUILD_STATUS.md if it exists

Produce a concise briefing with:
- Project name and stack
- Last work and current completion status (from BUILD_STATUS.md)
- What's next based on dependency order
- Open questions or blockers
- Suggested first action
