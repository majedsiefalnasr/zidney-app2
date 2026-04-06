# Clarify Report — STAGE 45 – Promocodes

**Step:** 2 — Clarify  
**Timestamp:** 2026-04-05T00:10:00.000Z  
**Status:** COMPLETE

---

## Summary

All specification ambiguities resolved in Session 2026-04-05. Seven clarification questions addressed across concurrency, error handling, stacking semantics, and analytics scope. Spec.md updated in-place with `## Clarifications / ### Session 2026-04-05` block. Security and performance checklists generated (72 items total across 14 categories).

---

## Inputs Reviewed

- `specs/runtime/045-promocodes/spec.md` (including `## Clarifications / ### Session 2026-04-05`)
- `specs/runtime/045-promocodes/checklists/requirements.md`

---

## Clarifications Resolved

| #   | Question                                      | Resolution                                                                                                                 | Impact                            |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | Race condition / usage_limit locking          | `FOR UPDATE` on `promocodes` row, then plain `COUNT(*)` on `promocode_usages`. Lock covers both global and per-user limit. | Validator + service updated       |
| 2   | FREE_TRIAL on non-recurring plan              | Sub-check of Check #6. Fails with `PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING` error code.                                    | New error code added              |
| 3   | Stacking order determinism                    | Existing codes first (by `redeemed_at ASC`), new code last. Each code uses previous `final_price` as input.                | Calculator updated                |
| 4   | Partial stack failure atomicity               | All-or-nothing. Transaction rolls back entirely if any code fails re-validation.                                           | Service contract updated          |
| 5   | Deactivation effect on existing subscriptions | No retroactive effect. `discount_amount` frozen at redemption time. No cascade.                                            | Deactivate endpoint clarified     |
| 6   | Validate endpoint response shape              | Full `ValidatePromocodeResponse` type defined: `{ valid, promocode, discount }` with all subfields.                        | New type added to types.ts        |
| 7   | Analytics scope                               | Strictly workspace-scoped. No cross-workspace aggregation. Super-admin sees current workspace only.                        | Explicitly forbidden per ADR-0001 |

---

## Open Items

None — all ambiguities resolved.

---

## Spec Updates Applied

- `## Clarifications / ### Session 2026-04-05` appended to `spec.md`
- New error code `PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING` added to error code registry
- `ValidatePromocodeResponse` type definition added
- Validator Check #6 updated to include FREE_TRIAL billing-type sub-check
- Stacking order algorithm made explicit (redeemed_at ASC)
- Transaction atomicity contract strengthened (all-or-nothing for stacks)

---

## Checklists Generated

| File                        | Items | Categories                                                                                                               |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| `checklists/security.md`    | 42    | 8 (tenant isolation, auth, input validation, SQL injection, race conditions, rate limiting, client trust, data exposure) |
| `checklists/performance.md` | 30    | 6 (index strategy, N+1 prevention, transaction scope, concurrency, query efficiency, pagination)                         |

**Notable gaps surfaced:**

- Rate limiting on `/validate` endpoint (brute-force enumeration risk) — addressed in security checklist
- Maximum page size on listing endpoint — addressed in performance checklist
- Analytics caching strategy for large `promocode_usages` tables — deferred to analytics stage
