#!/bin/bash

# Setup script for Dependency License Checker hook
# Initializes directory structure and permissions

set -euo pipefail

echo "🚀 Setting up Dependency License Checker Hook..."

# Make all scripts executable
chmod +x "$(dirname "$0")"/*.sh

# Create logs directory
mkdir -p .copilot/logs/license-checker
echo "✅ Created .copilot/logs/license-checker/ directory"

# Check if .gitignore exists
if [[ -f .gitignore ]]; then
  if ! grep -q "^\.copilot/logs/$" .gitignore; then
    echo ".copilot/logs/" >> .gitignore
    echo "✅ Added .copilot/logs/ to .gitignore"
  else
    echo "ℹ️  .copilot/logs/ already in .gitignore"
  fi
else
  echo ".copilot/logs/" > .gitignore
  echo "✅ Created .gitignore with .copilot/logs/"
fi

# Verify hook configuration
if [[ -f .github/hooks/dependency-license-checker/hooks.json ]]; then
  echo "✅ Hook configuration found at .github/hooks/dependency-license-checker/hooks.json"
else
  echo "⚠️  Warning: hooks.json not found"
fi

echo "✅ Dependency License Checker Hook setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Commit these changes: git add .github/hooks/dependency-license-checker/ .gitignore"
echo "  2. Start a Copilot session to activate the hook"
echo "  3. View logs: tail -f .copilot/logs/license-checker/check.log"
