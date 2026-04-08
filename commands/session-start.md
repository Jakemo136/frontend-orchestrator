---
description: Reorient at the start of a new frontend session — reads project docs and produces a status briefing
---

# /session-start

Reorient at the start of a new session.

1. Read ~/.claude/CLAUDE.md
2. Read project-level CLAUDE.md if it exists
3. Read /docs/UI_REQUIREMENTS.md if it exists
4. Read /docs/COMPONENT_INVENTORY.md if it exists
5. Read /docs/BUILD_STATUS.md if it exists

Produce a concise session briefing:
- Project name and stack
- What was last worked on (from BUILD_STATUS.md)
- What is complete
- What is next based on dependency order
- Any open questions or blockers
- Suggested first action for this session
