# Testing Guide — INFRA_AUDIT_CHECKLIST

**Stage:** INFRA_AUDIT_CHECKLIST
**Phase:** 01_PLATFORM_FOUNDATION
**Stage Directory:** infra-002-audit-checklist
**Generated On:** 2026-03-04T00:00:00.000Z

---

## Purpose

This guide explains how to validate the infrastructure audit implementation end-to-end.
The INFRA_AUDIT_CHECKLIST stage is **read-only** — it produces no new runtime behavior,
only documentation and tooling. Testing focuses on verifying the audit script execution,
report accuracy, and readiness for STAGE_INFRA_GOVERNANCE.

---

## Summary of Delivered Behavior

The stage delivers a **non-destructive infrastructure audit CLI tool** that:

- Scans the Zidney monorepo for test configs, linters, CI workflows, and READMEs
- Produces a 11-key JSON report that quantifies infrastructure readiness
- Generates 3 strategic documents: Gap Report, Risk Classification, Safe Rollout Plan

Key outcomes:

- **Audit Script:** `scripts/infra-audit.ts` — Bun CLI tool (exit 0 on success; read-only)
- **Gap Analysis:** 8-area infrastructure deficit documentation (393 lines)
- **Risk Matrix:** Governance readiness scorecard marking all areas as NEEDS WORK (74 lines)
- **Rollout Strategy:** Phased governance tightening plan (208 lines)
- **Evidence Base:** Audit findings ready to drive STAGE_INFRA_GOVERNANCE sub-stages

---

## Prerequisites

| Requirement                                                | Validation Command                         |
| ---------------------------------------------------------- | ------------------------------------------ |
| Bun v1.3.9+ installed                                      | `bun --version`                            |
| Repo at develop branch                                     | `git branch`                               |
| Node.js v20+ (for type checking)                           | `node --version`                           |
| git available in PATH                                      | `git version`                              |
| No uncommitted changes on infra-002-audit-checklist branch | `git status --porcelain` (should be empty) |

---

## Files in Scope

```text
NEW FILES:
  scripts/infra-audit.ts                    (255 lines, Bun CLI utility)
  specs/runtime/infra-002-audit-checklist/reports/GAP_REPORT.md           (393 lines)
  specs/runtime/infra-002-audit-checklist/reports/RISK_CLASSIFICATION.md  (74 lines)
  specs/runtime/infra-002-audit-checklist/reports/SAFE_ROLLOUT_PLAN.md    (208 lines)
  specs/runtime/infra-002-audit-checklist/audits/VALIDATION_REPORT.md     (200 lines)
  specs/runtime/infra-002-audit-checklist/reports/IMPLEMENT_REPORT.md     (180 lines)
  specs/runtime/infra-002-audit-checklist/reports/CLOSURE_REPORT.md       (180 lines)

MODIFIED FILES:
  .gitignore                                (added: infra-audit-report.json)
  specs/runtime/infra-002-audit-checklist/tasks.md (all 53 tasks: [X])
  specs/phases/01_PLATFORM_FOUNDATION/INFRA_AUDIT_CHECKLIST.md (status: BACKEND CLOSED)
```

---

## Local Run Commands

```bash
# Navigate to repo root
cd /path/to/zidney-app2

# Verify Bun version
bun --version        # Expected: v1.3.9 or later

# Run the audit script
bun run scripts/infra-audit.ts

# Expected output: [INFRA AUDIT] … summary
# Expected file: infra-audit-report.json (at repo root, gitignored)
```

---

## Automated Validation Commands

### Command 1: Run Audit Script

**Purpose:** Verify the audit script executes cleanly and produces valid JSON

```bash
cd /path/to/zidney-app2
bun run scripts/infra-audit.ts
echo "Exit code: $?"
cat infra-audit-report.json | bun -e "const d = await Bun.stdin.json(); console.log('JSON valid:', Object.keys(d).length === 11)"
```

**Expected outcome:**

- Exit code: 0
- stdout: [INFRA AUDIT] phase markers + summary
- infra-audit-report.json: valid JSON with 11 top-level keys

### Command 2: Verify Required JSON Keys

**Purpose:** Confirm the audit output has all 11 required keys

```bash
python3 -c "import json; d = json.load(open('infra-audit-report.json')); required = ['timestamp', 'gitSha', 'vitestConfigs', 'eslintConfigs', 'playwrightConfigs', 'totalTestFiles', 'readmeAudit', 'skippedTests', 'flakyTests', 'consolidationRisk', 'prettierConflictRisk']; print('All keys present:', all(k in d for k in required)); print('Keys:', list(d.keys()))"
```

**Expected outcome:**

```
All keys present: True
Keys: ['timestamp', 'gitSha', 'vitestConfigs', ..., 'prettierConflictRisk']
```

### Command 3: Verify Gitignore Entry

**Purpose:** Confirm infra-audit-report.json will not be committed

```bash
git status infra-audit-report.json
```

**Expected outcome:**

```
fatal: pathspec 'infra-audit-report.json' did not match any files
```

(This means it's properly gitignored and will not appear in `git status`)

### Command 4: Type Check the Audit Script

**Purpose:** Ensure the new script compiles without errors

```bash
bun run tsc --noEmit scripts/infra-audit.ts
```

**Expected outcome:** Exit 0 (no TypeScript errors from infra-audit.ts)

### Command 5: Lint the Audit Script

**Purpose:** Verify the script meets linting standards

```bash
bun run lint -- scripts/infra-audit.ts
```

**Expected outcome:** Exit 0 or warnings only (no errors specific to infra-audit.ts)

---

## Manual Test Scenarios

### Scenario 1 — Audit Script Produces Summary Output

**Purpose:** Verify the script logs expected phase markers and a success summary

**Steps:**

1. Navigate to repo root: `cd /path/to/zidney-app2`
2. Run the audit script: `bun run scripts/infra-audit.ts`
3. Watch stdout for these phase markers:
   - `[INFRA AUDIT] Starting infrastructure audit...`
   - `[INFRA AUDIT] Phase: Vitest Config Inventory...`
   - `[INFRA AUDIT] Phase: ESLint Config Inventory...`
   - `[INFRA AUDIT] Phase: Playwright Detector...`
   - `[INFRA AUDIT] Phase: Test File Counter...`
   - `[INFRA AUDIT] Phase: README Scanner...`
   - `[INFRA AUDIT] Phase: Skipped/Flaky Test Scanner...`
   - `[INFRA AUDIT] Writing infra-audit-report.json...`
   - `[INFRA AUDIT] ✓ Complete.`

**Expected:**

- All phases logged in order
- Final message indicates success
- Summary shows counts: Vitest configs (5), ESLint configs (4), test files (116), etc.
- Exit code: 0

**Troubleshooting:**

- If exit code ≠ 0: Check file permissions on repo root (`chmod 755 scripts/infra-audit.ts`)
- If phase is missing or JSON malformed: Verify no .env secrets are interfering with file reads

### Scenario 2 — JSON Output Matches Expected Keys

**Purpose:** Verify the 11-key JSON structure

**Steps:**

1. Run: `bun run scripts/infra-audit.ts`
2. Inspect the JSON: `cat infra-audit-report.json | jq 'keys'`
3. Confirm all 11 keys are present

**Expected:**

```json
[
  "consolidationRisk",
  "eslintConfigs",
  "flakyTests",
  "gitSha",
  "playwrightConfigs",
  "prettierConflictRisk",
  "readmeAudit",
  "skippedTests",
  "timestamp",
  "totalTestFiles",
  "vitestConfigs"
]
```

### Scenario 3 — Gap Report Lists Specific Findings

**Purpose:** Verify the Gap Report identifies infrastructure deficits

**Steps:**

1. Open [specs/runtime/infra-002-audit-checklist/reports/GAP_REPORT.md](../reports/GAP_REPORT.md)
2. Scan for section headers: US1–US8 (Vitest, Tests, ESLint, CI, Bun, READMEs, Tech Debt, Readiness)
3. For each section, verify at least ONE specific finding is listed (e.g., "5 Vitest configs at root, apps, packages; no workspace config")

**Expected:**

- All 8 sections present
- Each section has ≥1 finding (not generic placeholders)
- Findings cite specific files/paths (e.g., "apps/api/vitest.config.ts")

### Scenario 4 — Risk Classification Marks All Areas as NEEDS WORK

**Purpose:** Verify the risk matrix is accurate

**Steps:**

1. Open [specs/runtime/infra-002-audit-checklist/reports/RISK_CLASSIFICATION.md](../reports/RISK_CLASSIFICATION.md)
2. Check the risk matrix table
3. Verify all 6 governance areas are marked as "NEEDS WORK" (per CL7 readiness thresholds)

**Expected:**

- All 6 rows: Risk = NEEDS WORK
- No areas marked READY or PARTIAL READY (because all have <4 criteria met)

### Scenario 5 — Safe Rollout Plan Lists Prerequisites

**Purpose:** Verify the rollout plan gates STAGE_INFRA_GOVERNANCE on audit completion

**Steps:**

1. Open [specs/runtime/infra-002-audit-checklist/reports/SAFE_ROLLOUT_PLAN.md](../reports/SAFE_ROLLOUT_PLAN.md)
2. Find section: "Prerequisites for STAGE_INFRA_GOVERNANCE"
3. Verify at least ONE item states: "This audit (INFRA_AUDIT_CHECKLIST) must reach status PRODUCTION READY"

**Expected:**

- Prerequisites gate future enforcement on this stage's completion
- No enforcement should proceed without this audit as a checkpoint

---

## Reports Validation Checklist

- ✅ GAP_REPORT.md: 8 sections, ≥1 finding per section, specific file paths cited
- ✅ RISK_CLASSIFICATION.md: All 6 areas marked according to spec thresholds
- ✅ SAFE_ROLLOUT_PLAN.md: References this audit as prerequisite for STAGE_INFRA_GOVERNANCE
- ✅ PR_SUMMARY.md: Uses actual counts from infra-audit-report.json (e.g., "5 Vitest configs", "116 test files")

---

## Pre-Merge Checklist

Before merging the PR:

- [ ] Ran `bun run scripts/infra-audit.ts` — exit 0
- [ ] Verified infra-audit-report.json has all 11 keys
- [ ] Confirmed infra-audit-report.json is in .gitignore
- [ ] Reviewed GAP_REPORT.md — all findings are specific and credible
- [ ] Reviewed RISK_CLASSIFICATION.md — readiness levels match spec thresholds
- [ ] Reviewed SAFE_ROLLOUT_PLAN.md — prerequisites are clear
- [ ] All 3 reports cross-reference each other (relative markdown links)
- [ ] No existing source/config/schema/test files were modified
- [ ] Type check passes: `bun run tsc --noEmit`
- [ ] Lint check passes (or only pre-existing warnings): `bun run lint`

---

## Post-Merge Handoff

After this stage is merged to develop:

1. **Start STAGE_INFRA_GOVERNANCE** — Use findings to enforce improvements
2. **Track findings as work items** — Map each GAP_REPORT finding to a sub-stage
3. **Use SAFE_ROLLOUT_PLAN** — Phase governance tightening to avoid breaking changes
4. **Reference these documents in STAGE_INFRA_GOVERNANCE specs**

---

## Support & Escalation

If tests fail or findings are unclear:

1. Review [reports/IMPLEMENT_REPORT.md](../reports/IMPLEMENT_REPORT.md) for implementation details
2. Review [audits/VALIDATION_REPORT.md](../audits/VALIDATION_REPORT.md) for baseline issues
3. Check [research.md](../research.md) for monorepo structure reference
4. If issue is infrastructure-related (DB, Docker, etc.), ensure docker-compose.test.yml is running
