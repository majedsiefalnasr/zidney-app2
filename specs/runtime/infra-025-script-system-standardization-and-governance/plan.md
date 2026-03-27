# Implementation Plan: Script System Standardization and Governance

**Stage:** INFRA-25
**Phase:** 01_PLATFORM_FOUNDATION
**Spec:** `specs/runtime/infra-025-script-system-standardization-and-governance/spec.md`
**Branch:** `spec/infra-025-script-system-standardization-and-governance`
**Related ADR:** None required (dev tooling only)

---

## Stage Alignment

- **Phase:** 01_PLATFORM_FOUNDATION
- **Stage:** INFRA-25 — Script System Standardization and Governance
- **Related Spec File:** `specs/runtime/infra-025-script-system-standardization-and-governance/spec.md`
- **Related ADR:** None — no architectural decisions beyond developer tooling

Plan scope is strictly limited to: naming governance, refactor tooling, CI validation, registry generation, and the AI governance skill. No runtime behavior is introduced.

---

## Architectural Scope Confirmation

- **No cross-tenant data access** ✓ — no database connections whatsoever
- **No middleware bypass** ✓ — no HTTP layer touched
- **No direct DB instantiation** ✓ — no DB clients created
- **No grading logic outside Worker** ✓ — attempt engine not touched
- **No weakening of snapshot integrity** ✓ — snapshot logic unchanged
- **No weakening of version enforcement** ✓ — schema versioning unchanged
- **No layer boundary violation** ✓ — tooling only; no `packages/*` or `apps/*` imports created

No ADR required. No constitutional exception needed.

---

## Implementation Scope

This stage is **developer tooling only**. There are no API routes, no Worker jobs, no frontend changes, no database interactions, and no tenant-scoped operations. The scope is:

- Governance scripts under `scripts/`
- Validation scripts under `scripts/validate/`
- Root `package.json` script renames
- CI workflow additions to `.github/workflows/architecture-governance.yml`
- Documentation under `docs/scripts/`
- Reports under `reports/`
- AI governance skill at `.agents/skills/script-system-governance/SKILL.md`

---

## Database Impact

- **Master DB:** Not touched. No migration required.
- **Tenant DB:** Not touched. No migration required.
- **No schema_version change. No product_version impact.**

---

---

## Non-Applicable Template Sections

The following template sections are not applicable to this stage (developer tooling only — no DB, no HTTP, no runtime, no tenants):

- Transaction Design: N/A
- Idempotency Plan: N/A
- Version Enforcement Strategy: N/A
- Authoritative Time Handling: N/A
- Rate Limiting: N/A
- Worker Layer: N/A
- API Layer: N/A
- Frontend Layer: N/A

---

## Phase 0: Research Findings Summary

Research completed. See `research.md` for full findings. Key conclusions:

1. **33 non-compliant or redundant governed scripts** identified in root `package.json` (full table in §Naming Migration Design)
2. **Existing metadata format** uses `@script`, `@domain`, `@description`, `@mode`, `@dependencies` — missing `@category` and `@usage` required by this stage
3. **Root-level scripts** (`scripts/ai-guard.ts`, `scripts/infra-audit.ts`, etc.) lack the `@script`/`@domain`/`@category`/`@usage` headers entirely
4. **Existing partial validation infrastructure** exists (`scripts/validate/detect-broken-scripts.ts`, `scripts/validate/runtime-scripts.ts`, `scripts/validate/scan-package-scripts.ts`) and will be superseded by the new governed validation scripts
5. **CI workflow** `.github/workflows/architecture-governance.yml` currently has 13 steps; new script governance block adds steps 14–17
6. **Script directory** is well-organized under domain subfolders but root-level scripts (`scripts/*.ts`) exist outside the `scripts/<domain>/` convention and need metadata headers

---

## Phase 1: Script Inventory Strategy (T001)

### Purpose

Produce a deterministic, regenerable inventory of every script across all `package.json` files.

### Implementation

The naming validator (`scripts/validate/script-naming.ts`) performs inventory as a prerequisite. No separate inventory script is required.

**Scan algorithm:**

```
1. Collect all package.json files:
   - Root: package.json
   - Workspaces: apps/*/package.json, packages/*/package.json

2. For each package.json:
   - Parse scripts object
   - Record each entry: { name, command, packageFile, workspaceName }

3. Cross-reference command strings against scripts/ directory:
   - Extract file path from "bun scripts/<path>" pattern
   - Check existsSync(resolvedPath)
   - Record missing → broken reference
```

**Invocation references scan** (consumed by `script-usage.ts`):

```
Pattern matched per file: /bun run ([\w:.-]+)/g

File extensions scanned:
  .json   → **/package.json
  .ts     → scripts/**/*.ts
  .yml    → .github/workflows/*.yml
  .yaml   → .github/workflows/*.yaml
  .md     → docs/**/*.md, specs/**/*.md, .agents/**/*.md
  .sh     → scripts/**/*.sh, scripts/*.sh
```

---

## Phase 1: Naming Migration Design (T002)

### Convention Rule Recap

```
<domain>:<action>[:<scope>]
```

- Domain MUST be one of: `db`, `arch`, `validate`, `ai`, `ci`, `repo`, `dev`, `infra`, `test`
- Separator between segments MUST be `:`
- Internal hyphens within action or scope are permitted (e.g., `db:validate:tenant-schema`)
- Standard lifecycle scripts and sub-variants are exempt: `build`, `test`, `lint`, `typecheck`, `dev`, `clean`, `check`, `prepare`, `format` and all `:` sub-variants thereof

### Complete Migration Table (Root `package.json`)

Stored verbatim at `docs/scripts/SCRIPT_MIGRATION_MAP.md`.

#### Type A — Wrong action/scope structure

| Old Name               | Violation                                                             | New Name               |
| ---------------------- | --------------------------------------------------------------------- | ---------------------- |
| `db:pool-status`       | action `pool-status` should split to `status:pool` (per spec example) | `db:status:pool`       |
| `db:validate-licenses` | action `validate-licenses` should split to `validate:licenses`        | `db:validate:licenses` |
| `arch:validate-brain`  | action `validate-brain` should split to `validate:brain`              | `arch:validate:brain`  |

#### Type B — Domain segment contains hyphen

| Old Name              | Violation                    | New Name              |
| --------------------- | ---------------------------- | --------------------- |
| `ai-context:generate` | `ai-context` domain uses `-` | `ai:context:generate` |
| `ai-context:refresh`  | same                         | `ai:context:refresh`  |
| `ai-context:validate` | same                         | `ai:context:validate` |
| `ai-context:status`   | same                         | `ai:context:status`   |
| `ai-runtime:status`   | `ai-runtime` domain uses `-` | `ai:runtime:status`   |
| `ai-runtime:refresh`  | same                         | `ai:runtime:refresh`  |
| `ai-runtime:validate` | same                         | `ai:runtime:validate` |

#### Type C — No domain prefix

| Old Name                   | Violation                     | New Name                       |
| -------------------------- | ----------------------------- | ------------------------------ |
| `validate-runtime-scripts` | no domain, uses `-` separator | `validate:scripts:runtime`     |
| `ai-guard`                 | no domain                     | `ai:guard`                     |
| `type-safety-guard`        | no domain                     | `arch:type-safety-guard`       |
| `generate-script-docs`     | no domain, uses `-`           | `dev:generate:script-docs`     |
| `seed-dashboard-test-data` | no domain, uses `-`           | `dev:seed:dashboard-test-data` |
| `run-staging-smoke-tests`  | no domain, uses `-`           | `ci:smoke:staging`             |

#### Type D — Non-allowed domain

| Old Name                  | Violation                                                             | New Name                                 |
| ------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `gitnexus:context`        | `gitnexus` not in domain map                                          | `arch:gitnexus:context`                  |
| `gitnexus:validate`       | same                                                                  | `arch:gitnexus:validate`                 |
| `hygiene:report`          | `hygiene` not in domain map                                           | `dev:hygiene:report`                     |
| `maintenance:cache-clean` | `maintenance` not in domain map                                       | `infra:cache:clean`                      |
| `check:tsconfig`          | `check` not in domain map                                             | `validate:tsconfig`                      |
| `check:store-cycles`      | `check` not in domain map                                             | `arch:check:store-cycles`                |
| `infra-audit:check`       | `infra-audit` hyphen in domain                                        | `arch:audit:check`                       |
| `generate:ai-context`     | `generate` not in domain map; also duplicate of `ai-context:generate` | `ai:context:generate` (remove duplicate) |

#### Type E — Redundant aliases to remove

| Alias to Remove         | Canonical Target                                       |
| ----------------------- | ------------------------------------------------------ |
| `infra-audit`           | `arch:audit` (already exists)                          |
| `migrate`               | `db:migrate` (already exists)                          |
| `validate:architecture` | `arch:audit` (already exists)                          |
| `type-coverage`         | `validate:types` (already exists)                      |
| `cache-clean`           | `infra:cache:clean` (new canonical from Type D rename) |
| `biome`                 | `lint` (lifecycle)                                     |
| `tsc`                   | `typecheck:src` (lifecycle)                            |
| `vitest`                | `test` (lifecycle)                                     |
| `worker`                | `dev:worker` (already exists)                          |

**Refactor engine behavior for Type E:** These aliases are redundant duplicates of already-existing canonical scripts. Unlike Types A–D, the alias key must be removed from `package.json` rather than renamed. The engine behavior: (1) in all non-`package.json` files, replace `bun run <alias>` with `bun run <canonical-target>` (same `replaceAll` mechanism as A–D, treating the canonical target as the new name); (2) the alias key is deleted from `package.json`. For the migration map, Type E entries use the canonical target as the "New Name" column value. This ensures no dangling references remain after the alias key is removed.

#### Summary

| Type                            | Count  |
| ------------------------------- | ------ |
| Type A — Wrong action structure | 3      |
| Type B — Hyphen in domain       | 7      |
| Type C — No domain prefix       | 6      |
| Type D — Non-allowed domain     | 8      |
| Type E — Aliases to remove      | 9      |
| **Total**                       | **33** |

### Lifecycle-Exempt Scripts (No Action Required)

`typecheck`, `typecheck:src`, `typecheck:tests`, `lint`, `lint:fix`, `format`, `format:biome`, `format:md`, `format:check`, `format:check:biome`, `format:check:md`, `build`, `build:api`, `build:packages`, `test`, `test:unit`, `test:unit:debug`, `test:unit:boundaries`, `test:integration`, `test:performance`, `test:static`, `test:coverage`, `test:e2e`, `test:e2e:mmc`, `test:e2e:backoffice`, `test:e2e:frontoffice`, `dev`, `dev:infra`, `dev:api`, `dev:worker`, `dev:mmc`, `dev:backoffice`, `dev:frontoffice`, `dev:all`, `prepare`, `test:ci`, `type-check`

### Already-Compliant Governed Scripts (No Action Required)

`validate:yaml`, `validate:workflows`, `validate:types`, `validate:ai-context-fresh`, `validate:ai-context-schemas`, `validate:scripts:broken`, `arch:add-module`, `arch:generate`, `arch:audit`, `arch:context`, `arch:refresh`, `arch:fix`, `arch:guard`, `arch:guard:ci`, `arch:guard:changed`, `arch:health`, `arch:health:ci`, `arch:visualize`, `ai:run`, `ai:plan`, `ai:validate`, `repo:doctor`, `repo:fix`, `repo:onboard`, `repo:status`, `db:console`, `db:migrate`, `ci:test`, `ci:local`, `ci:local:full`, `ci:local:workflow`, `ci:local:job`, `ci:local:list`, `ci:local:dry`, `ci:run-local`

---

## Phase 1: Refactor Engine Design (T011)

### File

`scripts/dev/refactor-scripts.ts`
Package.json entry: `"dev:refactor:scripts": "bun scripts/dev/refactor-scripts.ts"`

### Architecture

```
scripts/dev/refactor-scripts.ts
  ├── parseMigrationMap()       → Parse docs/scripts/SCRIPT_MIGRATION_MAP.md
  ├── buildFileList()           → Glob all files in scan scope
  ├── replaceInFile(file, map)  → String-replace old → new script references
  ├── validateNoRemnants()      → Re-scan to confirm zero old references remain
  └── writeReport()             → Write reports/SCRIPT_REFACTOR_REPORT.md
```

### Migration Map Parser

Parses markdown table rows in `docs/scripts/SCRIPT_MIGRATION_MAP.md`:

```
| `old-name` | ... | `new-name` |
```

Produces: `{ [oldName: string]: string }`

### Scan Scope

| Extension | Glob                                               |
| --------- | -------------------------------------------------- |
| `.json`   | `**/package.json`                                  |
| `.ts`     | `scripts/**/*.ts`                                  |
| `.yml`    | `.github/workflows/*.yml`                          |
| `.yaml`   | `.github/workflows/*.yaml`                         |
| `.md`     | `docs/**/*.md`, `specs/**/*.md`, `.agents/**/*.md` |
| `.sh`     | `scripts/**/*.sh`, `scripts/*.sh`                  |

Exclusions: `node_modules/**`, `coverage/**`, `dist/**`, `.git/**`

### Replacement Logic

```ts
content = content.replaceAll(`bun run ${oldName}`, `bun run ${newName}`);
```

Plain string replacement (not regex) — avoids escaping `:` characters. Safe and idempotent.

### Dry-Run Mode

`--dry-run` flag: print diffs without writing. Exit 0.

### Idempotency

Idempotent — re-running after a completed migration produces zero replacements.

### Completion Gate

After replacement, re-scan for any remaining old script names:

```
❌ Script refactor incomplete — {N} unresolved references detected.
  <file>:<line>: bun run <old-name>
```

Exit 1.

### Report Format (`reports/SCRIPT_REFACTOR_REPORT.md`)

```markdown
# Script Refactor Report

Generated: <ISO timestamp>
Mode: <dry-run|live>

## Summary

| Metric                | Value |
| --------------------- | ----- |
| Files scanned         | N     |
| Files modified        | N     |
| Total replacements    | N     |
| Unresolved references | N     |

## Replacements by Script

| Old Name       | New Name       | Files | Occurrences |
| -------------- | -------------- | ----- | ----------- |
| db:pool-status | db:status:pool | 3     | 7           |

## Unresolved References (if any)

<file>:<line>: bun run <old-name>
```

---

## Phase 1: Validation Script Design (FR-008)

### Shared TypeScript Types

To ensure type consistency across all three validation scripts and the refactor engine, define these interfaces in `scripts/validate/types.ts`:

```ts
// Imported by script-naming.ts, script-usage.ts, script-infrastructure.ts, refactor-scripts.ts
export interface ScriptEntry {
  name: string;
  command: string;
  packageFile: string;
  workspaceName: string | null;
}

export interface ViolationRecord {
  rule: string;
  file: string;
  line?: number;
  scriptName?: string;
  message: string;
  hint?: string;
}

export interface MigrationEntry {
  oldName: string;
  type: "A" | "B" | "C" | "D" | "E";
  violation: string;
  newName: string; // For Type E: the canonical target (already-existing script name)
}
```

All three validators and the refactor engine import from `scripts/validate/types.ts`. Add `scripts/validate/types.ts` to the new files manifest.

### `scripts/validate/script-naming.ts`

Package.json entry: `"validate:scripts:naming": "bun scripts/validate/script-naming.ts"`

**Algorithm (report-all mode):**

```
1. Collect all package.json files (root + workspaces)
2. For each script name:
   a. Skip lifecycle-exempt names
   b. Validate: /^(db|arch|validate|ai|ci|repo|dev|infra|test):[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$/
   c. Non-conforming → record violation { name, file, hint }
3. After ALL files scanned: emit violations
4. if violations > 0: process.exit(1)
```

**Output:**

```
❌ Script naming violations found: N

  validate-runtime-scripts (package.json)
    ↳ Uses '-' separator. Use: validate:scripts:runtime

  gitnexus:context (package.json)
    ↳ 'gitnexus' is not an allowed domain.
      Allowed: db, arch, validate, ai, ci, repo, dev, infra, test
```

**Key rule:** Never call `process.exit(1)` before scanning all files.

### `scripts/validate/script-usage.ts`

Package.json entry: `"validate:scripts:usage": "bun scripts/validate/script-usage.ts"`

**Algorithm (report-all mode):**

```
1. Build reference set: all script names from all package.json files
2. Scan files in scope using pattern: /bun run (?:--?\S+ )*([\ w:.-]+)/g
   - The `(?:--?\S+ )*` prefix clause skips zero or more CLI flag tokens (e.g. --bun, --silent)
   - The captured group must begin with [a-zA-Z]; tokens starting with '-' are skipped
   - Example: 'bun run --bun validate:scripts:naming' captures 'validate:scripts:naming'
3. For each match: if name not in reference set → broken reference
4. After FULL scan: emit violations
5. if violations > 0: process.exit(1)
```

**Output:**

```
❌ Script usage violations found: N

  BROKEN REFERENCE
  File: .github/workflows/architecture-governance.yml:87
  Script: bun run db:status:pool
  ↳ Not found in any package.json. Perhaps: db:status:pool
```

### `scripts/validate/script-infrastructure.ts`

Package.json entry: `"validate:scripts:infrastructure": "bun scripts/validate/script-infrastructure.ts"`

**Validates:**

1. Every `.ts` script under `scripts/` has all 5 required metadata fields
2. `docs/scripts/SCRIPT_REGISTRY.md` matches a freshly generated registry (no staleness)

```
❌ Script infrastructure violations found: N

  MISSING METADATA
  File: scripts/ai-guard.ts
  Missing: @category, @usage

  STALE REGISTRY
  docs/scripts/SCRIPT_REGISTRY.md is out of date.
  Run: bun run dev:generate:script-docs
```

---

## Phase 1: CI Integration Design (FR-009)

### Target File

`.github/workflows/architecture-governance.yml`

Current workflow ends at **step 13**. New block appended as steps 14–17:

```yaml
# ── Script System Governance ──────────────────────────────────────

# ── 14. Validate Script Naming Convention ──────────────────────────
- name: Validate Script Naming Convention
  run: bun run validate:scripts:naming

# ── 15. Validate Script Usages ─────────────────────────────────────
- name: Validate Script Usages (no broken or orphan references)
  run: bun run validate:scripts:usage

# ── 16. Validate Script Infrastructure ────────────────────────────
- name: Validate Script Infrastructure (headers + registry freshness)
  run: bun run validate:scripts:infrastructure

# ── 17. Verify Script Registry Generation ─────────────────────────
- name: Verify Script Registry Generation
  run: bun run dev:generate:script-docs
```

All four steps: `continue-on-error: false` (default). Any failure independently blocks the job.

---

## Phase 1: Script Registry Design (FR-007)

### Location

`docs/scripts/SCRIPT_REGISTRY.md`

### Generator

**File:** `scripts/generate/script-docs.ts` (existing — update to new 5-field schema)
**Rename:** `generate-script-docs` → `dev:generate:script-docs`

**Algorithm:**

```
1. Walk scripts/**/*.ts
2. Parse @script, @domain, @category, @description, @usage from each file
3. Sort: domain ASC, then script name ASC
4. Write docs/scripts/SCRIPT_REGISTRY.md
5. Exit 1 if any file missing required tags
```

**Registry format:**

```markdown
# Zidney Script Registry

> Auto-generated by `bun run dev:generate:script-docs`. Do not edit manually.
> Last generated: <ISO timestamp>

## db

| Script Name      | Source File                 | Category   | Description                             | Usage                    |
| ---------------- | --------------------------- | ---------- | --------------------------------------- | ------------------------ |
| `db:migrate`     | `scripts/db/migrate.ts`     | governance | Run all pending DB migrations           | `bun run db:migrate`     |
| `db:status:pool` | `scripts/db/pool-status.ts` | runtime    | Check PostgreSQL connection pool health | `bun run db:status:pool` |
```

**Staleness check** (`validate:scripts:infrastructure`): regenerate in-memory → normalize both versions (strip the `> Last generated: ...` timestamp line) → string diff of normalized content only. Any diff in the normalized content triggers failure. This prevents the timestamp line from causing permanent stale failures in CI.

---

## Phase 1: AI Skill Design (FR-011)

### File

`.agents/skills/script-system-governance/SKILL.md` — **already exists**, update required.

### Updates Required

1. Domain map: finalized 9 allowed domains
2. Metadata header format: new 5-field format with `@category` and `@usage`
3. Workflow 1 — Add New Script (step-by-step)
4. Workflow 2 — Rename Existing Script (migration map + refactor engine + validate)
5. Anti-patterns table

### Anti-Patterns Table

| Anti-Pattern                            | Why Forbidden                              | Fix                                                      |
| --------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| Inline shell command in package.json    | Not refactorable, no metadata, no registry | Create `scripts/<domain>/<file>.ts`                      |
| `ts-node` or `npx tsx` instead of `bun` | Breaks invocation standardization          | Use `bun scripts/<domain>/<file>.ts`                     |
| Omitting metadata header                | `validate:scripts:infrastructure` fails CI | Add all 5 required `@` tags                              |
| Non-allowed domain                      | `validate:scripts:naming` fails CI         | Use one of 9 allowed domains                             |
| Rename without running refactor engine  | Leaves broken references                   | Update migration map, run `bun run dev:refactor:scripts` |
| Forgetting to update SCRIPT_REGISTRY    | CI staleness check fails                   | Run `bun run dev:generate:script-docs`                   |
| Duplicate governed script name          | Ambiguous; naming validator catches it     | Choose unique name within domain                         |

---

## Phase 1: Metadata Header Format (FR-006)

### Canonical Format (TypeScript scripts only)

```ts
/**
 * @script <domain>:<action>[:<scope>]
 * @domain <domain>
 * @category <runtime|governance|dev|ci|infra|test>
 * @description <Single-line summary of what this script does>
 * @usage bun run <domain>:<action>[:<scope>]
 */
```

All five fields are mandatory and enforced by `validate:scripts:infrastructure`.

### Category Values

| Value        | When To Use                                                     |
| ------------ | --------------------------------------------------------------- |
| `runtime`    | Scripts that inspect live services (DB pool, Redis, API health) |
| `governance` | Architecture guards, infrastructure audits, naming validation   |
| `dev`        | Developer utilities, seeding, repo hygiene, code generation     |
| `ci`         | Scripts run exclusively in CI pipelines                         |
| `infra`      | Infrastructure management (cache, env, Docker)                  |
| `test`       | Test setup and execution helpers                                |

### Existing Header Gap

Existing scripts use `@script`, `@domain`, `@description`, `@mode`, `@dependencies`. The `@mode` and `@dependencies` fields are preserved (additive). Only the 5 canonical fields are enforced.

### Shell Script Exemption

Shell scripts (`.sh`) are not required to have the TS `/** @script ... */` block. Naming convention and placement under a domain subfolder is sufficient.

---

## Phase 1: File Locations — Complete Manifest

### New Files

| File                                        | Purpose                                             |
| ------------------------------------------- | --------------------------------------------------- |
| `scripts/dev/refactor-scripts.ts`           | Refactor engine (FR-004, T011)                      |
| `scripts/validate/script-naming.ts`         | Naming convention validator (FR-008)                |
| `scripts/validate/script-usage.ts`          | Usage reference validator (FR-008)                  |
| `scripts/validate/script-infrastructure.ts` | Metadata header + registry staleness check (FR-008) |
| `docs/scripts/SCRIPT_MIGRATION_MAP.md`      | Canonical rename map (FR-003, T002)                 |
| `docs/scripts/SCRIPT_REGISTRY.md`           | Auto-generated script registry (FR-007)             |

### Files to Update

| File                                               | Change                                                      |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `package.json` (root)                              | Apply 33 renames/removals; add 5 new entries                |
| `scripts/generate/script-docs.ts`                  | Enforce 5-field metadata schema; update `@script` header    |
| `.agents/skills/script-system-governance/SKILL.md` | Add workflows, anti-patterns, domain map, new header format |
| `.github/workflows/architecture-governance.yml`    | Append 4-step Script System Governance block                |

### Scripts Requiring Metadata Header Additions

| File                                        | Status                                                 |
| ------------------------------------------- | ------------------------------------------------------ |
| `scripts/ai-guard.ts`                       | No `@script`, `@domain`, `@category`, `@usage`         |
| `scripts/infra-audit.ts`                    | No `@script`, `@domain`, `@category`, `@usage`         |
| `scripts/architecture-diff.ts`              | No `@script`, `@domain`, `@category`, `@usage`         |
| `scripts/generate-ai-context.ts`            | No `@script`, `@domain`, `@category`, `@usage`         |
| `scripts/gitnexus-context.ts`               | No `@script`, `@domain`, `@category`, `@usage`         |
| `scripts/type-safety-guard.ts`              | No `@script`, `@domain`, `@category`, `@usage`         |
| `scripts/check-store-cycles.ts`             | No `@script`, `@domain`, `@category`, `@usage`         |
| `scripts/run-local-ci.ts`                   | No `@script`, `@domain`, `@category`, `@usage`         |
| `scripts/db/pool-status.ts`                 | Partial — missing `@category`, `@usage`                |
| `scripts/db/validate-licenses.ts`           | Partial — missing `@category`, `@usage`                |
| `scripts/validate/runtime-scripts.ts`       | Partial, old name — needs name update + missing fields |
| `scripts/validate/detect-broken-scripts.ts` | Partial — missing `@category`, `@usage`                |
| `scripts/generate/script-docs.ts`           | Partial, old name — needs name update + missing fields |

All `scripts/ai-engine/`, `scripts/architecture-guard/`, `scripts/architecture-health/`, `scripts/dev/` subdirectory scripts must also be swept for missing fields.

---

## Implementation Sequence

| Step | Action                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Create `docs/scripts/SCRIPT_MIGRATION_MAP.md` with full table                                                                                                                         |
| 2    | Implement `scripts/dev/refactor-scripts.ts`                                                                                                                                           |
| 3    | Implement `scripts/validate/script-naming.ts`, `script-usage.ts`, `script-infrastructure.ts`                                                                                          |
| 4    | Add to `package.json`: `validate:scripts:naming`, `validate:scripts:usage`, `validate:scripts:infrastructure`, `dev:refactor:scripts` (plus renamed entry `dev:generate:script-docs`) |
| 5    | Run `bun run dev:refactor:scripts --dry-run`; review output                                                                                                                           |
| 6    | Apply all 33 renames/removals to root `package.json`                                                                                                                                  |
| 7    | Run `bun run dev:refactor:scripts` (live); confirm `reports/SCRIPT_REFACTOR_REPORT.md` shows 0 unresolved                                                                             |
| 8    | Add `@category` and `@usage` to all scripts in §File Locations                                                                                                                        |
| 9    | Update `scripts/generate/script-docs.ts` to enforce 5-field schema                                                                                                                    |
| 10   | Run `bun run dev:generate:script-docs`; verify `docs/scripts/SCRIPT_REGISTRY.md` is complete                                                                                          |
| 11   | Run `validate:scripts:naming`, `validate:scripts:usage`, `validate:scripts:infrastructure` — all must exit 0                                                                          |
| 12   | Update `.agents/skills/script-system-governance/SKILL.md`                                                                                                                             |
| 13   | Append CI block to `.github/workflows/architecture-governance.yml`                                                                                                                    |
| 14   | Full gate: `bun scripts/ai-guard.ts && bun scripts/infra-audit.ts && bun run lint && bun run typecheck && bun run test`                                                               |

---

## Failure Modes and Recovery

| Failure                                                  | Recovery                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| Refactor engine leaves unresolved references             | Extend scan scope or fix migration map entry; re-run engine    |
| `validate:scripts:naming` finds violation after rename   | Old alias still in `package.json` — remove it                  |
| `validate:scripts:usage` finds broken reference in `.sh` | Confirm `\.sh$` is in scan glob (it is per spec clarification) |
| CI step 16 fails (stale registry)                        | Run `bun run dev:generate:script-docs` and commit              |
| Metadata check fails for newly discovered script         | Add missing `@category`/`@usage` fields                        |

---

## Observability

All new scripts use `scripts/core/logger-factory.ts` for structured output. Console output uses consistent prefixes (✓, ❌, ℹ). No raw `console.log` calls.

---

## Security Review

- No user input processed — all inputs are local filesystem paths
- No secrets accessed or logged
- No network calls
- No environment variables exposed
- No RBAC surface introduced

No security concerns for this developer tooling stage.

---

## Test Strategy

### Unit Tests

```
scripts/validate/__tests__/script-naming.test.ts
scripts/validate/__tests__/script-usage.test.ts
scripts/validate/__tests__/script-infrastructure.test.ts
scripts/dev/__tests__/refactor-scripts.test.ts
```

**Refactor engine test cases** (`scripts/dev/__tests__/refactor-scripts.test.ts`):

- `parseMigrationMap()`: valid table returns correct map; malformed entry (missing backtick) skips gracefully
- `replaceInFile()`: replacement occurs when old name present; returns false when content unchanged
- `validateNoRemnants()`: detects stale reference and returns violation; clean scan returns empty array
- `--dry-run` flag: no file writes occur after invocation; process exits 0
- Idempotency: re-running engine after completed migration produces zero replacements

### Integration Verification

- `validate:scripts:naming` passes after all renames applied (zero violations)
- `validate:scripts:usage` passes after refactor engine run (zero unresolved)
- `dev:generate:script-docs` is idempotent — running twice gives same `SCRIPT_REGISTRY.md`

### Existing Tests to Update

`scripts/validate/__tests__/runtime-scripts.test.ts` — update references from `validate-runtime-scripts` to `validate:scripts:runtime`.

---

## Rollback Strategy

Fully reversible via git revert:

- `package.json`, CI workflow, and script files can be reverted
- No database touched
- No migration files created
- No runtime behavior changed

---

## Orchestrator Gate (FR-010)

Before closure, verify all three exit 0:

```bash
bun run validate:scripts:naming
bun run validate:scripts:usage
bun run validate:scripts:infrastructure
```

Failure of any gate **blocks closure**.

---

## Non-Goals

- No business logic scripts added
- No new `packages/*` created
- No `apps/*` directory changes
- No AST-based replacement (deferred)
- No automated deprecation tracking

---

## Success Criteria Mapping

| #   | Criterion                                                 | Validation                                  |
| --- | --------------------------------------------------------- | ------------------------------------------- |
| 1   | All governed scripts follow `<domain>:<action>[:<scope>]` | `validate:scripts:naming` exits 0           |
| 2   | No broken script references                               | `validate:scripts:usage` exits 0            |
| 3   | Every `.ts` script has complete 5-field metadata header   | `validate:scripts:infrastructure` exits 0   |
| 4   | Registry complete and accurate                            | Registry regenerates without diff           |
| 5   | CI prevents future regressions                            | All 4 CI checks integrated and blocking     |
| 6   | Refactor engine shows 0 unresolved                        | `reports/SCRIPT_REFACTOR_REPORT.md` shows 0 |
| 7   | AI agents can create/rename scripts safely                | Skill updated with all required workflows   |
| 8   | Orchestrator gate blocks if validation fails              | Gate defined and enforced                   |

---

## Final Compliance Statement

Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.

This stage is developer tooling only. No tenant isolation is involved. No database connections are made. No runtime behavior is modified. No middleware is changed. No ADR is required.
