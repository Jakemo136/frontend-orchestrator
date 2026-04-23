---
description: Dispatch the code-simplifier agent to clean up recently changed code
---

# /code-simplify

Dispatch the `code-simplifier:code-simplifier` agent against
all files changed since the last commit.

The agent simplifies code for clarity, consistency, and
maintainability while preserving all functionality. It focuses
on recently modified code unless instructed otherwise.

This command delegates entirely to the code-simplifier
plugin — see its agent definition for the full protocol.

Return success if simplification completed without breaking
tests. Return failure if unable to simplify without test
regressions.
