#!/usr/bin/env bash
set -euo pipefail

echo "Installing frontend-orchestration plugin..."

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"

# Find workspace root — walk up until we find .claude/
WORKSPACE="$PLUGIN_DIR"
while [[ "$WORKSPACE" != "/" ]]; do
  if [[ "$(basename "$(dirname "$WORKSPACE")")" == ".claude" ]]; then
    WORKSPACE="$(dirname "$(dirname "$WORKSPACE")")"
    break
  fi
  WORKSPACE="$(dirname "$WORKSPACE")"
done

if [[ "$WORKSPACE" == "/" ]]; then
  echo "Error: Could not find workspace root. Is this plugin inside .claude/plugins/?"
  exit 1
fi

echo "  Workspace: $WORKSPACE"
echo "  Plugin: $PLUGIN_DIR"

# Install dependencies
cd "$PLUGIN_DIR"
echo "  runner..."
(cd runner && npm install --silent)
echo "  a11y-scanner..."
(cd mcp/a11y-scanner && npm install --silent)
echo "  screenshot-review..."
(cd mcp/screenshot-review && npm install --silent)

# Install Playwright browsers
echo "  Playwright browsers..."
npx --yes playwright install chromium --with-deps 2>/dev/null || npx --yes playwright install chromium

# Register commands with Claude Code
# Claude Code discovers slash commands from .claude/commands/, not from plugin directories.
# Symlink the plugin's commands directory so they show up as /session-start, /ui-interview, etc.
COMMANDS_DIR="$WORKSPACE/.claude/commands"
LINK_PATH="$COMMANDS_DIR/frontend-orchestration"

mkdir -p "$COMMANDS_DIR"

if [[ -L "$LINK_PATH" ]]; then
  echo "  Commands symlink already exists, updating..."
  rm "$LINK_PATH"
elif [[ -e "$LINK_PATH" ]]; then
  echo "  Warning: $LINK_PATH exists and is not a symlink. Skipping command registration."
  echo "  Remove it manually and re-run setup.sh to register commands."
  LINK_PATH=""
fi

if [[ -n "$LINK_PATH" ]]; then
  ln -s "$PLUGIN_DIR/commands" "$LINK_PATH"
  echo "  Commands registered at .claude/commands/frontend-orchestration/"
fi

echo ""
echo "Done. Next steps:"
echo "  1. Restart Claude Code (or start a new session)"
echo "  2. Create orchestrator.config.yaml in your project root (see README.md)"
echo "  3. Run /session-start to verify"
