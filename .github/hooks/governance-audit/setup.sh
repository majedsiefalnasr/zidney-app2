#!/bin/bash

# Setup script for Governance Audit hook
# Initializes directory structure and permissions

set -euo pipefail

echo "🚀 Setting up Governance Audit Hook..."

# Make all scripts executable
chmod +x "$(dirname "$0")"/*.sh

# Create logs directory
mkdir -p .copilot/logs/governance
echo "✅ Created .copilot/logs/governance/ directory"

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
if [[ -f .github/hooks/governance-audit/hooks.json ]]; then
  echo "✅ Hook configuration found at .github/hooks/governance-audit/hooks.json"
else
  echo "⚠️  Warning: hooks.json not found"
fi

echo "✅ Governance Audit Hook setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Commit these changes: git add .github/hooks/governance-audit/ .gitignore"
echo "  2. Start a Copilot session to activate the hook"
echo "  3. View logs: tail -f .copilot/logs/governance/audit.log"
