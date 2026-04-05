#!/bin/bash

# Setup script for Session Logger hook
# Initializes directory structure and permissions

set -euo pipefail

echo "🚀 Setting up Session Logger Hook..."

# Make all scripts executable
chmod +x "$(dirname "$0")"/*.sh

# Create logs directory
mkdir -p .copilot/logs
echo "✅ Created .copilot/logs/ directory"

# Check if .gitignore exists
if [[ -f .gitignore ]]; then
  # Add to .gitignore if not already present
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
if [[ -f .github/hooks/session-logger/hooks.json ]]; then
  echo "✅ Hook configuration found at .github/hooks/session-logger/hooks.json"
else
  echo "⚠️  Warning: hooks.json not found"
fi

echo "✅ Session Logger Hook setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Commit these changes: git add .github/hooks/session-logger/ .gitignore"
echo "  2. Start a Copilot session to begin logging"
echo "  3. View logs: tail -f .copilot/logs/session.log"
