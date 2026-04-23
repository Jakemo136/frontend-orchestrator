---
description: Dispatch the superpowers code-reviewer agent against recently changed files
---

# /code-review

Dispatch the `superpowers:code-reviewer` agent against all
files changed since the last commit (or since the branch
diverged from main if no commits yet).

The agent reviews for:
- Correctness, security, and convention adherence
- Plan alignment (if a plan document exists)
- Test quality and coverage

This command delegates entirely to the superpowers
code-reviewer plugin — see its agent definition for the
full review protocol.

Return success if the reviewer reports zero Critical
issues. Return failure if any Critical issues are found.
