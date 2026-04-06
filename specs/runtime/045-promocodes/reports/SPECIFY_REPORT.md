# Specify Report — STAGE 45 – Promocodes

**Step:** 1 — Specify  
**Timestamp:** 2026-04-05T00:05:00.000Z  
**Status:** COMPLETE

---

## Summary

Specification complete for the workspace-scoped Promocode system. The spec defines a comprehensive discount and affiliate code module for the Zidney Backoffice, integrated with the Stage 44 subscription activation flow. All 12 governance declarations confirmed, 15 functional requirements captured, 13 error codes defined, and 29 files identified (24 new + 5 modified).

---

## Inputs Reviewed

- `specs/runtime/045-promocodes/spec.md`
- `specs/runtime/045-promocodes/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/06_COMMERCIAL_LAYER/STAGE_45_PROMOCODES.md`

---

## Key Decisions

| #   | Decision                                                           | Rationale                                                            |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | Case-insensitive code uniqueness via `LOWER(code)` unique index    | Prevents duplicate "SUMMER10" / "summer10" codes; improves UX        |
| 2   | 7-check fail-fast validation engine                                | Ordered checks ensure cheapest operations first (DB queries last)    |
| 3   | Stacking uses deterministic write-order application                | Prevents non-deterministic discounts from varying calculation order  |
| 4   | SERIALIZABLE isolation for usage recording + subscription creation | Prevents race conditions on usage_limit enforcement                  |
| 5   | `NOT_YET_VALID` vs `EXPIRED` split into separate error codes       | Clearer UX — student knows whether code hasn't started vs lapsed     |
| 6   | Code string, type, and value immutable after creation              | Prevents retroactive discount manipulation on existing subscriptions |
| 7   | Migration 024 (forward-only, after Stage 44's 023)                 | Maintains migration sequence integrity (ADR-0003)                    |
| 8   | Server re-validates discount on payment gateway callback           | Never trust client-passed discount amount to gateway                 |

---

## Functional Requirements Captured

- FR-01: Backoffice admin can create promocodes with PERCENTAGE, FIXED, or FREE_TRIAL type
- FR-02: Code string is unique within workspace (case-insensitive)
- FR-03: Validity window (valid_from / valid_until) enforced using server time
- FR-04: Usage limit enforcement — global (usage_limit) and per-user (per_user_limit)
- FR-05: Targeting by division_ids and/or group_ids (nullable = unrestricted)
- FR-06: Plan eligibility check via applies_to_plan_ids
- FR-07: Seven-check sequential validation with fail-fast and structured error codes
- FR-08: Discount calculated server-side; never trusted from client
- FR-09: Stacking policy (is_stackable flag) enforced deterministically
- FR-10: Total stacked discount cannot exceed plan price (clamped to zero floor)
- FR-11: Every redemption recorded in promocode_usages transactionally with subscription
- FR-12: Promotional preview/validate endpoint (no usage count increment)
- FR-13: Deactivate endpoint (soft delete via is_active flag)
- FR-14: Analytics endpoints: total redemptions, revenue impact, active/expired report
- FR-15: Gateway callback re-validation — server recalculates, does not trust client amount

---

## Clarifications Required

None — all spec items fully resolved.

---

## Architecture Governance Compliance

| Check                                   | Status | Notes                                                 |
| --------------------------------------- | ------ | ----------------------------------------------------- |
| No cross-tenant access (ADR-0001)       | ✅     | All queries scoped to tenant DB                       |
| License middleware requirement captured | ✅     | Mandatory on all workspace routes                     |
| Snapshot integrity (ADR-0002)           | ✅     | Not applicable (no attempt engine)                    |
| Server-authoritative time (ADR-0006)    | ✅     | All validity checks use DB NOW()                      |
| Forward-only migrations (ADR-0003)      | ✅     | Migration 024 specified                               |
| No client-calculated discount           | ✅     | Server recalculates on every apply                    |
| Code immutability after creation        | ✅     | Enforced at domain layer                              |
| Usage history preservation              | ✅     | Deletions forbidden                                   |
| Idempotency for critical endpoints      | ✅     | Dedup unique index on (promocode_id, subscription_id) |
| Import boundary compliance              | ✅     | packages/domain-core only; no UI → DB                 |

---

## Files Manifest

**New files (24):** Domain types, errors, repository, validator, calculator, service + API route + migration + tests  
**Modified files (5):** Subscription service (Stage 44 extension), router, tenant migration runner, test helpers

---

## Checklist Validation

All 10 requirement categories in `checklists/requirements.md` fully checked ✅
