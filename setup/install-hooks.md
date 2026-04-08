# Quality Gate Hooks — Install Guide

## What they do

Three hooks enforce that both quality gates run before any `git commit`:

- **SessionStart** — clears `/tmp/claude-commit-gates` at the start of each session
- **PostToolUse (Agent)** — stamps a gate file when `code-reviewer` or `code-simplifier` finishes
- **PreToolUse (Bash)** — blocks any `git commit` command if either gate file is missing

The commit is denied with a message naming whichever gates are outstanding.
Run `/simplify` and invoke the `code-reviewer` subagent to satisfy them.

## How to install

Merge the `hooks` object from `recommended-hooks.json` into your workspace
`.claude/settings.json`. If you already have a `hooks` key, merge each
event array rather than replacing the whole object.

## How to disable

Remove the `hooks` section (or the specific event entries) from
`.claude/settings.json`. The gate files in `/tmp/claude-commit-gates`
are harmless and will be cleaned up on the next session start.
