# Review Gate Enforcement Hook (opt-in)

A `PreToolUse` hook that blocks `gh pr create` and `git push`
until the review gate defined in `standards/review-gate.md`
has been run clean against the current working tree.

**This is opt-in.** It is not active by default for plugin
users. The build skills already include the review gate in
their protocols (soft enforcement). This hook adds hard
enforcement for teams who want the harness to refuse PRs
when the gate hasn't passed.

## How it works

1. The build skills write `.orchestrator/last-review.json`
   when `frontend-orchestration:code-review` and
   `frontend-orchestration:code-simplify` both return clean.
2. This hook intercepts `Bash` tool calls for `gh pr create`
   or `git push` and checks that the marker file exists and
   is newer than the most recent source file changed on the
   branch.
3. If the marker is missing or stale, the hook exits with
   code `2`, which Claude Code surfaces to the model as a
   blocking error with the stderr message. The model can
   then run the review skills and retry.

## Install

Add to your project's `.claude/settings.json` (or
`.claude/settings.local.json` for personal use):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/review-gate-enforcement/require-review.sh"
          }
        ]
      }
    ]
  }
}
```

If `$CLAUDE_PLUGIN_ROOT` isn't set in your environment,
substitute the absolute path to this plugin directory.

## Requirements

- `jq` on `$PATH` (used to parse the hook payload)
- `git` with a remote named `origin` and a `main` branch
- macOS `stat` (`-f` flag) — on Linux change to `stat -c '%Y'`

## Disabling per-run

If you need to push without passing the gate (hotfix, doc
commit, etc.), bypass the hook by running the command
yourself outside of Claude Code, or temporarily comment the
entry out of `settings.json`.

## Why this isn't shipped on by default

The plugin is used across many teams with different policies.
Forcing a blocking hook on everyone would surprise users who
just want to try the skills, and could block legitimate work
when the marker scheme doesn't fit a team's workflow. The
protocol edits in `commands/build-*.md` give every user the
intended behavior; this hook is for teams that want belt-
and-suspenders enforcement.
