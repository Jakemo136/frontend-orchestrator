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
  echo "Error: Could not find workspace root."
  echo "Expected structure: /path/to/workspace/.claude/plugins/frontend-orchestration/"
  echo "Found plugin at: $PLUGIN_DIR"
  echo "Parent directory: $(dirname "$PLUGIN_DIR")"
  echo ""
  echo "Make sure this plugin is installed inside a .claude/plugins/ directory."
  exit 1
fi

echo "  Workspace: $WORKSPACE"
echo "  Plugin: $PLUGIN_DIR"

# Install dependencies
cd "$PLUGIN_DIR"
echo "  runner..."
(cd runner && npm install --silent)
echo "  a11y-scanner..."
(cd mcp/a11y-scanner && npm ci --silent 2>/dev/null || npm install --silent)
echo "  screenshot-review..."
(cd mcp/screenshot-review && npm ci --silent 2>/dev/null || npm install --silent)

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

# Install quality gate hooks (optional, with confirmation)
SETTINGS_FILE="$WORKSPACE/.claude/settings.json"
HOOKS_SOURCE="$PLUGIN_DIR/setup/recommended-hooks.json"

echo ""
echo "  Quality gate hooks enforce code-review and code-simplify"
echo "  before every git commit. Recommended for full pipeline use."

if [[ -f "$SETTINGS_FILE" ]]; then
  if grep -q '"hooks"' "$SETTINGS_FILE" 2>/dev/null; then
    echo "  ⚠ .claude/settings.json already has hooks configured."
    echo "  Skipping hook installation to avoid clobbering."
    echo "  See setup/install-hooks.md to merge manually."
  else
    echo -n "  Install quality gate hooks? [y/N] "
    read -r INSTALL_HOOKS
    if [[ "$INSTALL_HOOKS" =~ ^[Yy]$ ]]; then
      if command -v jq &>/dev/null; then
        jq -s '.[0] * {"hooks": .[1].hooks}' "$SETTINGS_FILE" "$HOOKS_SOURCE" > "${SETTINGS_FILE}.tmp" \
          && mv "${SETTINGS_FILE}.tmp" "$SETTINGS_FILE"
        echo "  ✓ Hooks installed into .claude/settings.json"
      elif command -v python3 &>/dev/null; then
        python3 -c "
import json, sys
with open('$SETTINGS_FILE') as f: settings = json.load(f)
with open('$HOOKS_SOURCE') as f: hooks = json.load(f)
settings['hooks'] = hooks['hooks']
with open('$SETTINGS_FILE', 'w') as f: json.dump(settings, f, indent=2)
print('  ✓ Hooks installed into .claude/settings.json')
"
      else
        echo "  ✗ Neither jq nor python3 found. Install hooks manually."
        echo "  See setup/install-hooks.md for instructions."
      fi
    else
      echo "  Skipped. Run later with: see setup/install-hooks.md"
    fi
  fi
else
  echo -n "  Install quality gate hooks? [y/N] "
  read -r INSTALL_HOOKS
  if [[ "$INSTALL_HOOKS" =~ ^[Yy]$ ]]; then
    mkdir -p "$(dirname "$SETTINGS_FILE")"
    if command -v jq &>/dev/null; then
      jq '{hooks: .hooks}' "$HOOKS_SOURCE" > "$SETTINGS_FILE"
    else
      python3 -c "
import json
with open('$HOOKS_SOURCE') as f: hooks = json.load(f)
with open('$SETTINGS_FILE', 'w') as f: json.dump({'hooks': hooks['hooks']}, f, indent=2)
" 2>/dev/null || echo '{"hooks":{}}' > "$SETTINGS_FILE"
    fi
    echo "  ✓ Hooks installed into .claude/settings.json"
  else
    echo "  Skipped. Run later with: see setup/install-hooks.md"
  fi
fi

echo ""
echo "Done. Next steps:"
echo "  1. Restart Claude Code (or start a new session)"
echo "  2. Create orchestrator.config.yaml in your project root (see README.md)"
echo "  3. Run /session-start to verify"
