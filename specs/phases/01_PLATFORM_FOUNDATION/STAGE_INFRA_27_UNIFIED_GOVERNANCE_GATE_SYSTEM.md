# STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: LOW
Last Updated: 2026-03-25T01:30:00Z

Tasks Generated:

- Total: 16 atomic tasks across 7 parallelization groups
- 3 new script files: gate.ts, gate-ci.ts, report.ts
- 5 new package.json scripts
- pre-commit, CI workflow, .gitignore, docs updates
- 1 unit test file, 4 final validation tasks

Deferred Scope:

- Runtime monitoring (explicitly out of scope)
- External security tooling beyond Trivy (out of scope)

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation
- Architecture Guardian: PASS
- API Designer: PASS

Notes:
Atomic task set generated. 16 tasks in 7 dependency-ordered groups. Drift analysis gate pending.

---

## Scope Reference

Scope Planned:

- Unified governance gate (`governance:gate`) composing 6 guards in report-all mode with canonical script names
- CI mode variant (`governance:gate:ci`) with GitHub Actions annotation support
- Changed-files scoped variant (`governance:gate:changed`) using fail-fast `&&` semantics (intentional)
- Report generation command (`governance:report`) — always exits 0, audit tool only
- `ai-context:validate` alias created in INFRA-27 (chaining `validate:ai-context-fresh && validate:ai-context-schemas`)
- Pre-commit integration after Trivy secret scan
- CI integration as step 18 after step 17 (`Verify Script Registry Generation`) in `architecture-governance.yml`
- Orchestrator Step 6 / Step 7 gates documented
- `governance` registered as 10th canonical domain in `script-system-governance/SKILL.md`
- `docs/governance/governance-report.md` added to `.gitignore`

Deferred Scope:

- Runtime monitoring (explicitly out of scope)
- External security tooling beyond Trivy (out of scope)

Constitutional Compliance:

- Technical plan compliant — task generation authorized
- Architecture Guardian: PASS
- API Designer: PASS

Notes:
Technical plan complete. Guardian validation passed (2 remediation rounds). Task breakdown in progress.

---

## Objective

Unify all enforcement layers into a single **Governance Gate System** that deterministically blocks invalid states across:

- Architecture (boundaries, drift)
- Scripts (existence, naming, usage)
- Security (vulnerabilities, secrets, misconfig)

This stage consolidates prior infra work (INFRA-16, 21, 22, 26) into a **single, composable, fail-fast gate** used by pre-commit, CI, and orchestrator.

---

## Scope

### In Scope

- Unified governance command surface
- Composition of existing guards:
  - architecture-guard
  - type-safety-guard
  - script-system-governance
  - trivy security scans
- Pre-commit + CI + Orchestrator integration
- Standardized reporting + exit codes
- Docs under `docs/governance/`

### Out of Scope

- Runtime monitoring
- External security tooling beyond Trivy

---

## Governance Gate Model

### Layers

1. **Pre-Commit Gate (fast, scoped)**
2. **CI Gate (full, blocking)**
3. **Orchestrator Gate (final authority)**

### Composition

```text
governance:gate
├── arch:guard
├── validate:types (type-safety-guard)
├── validate:runtime-scripts
├── script:usage-scan
├── security:scan:ci
└── ai-context:validate
```

---

## Command Surface (MANDATORY)

### Primary Commands

| Script                    | Purpose                    |
| ------------------------- | -------------------------- |
| `governance:gate`         | Full unified gate          |
| `governance:gate:ci`      | CI mode (strict, blocking) |
| `governance:gate:changed` | Changed-files scoped       |
| `governance:report`       | Generate report            |

### Naming

```
governance:<action>[:scope]
```

---

## Script Implementation

### Location

```
scripts/governance/
```

### Orchestrator Script

```ts
// scripts/governance/gate.ts
import { $ } from "bun";

await $`bun run arch:guard`;
await $`bun run validate:types`;
await $`bun run validate:runtime-scripts`;
await $`bun run script:usage-scan`;
await $`bun run security:scan:ci`;
await $`bun run ai-context:validate`;
```

### CI Variant

```ts
// scripts/governance/gate-ci.ts
import { $ } from "bun";

await $`bun run governance:gate`;
```

---

## Package.json Integration

```json
{
  "scripts": {
    "governance:gate": "bun run scripts/governance/gate.ts",
    "governance:gate:ci": "bun run scripts/governance/gate-ci.ts",
    "governance:gate:changed": "bun run arch:guard:changed && bun run validate:runtime-scripts",
    "governance:report": "bun run arch:health && bun run ai-context:validate"
  }
}
```

---

## Pre-Commit Integration

Extend `.husky/pre-commit`:

```bash
bun run governance:gate:changed
```

### Fail Conditions

- Any guard fails
- Missing scripts
- Type violations
- Critical vulnerabilities

---

## CI Integration

### Workflow Step

```yaml
- name: Unified Governance Gate
  run: bun run governance:gate:ci
```

### Blocking Rules

Fail CI if any sub-check fails.

---

## Orchestrator Integration

### Step 6 — Implement (Pre-Execution)

- MUST run `governance:gate:changed`

### Step 7 — Closure (Final Gate)

- MUST run `governance:gate`

### Behavior

- BLOCK if any violation exists
- Surface normalized report

---

## Reporting

### Output

```
docs/governance/governance-report.md
```

### Contents

- Architecture violations
- Script violations
- Security findings
- Type safety issues

---

## Exit Code Policy

| Condition | Exit |
| --------- | ---- |
| Success   | 0    |
| Warning   | 0    |
| Failure   | 1    |

---

## Success Criteria

- Single command enforces all governance
- No duplicate validation logic
- Precommit catches early issues
- CI blocks invalid merges
- Orchestrator enforces final authority

---

## Anti-Patterns (Forbidden)

❌ Running guards individually in CI
❌ Duplicating validation logic in orchestrator
❌ Skipping governance:gate
❌ Introducing new scripts without registration

---

## Follow-Up

- Integrate GitNexus context into governance decisions
- Add policy engine (allow/deny rules)
- Add performance budget checks

---

## Notes

- This is the **final consolidation layer** for Zidney governance
- Must remain the single entrypoint for all enforcement
- Must align with script-system-governance skill
