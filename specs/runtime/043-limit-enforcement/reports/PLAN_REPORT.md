# Plan Report — Stage 43: License Limit Enforcement

**Generated:** 2026-04-04T00:55:00.000Z  
**Stage:** STAGE_43_LIMIT_ENFORCEMENT  
**Orchestrator Step:** 3 — Plan  
**Guardian Verdicts:** Architecture Guardian: PASS | API Designer: PASS (inline review)

---

## What Was Planned

### Objective

Patch 13 existing enforcement gaps and add one new feature (staff bulk import) that brings license
limit enforcement to 100% coverage across all student and staff user-creation entry points.

### Approach

Bottom-up dependency order across 7 phases:

- **Phase A** — Foundation fixes: types, error classes, middleware
- **Phase B** — Domain signature normalization (`number | null` everywhere)
- **Phase C** — Enable-path limit checks with SERIALIZABLE isolation (critical new logic)
- **Phase D** — Route handler wiring (pass limits from context to domain)
- **Phase E** — Error response mapping (`LICENSE_LIMIT_REACHED` shape)
- **Phase F** — New feature: staff bulk import (domain + route + schema + exports)
- **Phase G** — Tests

### Files to Change

**Existing files modified:** 17 files  
**New files created:** 2 domain + 1 route handler + 1 test files

### Key Decisions

| Decision                                      | Rationale                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| SERIALIZABLE (not advisory locks)             | Consistent with createStudent/createStaff pattern; no extra infra needed   |
| No retry on serialize failure                 | Return LIMIT_REACHED immediately; race = concurrency showing limit is full |
| null = unlimited, no ?? fallback              | Explicit `if (limit !== null && ...)` — no magic coercion                  |
| Error classes carry limit_value/current_value | Enables structured response without coupling helpers to DB                 |
| Staff bulk import: no divisionId              | Staff domain has no division_id column — simpler than student path         |

---

## Gap-to-Task Mapping

| Gap         | Phase | Description                     |
| ----------- | ----- | ------------------------------- |
| G12         | A     | BackofficeVariables types       |
| G13         | A     | Middleware string → null        |
| G10a/b      | A     | Error class extension           |
| G5,G8,G9    | B     | Signature normalization         |
| G1,G2       | C     | Enable limit checks (CRITICAL)  |
| G3,G4,G6,G7 | D     | Route wiring                    |
| G10c/d      | E     | Error response mapping          |
| G11         | F     | Staff bulk import (new feature) |

---

## Architecture Governance

All 7 Constitutional compliance points verified:

- No cross-tenant access
- No direct DB instantiation
- SERIALIZABLE for count-then-write paths
- Package boundary integrity maintained
- Error contract `{ success, data, error }` followed
- No business logic in frontend
- Server-authoritative time (via DB `NOW()`)

---

## Risk Summary

| Risk                                                | Severity | Status                                                |
| --------------------------------------------------- | -------- | ----------------------------------------------------- |
| enableStudent/enableStaff signature breaking change | HIGH     | Mitigated — all callers updated in same task sequence |
| Middleware null change breaks routes                | HIGH     | Mitigated — types updated before routes               |
| Serial failure on concurrent enable                 | MEDIUM   | Mitigated — no retry, return limit error              |

---

## Verdict

PLAN APPROVED — Task generation authorized.
