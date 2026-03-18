#!/usr/bin/env bash
#
# setup-act-local.sh - Configure act (GitHub Actions local runner) for Zidney
#
# This script helps you set up act to run CI workflows locally.
#
# Requirements:
#   - act installed (https://github.com/nektos/act)
#   - Docker running
#   - GitHub personal access token
#
# Usage:
#   bash scripts/ci/setup-act-local.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS_FILE="$SCRIPT_DIR/.secrets"
SECRETS_EXAMPLE="$SCRIPT_DIR/.secrets.example"

echo "═══════════════════════════════════════════════════════════════════════════"
echo "  Zidney act (Local GitHub Actions) Setup"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Check if act is installed
if ! command -v act &> /dev/null; then
  echo "❌ act is not installed. Please install it first:"
  echo ""
  echo "   macOS (Homebrew):"
  echo "   brew install act"
  echo ""
  echo "   Linux:"
  echo "   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | bash"
  echo ""
  exit 1
fi

echo "✅ act is installed: $(act --version)"
echo ""

# Check if Docker is running
if ! docker ps &> /dev/null; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if .secrets file exists
if [ ! -f "$SECRETS_FILE" ]; then
  echo "❌ .secrets file not found. Creating from template..."
  if [ -f "$SECRETS_EXAMPLE" ]; then
    cp "$SECRETS_EXAMPLE" "$SECRETS_FILE"
    echo "✅ Created .secrets from .secrets.example"
  else
    cat > "$SECRETS_FILE" << 'EOF'
# Local secrets for act (GitHub Actions local runner)
# This file is gitignored – NEVER commit it.

GITHUB_TOKEN=
EOF
    echo "✅ Created .secrets (minimal)"
  fi
  echo ""
fi

# Read current token
CURRENT_TOKEN=$(grep "^GITHUB_TOKEN=" "$SECRETS_FILE" | cut -d'=' -f2- || echo "")

if [ -z "$CURRENT_TOKEN" ] || [ "$CURRENT_TOKEN" = "your_github_personal_access_token_here" ]; then
  echo "❌ GitHub token is not configured."
  echo ""
  echo "To fix this:"
  echo "1. Visit: https://github.com/settings/tokens/new"
  echo "2. Generate new token (classic)"
  echo "3. Give it a name like 'zidney-act-local'"
  echo "4. Select scopes:"
  echo "   • repo (full control of private repositories)"
  echo "   • read:user"
  echo "   • user:email"
  echo "5. Generate and copy the token"
  echo "6. Edit .secrets and replace GITHUB_TOKEN value"
  echo ""
  echo "Then run this script again."
  exit 1
else
  echo "✅ GitHub token is configured (${#CURRENT_TOKEN} characters)"
  echo ""
fi

# Test act with a simple workflow
echo "Testing act configuration..."
echo ""

# Silently test by just listing workflows
if act -l &> /tmp/act-test.log; then
  echo "✅ act configuration is working!"
  echo ""
  WORKFLOWS=$(grep "^ID" /tmp/act-test.log | wc -l || echo "0")
  echo "Found $WORKFLOWS workflows:"
  grep "^  " /tmp/act-test.log | head -5 || true
  if [ "$WORKFLOWS" -gt 5 ]; then
    echo "  ... and $(($WORKFLOWS - 5)) more"
  fi
else
  echo "❌ act configuration test failed:"
  cat /tmp/act-test.log
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "  ✅ act is ready to use!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "Run CI locally with:"
echo "  bun run ci:local          # Fast mode (no new image pulls)"
echo "  bun run ci:local:full     # Full mode (pull fresh images)"
echo "  bun run ci:local:list     # List available workflows"
echo ""
echo "Or run specific workflow:"
echo "  act -j lint"
echo "  act -j typecheck"
echo "  act -W .github/workflows/hard-mode-guard.yml"
echo ""
