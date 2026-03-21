# Quickstart — INFRA_AUDIT_CHECKLIST Audit Script

**Stage:** INFRA_AUDIT_CHECKLIST  
**Phase:** 01_PLATFORM_FOUNDATION  
**Authored:** 2026-03-04

---

## Prerequisites

1. **Bun ≥ 1.0** installed: `bun --version`
2. You are at the **repo root**: `cd /path/to/zidney-app2`
3. Dependencies are installed: `bun install`
4. Confirm `infra-audit-report.json` is in `.gitignore` (Phase 0 of the plan). If not, add it before
   running.

---

## Running the Audit Script

```bash
bun run scripts/infra-audit.ts
```

This is the only command needed to execute the automated audit. It is **non-destructive** and
**read-only** (except writing `infra-audit-report.json`).

### What the script does

1. Recursively scans the monorepo (skipping `node_modules`, `.git`, secret files).
2. Locates all Vitest config files and records their settings.
3. Locates all ESLint config files and classifies format and Prettier risk.
4. Counts test files per app and package (unit, integration, spec).
5. Detects Playwright config presence per app.
6. Audits README presence and section completeness for all `apps/*` and `packages/*`.
7. Scans test files for skipped (`.skip`, `.todo`, `xit`, `xdescribe`) and flaky (`.retry`,
   `// flaky`) markers.
8. Writes results to `infra-audit-report.json` at the repo root.

### Expected console output

```
[INFRA AUDIT] Phase: Vitest Config Inventory...
[INFRA AUDIT] Phase: ESLint Config Inventory...
[INFRA AUDIT] Phase: Test File Counter...
[INFRA AUDIT] Phase: Playwright Detector...
[INFRA AUDIT] Phase: README Scanner...
[INFRA AUDIT] Phase: Skipped/Flaky Test Scanner...
[INFRA AUDIT] Writing infra-audit-report.json...
[INFRA AUDIT] ✓ Complete. Output: infra-audit-report.json
```

If a file could not be parsed, a structured warning is logged:

```
[INFRA AUDIT] WARN: PARSE_ERROR at path/to/file.ts — <error message>
```

The script continues and exits 0 even with parse warnings.

If a secret-pattern file is encountered:

```
[INFRA AUDIT] SKIP: SKIPPED (secret pattern) — .env.local
```

---

## Output Files Produced

| File                      | Location  | Committed?                 | Purpose                                               |
| ------------------------- | --------- | -------------------------- | ----------------------------------------------------- |
| `infra-audit-report.json` | Repo root | NO (ephemeral, gitignored) | Machine-readable audit data; re-generated on each run |

> **Note:** The three written deliverables (Gap Report, Risk Classification, Safe Rollout Plan) are
> NOT produced by the script. They are authored manually in Phase 3 using the script's JSON output
> as source data.

---

## Reading infra-audit-report.json

The JSON file has the following top-level keys:

```json
{
  "timestamp": "2026-03-04T12:00:00.000Z",   // ISO 8601 run timestamp
  "gitSha": "abc123...",                       // Commit SHA at time of run
  "vitestConfigs": [                           // Array of vitest config entries
    {
      "path": "vitest.config.ts",
      "environment": "node|jsdom|...",
      "globalsEnabled": true,
      "coverageEnabled": false,
      "customReporters": [],
      "status": "OK|PARSE_ERROR"
    }
  ],
  "eslintConfigs": [                           // Array of eslint config entries
    {
      "path": "eslint.config.mjs",
      "format": "flat|legacy",
      "status": "OK|PARSE_ERROR"
    }
  ],
  "playwrightConfigs": [                       // Array — empty if no Playwright found
    {
      "path": "...",
      "app": "..."
    }
  ],
  "totalTestFiles": {                          // Test file counts
    "apps": {
      "api":         { "unit": 0, "integration": 0, "spec": 0 },
      "backoffice":  { "unit": 0, "integration": 0, "spec": 0 },
      "frontoffice": { "unit": 0, "integration": 0, "spec": 0 },
      "mmc":         { "unit": 0, "integration": 0, "spec": 0 },
      "worker":      { "unit": 0, "integration": 0, "spec": 0 }
    },
    "packages": { ... }
  },
  "readmeAudit": {                             // README presence + section completeness
    "apps": {
      "api": {
        "readmePresent": false,
        "sections": null,
        "debtLevel": "HIGH"
      }
    },
    "packages": {
      "types": {
        "readmePresent": true,
        "sections": {
          "Purpose": "PRESENT|PRESENT_EMPTY|MISSING",
          "Responsibilities": "...",
          "Dependencies": "...",
          "Public API": "...",
          "How to Run Tests": "...",
          "Environment Variables": "...",
          "Known Boundaries": "..."
        },
        "debtLevel": "MEDIUM|LOW"
      }
    }
  },
  "skippedTests": {                            // Skipped test marker counts
    "detectionMethod": "STATIC_SCAN_ONLY",
    "apps": { "api": 0, ... },
    "packages": { ... }
  },
  "flakyTests": {                              // Flaky test marker counts
    "detectionMethod": "STATIC_SCAN_ONLY",
    "apps": { "api": 0, ... },
    "packages": { ... }
  },
  "consolidationRisk": "LOW|MEDIUM|HIGH",      // Vitest consolidation risk
  "prettierConflictRisk": "SAFE|NEEDS ALIGNMENT|CONFLICT PRESENT"
}
```

---

## Manual Audit Steps (script does NOT cover these)

After running the script, the following must be done **manually** to complete the audit:

| Step                             | What to Do                                                                                                                                                 | Where Results Go |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| ESLint rule severity             | Open each `eslint.config.*` and record severity for `no-unused-vars`, `@typescript-eslint/no-explicit-any`, `no-console`, `vue/multi-word-component-names` | Gap Report §3    |
| CI workflow posture              | Read each `.github/workflows/*.yml` and mark each step (Lint/Type/Unit/Integration/E2E/Coverage Gate) as Present/Absent/Informational                      | Gap Report §4    |
| `bun install` exit code          | Run and record                                                                                                                                             | Gap Report §5    |
| `bun run typecheck:src --noEmit` | Run and record total TS error count                                                                                                                        | Gap Report §7    |
| `bun run lint`                   | Run and record error and warning counts                                                                                                                    | Gap Report §7    |
| `bun test --coverage`            | Run, record Lines%/Fn%/Stmt%/Branch%; record DB-GATED failures                                                                                             | Gap Report §2    |
| `bun run build`                  | Run and record exit code                                                                                                                                   | Gap Report §5    |

---

## Reading the Gap Report

The Gap Report (`reports/GAP_REPORT.md`) is the primary output of this audit stage.

### Structure

Each top-level section (§1–§8) maps to one audit goal:

| Section | Audit Goal                  | Key Finding Location                           |
| ------- | --------------------------- | ---------------------------------------------- |
| §1      | Vitest Config Inventory     | Table: configs + consolidation risk            |
| §2      | Test Distribution           | Table: file counts + coverage baseline         |
| §3      | ESLint Config Audit         | Table: rule severity + Prettier risk           |
| §4      | CI Pipeline Audit           | Table: per-workflow step presence              |
| §5      | Bun Compatibility           | Table: command exit codes + verdict            |
| §6      | README Coverage             | Table: presence + section status               |
| §7      | Technical Debt Snapshot     | Table: TS errors, ESLint counts, skipped/flaky |
| §8      | Enforcement Readiness Score | Verdict table: 6 areas + overall verdict       |

### How to interpret findings

Findings are rows where the current state deviates from the target governance posture. Every finding
has:

- A **Gap ID** (e.g., `GAP-001`)
- A **description** of the deviation
- Cross-reference to the corresponding **Risk Classification** entry

### Enforcement Readiness Score interpretation

The readiness score table appears at the end of the Gap Report (§8) and has 6 rows:

| Governance Area      | Status           | Justification (if NEEDS WORK) |
| -------------------- | ---------------- | ----------------------------- |
| Vitest Consolidation | READY/NEEDS WORK | ...                           |
| Coverage Threshold   | READY/NEEDS WORK | ...                           |
| E2E Isolation        | READY/NEEDS WORK | ...                           |
| ESLint Enforcement   | READY/NEEDS WORK | ...                           |
| Husky Hooks          | READY/NEEDS WORK | ...                           |
| CI Matrix            | READY/NEEDS WORK | ...                           |

**Overall verdict rule (verbatim):**

> - 0 areas NEEDS WORK → `READY FOR ENFORCEMENT`
> - 1–3 areas NEEDS WORK → `PARTIAL — FIX REQUIRED`
> - 4–6 areas NEEDS WORK → `NOT READY`

A `PARTIAL — FIX REQUIRED` or `NOT READY` verdict means `STAGE_INFRA_GOVERNANCE` implementation
**must not begin** until the referenced gaps are resolved.

---

## Re-running the Audit

The script is **idempotent**. Re-running it at any time:

- Overwrites `infra-audit-report.json` silently (by design — see CL2 in spec).
- Produces fresh counts reflecting the current codebase state.
- Does not modify any tracked file.

To compare two audit runs, use `git stash` or copy `infra-audit-report.json` to a temporary location
before re-running.

---

## Troubleshooting

| Symptom                                           | Likely Cause                              | Resolution                                                                      |
| ------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `command not found: bun`                          | Bun not installed                         | Install via `curl -fsSL https://bun.sh/install \| bash`                         |
| `infra-audit-report.json` appears in `git status` | Missing `.gitignore` entry                | Add `infra-audit-report.json` to `.gitignore`                                   |
| Script exits non-zero                             | Parse error in a config file              | Check console `PARSE_ERROR` lines; script should still exit 0 if scan completes |
| Coverage run hangs                                | DB-dependent tests waiting for connection | Let run complete; DB-gated tests will fail naturally; record as `DB-GATED`      |
| ESLint rule severity missing from JSON            | Flat config cannot be statically imported | Complete the manual ESLint rule severity step (Phase 2)                         |
