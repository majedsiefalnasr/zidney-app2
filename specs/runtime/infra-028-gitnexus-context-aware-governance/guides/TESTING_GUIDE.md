# Testing Guide — INFRA-28 GitNexus Context-Aware Governance

**Stage:** GitNexus Context-Aware Governance
**Branch:** `spec/infra-028-gitnexus-context-aware-governance`
**Audience:** QA engineers, code reviewers, senior developers

---

## Overview

This stage adds 4 context-aware governance scripts under `scripts/context/` and integrates them into:

- The pre-commit hook (`.husky/pre-commit`)
- The governance gate (`scripts/governance/gate.ts`)
- The architecture-governance CI workflow

---

## Prerequisites

```bash
# Ensure you are on the stage branch
git checkout spec/infra-028-gitnexus-context-aware-governance

# Install dependencies
bun install
```

---

## 1 — Run Unit Tests

```bash
bun run vitest run scripts/context/__tests__/validate.test.ts
```

**Expected output:**

```
 ✓ |context-scripts| scripts/context/__tests__/validate.test.ts  (16 tests)
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

All 16 tests must pass. Test coverage:

| Test                       | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| Valid fresh artifact       | Returns `[context:validate] OK artifact valid (...)` |
| Missing artifact file      | Throws `artifact not found`                          |
| Invalid JSON               | Throws `invalid JSON in artifact`                    |
| T.each required field (×9) | Throws `missing required field: <field>`             |
| schemaVersion mismatch     | Throws `schemaVersion mismatch`                      |
| 25h old artifact           | Throws `stale artifact`                              |
| 23h59m old (boundary)      | Returns OK                                           |
| 24h1m old (boundary)       | Throws `stale artifact`                              |

---

## 2 — Test `context:validate` CLI

The real artifact must be fresh. If it's stale, build first:

```bash
# Build a fresh artifact
bun run context:build

# Validate it
bun run context:validate
```

**Expected output (success):**

```
[context:validate] OK artifact valid (schemaVersion=1.0.0, age=0.0h)
```

**Expected output (stale artifact):**

```
[context:validate] FAIL: stale artifact — age: 30.5h (max: 24h) — run 'bun run context:build --force'
```

---

## 3 — Test `context:build` CLI

```bash
# Dry run (prints what would be written, no file change)
bun run context:build -- --dry-run

# Force rebuild (ignores freshness)
bun run context:build -- --force

# Changed-files-only scan
bun run context:build
```

**Expected output:**

```
[context:build] OK Written: docs/ai/context/gitnexus-context.json
```

After running, verify the file was updated:

```bash
ls -lh docs/ai/context/gitnexus-context.json
```

---

## 4 — Test `context:changed` CLI

Stage some files first:

```bash
# Stage a file
git add scripts/context/validate.ts

# Run changed context script
bun run context:changed
```

**Expected output:**

```
[context:changed] OK: 1 changed file(s) resolved
```

Check the artifact:

```bash
cat docs/ai/context/context-changed.json
```

Expected JSON shape:

```json
{
  "generatedAt": "...",
  "changedFiles": ["scripts/context/validate.ts"]
}
```

---

## 5 — Test `context:impact` CLI

After running `context:changed` (step 4):

```bash
bun run context:impact
```

**Expected output:** Lists impacted risk modules whose `affectedBy` intersects the changed files.

With `--json` flag prints raw JSON array to stdout:

```bash
bun run context:impact -- --json
```

---

## 6 — Test Pre-Commit Hook Integration

```bash
# Make a trivial change and stage it
echo "# test" >> scripts/context/validate.ts
git add scripts/context/validate.ts

# Run the pre-commit hook manually
.husky/pre-commit
```

**Expected behavior:**

1. TypeScript incremental check runs
2. `bun run context:changed` runs → outputs resolved changed files
3. `bun run context:validate` runs → outputs OK or FAIL
4. Architecture guard runs
5. Hook completes (exit 0 if artifact is fresh)

Clean up:

```bash
git restore scripts/context/validate.ts
git restore --staged scripts/context/validate.ts
```

---

## 7 — Test Governance Gate

```bash
bun run governance:gate
```

**Expected output:** All 8 guards listed, first two being `Context Build` and `Context Validate`.

---

## 8 — TypeScript Type-Check

```bash
bun tsc --noEmit --skipLibCheck
```

**Expected:** No output (zero errors).

---

## 9 — CI Workflow (architecture-governance.yml)

Review that the new step is in `.github/workflows/architecture-governance.yml`:

```bash
grep -A3 'Build and Validate GitNexus Context' .github/workflows/architecture-governance.yml
```

**Expected output:**

```
- name: Build and Validate GitNexus Context
  run: bun run context:build && bun run context:validate
```

---

## Pass Criteria

| Check                  | Pass condition                                 |
| ---------------------- | ---------------------------------------------- |
| Unit tests             | 16/16 pass                                     |
| `context:validate` CLI | Exits 0 with OK message for fresh artifact     |
| `context:build` CLI    | Exits 0, artifact updated                      |
| `context:changed` CLI  | Exits 0, `context-changed.json` updated        |
| Pre-commit hook        | Completes without error when artifact is fresh |
| Governance gate        | Lists Context Build + Context Validate guards  |
| TypeScript             | 0 errors                                       |
