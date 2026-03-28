# Pull Request — Script System Standardization And Governance

**Stage:** INFRA-025  
**Phase:** 01_PLATFORM_FOUNDATION  
**Branch:** `spec/infra-025-script-system-standardization-and-governance`  
**Status:** PRODUCTION READY

---

## Executive Summary

This PR introduces comprehensive script governance infrastructure for the Zidney monorepo:

- **Problem solved:** Repository-wide script naming inconsistency, difficult to track script migrations, metadata scattered across files
- **Architectural impact:** Zero — INFRA stage, governance-only, no functional changes to platform core
- **Safety:** All validators tested; dry-run mode allows safe preview before applying migrations; backward compatible
- **Constitutional guarantees:** All ADRs preserved; tenant isolation untouched; no database changes; no middleware bypass

---

## What's Included

### 1. Script Naming Validator (validate:scripts:naming)

- Enforces `domain:action[:scope]` convention
- 9 canonical domains: `db`, `arch`, `validate`, `ai`, `ci`, `repo`, `dev`, `infra`, `test`
- Exempts lifecycle scripts (`migrate`, `start`, `stop`, `test`, `build`, `dev`, `lint`, `format`)
- Exit code 0 when all scripts comply

### 2. Script Usage Validator (validate:scripts:usage)

- Scans entire repository for `bun run` references
- Validates each reference against known package.json scripts
- Filters false positives: flags (--silent), paths (src/index.ts)
- Safe for CI integration

### 3. Script Infrastructure Validator (validate:scripts:infrastructure)

- Validates 5-field metadata headers on tracked scripts: @script, @domain, @category, @description, @usage
- Checks SCRIPT_REGISTRY.md freshness (must be ≤24h old)
- 27 scripts tracked; all passing metadata validation

### 4. Refactor Engine (dev:refactor:scripts)

- Automates script migrations defined in SCRIPT_MIGRATION_MAP.md
- Supports 5 migration types:
  - **Type A:** Non-compliant domain prefix → canonical domain
  - **Type B:** Rename in package.json only (no .ts file)
  - **Type C:** Add new alias while keeping old name
  - **Type D:** Delete from package.json
  - **Type E:** Replace references in files, then remove alias
- Dry-run mode for safe preview
- 33 migration entries staged and ready

### 5. Script Documentation Generator (dev:generate:script-docs)

- Regenerated SCRIPT_REGISTRY.md with all 27 scripts
- Enforces metadata completeness
- Fresh registry in repo

### 6. CI Integration

- All 4 validators integrated into architecture-governance.yml
- Enforced on every commit via pre-commit hook
- No merge allowed if validators fail

---

## Files Changed

### Created (18 new files)

- `scripts/validate/script-naming.ts` — naming validator
- `scripts/validate/script-usage.ts` — usage validator
- `scripts/validate/script-infrastructure.ts` — metadata validator
- `scripts/validate/types.ts` — shared types
- `scripts/dev/refactor-scripts.ts` — migration engine
- `scripts/validate/__tests__/script-naming.test.ts` — naming tests
- `scripts/validate/__tests__/script-usage.test.ts` — usage tests
- `scripts/validate/__tests__/script-infrastructure.test.ts` — infrastructure tests
- `scripts/dev/__tests__/refactor-scripts.test.ts` — engine tests
- `docs/scripts/SCRIPT_MIGRATION_MAP.md` — 33 migration entries
- `.agents/skills/script-system-governance/SKILL.md` — governance rules
- `specs/runtime/infra-025-.../` — full workflow artifacts (spec, plan, tasks, reports)

### Modified (12 files)

- `package.json` — 5 new script entries: `validate:scripts:naming`, `validate:scripts:usage`, `validate:scripts:infrastructure`, `validate:scripts:registry`, `validate:scan:packages`, `ai:validate:prompts`
- `docs/scripts/SCRIPT_REGISTRY.md` — regenerated with 27 scripts
- `.github/workflows/architecture-governance.yml` — integrated validators
- `scripts/dev/refactor-scripts.ts` — updated script engine
- 10 scripts with updated metadata (@category, @usage, @domain fixes)

---

## Workflow Completion

| Step      | Status      | Report                                                                                                                  |
| --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Specify   | ✅ Complete | [SPECIFY_REPORT.md](specs/runtime/infra-025-script-system-standardization-and-governance/reports/SPECIFY_REPORT.md)     |
| Clarify   | ✅ Complete | [CLARIFY_REPORT.md](specs/runtime/infra-025-script-system-standardization-and-governance/reports/CLARIFY_REPORT.md)     |
| Plan      | ✅ Complete | [PLAN_REPORT.md](specs/runtime/infra-025-script-system-standardization-and-governance/reports/PLAN_REPORT.md)           |
| Tasks     | ✅ Complete | [TASKS_REPORT.md](specs/runtime/infra-025-script-system-standardization-and-governance/reports/TASKS_REPORT.md)         |
| Analyze   | ✅ Complete | [ANALYZE_REPORT.md](specs/runtime/infra-025-script-system-standardization-and-governance/audits/ANALYZE_REPORT.md)      |
| Implement | ✅ Complete | [IMPLEMENT_REPORT.md](specs/runtime/infra-025-script-system-standardization-and-governance/reports/IMPLEMENT_REPORT.md) |
| Closure   | ✅ Complete | [CLOSURE_REPORT.md](specs/runtime/infra-025-script-system-standardization-and-governance/reports/CLOSURE_REPORT.md)     |

**All 14 tasks completed.** All 4 validators passing. All 6 guardian verdicts: PASS.

---

## Constitutional Compliance Checklist

- ✅ **ADR-0001** — Database-per-tenant isolation preserved (N/A — INFRA stage)
- ✅ **ADR-0002** — Snapshot immutability enforced (N/A — no exam/attempt changes)
- ✅ **ADR-0006** — Server-authoritative time (N/A — no timing logic)
- ✅ **ADR-0007** — Version compatibility enforced (scripts follow SemVer)
- ✅ **ADR-0008** — Semantic versioning respected (no v0 exports)
- ✅ **No cross-tenant access** — INFRA stage, zero tenant logic
- ✅ **No middleware bypass** — No API/middleware modifications
- ✅ **No shared mutable state** — Pure functions only
- ✅ **ARCHITECTURE_MAP.json rules** — No boundary violations

---

## Security & Isolation Verification

- ✅ No cross-workspace joins (INFRA stage)
- ✅ No default DB fallback (INFRA stage)
- ✅ All logging structured (no console.log)
- ✅ Error contract compliance ({ success, data, error })
- ✅ Sensitive data not logged

---

## Testing & Validation Evidence

### Validator Test Results

```
✅ validate:scripts:naming — 0 violations
✅ validate:scripts:usage — 0 violations
✅ validate:scripts:infrastructure — 0 violations (1 expected stale registry note, now regenerated)
✅ dev:generate:script-docs — 27 scripts registered
```

### Automated Test Suite

```
✅ scripts/validate/__tests__/script-naming.test.ts — all pass
✅ scripts/validate/__tests__/script-usage.test.ts — all pass
✅ scripts/validate/__tests__/script-infrastructure.test.ts — all pass
✅ scripts/dev/__tests__/refactor-scripts.test.ts — all pass
```

### Code Quality

```
✅ Biome lint — passes (0 errors, 0 warnings)
✅ TypeScript type-check — passes (0 errors)
✅ Pre-commit hooks — pass
✅ CI governance checks — pass
```

---

## Testing Guide

For QA and reviewers: [TESTING_GUIDE.md](specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md)

Contains:

- 7 manual test scenarios
- Performance validation (SLOs)
- Backward compatibility verification
- Rollback testing
- Sign-off checklist

---

## Deployment Information

- **Risk Level:** LOW (governance-only, zero functional changes)
- **Rollback:** Trivial — single commit revert restores all scripts
- **Tenant Impact:** None (INFRA stage)
- **Database Impact:** None (no schema changes)
- **API Changes:** None
- **Performance Impact:** +50–100ms CI time for validators (negligible)

---

## Related Issues & PRs

- Part of: INFRA-025 Script System Standardization And Governance
- Fixes: Script naming inconsistency, tooling friction, migration safety
- Enables: Unified script governance across all Zidney services

---

## Merge Requirements

- [x] All automated checks passing
- [x] All validators passing
- [x] All tests passing
- [x] All guardian verdicts: PASS
- [x] Constitutional compliance verified
- [x] Pre-closure review gate approved

**Ready for merge to develop.**

---

## Questions?

See the full specification and design at:  
[Stage Spec](specs/runtime/infra-025-script-system-standardization-and-governance/spec.md)  
[Technical Plan](specs/runtime/infra-025-script-system-standardization-and-governance/plan.md)  
[Governance Rules](specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_25_SCRIPT_SYSTEM_STANDARDIZATION_AND_GOVERNANCE.md)
