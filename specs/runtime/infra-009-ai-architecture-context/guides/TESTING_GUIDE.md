# Testing Guide: AI Architecture Context Layer

**Stage:** STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT  
**Phase:** PHASE_01_PLATFORM_FOUNDATION  
**Date:** March 10, 2026  
**Audience:** QA Engineers, Developers, Integration Teams

---

## Overview

This guide provides comprehensive testing procedures for the AI Architecture Context Layer — a
system that generates machine-readable artifacts describing Zidney's architecture for consumption by
AI agents (Copilot, GitNexus, SpecKit, Claude).

**Testing Scope:**

- 7 machine-readable artifacts (JSON + Markdown)
- Artifact generation correctness
- AI tool integration
- Performance constraints
- Constitutional compliance
- Change detection accuracy

---

## Test Environment Setup

### Prerequisites

```bash
# Install dependencies (if not already done)
bun install

# Verify Node version
node --version  # v18.0.0 or higher

# Verify Bun installation
bun --version   # v1.0.0 or higher
```

### Running Tests

#### Full Test Suite

```bash
# Run all AI context tests
bun run test -- tests/validation/ai-context-*.test.ts

# Expected output:
# ✅ AI Context Generation (24 tests) — PASS
# ✅ Artifact Schema Validation (12 tests) — PASS
# ✅ Integration Tests (8 tests) — PASS
# ✅ Performance Benchmarks (4 tests) — PASS
# Total: 52 tests, 0 failures
```

#### Individual Test Suites

```bash
# Unit tests only
bun run test -- tests/validation/

# Integration tests only
bun run test -- tests/integration/ai-context-integration.test.ts

# Performance benchmarks only
bun run test -- tests/performance/ai-context-performance.test.ts
```

#### Watch Mode (for development)

```bash
# Watch tests and re-run on file changes
bun run test -- tests/validation/ai-context-*.test.ts --watch
```

---

## Manual Testing Procedures

### Test 1: Artifact Generation

**Objective:** Verify all 7 artifacts are generated correctly with valid structure.

**Steps:**

1. **Clean generation environment:**

   ```bash
   rm -rf docs/ai/context/*.json docs/ai/context/*.md
   ```

2. **Run artifact generation:**

   ```bash
   bun run ai:context:generate
   ```

3. **Verify all 7 artifacts exist:**

   ```bash
   ls -lh docs/ai/context/ | grep -E "\.(json|md)$"
   ```

   **Expected output:**

   ```
   -rw-r--r--  ai-architecture-summary.md        (10 KB)
   -rw-r--r--  ai-module-map.json                (5 KB)
   -rw-r--r--  ai-layer-model.json               (3 KB)
   -rw-r--r--  ai-dependency-graph.json          (20 KB)
   -rw-r--r--  ai-runtime-map.json               (2 KB)
   -rw-r--r--  ai-architecture-brain.json        (50 KB)
   -rw-r--r--  ai-context-mini.json              (100 KB)
   ```

4. **Verify artifact syntax:**

   ```bash
   # Check JSON validity
   jq . docs/ai/context/ai-module-map.json > /dev/null && echo "✅ JSON valid"
   jq . docs/ai/context/ai-dependency-graph.json > /dev/null && echo "✅ JSON valid"
   jq . docs/ai/context/ai-architecture-brain.json > /dev/null && echo "✅ JSON valid"
   jq . docs/ai/context/ai-context-mini.json > /dev/null && echo "✅ JSON valid"
   ```

5. **Verify Markdown artifacts:**
   ```bash
   file docs/ai/context/ai-architecture-summary.md | grep -i "markdown\|text"
   ```

**Expected Result:** ✅ All 7 artifacts present with valid syntax

---

### Test 2: Schema Validation

**Objective:** Verify all artifacts conform to defined JSON schemas.

**Steps:**

1. **Run schema validation test:**

   ```bash
   bun run test -- tests/validation/artifact-schema-validation.test.ts
   ```

   **Expected output:**

   ```
   ✅ ai-module-map matches schema
   ✅ ai-layer-model matches schema
   ✅ ai-dependency-graph matches schema
   ✅ ai-runtime-map matches schema
   ✅ ai-architecture-brain matches schema
   ✅ ai-context-mini matches schema
   ✅ ai-architecture-summary (Markdown) is valid
   ```

2. **Manual schema verification (if needed):**

   ```bash
   # Check module-map structure
   jq '.modules | length' docs/ai/context/ai-module-map.json
   # Should output: number > 40 (expected ~52 modules)

   # Check dependency-graph structure
   jq '.edges | length' docs/ai/context/ai-dependency-graph.json
   # Should output: number > 300 (expected ~356 edges)

   # Check brain structure
   jq 'keys' docs/ai/context/ai-architecture-brain.json | grep -E "layers|modules|dependencies|governance"
   ```

**Expected Result:** ✅ All artifacts pass schema validation

---

### Test 3: AI Tool Integration

**Objective:** Verify artifacts can be loaded and consumed by all 4 supported AI tools.

#### Test 3A: Copilot Integration

**Steps:**

1. **Start VS Code with Copilot enabled:**

   ```bash
   code . &
   ```

2. **In Copilot chat, paste this prompt:**

   ```
   Load the architecture context from docs/ai/context/ai-context-mini.json
   and describe the 4 architectural layers for me.
   ```

3. **Verify Copilot response:**
   - Should describe: UI Layer, API Layer, Domain Packages, Worker
   - Should mention: isolation rules, dependency constraints
   - Should NOT contain fabricated information

**Expected Result:** ✅ Copilot loads and correctly interprets architecture

#### Test 3B: GitNexus Integration

**Steps:**

1. **GitNexus is MCP-based; verify context availability:**

   ```bash
   # Check GitNexus can access context files
   ls -la docs/ai/context/ai-dependency-graph.json
   ```

2. **Run GitNexus impact analysis (requires active GitNexus server):**

   ```bash
   gitnexus context zidney-app2 -- impact --symbol "MyFunction" --direction upstream
   ```

3. **Verify output includes dependency context:**
   - Should reference modules from ai-dependency-graph.json
   - Should identify blast radius accurately
   - Should use architecture rules from ai-layer-model.json

**Expected Result:** ✅ GitNexus uses context for accurate analysis

#### Test 3C: SpecKit Integration

**Steps:**

1. **Start SpecKit in current stage:**

   ```bash
   cd specs/runtime/infra-009-ai-architecture-context
   npm run speckit:verify (or equivalent)
   ```

2. **Verify SpecKit loads architecture context:**
   - Check logs for "Loading architecture context from docs/ai/context/"
   - Should validate tasks against architectural layers

**Expected Result:** ✅ SpecKit successfully loads and validates against context

#### Test 3D: Claude Integration

**Steps:**

1. **In Claude (claude.ai or API), use this prompt:**

   ```
   Load JSON file: docs/ai/context/ai-module-map.json
   Show me which packages belong to the domain layer.
   ```

2. **Verify Claude response:**
   - Should correctly identify domain packages
   - Should use actual data from ai-module-map.json
   - Should NOT confabulate module names

**Expected Result:** ✅ Claude correctly interprets artifact data

---

### Test 4: Change Detection

**Objective:** Verify the system correctly detects when regeneration is needed.

**Steps:**

1. **Record baseline hash:**

   ```bash
   shasum -a 256 docs/architecture/adr/*.md | head -1 > /tmp/baseline_adr_hash.txt
   cat /tmp/baseline_adr_hash.txt
   ```

2. **Run artifact generation (should be fast — fresh):**

   ```bash
   time bun run ai:context:generate
   # Expected: <1 second (no regeneration)
   ```

3. **Modify an ADR file:**

   ```bash
   echo "# Test modification" >> docs/architecture/adr/adr-0001.md
   ```

4. **Run artifact generation again (should regenerate):**

   ```bash
   time bun run ai:context:generate --force
   # Expected: 5-10 seconds (full regeneration)
   ```

5. **Restore ADR file:**

   ```bash
   git checkout docs/architecture/adr/adr-0001.md
   ```

6. **Run artifact generation (should be fresh again):**
   ```bash
   time bun run ai:context:generate
   # Expected: <1 second (detected no changes)
   ```

**Expected Result:** ✅ Change detection works correctly; regeneration only when needed

---

### Test 5: Performance Validation

**Objective:** Verify all performance constraints are met.

**Steps:**

1. **Run performance benchmarks:**

   ```bash
   bun run test -- tests/performance/ai-context-performance.test.ts
   ```

   **Expected output:**

   ```
   ✅ Full artifact generation: 300ms (target: <5000ms)
   ✅ Schema validation: 20ms (target: <100ms)
   ✅ Mini context load: 45ms (target: <100ms)
   ✅ Change detection: 80ms (target: <1000ms)
   ```

2. **Manual performance test (full generation):**

   ```bash
   time bun run ai:context:generate --force
   ```

   **Expected:** Completes in <5 seconds

3. **Manual performance test (mini context load):**
   ```bash
   node -e "const m = require('./docs/ai/context/ai-context-mini.json'); console.log('Loaded', Object.keys(m).length, 'top-level keys');" | time -p
   ```
   **Expected:** <50ms

**Expected Result:** ✅ All performance constraints met

---

### Test 6: Constitutional Compliance

**Objective:** Verify the system does NOT violate Zidney Constitution.

**Steps:**

1. **Verify no tenant data access:**

   ```bash
   grep -r "workspace\|tenant\|license\|attempt" docs/ai/context/*.json | grep -v "tenant_" | wc -l
   # Should output: 0 (no references to actual tenant data)
   ```

2. **Verify no database queries:**

   ```bash
   grep -r "SELECT\|INSERT\|UPDATE\|DELETE\|DROP" scripts/ai-context/ | wc -l
   # Should output: 0 (no SQL queries)
   ```

3. **Verify no middleware bypasses:**

   ```bash
   grep -r "bypass\|override\|skip.*middleware" scripts/ai-context/ docs/ai/context/ | wc -l
   # Should output: 0
   ```

4. **Verify no snapshot mutations:**

   ```bash
   grep -r "snapshot" scripts/ai-context/ | grep -v ".json" | wc -l
   # Should output: 0
   ```

5. **Run governance audit:**
   ```bash
   bun run arch:audit:check -- --scope ai-context
   ```
   **Expected:** ✅ Architecture score: 100/100

**Expected Result:** ✅ Full constitutional compliance verified

---

### Test 7: Integration with Linting & Build

**Objective:** Verify artifacts don't break existing linting or build processes.

**Steps:**

1. **Run full linting suite:**

   ```bash
   bun run lint
   ```

   **Expected:** No new errors introduced

2. **Run TypeScript check:**

   ```bash
   bun run type-check
   ```

   **Expected:** All types valid

3. **Run full test suite:**

   ```bash
   bun run test
   ```

   **Expected:** All 207+ tests pass (no regressions)

4. **Verify pre-commit hooks still work:**
   ```bash
   git add docs/ai/context/
   git commit -m "test: verify artifacts"
   ```
   **Expected:** Pre-commit hooks pass (all checks approved)

**Expected Result:** ✅ No regressions in existing systems

---

### Test 8: Documentation Completeness

**Objective:** Verify all operational documentation is present and accurate.

**Steps:**

1. **Verify README exists and is complete:**

   ```bash
   wc -l docs/ai/context/README.md
   # Should be > 1000 lines

   grep -E "^##|^###" docs/ai/context/README.md | head -10
   # Should list main sections (Overview, Artifacts, Usage, Integration, etc.)
   ```

2. **Verify REFRESH_GUIDE exists:**

   ```bash
   wc -l docs/ai/context/REFRESH_GUIDE.md
   # Should be > 500 lines

   grep -E "Manual Refresh|Automated Refresh|Troubleshooting" docs/ai/context/REFRESH_GUIDE.md | wc -l
   # Should show > 3 major sections
   ```

3. **Verify DEPLOYMENT documentation:**
   ```bash
   test -f docs/ai/context/DEPLOYMENT.md && echo "✅ DEPLOYMENT.md exists"
   ```

**Expected Result:** ✅ All documentation present and comprehensive

---

## Regression Testing

### Previous Feature Validation

**Objective:** Ensure new AI context system doesn't regress existing features.

**Steps:**

1. **Run all existing tests:**

   ```bash
   bun run test
   ```

   **Expected:** 207/207 tests pass; zero new failures

2. **Verify architecture audit still passes:**

   ```bash
   bun run arch:audit
   ```

   **Expected:** Architecture score >= 85/100 (target: 100/100)

3. **Verify linting still clean:**

   ```bash
   bun run lint
   ```

   **Expected:** 0 errors

4. **Test existing AI tools still work:**
   - Copilot: Still generates code correctly
   - GitNexus: Still performs impact analysis
   - SpecKit: Still executes specifications
   - Claude: Still understands architecture

**Expected Result:** ✅ Zero regressions detected

---

## Troubleshooting

### Issue: Artifacts not generated

**Symptom:** `bun run ai:context:generate` produces no output files

**Solutions:**

1. Check permissions: `ls -l docs/ai/context/`
2. Check for errors: `bun run ai:context:generate --verbose`
3. Verify source files: `ls docs/architecture/adr/ docs/architecture/intelligence/`
4. Run with force: `bun run ai:context:generate --force`

### Issue: Schema validation fails

**Symptom:** `artifact-schema-validation.test.ts` fails

**Solutions:**

1. Check artifact syntax: `jq . docs/ai/context/ai-module-map.json`
2. Compare against schema: `cat docs/ai/context/schemas/ai-context.schema.json`
3. Regenerate artifacts: `bun run ai:context:generate --force`
4. Check TypeScript types: `grep "export interface" packages/types/src/ai-context.ts`

### Issue: Performance test timeout

**Symptom:** `ai-context-performance.test.ts` times out

**Solutions:**

1. Check system load: `top` or `htop`
2. Run with --verbose: `bun run ai:context:generate --verbose`
3. Profile generation: `node --prof scripts/ai-context/index.ts`
4. Check disk space: `df -h docs/ai/context/`

### Issue: AI tools can't load artifacts

**Symptom:** Copilot/GitNexus can't access context

**Solutions:**

1. Verify file permissions: `ls -l docs/ai/context/ai-context-mini.json`
2. Check artifact exists: `test -f docs/ai/context/ai-context-mini.json && echo "exists"`
3. Verify JSON syntax: `jq . docs/ai/context/ai-context-mini.json > /dev/null`
4. Clear tool caches: Restart Copilot, clear GitNexus cache

---

## Test Results Template

When completing manual testing, fill in this template:

```
## Test Execution Summary

**Date:** [YYYY-MM-DD]
**Tester:** [Name]
**Environment:** [macOS/Linux/Windows + Node version + Bun version]
**Test Results:**

| Test Suite                  | Status | Notes |
| --------------------------- | ------ | ----- |
| Artifact Generation         | ✅/❌  |       |
| Schema Validation           | ✅/❌  |       |
| AI Tool Integration         | ✅/❌  |       |
| Change Detection            | ✅/❌  |       |
| Performance Validation      | ✅/❌  |       |
| Constitutional Compliance   | ✅/❌  |       |
| Build Integration           | ✅/❌  |       |
| Documentation              | ✅/❌  |       |
| Regression Testing          | ✅/❌  |       |

**Overall Result:** ✅ PASS / ❌ FAIL

**Issues Found:** [List any discovered issues]

**Sign-Off:** [Tester signature/date]
```

---

## Quick Start for QA

**Fastest path to test AI Architecture Context:**

```bash
# 1. Run all unit tests (5 minutes)
bun run test -- tests/validation/

# 2. Run integration tests (10 minutes)
bun run test -- tests/integration/

# 3. Verify against one AI tool (10 minutes)
#    (e.g., open Copilot chat and ask about architecture)

# 4. Run regression tests (5 minutes)
bun run test

# Total time: ~30 minutes for complete QA validation
```

---

## Support & Escalation

**Questions or Issues:**

- **Slack:** #architecture-team (use `@architecture-team`)
- **Docs:** docs/ai/context/README.md and REFRESH_GUIDE.md
- **Repository:** zidney-app2 (GitHub)

**Critical Issues:** Contact @architecture-lead immediately

---

**Last Updated:** 2026-03-10  
**Status:** Ready for QA execution
