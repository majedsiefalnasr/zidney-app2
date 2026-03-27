# STAGE_INFRA_25_SCRIPT_SYSTEM_STANDARDIZATION_AND_GOVERNANCE

## Stage Status

Status: PRODUCTION READY
Closure Date: 2026-03-21
Risk Level: LOW
Last Updated: 2026-03-21T15:25:00Z

Implementation: COMPLETE
Tasks: 14 / 14 completed

Scope Closed:

- T001: SCRIPT_MIGRATION_MAP.md created with 33 migration entries
- T002: SCRIPT_REGISTRY.md placeholder created (regenerated via dev:generate:script-docs)
- T003: script-naming.ts validator implemented (domain:action[:scope] convention)
- T004: script-usage.ts validator implemented (bun run reference scan with false-positive filters)
- T005: script-infrastructure.ts validator implemented (5-field metadata + registry freshness)
- T006: refactor-scripts.ts engine implemented (Type A–E logic + dry-run mode)
- T007: script-docs.ts generator updated (enforces 5-field metadata)
- T008: 5 new governed package.json entries added (validate:script:\*, validate:scripts:registry, validate:scan:packages, ai:validate:prompts)
- T009: @category + @usage metadata added to all tracked scripts (27 registered)
- T010: 33 renames/removals applied from SCRIPT_MIGRATION_MAP
- T011: dev:refactor:scripts live run completed and verified
- T012: CI validation block added to architecture-governance.yml
- T013: script-system-governance SKILL.md updated with governance rules
- T014: Full validation gate passed — validate:scripts:naming, validate:scripts:usage, validate:scripts:infrastructure, dev:generate:script-docs ✅

Deferred Scope:

- AST-based replacement (future enhancement beyond regex engine)

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation — N/A (INFRA stage, no multi-tenant changes)
- ADR-0007 Version compatibility enforcement — ✅ Verified
- ADR-0008 Semantic versioning alignment — ✅ Verified
- All validation gates passed — ✅ 4/4 validators PASS
- All guardian verdicts — ✅ 6/6 PASS
- Constitutional compliance audit — ✅ COMPLIANT

Notes:
Production ready. All validation gates passed. Script governance system is live across the monorepo. Use `PR_SUMMARY.md` to create PR. Share `guides/TESTING_GUIDE.md` with QA/reviewers.

- Automated script deprecation tracking
- Auditing existing invocation command-strings (FR-005 deferred to future INFRA stage)

Constitutional Compliance:

- All drift criteria passed — implementation authorized
- INFRA stage: no tenant isolation, license, DB, or routing requirements applicable
- Test coverage specified for all 4 implementation tasks

Notes:
Drift analysis passed (Attempt 2). Implementation gate open.

---

## Purpose

Standardize and govern the entire script system across Zidney to ensure:

- deterministic execution
- consistent naming
- zero drift between script definition and usage
- full integration with CI, orchestrator, and AI agents

This stage eliminates inconsistencies and turns scripts into a **first-class governed system**.

---

## Core Problem

Current issues:

- inconsistent naming (`db:*`, `validate-*`, `validate:*`)
- inconsistent invocation (`bun run scripts/...` vs `bun scripts/...`)
- no mapping between script name and file
- no guarantee that renamed scripts are updated across the repo
- no enforcement of domains or structure

---

## Scope

- script naming standardization
- script-to-file mapping enforcement
- invocation standardization
- usage refactoring across repo (CRITICAL)
- script registry + metadata
- CI + orchestrator enforcement
- AI skill for script governance

---

## Success Criteria

- all scripts follow naming convention
- all script calls across repo are updated
- no broken script references
- CI prevents invalid scripts
- orchestrator validates script integrity
- script registry is complete and consistent

---

## Naming Convention (MANDATORY)

```
<domain>:<action>[:<scope>]
```

### Examples

| Old                      | New                      |
| ------------------------ | ------------------------ |
| db:pool-status           | db:status:pool           |
| db:validate-licenses     | db:validate:licenses     |
| validate-runtime-scripts | validate:scripts:runtime |
| arch:validate-brain      | arch:validate:brain      |

---

## Domain Map

Allowed domains:

```
db
arch
validate
ai
ci
repo
dev
infra
test
```

---

## Tasks

### T001 – Script Inventory

Scan:

- root package.json
- apps/\*/package.json
- packages/\*/package.json

Build mapping:

- script name
- file path
- usage locations

---

### T002 – Naming Migration Plan

Create mapping:

```
old-name → new-name
```

Store in:

```
docs/scripts/SCRIPT_MIGRATION_MAP.md
```

---

### T003 – Usage Refactor (CRITICAL)

Search and update ALL usages of scripts across:

- package.json files
- CI workflows
- scripts/
- docs/
- tests/
- orchestrator agent
- shell scripts

Requirement:

> No script rename is allowed unless ALL references are updated.

---

### T004 – Invocation Standardization

All scripts MUST use:

```
bun scripts/<domain>/<file>.ts
```

Disallow:

```
bun run scripts/...
```

---

### T005 – Script Metadata

Each script must include:

```ts
/**
 * @script db:status:pool
 * @domain db
 * @category runtime
 * @description Show DB pool status
 * @usage bun run db:status:pool
 */
```

---

### T006 – Script Registry

Auto-generate:

```
docs/scripts/SCRIPT_REGISTRY.md
```

Include:

- script name
- domain
- file path
- category
- description

---

### T007 – Validation Scripts

Create:

```
scripts/validate/script-naming.ts
scripts/validate/script-usage.ts
```

Checks:

- naming convention compliance
- script-file mapping
- no orphan scripts
- no broken references

---

### T008 – CI Integration

Add:

```
bun run validate-script-naming
bun run validate-script-usage
bun run validate-script-infrastructure
bun run dev:generate:script-docs
```

Fail CI if:

- invalid naming
- missing references
- mismatched mapping

---

### T009 – Orchestrator Gate

Before closure:

```
- validate script naming
- validate script usage
- validate no broken references
```

Failure → BLOCK closure

---

### T010 – AI Skill

Create:

```
.agents/skills/script-system-governance/SKILL.md
```

Content must include:

- naming rules
- domain rules
- how to create new scripts
- how to refactor scripts
- how to update usage safely
- anti-patterns

---

### T011 – Script Refactor Engine

#### Purpose

Provide an automated, deterministic mechanism to safely refactor script names across the entire repository using a migration map.

This prevents broken references during script renaming and ensures full propagation across all surfaces.

---

#### Inputs

- Migration map:

```
docs/scripts/SCRIPT_MIGRATION_MAP.md
```

- Script inventory (T001 output)

---

#### Output

- Updated script references across the repository
- Refactor report:

```
reports/SCRIPT_REFACTOR_REPORT.md
```

---

#### Implementation

Create:

```
scripts/refactor-scripts.ts
```

---

#### Responsibilities

1. Parse migration map:
   - old → new script names

2. Scan repository for references:
   - package.json (root + workspaces)
   - `.github/workflows/*`
   - `scripts/**/*.ts`
   - `docs/**/*.md`
   - `specs/**/*.md`
   - `.agents/**/*.md`

3. Replace all occurrences:

```
bun run <old>
→
bun run <new>
```

4. Validate no remaining old references exist

5. Generate report:
   - total replacements
   - unresolved references (if any)

---

#### Validation

Run:

```bash
bun run refactor-scripts
bun run validate-script-usage
```

---

#### Failure Handling

If any old script reference remains:

```
❌ Script refactor incomplete — unresolved references detected.
Why it matters: partial migration breaks CI and runtime.
Fix: update migration map or extend scan scope.
```

→ STOP until resolved

---

#### Script Skeleton

```ts
#!/usr/bin/env bun

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes("--dry-run");

function loadMigrationMap() {
  const file = path.join(ROOT, "docs/scripts/SCRIPT_MIGRATION_MAP.md");
  const content = fs.readFileSync(file, "utf-8");

  const map: Record<string, string> = {};

  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/`(.+?)`\s*→\s*`(.+?)`/);
    if (match) {
      map[match[1]] = match[2];
    }
  }

  return map;
}

function scanFiles(dir: string, files: string[] = []) {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (["node_modules", ".git", "dist", "coverage"].includes(entry)) continue;
      scanFiles(full, files);
    } else {
      if (/\.(md|json|ts|yml|yaml|js)$/.test(full)) {
        files.push(full);
      }
    }
  }

  return files;
}

function buildPatterns(oldName: string, newName: string) {
  return [
    {
      label: "bun run",
      regex: new RegExp(`bun run ${oldName}`, "g"),
      replace: `bun run ${newName}`,
    },
    {
      label: "bun direct",
      regex: new RegExp(`\\bbun ${oldName}\\b`, "g"),
      replace: `bun ${newName}`,
    },
    {
      label: "npm run",
      regex: new RegExp(`npm run ${oldName}`, "g"),
      replace: `npm run ${newName}`,
    },
    {
      label: "pnpm run",
      regex: new RegExp(`pnpm (run )?${oldName}`, "g"),
      replace: `pnpm run ${newName}`,
    },
  ];
}

function diffPreview(before: string, after: string) {
  if (before === after) return "";
  const b = before.split("\n");
  const a = after.split("\n");
  const max = Math.max(b.length, a.length);
  let out = "";
  for (let i = 0; i < max; i++) {
    if (b[i] !== a[i]) {
      if (b[i] !== undefined) out += `- ${b[i]}\n`;
      if (a[i] !== undefined) out += `+ ${a[i]}\n`;
    }
  }
  return out;
}

function refactor() {
  const map = loadMigrationMap();
  const files = scanFiles(ROOT);

  let replacements = 0;
  let filesChanged = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, "utf-8");
    let updated = content;

    for (const [oldName, newName] of Object.entries(map)) {
      const patterns = buildPatterns(oldName, newName);

      for (const p of patterns) {
        if (p.regex.test(updated)) {
          updated = updated.replace(p.regex, p.replace);
          replacements++;
        }
      }
    }

    if (updated !== content) {
      filesChanged++;
      const diff = diffPreview(content, updated);

      console.log(`\n--- ${file} ---`);
      console.log(diff.slice(0, 2000)); // limit output

      if (!DRY_RUN) {
        fs.writeFileSync(file, updated);
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Files changed: ${filesChanged}`);
  console.log(`Total replacements: ${replacements}`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);

  if (filesChanged === 0) {
    console.log("No changes needed.");
  }
}

refactor();
```

---

#### Notes

- Must be idempotent (safe to run multiple times)
- Must not modify unrelated text
- Must preserve formatting
- Future enhancement: AST-based replacement instead of regex

---

## Critical Rule

> Script renaming MUST propagate across the entire repository.

No partial renaming allowed.

---

## Guard Guarantees

After this stage:

- no broken script calls
- naming is deterministic
- scripts are discoverable
- AI agents understand script system
- CI enforces integrity

---

## Final Outcome

Transforms scripts from:

> ad-hoc utilities

into:

> **a governed, structured, and enforceable execution system**
