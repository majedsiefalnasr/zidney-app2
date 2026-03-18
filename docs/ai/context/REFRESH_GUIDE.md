# Artifact Refresh Guide: AI Context Layer

**Created:** 2026-03-09  
**Version:** 1.0.0

---

## Overview

This guide provides operational procedures for keeping AI context artifacts fresh and
troubleshooting regeneration issues.

---

## Freshness Standards

### Artifact Considered Fresh If

- ✅ Generated within last 24 hours
- ✅ Source metadata matches current state
- ✅ All 7 artifacts present
- ✅ Schema version matches 1.0.0

### Artifact Considered Stale If

- ❌ Generated > 24 hours ago
- ❌ Source files changed since last generation
- ❌ Missing any of 7 artifacts
- ❌ Schema version mismatch

---

## Automatic Regeneration

### Pre-Commit Hook

Artifacts regenerate automatically before every commit:

```bash
# This happens automatically via Husky
# File: .husky/pre-commit
bun run generate:ai-context
```

**Behavior:**

- Detects source changes
- Skips if nothing changed
- Force regenerates if --no-verify used
- Stages artifacts with commit

### CI/CD Pipeline

GitHub Actions validates artifacts on every push:

```yaml
# File: .github/workflows/ai-context-validation.yml
jobs:
  validate-ai-context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun run generate:ai-context --validate
```

**Behavior:**

- Runs on all pushes
- Validates against schemas
- Fails if validation errors
- Reports metrics

---

## Manual Regeneration

### Quick Refresh

```bash
# Regenerate if sources changed (smart mode)
bun run generate:ai-context
```

### Force Regeneration

```bash
# Always regenerate, regardless of change status
bun run generate:ai-context --force
```

### Regenerate with Validation

```bash
# Generate AND validate immediately after
bun run generate:ai-context --validate
```

### Verbose Output

```bash
# Show detailed progress and logging
bun run generate:ai-context --verbose

# Combine options
bun run generate:ai-context --force --validate --verbose
```

---

## Freshness Validation

### Check Artifact Timestamps

```bash
# View generation timestamps
jq .generated_at docs/ai/context/ai-*.json

# Example output
"2026-03-09T15:42:30.123Z"  # ai-module-map.json
"2026-03-09T15:42:30.456Z"  # ai-layer-model.json
```

### Check Source Metadata

```bash
# View source hash and timestamp
jq .source_metadata docs/ai/context/ai-module-map.json

# Example
{
  "module_boundaries_hash": "abc123...",
  "audit_timestamp": "2026-03-09T15:42:00Z"
}
```

### Validate Against Schemas

```bash
# Validate all artifacts
bun run generate:ai-context --validate

# Manual JSON schema validation
jq -s '.[0] | keys' docs/ai/context/schemas/ai-module-map.schema.json
```

### Check File Sizes

```bash
# Display artifact sizes
ls -lh docs/ai/context/ai-*.json docs/ai/context/ai-*.md

# Get total size
du -sh docs/ai/context/
```

---

## Troubleshooting Refresh Issues

### Issue: "Artifacts seem stale but won't regenerate"

**Diagnosis:**

```bash
# Check if change detection cache is working
ls -la .ai-context-cache/

# View cached hash
cat .ai-context-cache/source-hash.json | jq .
```

**Solution:**

```bash
# Force regeneration and reset cache
bun run generate:ai-context --force

# Or manually reset cache
rm -rf .ai-context-cache/
bun run generate:ai-context
```

### Issue: "Regeneration fails with 'sources changed' error"

**Diagnosis:**

```bash
# Check for parse errors in source files
jq . docs/architecture/module-boundaries.json

# Check if ADR directory is readable
ls -la docs/architecture/ADR/ | head -5

# Check app/package structure
ls -la apps/
ls -la packages/
```

**Solution:**

1. Verify `module-boundaries.json` is valid JSON
2. Ensure `docs/architecture/ADR/` contains .md files
3. Ensure all modules have `package.json`

### Issue: "Generation runs but validation fails"

**Diagnosis:**

```bash
# Run with validation to see errors
bun run generate:ai-context --validate

# Check specific artifact
jq . docs/ai/context/ai-module-map.json | head -20

# Validate individual schemas
jq . docs/ai/context/schemas/ai-module-map.schema.json
```

**Solution:**

```bash
# Regenerate with strict validation
bun run generate:ai-context --force --validate

# If specific artifact fails, check its content
# File: scripts/ai-context/artifact-builders/[builder-name].ts
```

### Issue: "Pre-commit hook prevents commit of unrefreshed artifacts"

**Diagnosis:**

```bash
# See what the hook detected
git diff --staged docs/ai/context/

# Check git status
git status
```

**Solution:**

```bash
# Regenerate artifacts
bun run generate:ai-context

# Stage the new artifacts
git add docs/ai/context/

# Retry commit
git commit -m "message"

# Or bypass hook (not recommended)
git commit --no-verify -m "message"
```

### Issue: "CI fails with 'artifacts don't match expected state'"

**Diagnosis:**

```bash
# Reproduce CI locally
bun run generate:ai-context --validate

# Check CI logs for specific errors
# In GitHub: Actions → [workflow name] → [run] → Logs
```

**Solution:**

```bash
# Generate locally and commit
bun run generate:ai-context --validate

# Push updated artifacts
git add docs/ai/context/
git commit -m "Refresh AI context artifacts"
git push

# Or rerun CI once artifacts are committed
```

---

## Monitoring Artifact Health

### Create a monitoring script

```bash
#!/bin/bash
# File: scripts/check-ai-context-freshness.sh

ARTIFACT_DIR="docs/ai/context"
THRESHOLD_HOURS=24

echo "🔍 Checking AI Context Freshness"
echo "================================"

for file in "$ARTIFACT_DIR"/ai-*.json; do
  if [ -f "$file" ]; then
    MTIME=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file")
    NOW=$(date +%s)
    AGE_SECONDS=$((NOW - MTIME))
    AGE_HOURS=$((AGE_SECONDS / 3600))

    if [ $AGE_HOURS -gt $THRESHOLD_HOURS ]; then
      echo "⚠️  STALE: $(basename $file) ($AGE_HOURS hours old)"
    else
      echo "✓ FRESH: $(basename $file) ($AGE_HOURS hours old)"
    fi
  fi
done

# Recommend action
echo ""
if [ $AGE_HOURS -gt $THRESHOLD_HOURS ]; then
  echo "💡 Recommendation: Run 'bun run generate:ai-context --force'"
fi
```

Run regularly:

```bash
# Manual check
bash scripts/check-ai-context-freshness.sh

# Scheduled check (cron, GitHub Actions, etc.)
# 0 9 * * 1 cd /path/to/repo && bash scripts/check-ai-context-freshness.sh
```

---

## Integration with Operations

### Adding to Health Checks

```yaml
# Pseudo-code for operations dashboard
health_checks:
  ai_context_freshness:
    command: "jq .generated_at docs/ai/context/ai-module-map.json"
    expected: "within 24 hours"
    alert_if: "stale"
```

### Adding to Runbooks

````markdown
# [Runbook] AI Context Artifacts Stale

## Symptoms

- AI tooling suggestions become inaccurate
- Architecture violations not detected
- Artifacts not updated synchronously

## Root Cause

- Pre-commit hook not running
- CI pipeline disabled
- Source files changed without regeneration

## Resolution

1. Regenerate artifacts
   ```bash
   bun run generate:ai-context --force --validate
   ```
````

2. Commit changes

   ```bash
   git add docs/ai/context/
   git commit -m "Refresh AI artifacts per runbook"
   ```

3. Verify CI passes
   - Check GitHub Actions workflow

4. Validate tooling loads new artifacts
   - Test GitNexus with new dependency-graph
   - Test ai-guard with new architecture-brain

## Prevention

- Ensure Husky pre-commit hooks are installed: `husky install`
- Run CI pipeline on all pushes (GitHub Actions enabled)

````

---

## Success Criteria

✅ All 7 artifacts present in `docs/ai/context/`
✅ Timestamps current (within 24 hours)
✅ All JSON validates against schemas
✅ Schema version is "1.0.0"
✅ Source metadata populated
✅ Generation time < 5 seconds
✅ Total size < 15 MB

---

## Related Commands

```bash
# Common operations
bun run generate:ai-context              # Standard refresh
bun run generate:ai-context --force      # Force refresh
bun run generate:ai-context --validate   # Refresh + validate
bun run generate:ai-context --verbose    # Detailed output

# Inspecting artifacts
jq . docs/ai/context/ai-module-map.json
jq .modules docs/ai/context/ai-module-map.json | head -10
jq .violations docs/ai/context/ai-dependency-graph.json

# Finding artifacts
find docs/ai/context -name "ai-*.json" -ls
ls -lh docs/ai/context/

# Checking git status
git status docs/ai/context/
git diff docs/ai/context/
````

---

## Support

For operational issues with artifact freshness:

1. Run diagnostic script: `bash scripts/check-ai-context-freshness.sh`
2. Attempt manual refresh: `bun run generate:ai-context --force --validate`
3. Check logs: `bun run generate:ai-context --verbose`
4. Review: `specs/runtime/infra-009-ai-architecture-context/`
5. Contact: Architecture team / DevOps
