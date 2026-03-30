# Testing Guide — Runtime Script Recovery and Validation

**Stage:** Runtime Script Recovery and Validation  
**Phase:** 0X_FIXES  
**Stage Directory:** fix-01-runtime-script-recovery-and-validation  
**Generated On:** 2025-01-18T12:00:00.000Z

---

## Purpose

This guide explains how to validate the implementation for this stage end-to-end. All 46 tasks
have been completed and all new runtime scripts have been integrated into the codebase with
full documentation and testing.

---

## Summary of Delivered Behavior

The Runtime Script Recovery and Validation stage restores 14 missing TypeScript scripts across
five canonical domain directories (`scripts/db/`, `scripts/validate/`, `scripts/seed/`,
`scripts/generate/`, `scripts/maintenance/`). Each script follows strict governance rules, uses
structured logging via the shared `createLogger` factory, and is registered in `package.json`
with full CLI documentation.

Key outcomes:

- **14 canonical script files** created with JSDoc metadata headers, structured logging, and infra-absent exit-0 patterns
- **30 new `package.json` script entries** registered (both direct and alias forms)
- **12 documentation pages** auto-generated in `docs/scripts/` covering all scripts with 8-section format (Command, Purpose, When to Run, Execution Mode, Dependencies, Example Usage, Known Failure Modes)
- **Governance rules** enforced via `## Script Governance` section added to AGENTS.md
- **Runtime validation guard** (`validate-runtime-scripts`) verifies all spec.md references are registered (83 spec refs / 95 registered)
- **Unit tests** for script extraction and registry validation (9/9 pass)
- **CI gates** all pass: typecheck EXIT 0, lint EXIT 0, validate-runtime-scripts EXIT 0

---

## Prerequisites

| Requirement                | Validation Command / Check                                         |
| -------------------------- | ------------------------------------------------------------------ | ------------------------- |
| Node.js installed          | `node --version` (v20+)                                            |
| Bun installed              | `bun --version` (v1.3.9+)                                          |
| Docker running             | `docker ps`                                                        |
| Environment file present   | Verify `.env.local` exists with DATABASE_URL                       |
| Repo root has node_modules | `ls node_modules                                                   | head -5` returns packages |
| PostgreSQL running         | `bun run db:status:pool` should exit 0                             |
| Correct branch checked out | `git branch` shows `fix-01-runtime-script-recovery-and-validation` |

---

## Files in Scope

**New Script Files:**

```
scripts/db/console.ts                      — psql launcher
scripts/db/migrate.ts                      — migration runner
scripts/db/pool-status.ts                  — DB connection pool status check
scripts/db/validate-licenses.ts            — license status query
scripts/validate/scan-package-scripts.ts   — spec reference scanner
scripts/validate/diff-script-registry.ts   — registry diff reporter
scripts/validate/detect-broken-scripts.ts  — broken script detector
scripts/validate/ai-context-fresh.ts       — AI context freshness validator
scripts/validate/ai-context-schemas.ts     — AI context schema validator
scripts/validate/runtime-scripts.ts        — runtime spec reference guard
scripts/validate/__tests__/runtime-scripts.test.ts — unit tests (6 cases)
scripts/seed/dashboard-test-data.ts        — dashboard seeding script
scripts/generate/script-docs.ts            — auto-documentation generator
scripts/maintenance/cache-clean.ts         — cache cleanup utility
```

**Deleted Files:**

```
scripts/seed-dashboard-test-data.ts        — root-level duplicate
scripts/dev/seed-dashboard-test-data.ts    — prior location superseded
```

**Documentation:**

```
docs/scripts/README.md                     — knowledge base index
docs/scripts/SCRIPT_REGISTRY.md            — post-fix registry table
docs/scripts/*.md                          — 12 individual documentation pages
```

**Modified Files:**

```
package.json                               — 30 new script registrations
vitest.workspace.ts                        — validate-scripts Vitest project
AGENTS.md                                  — Script Governance section
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Verify environment
bun run db:status:pool

# Run all unit tests
bun test

# Run only the script validation tests
bun test --project=validate-scripts
```

---

## Automated Validation Commands

```bash
# Unit tests (runtime-scripts only)
bun test scripts/validate/__tests__/runtime-scripts.test.ts

# CI validation suite for this stage
bun run validate:scripts:all  # EXIT 0 if all 83 spec refs registered
bun run typecheck                 # EXIT 0 if no TS errors
bun run lint                      # EXIT 0 if no Biome violations

# Run each new script manually to verify operation
bun run db:status:pool
bun run db:validate:licenses
bun run db:migrate --help
bun run db:console
bun run validate:ai-context-fresh
bun run validate:ai-context-schemas
bun run infra:cache:clean
bun run dev:seed:dashboard-test-data
bun run validate:scripts:all
bun run dev:generate:script-docs
```

---

## Manual Test Scenarios

### Scenario 1: Verify All Scripts Are Registered

**Expected:** Exit 0, no unregistered references found.

```bash
bun run validate:scripts:all
```

**What to check:** Output should list all 83 spec references as `registered` under their corresponding script keys.

### Scenario 2: Database Connectivity

**Expected:** EXIT 0 with structured log showing connection pool status.

```bash
bun run db:status:pool
```

**What to check:** Confirms PostgreSQL is running and DATABASE_URL is valid.

### Scenario 3: License Status Query

**Expected:** EXIT 0 with structured log showing license status counts.

```bash
bun run db:validate:licenses
```

**What to check:** Queries the master DB and groups licenses by status (active, expired, etc.).

### Scenario 4: AI Context Freshness Validator

**Expected:** EXIT 0 if `docs/ai/context/ai-context-mini.json` exists and is < 24h old.

```bash
bun run validate:ai-context-fresh
```

**What to check:** If the file is missing or stale (> 24h), exits with error code 1.

### Scenario 5: AI Context Schema Validator

**Expected:** EXIT 0 if all 5 required AI context JSON files are valid JSON.

```bash
bun run validate:ai-context-schemas
```

**What to check:** Validates:

- `docs/ai/context/ai-layer-model.json`
- `docs/ai/context/ai-module-map.json`
- `docs/ai/context/ai-dependency-graph.json`
- `docs/ai/context/ai-context-mini.json`
- `docs/ai/context/ai-architecture-brain.json`

### Scenario 6: Cache Cleanup

**Expected:** EXIT 0 with structured log showing cleanup results.

```bash
bun run infra:cache:clean
```

**What to check:** Cleans `.turbo/`, `node_modules/.cache/`, and `apps/*/dist/` directories.

### Scenario 7: Auto-Doc Generation

**Expected:** EXIT 0, all 14 script docs regenerated in `docs/scripts/`.

```bash
bun run dev:generate:script-docs
```

**What to check:** Verifies JSDoc metadata headers are correct in all script files, generates conformance table, updates `docs/scripts/SCRIPT_REGISTRY.md`.

### Scenario 8: Unit Tests for Script Validation

**Expected:** All 6 tests pass.

```bash
bun test --project=validate-scripts scripts/validate/__tests__/runtime-scripts.test.ts
```

**What to check:**

- ✓ extractScriptReferences finds standard `bun run <script>` references
- ✓ extractScriptReferences ignores excluded names
- ✓ extractScriptReferences ignores CLI flag forms
- ✓ loadRegisteredScripts returns a Set of keys
- ✓ detects missing scripts across loaded set
- ✓ all registered — no error output

---

## Known Limitations / Failure Modes

| Scenario                              | Cause                                | Resolution                                                      |
| ------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `db:pool-status` exits 1              | PostgreSQL not running               | `docker compose up -d` to start services                        |
| `validate:ai-context-fresh` exits 1   | AI context missing or stale          | Run `bun run ai:context:refresh`                                |
| `validate:ai-context-schemas` exits 1 | Invalid JSON in ai-context files     | Manually review/fix `docs/ai/context/*.json`                    |
| `validate-runtime-scripts` exits 1    | Unregistered spec references         | Add missing scripts to `package.json`                           |
| `generate-script-docs` exits 1        | Invalid JSDoc metadata               | Check `@script`, `@domain`, `@description` tags in script files |
| `maintenance:cache-clean` errors      | Dir already deleted by other process | Safe to ignore; script is idempotent                            |

---

## Validation Pass Checklist

Use this checklist when reviewing the PR:

- [ ] All 46 tasks completed and marked `[X]` in tasks.md
- [ ] Unit tests pass: `bun test --project=validate-scripts`
- [ ] CI gates pass: `bun run validate:scripts:all && bun run typecheck && bun run lint`
- [ ] All new scripts execute without errors: manual scenario tests 1–7 pass
- [ ] Documentation complete: `docs/scripts/` has 12 pages + README + REGISTRY
- [ ] No `console.log` in any new `.ts` files (structured logging via `createLogger` only)
- [ ] Git commit `5fee844b` (Step 6 Implement) is clean and covers all expected files
- [ ] Stage file updated to BACKEND CLOSED (no further structural changes allowed)

---

## Sharing with QA / Reviewers

1. Share this file with QA: `guides/TESTING_GUIDE.md`
2. Encourage them to follow "Manual Test Scenarios" 1–8 in order
3. Reference [IMPLEMENT_REPORT.md](../reports/IMPLEMENT_REPORT.md) for what changed
4. Reference [VALIDATION_REPORT.md](../audits/VALIDATION_REPORT.md) for CI evidence
5. Point to PR_SUMMARY.md for the pull request description

---

## Next Steps

1. Open a PR using the content in `PR_SUMMARY.md` (stage root)
2. Run hard-mode-guard.yml workflow validation (auto-triggered on push to spec/ branch)
3. Share this testing guide with code reviewers
4. Merge to `develop` once reviewed and approved
