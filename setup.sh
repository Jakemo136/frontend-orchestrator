#!/usr/bin/env bash
set -euo pipefail

echo "Installing frontend-orchestration plugin..."

cd "$(dirname "$0")"

# Install dependencies
echo "  runner..."
(cd runner && npm install --silent)
echo "  a11y-scanner..."
(cd mcp/a11y-scanner && npm install --silent)
echo "  screenshot-review..."
(cd mcp/screenshot-review && npm install --silent)

# Install Playwright browsers
echo "  Playwright browsers..."
npx --yes playwright install chromium --with-deps 2>/dev/null || npx --yes playwright install chromium

echo ""
echo "Done. To set up a project, create orchestrator.config.yaml in your project root."
echo "See README.md for a minimal config example."
