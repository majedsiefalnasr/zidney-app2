# INFRA_AUDIT_CHECKLIST

Phase: 01_PLATFORM_FOUNDATION  
Related Stage: STAGE_INFRA_GOVERNANCE  
Purpose: Non-destructive audit before governance enforcement

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: LOW
Last Updated: 2026-03-04T00:00:00.000Z

Tasks Generated:

- Total: 53 atomic tasks
- Phase 0 (Research & Setup): 7 tasks
- Phase 1 (Audit Script, US9): 12 tasks
- Phase 2 (Manual Supplements, US1–US8): 30 tasks
- Phase 3 (Written Deliverables, US10): 4 tasks
- Parallelizable: 33 tasks

Deferred Scope:

- Any Vitest consolidation, ESLint rule changes, Husky hooks, CI workflow modifications — deferred to STAGE_INFRA_GOVERNANCE

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation

Notes:
53 atomic tasks generated. All tasks are read-only or additive. T053 is the final governance gate.

---

# 1. Objective

This checklist must be completed BEFORE:

- Consolidating Vitest configs
- Enforcing coverage thresholds
- Introducing Husky hooks
- Tightening ESLint rules
- Adding E2E enforcement gates

This is a READ-ONLY audit phase.

No refactors allowed during audit.

---

# 2. Vitest Configuration Inventory

## 2.1 Locate All Vitest Config Files

Search for:

- vitest.config.ts
- vitest.config.js
- vitest.workspace.ts
- Any inline test config inside package.json

Record:

| Location | Environment | Custom Coverage? | Notes |
| -------- | ----------- | ---------------- | ----- |

---

## 2.2 Environment Classification

For each config, identify:

- test.environment (node / jsdom / happy-dom / browser)
- globals enabled?
- coverage enabled?
- custom reporters?

Mark inconsistencies.

---

## 2.3 Projects Consolidation Risk

Check:

- Are test includes overlapping?
- Are different coverage thresholds defined?
- Are multiple configs redefining globals?

Risk Level:

- LOW
- MEDIUM
- HIGH

---

# 3. Test Distribution Audit

## 3.1 Unit Tests Count

Count:

- apps/_/src/\*\*/_.test.ts
- packages/_/src/\*\*/_.test.ts

Record totals per app.

---

## 3.2 Integration Tests Count

Count:

- apps/_/tests/integration/\*\*/_.test.ts

Record totals.

---

## 3.3 E2E Tests Presence

For each app:

| App | Playwright Config Exists? | E2E Tests Present? | CI Integrated? |
| --- | ------------------------- | ------------------ | -------------- |

---

## 3.4 Coverage Baseline

Run:

bun test --coverage

Record:

- Lines %
- Functions %
- Statements %
- Branches %

These numbers define current baseline.

Do NOT change thresholds yet.

---

# 4. ESLint Audit

## 4.1 Config Locations

Search for:

- .eslintrc.\*
- eslint.config.\*
- Overrides in package.json

Record:

| Location | Extends | Overrides | Notes |

---

## 4.2 Rule Severity Mapping

Identify:

- Which rules are "error"
- Which rules are "warn"

Specifically check:

- no-unused-vars
- @typescript-eslint/no-explicit-any
- no-console
- vue/multi-word-component-names

---

## 4.3 ESLint + Prettier Conflict Risk

Check:

- Is eslint-config-prettier installed?
- Is prettier already installed?
- Any formatting rules duplicated in ESLint?

Risk:

- SAFE
- NEEDS ALIGNMENT
- CONFLICT PRESENT

---

# 5. CI Pipeline Audit

Inspect:

.github/workflows/

Record:

| Workflow | Lint | Type Check | Unit | Integration | E2E | Coverage Gate |

---

Check:

- Is coverage threshold enforced?
- Is E2E currently blocking merge?
- Is build step validated?

---

# 6. Bun Compatibility Audit

Verify:

- bun install works without errors
- bun test works
- bun run lint works
- bun run build works

Document any incompatibility with Node-only tooling.

---

# 7. README Coverage Audit

For each:

apps/_  
packages/_

Record:

| Directory | README Present? | Sections Complete? |

Sections required:

- Purpose
- Responsibilities
- Dependencies
- Public API (packages only)
- How to run tests
- Environment variables
- Known boundaries

---

# 8. Technical Debt Snapshot

Record:

- TypeScript error count
- ESLint error count
- ESLint warning count
- Flaky tests?
- Skipped tests?

This snapshot prevents regression masking.

---

# 9. Enforcement Readiness Score

After audit, classify readiness:

| Area                 | Status             |
| -------------------- | ------------------ |
| Vitest Consolidation | READY / NEEDS WORK |
| Coverage Threshold   | READY / NEEDS WORK |
| E2E Isolation        | READY / NEEDS WORK |
| ESLint Enforcement   | READY / NEEDS WORK |
| Husky Hooks          | READY / NEEDS WORK |
| CI Matrix            | READY / NEEDS WORK |

Overall Governance Readiness:

- READY FOR ENFORCEMENT
- PARTIAL — FIX REQUIRED
- NOT READY

---

# 10. Output Requirement

This audit must produce:

- A written Gap Report
- A Risk Classification
- A Safe Rollout Plan
- No structural changes

Only after this report:

Proceed to STAGE_INFRA_GOVERNANCE implementation.

---

Status Upon Completion:
AUDIT COMPLETE — READY FOR GOVERNANCE ALIGNMENT

---

# 11. Automated Audit Script (Repeatable Execution)

To avoid manual counting and ensure repeatability, create a Bun-compatible audit script:

Recommended location:
scripts/infra-audit.ts

Suggested implementation:

```ts
import { readdirSync, statSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

function findFiles(dir: string, pattern: RegExp, results: string[] = []) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
        findFiles(fullPath, pattern, results)
      }
    } else if (pattern.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}

function findDirectories(dir: string, results: string[] = []) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      results.push(join(dir, entry.name))
    }
  }
  return results
}

const vitestConfigs = findFiles('.', /vitest\.config|vitest\.workspace/)
const eslintConfigs = findFiles('.', /\.eslintrc|eslint\.config/)
const playwrightConfigs = findFiles('.', /playwright\.config/)
const testFiles = findFiles('.', /\.test\.ts$/)

const appsDirs = existsSync('apps') ? findDirectories('apps') : []
const packagesDirs = existsSync('packages') ? findDirectories('packages') : []

const readmeAudit = [...appsDirs, ...packagesDirs].map((dir) => ({
  directory: dir,
  hasReadme: existsSync(join(dir, 'README.md')),
}))

const report = {
  vitestConfigs,
  eslintConfigs,
  playwrightConfigs,
  totalTestFiles: testFiles.length,
  readmeAudit,
  timestamp: new Date().toISOString(),
}

console.log('=== INFRA AUDIT SNAPSHOT ===')
console.log(JSON.stringify(report, null, 2))

writeFileSync('infra-audit-report.json', JSON.stringify(report, null, 2))
console.log('Report written to infra-audit-report.json')
```

Run with:

```bash
bun run scripts/infra-audit.ts
```

Optional enhancements:

- Add coverage parsing
- Add README presence scan
- Add Playwright config detection
- Export JSON report

This script must remain read-only.
No modifications allowed during audit phase.

---

Status remains unchanged:
AUDIT COMPLETE — READY FOR GOVERNANCE ALIGNMENT
