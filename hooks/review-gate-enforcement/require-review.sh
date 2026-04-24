#!/usr/bin/env bash
# PreToolUse hook — blocks PR creation / push if the review gate
# hasn't been run clean against the current working tree.
#
# The build skills write .orchestrator/last-review.json when
# code-review + code-simplify both return clean. This hook checks
# that the file exists and is newer than every staged/committed
# source file on the branch.
#
# Exit codes:
#   0 — allow the tool call
#   2 — block the tool call (Claude Code reports the message to
#       the model, which can then run the review and retry)

set -euo pipefail

# Read Claude Code hook payload on stdin
payload="$(cat)"

# Only care about Bash tool calls
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // empty')"
[[ "$tool_name" == "Bash" ]] || exit 0

cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"

# Only guard PR / push commands
case "$cmd" in
  *"gh pr create"*|*"git push"*) ;;
  *) exit 0 ;;
esac

cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty')"
[[ -n "$cwd" ]] || cwd="$PWD"

marker="$cwd/.orchestrator/last-review.json"

if [[ ! -f "$marker" ]]; then
  cat >&2 <<EOF
Review gate not satisfied — no .orchestrator/last-review.json found.

Run the review skills against your changes before opening a PR:
  - frontend-orchestration:code-review
  - frontend-orchestration:code-simplify

Both must return clean. The build skills write the marker file
automatically on a clean run. See standards/review-gate.md.
EOF
  exit 2
fi

# Marker must be newer than any tracked source file on this branch
newest_src="$(git -C "$cwd" diff --name-only origin/main...HEAD 2>/dev/null \
  | xargs -I{} stat -f '%m {}' "$cwd/{}" 2>/dev/null \
  | sort -rn | head -1 | awk '{print $1}')"

if [[ -n "$newest_src" ]]; then
  marker_mtime="$(stat -f '%m' "$marker")"
  if (( marker_mtime < newest_src )); then
    cat >&2 <<EOF
Review gate stale — .orchestrator/last-review.json is older than
your most recent code change. Re-run the review skills before
opening a PR.
EOF
    exit 2
  fi
fi

exit 0
