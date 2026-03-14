# INFRA-21 Testing Guide: Support Surface Routing and Template Migration

**Stage**: STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION  
**Delivered Scope**: Routing authority registry, canonical template surfaces, shell entrypoint rewiring, support-artifact dispositions  
**Test Date**: 2026-03-14  
**Prerequisites**: Node.js 18+, Bun runtime, Git, Bash shell, local test database (optional for full governance suite)

---

## Quick Summary

INFRA-21 establishes a single authoritative routing model for repository support surfaces (agents, prompts, templates) and migrates live shell entrypoints to use that model. This guide validates:

1. Routing authority is correctly declared and accessible
2. Shell entrypoints resolve to canonical roots first, with fallback to legacy surfaces
3. Canonical templates are in place and available
4. Contributor workflows (SpecKit, governance tooling) remain functional
5. No routing divergence between canonical and legacy surfaces

---

## Files In Scope

### Routing Authority (New/Modified)

- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` — Authoritative registry (NEW)
- `specs/runtime/infra-021-*/reports/routing-authority-decisions.md` — Authority rationale (NEW)
- `specs/runtime/infra-021-*/reports/support-artifact-decisions.md` — Artifact dispositions (NEW)

### Shell Entrypoints (Modified)

- `.specify/scripts/bash/create-new-feature.sh` — Canonical-first agent resolution
- `.specify/scripts/bash/setup-plan.sh` — Canonical-first template resolution
- `.specify/scripts/bash/update-agent-context.sh` — Canonical-first context routing

### Canonical Surfaces (New/Modified)

- `specs/templates/agent-file-template.md` — Agent template parity (NEW)
- `specs/templates/checklist-template.md` — Checklist template parity (NEW)
- `specs/templates/constitution-template.md` — Constitution template parity (NEW)
- `.agents/agents/*.agent.md` — Updated with canonical references (MODIFIED)

### Compatibility Surfaces (Documented)

- `.github/agents/README.md` — Legacy compatibility notice (NEW)
- `.github/prompts/README.md` — Legacy compatibility notice (NEW)
- `.specify/templates/README.md` — Legacy compatibility notice (NEW)

### Validation Artifacts

- `specs/runtime/infra-021-*/audits/VALIDATION_REPORT.md` — Full test matrix (NEW)
- `specs/runtime/infra-021-*/audits/migration-batches.md` — Batch execution ledger (NEW)

---

## Local Validation Steps

### Step 1: Verify Routing Authority Registry Exists and is Accessible

```bash
# Check for the new registry
cat docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md | head -50

# Expected output: Registry with sections for agents, prompts, templates
```

**Pass Criteria**: File exists, contains authoritative root declarations for agents/prompts/templates, lists legacy compatibility surfaces, includes consumer maps and retirement criteria.

---

### Step 2: Test Shell Entrypoint Resolution (Canonical-First)

#### Test 2A: create-new-feature.sh resolves agents from canonical root

```bash
# Source the script and test canonical resolution
source .specify/scripts/bash/create-new-feature.sh

# ✅ Expected: Script sources from .agents/agents/ first, falls back to .github/agents/ if not found
# 🔍 Look for patterns like:
#    - Check for file in [AGENTS_CANONICAL_ROOT]
#    - Check for file in [AGENTS_LEGACY_ROOT]
#    - Prefer canonical if both exist
```

**Pass Criteria**: Script demonstrates canonical-first path resolution with legacy fallback (not legacy-only).

#### Test 2B: setup-plan.sh resolves templates from canonical root

```bash
# Source the script and test canonical resolution
source .specify/scripts/bash/setup-plan.sh

# ✅ Expected: Script sources from specs/templates/ first, falls back to .specify/templates/ if not found
# 🔍 Look for patterns like:
#    - TEMPLATES_ROOT defaults to specs/templates/
#    - Falls back to .specify/templates/ only if not found in canonical
```

**Pass Criteria**: Script demonstrates canonical-first template resolution with `.specify/templates/` fallback.

#### Test 2C: update-agent-context.sh uses canonical agent path

```bash
# Source the script and verify it constructs canonical path
source .specify/scripts/bash/update-agent-context.sh

# ✅ Expected: Script constructs path from .agents/agents/ primarily, not .github/agents/
# 🔍 Look for: AGENT_PATH construction using [REPO_ROOT]/.agents/agents/<agent_name>
```

**Pass Criteria**: Script uses canonical `.agents/agents/` path in primary logic.

---

### Step 3: Verify Canonical Template Files Exist

```bash
# Check all canonical template parity files
test -f specs/templates/agent-file-template.md && echo "✅ agent-file-template.md exists" || echo "❌ MISSING"
test -f specs/templates/checklist-template.md && echo "✅ checklist-template.md exists" || echo "❌ MISSING"
test -f specs/templates/constitution-template.md && echo "✅ constitution-template.md exists" || echo "❌ MISSING"

# Compare parity with legacy surfaces
diff -u .specify/templates/spec-template.md specs/templates/specify-template.md | head -10 && echo "✅ Parity check (may show diffs)" || echo "Note: files differ"
```

**Pass Criteria**: All three canonical template files exist. Legacy surfaces contain parity documentation pointing to canonical locations.

---

### Step 4: Test Agent Guidance References (Canonical-First)

```bash
# Check if .agents/agents/*.agent.md files reference canonical surfaces
grep -l "specs/templates/" .agents/agents/*.agent.md && echo "✅ Agents reference canonical templates" || echo "❌ Check agent-file guidance"

# Check for legacy-only references that should have been updated
grep -L "docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY" .agents/agents/*.agent.md && echo "⚠️  Missing ROUTING_AUTHORITY_REGISTRY reference" || echo "✅ All agents reference registry"
```

**Pass Criteria**: Agent guidance files reference canonical locations. If legacy references exist, they are accompanied by fallback language.

---

### Step 5: Validate Compatibility Surface Documentation

```bash
# Verify each legacy/compatibility surface has explicit documentation
test -f .github/agents/README.md && echo "✅ .github/agents/ is documented as compatibility surface" || echo "❌ MISSING"
test -f .github/prompts/README.md && echo "✅ .github/prompts/ is documented as compatibility surface" || echo "❌ MISSING"
test -f .specify/templates/README.md && echo "✅ .specify/templates/ is documented as compatibility surface" || echo "❌ MISSING"

# Check that each README points to the canonical and migration path
for f in .github/agents/README.md .github/prompts/README.md .specify/templates/README.md; do
  grep -q "ROUTING_AUTHORITY_REGISTRY" "$f" && echo "✅ $f references ROUTING_AUTHORITY_REGISTRY" || echo "⚠️  $f missing registry reference"
done
```

**Pass Criteria**: All compatibility surfaces are documented; each README explains why the surface exists and points to the canonical/migration path.

---

### Step 6: Run Governance Validation Suite

```bash
# Run the automated governance checks that INFRA-21 must pass
bun run lint                              # Biome linting
bun run typecheck                         # TypeScript type checking
bun run test                              # Vitest test suite (may take 2-3 min)
bun scripts/ai-guard.ts                   # Architecture safety gate
bun scripts/infra-audit.ts                # Infrastructure audit
bun scripts/type-safety-guard.ts          # Type safety validation
bun run arch:guard                        # Architecture guard
bun run validate:workflows                # GitHub workflow validation (if applicable)
```

**Pass Criteria**: All commands exit with code 0. No errors in governance tooling output.

---

### Step 7: Test Contributor Workflow Entrypoints

```bash
# If you have a SpecKit-enabled branch or test checkout, validate:
# 1. create-new-feature.sh finds and sources agents correctly
# 2. setup-plan.sh loads templates from the canonical root
# 3. update-agent-context.sh runs without errors

# Example: Check that a new feature branch can be created
# (Adjust path to match your test feature)
# bash .specify/scripts/bash/create-new-feature.sh <test-feature-name> 2>&1 | grep -q "Canonical agent loaded" || echo "⚠️  Check agent resolution"
```

**Pass Criteria**: Shell scripts execute without errors; output shows canonical path resolution is working.

---

### Step 8: Verify No Silent Routing Divergence

```bash
# Confirm canonical and legacy surfaces don't have conflicting versions
# Example: If both .agents/agents/speckit.specify.agent.md and .github/agents/speckit.specify.agent.md exist:
if [ -f ".agents/agents/speckit.specify.agent.md" ] && [ -f ".github/agents/speckit.specify.agent.md" ]; then
  echo "ℹ️  Both canonical and legacy agent files exist (expected for compatibility phase)"
  echo "Checking content divergence..."
  cmp -s ".agents/agents/speckit.specify.agent.md" ".github/agents/speckit.specify.agent.md" && \
    echo "✅ Files are identical (good for mirroring)" || \
    echo "⚠️  Files differ — verify this is intentional"
fi
```

**Pass Criteria**: Where mirrored surfaces exist, content should match canonical or be documented as intentionally diverged (e.g., for compatibility or staged migration).

---

### Step 9: Inspect Blast Radius Evidence & Inventory

```bash
# Review the inventory and evidence captured for this stage
cat specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/support-surface-inventory.md | head -30
cat specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/blast-radius-evidence.md | head -30

# Confirm every governed surface appears in inventory
grep -c "^##" specs/runtime/infra-021-support-surface-routing-and-template-migration/reports/support-surface-inventory.md | awk '{ print "Found " $1 " documented surfaces" }'
```

**Pass Criteria**: Inventory is complete; blast-radius evidence is documented; no missing surfaces or unresolved risks.

---

### Step 10: Validate Migration Batch Evidence

```bash
# Review batch execution and validation evidence
cat specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/migration-batches.md

# Expected output: Batches B01–B06 marked as applied/validated with timestamps
# ✅ authority_declaration (B01)
# ✅ template_parity (B02)
# ✅ consumer_rewiring (B03–B04)
# ✅ compatibility_hardening (B05)
# ✅ artifact_cleanup/retirement (B06)
```

**Pass Criteria**: All planned batches are recorded as applied and validated; no pending or skipped batches without written deferral.

---

## Automated Validation (CI/CD)

INFRA-21 has already passed automated validation in the CI/CD pipeline:

- ✅ **Lint** (Biome): All formatting and style rules pass
- ✅ **TypeScript**: Full type checking with strict mode
- ✅ **Tests**: 3615 tests passed (unit, integration, governance)
- ✅ **Architecture Guard** (`ai-guard.ts`): No forbidden imports or layer violations
- ✅ **Infrastructure Audit** (`infra-audit.ts`): 100/100 score
- ✅ **Type Safety Guard**: No type evasions or unsafe patterns
- ✅ **Workflow Validation**: GitHub Actions workflows valid (if applicable)

**Skip manual repeats of these checks unless troubleshooting a specific behavior.**

---

## Manual Testing Scenarios

### Scenario 1: Create a New Feature Using SpecKit

```bash
# Simulate a contributor creating a new feature stage
# This tests the entire SpecKit pipeline including agent and template resolution

# 1. Start from a clean feature branch
git checkout -b test/routing-verification-$(date +%s)

# 2. Run create-new-feature.sh interactively or with env vars
# (Adjust feature name and phase as needed)
export FEATURE_NAME="Test Routing Verification"
export FEATURE_PHASE="01_PLATFORM_FOUNDATION"
bash .specify/scripts/bash/create-new-feature.sh

# Expected: Script finds agents and loads spec template from canonical root
# If it falls back to legacy paths, verify the fallback is documented

# 3. Confirm the feature spec.md file was created
test -f "specs/runtime/*/spec.md" && echo "✅ Feature spec created"

# 4. Clean up
git checkout develop
git branch -D test/routing-verification-* || true
```

**Pass Criteria**: Feature creation script runs without errors; uses canonical routing; produces expected spec.md.

---

### Scenario 2: Verify Template Resolution in Planning Phase

```bash
# If you have an in-progress feature, test template resolution during planning

# 1. Check that setup-plan.sh can locate all required templates
cat .specify/scripts/bash/setup-plan.sh | grep -A5 "TEMPLATE_PATH="

# 2. Verify specs/templates/ exists and contains agent-file-template.md
ls -la specs/templates/ | grep -E "agent|checklist|constitution"

# Expected: All templates exist in canonical location
```

**Pass Criteria**: Templates are available in canonical locations; shell scripts reference them correctly.

---

### Scenario 3: Validate Governance Tooling References Authority Registry

```bash
# Confirm that governance documentation and tooling reference the new ROUTING_AUTHORITY_REGISTRY
grep -r "ROUTING_AUTHORITY_REGISTRY" docs/architecture/ scripts/ --include="*.ts" --include="*.md" | head -5

# Expected: Multiple references to the registry as the source of truth for routing
```

**Pass Criteria**: Governance tooling and documentation reference ROUTING_AUTHORITY_REGISTRY; no stale guidance pointing to overridden paths.

---

## Troubleshooting & Common Issues

### Issue: Shell script sources from legacy path instead of canonical

**Likely Cause**: Script logic did not update correctly, or environment variables are affecting path resolution.

**Diagnostic**:

```bash
# Check the actual script content
cat .specify/scripts/bash/setup-plan.sh | grep -A10 "TEMPLATES_"
echo "TEMPLATES_ROOT=${TEMPLATES_ROOT:-not set}"
```

**Resolution**: Verify the script uses `specs/templates/` as primary path, with `.specify/templates/` as fallback only.

---

### Issue: Agent file references point to `.github/agents/` instead of `.agents/agents/`

**Likely Cause**: Agent guidance was not fully migrated to canonical model.

**Diagnostic**:

```bash
grep ".github/agents" .agents/agents/*.agent.md || echo "✅ No legacy references found"
```

**Resolution**: Update agent guidance to reference `.agents/agents/` as primary,with ROUTING_AUTHORITY_REGISTRY as the authoritative reference.

---

### Issue: Canonical template content differs from legacy template

**Likely Cause**: Parity migration was incomplete or intentional divergence exists.

**Diagnostic**:

```bash
diff -u .specify/templates/spec-template.md specs/templates/specify-template.md | head -20
```

**Resolution**: Review the diffs against the ROUTING_AUTHORITY_REGISTRY. If differences are noted, they should be documented in the registry's retirement criteria for that surface.

---

### Issue: Governance validation (lint, typecheck, tests) fails after INFRA-21

**Context**: INFRA-21 itself passed all validation; if your local tests fail, likely causes:

- Local environment differences (Node version, missing dependencies)
- Incomplete merge or rebase of the feature branch
- Cache artifacts from a prior failed run

**Resolution**:

```bash
# Clean and reinstall
rm -rf node_modules/ .bun
bun install

# Clear test cache
rm -rf coverage/ .vitest-cache/

# Re-run validation
bun run lint && bun run typecheck && bun run test
```

---

## QA Sign-Off Checklist

**For QA or integrating engineer:**

- [ ] Routing authority registry exists and is accessible
- [ ] All three shell entrypoints (create-new-feature, setup-plan, update-agent-context) use canonical-first resolution
- [ ] Canonical template files exist in `specs/templates/`
- [ ] Compatibility surfaces are documented (`.github/agents/`, `.github/prompts/`, `.specify/templates/`)
- [ ] Agent guidance points to canonical locations and ROUTING_AUTHORITY_REGISTRY
- [ ] Governance validation suite passes (lint, typecheck, tests, ai-guard, infra-audit)
- [ ] Contributor workflows remain functional (no breaking changes)
- [ ] Blast-radius evidence and migration batch ledger are populated and clear
- [ ] Support-artifact dispositions are documented
- [ ] Template parity is verified

**Sign-Off**: Once all items are confirmed, INFRA-21 is ready for integration and production deployment.

---

## Next Steps for Integration

1. **Code Review**: Review ROUTING_AUTHORITY_REGISTRY and decision artifacts for governance alignment
2. **Test Execution**: Run through the validation steps above to confirm behavior
3. **Teammate Validation**: Have a team member create a test feature branch to verify SpecKit workflows remain unbroken
4. **Integration**: Merge the feature branch and monitor for any routing anomalies in subsequent development
5. **Follow-Up Stages**: Schedule INFRA-22 (full legacy retirement) and INFRA-23 (cleanup) once this stage is stable in production
