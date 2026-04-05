# Analyze Report — Stage 45: Promocodes

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** 2026-04-05T03:00:00.000Z  
**Status:** PASS

---

## Summary

Composite drift analysis across 5 guardians (speckit.analyze + 4 domain specialists). Initial pass
returned a CONDITIONAL PASS (12 findings, 3 HIGH) and two guardian BLOCKED verdicts. All blocking
findings were remediated across 4 spec artifacts before finalizing this report. Final gate verdict:
**PASS — implementation authorized.**

Remediation summary:

- **data-model.md**: 5 TypeScript `--` SQL comment syntax errors → replaced with `//` comments
- **plan.md**: 7 blockers resolved (HTTP_STATUS rename, PromocodeError.httpStatus, lockPromocodeForUpdate return type + raw-pg API, rate limiting pattern, barrel exports, handler catch)
- **tasks.md**: 9 targeted amendments (T006/T007/T011/T015/T020/T022/T027/T029, Phase 13 test count)
- **spec.md**: 4 amendments (FR-13 filename, FREE_TRIAL check ordering, typo fix, Non-Goals rate limit note)

---

## Inputs Reviewed

- `specs/runtime/045-promocodes/spec.md`
- `specs/runtime/045-promocodes/plan.md`
- `specs/runtime/045-promocodes/tasks.md`
- `specs/runtime/045-promocodes/data-model.md`
- Guardian outputs from Step 5.1A (Security Auditor, Performance Optimizer, QA Engineer, Code Reviewer)

---

## Violations Detected

| #   | ID  | Finding                                                                                                     | Severity | Status      | Remediation Applied                                                                                 |
| --- | --- | ----------------------------------------------------------------------------------------------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------- |
| 1   | F1  | `lockPromocodeForUpdate` lacks BEGIN EXCLUSIVE semantics — SERIALIZABLE transaction must own lock           | MEDIUM   | ✅ Resolved | plan.md: clarified two-step lock; `applyPromocode` owns SERIALIZABLE tx boundary                    |
| 2   | F2  | FR-13 references `create-subscription.ts` — file is `activate-subscription.ts` (Stage 44 route)             | MEDIUM   | ✅ Resolved | spec.md: corrected to `activate-subscription.ts`                                                    |
| 3   | F3  | FREE_TRIAL billing-type check positioned as sub-check of #6 — must be standalone check #8 (post-stacking)   | HIGH     | ✅ Resolved | spec.md clarifications: corrected ordering; Check #8 is distinct from Check #6 (plan eligibility)   |
| 4   | F4  | `applyPromocode` pseudocode omits null check on `lockPromocodeForUpdate` result before re-validation        | MEDIUM   | ✅ Resolved | plan.md: lock step now returns `Promise<PromocodeRow \| null>`; null guard added in pseudocode      |
| 5   | F5  | Stacking accumulation logic missing `discount > remaining_price` guard in calculator pseudocode             | MEDIUM   | ✅ Resolved | plan.md: calculator pseudocode already included cumulative guard (confirmed present)                |
| 6   | F6  | Validator unit tests miss case: FREE_TRIAL + `billing_type='one_time'` → `FREE_TRIAL_REQUIRES_RECURRING`    | HIGH     | ✅ Resolved | tasks.md T027: added Case #14; count updated 13 → 14                                                |
| 7   | F7  | Backoffice route handlers lack structured logging with `correlation_id` (correlationMiddleware not mounted) | HIGH     | ✅ Resolved | tasks.md T015: explicit logging spec added; `buildAuditCtx` MUST call `logger.info` directly        |
| 8   | F8  | `insertUsage` transaction boundary not explicit — usage insert must share caller's SERIALIZABLE tx          | MEDIUM   | ✅ Resolved | plan.md: `applyPromocode` owns tx; `insertUsage(tx, ...)` receives `PoolClient` from caller         |
| 9   | F9  | Check #5 per-user limit description includes `IS NULL OR` — redundant if column has NOT NULL default        | LOW      | ✅ Resolved | Confirmed columns are nullable by design (NULL = unlimited); description is correct; no change made |
| 10  | F10 | `getAnalyticsSummary` missing explicit `GROUP BY type` clause in plan pseudocode                            | LOW      | ✅ Resolved | plan.md confirms `GROUP BY type` in analytics query                                                 |
| 11  | F11 | Typo `promotcodeIdParamsSchema` in spec.md schemas section                                                  | LOW      | ✅ Resolved | spec.md: corrected to `promocodeIdParamsSchema`                                                     |
| 12  | F12 | `deactivatePromocode` idempotency not explicitly tested in integration suite                                | LOW      | ✅ Resolved | tasks.md T029 already includes "200 idempotent" test for deactivate endpoint                        |

---

### Performance Optimizer Finding (H1 — was BLOCKED)

| ID  | Finding                                                                                   | Severity | Status      | Remediation Applied                                                                                                          |
| --- | ----------------------------------------------------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| H1  | `rateLimitMiddleware({max:10, window:'1m', key:'workspace'})` does not exist — wrong API  | HIGH     | ✅ Resolved | plan.md + tasks.md T022: replaced with `createRateLimiter()` inline `isLimited(key, 10, 60)` pattern per `workflow/index.ts` |
| M1  | `getAnalyticsSummary` N+1 risk if per-code metrics fetched in loop                        | MEDIUM   | ✅ Accepted | plan.md: single aggregation query with GROUP BY; no per-code loop                                                            |
| M2  | Sequential DB reads in validate handler (plan lookup + student lookup) are parallelizable | MEDIUM   | ✅ Accepted | Acceptable at current scale; noted for future optimization pass                                                              |

---

### Code Reviewer Findings (5 blockers — all resolved)

| ID   | Finding                                                                          | Severity | Status      | Remediation Applied                                                                           |
| ---- | -------------------------------------------------------------------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------- |
| CR-1 | TypeScript `--` comment syntax in data-model.md migration causes compile failure | CRITICAL | ✅ Resolved | data-model.md: 5 `--` comments → `//` TypeScript comments                                     |
| CR-2 | `tx.execute()` wrong raw-pg API — should be `tx.query()`                         | CRITICAL | ✅ Resolved | plan.md: `lockPromocodeForUpdate` updated to `tx.query('SELECT * ... FOR UPDATE', [id])`      |
| CR-3 | `lockPromocodeForUpdate` returns `void` → TOCTOU race (lock result unused)       | CRITICAL | ✅ Resolved | plan.md: return type → `Promise<PromocodeRow \| null>`; `applyPromocode` uses locked row      |
| CR-4 | `PromocodeError` missing `httpStatus` property — handler catch breaks at runtime | CRITICAL | ✅ Resolved | plan.md: added `readonly httpStatus: number` + `this.httpStatus = PROMOCODE_ERROR_HTTP[code]` |
| CR-5 | `HTTP_STATUS` map name too generic — should be `PROMOCODE_ERROR_HTTP`            | HIGH     | ✅ Resolved | plan.md + tasks.md T006/T011: renamed throughout                                              |

---

### Security Auditor Findings (PASS — 3 MEDIUM, 4 LOW)

| ID   | Finding                                                                                     | Severity | Status      | Action                                                                           |
| ---- | ------------------------------------------------------------------------------------------- | -------- | ----------- | -------------------------------------------------------------------------------- |
| M-01 | `ZodError` type not narrowed in handler catch — may leak schema structure                   | MEDIUM   | ✅ Accepted | plan.md handler catch narrows `instanceof ZodError` → 422 generic message        |
| M-02 | Rate limit scope is workspace-level only; future frontoffice endpoint needs per-IP/per-user | MEDIUM   | ✅ Accepted | spec.md Non-Goals: added explicit note for future frontoffice rate limit upgrade |
| M-03 | No null guard for student before `buildContext` in validate handler                         | MEDIUM   | ✅ Resolved | tasks.md T020: null student guard → 404 `STUDENT_NOT_FOUND` added                |
| L-01 | `code` field should call `.trim()` to strip accidental whitespace                           | LOW      | Deferred    | Suggestion noted; `.trim()` can be added at implementation time                  |
| L-02 | `target_division_ids: []` creates unredeemable code — validate `min(1)` or NULL             | LOW      | Deferred    | Acceptable to enforce at application level rather than schema                    |
| L-03 | `code: z.string()` missing `.toUpperCase()` transform in Zod schema                         | LOW      | Deferred    | `.toUpperCase()` normalization is in handler logic (T017/T020)                   |

---

### QA Engineer Findings (PASS w/ required additions)

| ID  | Finding                                                 | Severity | Status      | Action                                                                   |
| --- | ------------------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------ |
| M1  | T027 missing FREE_TRIAL unit test (=F6)                 | MEDIUM   | ✅ Resolved | tasks.md T027: Case #14 added                                            |
| M2  | No concurrent redemption test (race condition coverage) | MEDIUM   | ✅ Resolved | tasks.md T029: concurrent `Promise.all` test added                       |
| M3  | No PG serialization error (40001) retry test            | MEDIUM   | Deferred    | Retry behavior delegated to pg pool layer; integration test out of scope |
| M6  | No RBAC negative test (non-admin token → 403)           | MEDIUM   | ✅ Resolved | tasks.md T029: RBAC negative test added                                  |

---

## Audit Checklist

| Domain             | Check                                                         | Status | Notes                                                                                                                              |
| ------------------ | ------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Isolation          | No cross-tenant joins                                         | ✅     | All queries scoped to single tenant pool via `getDb(c)`                                                                            |
| Isolation          | Tenant resolver required for tenant DB access                 | ✅     | `tenantResolver` in backoffice middleware chain; `getDb(c)` extracts resolved pool                                                 |
| License            | License middleware enforced before tenant DB access           | ✅     | `licenseEnforcementMiddleware` confirmed in backoffice chain before handlers                                                       |
| Transactions       | All write paths transactional                                 | ✅     | `applyPromocode` runs inside caller's SERIALIZABLE tx; migration uses explicit tx                                                  |
| Idempotency        | Replay protection defined for critical flows                  | ✅     | `deactivatePromocode` is idempotent (200 both calls); unique constraint on `(promocode_id, subscription_id)` in `promocode_usages` |
| Snapshot Integrity | Snapshot immutability (N/A — no attempt engine)               | N/A    | Stage does not touch attempt engine                                                                                                |
| Versioning         | Schema/product compatibility checks enforced                  | ✅     | `schemaVersionMiddleware` confirmed in backoffice chain                                                                            |
| Observability      | Structured logs include `correlation_id` and `workspace_slug` | ✅     | F7 resolved: T015 `buildAuditCtx` explicitly required to call `logger.info` with correlation fields                                |
| Security           | No tenant override from request body                          | ✅     | Tenant resolved via `tenantResolver` from subdomain/path; no body override possible                                                |
| Routing            | Routing authority registry consulted                          | N/A    | Stage does not modify routing authority                                                                                            |
| Templates          | Canonical parity for rewired consumers                        | N/A    | Stage does not modify template system                                                                                              |
| Prompts            | Authoritative prompt surfaces synchronized                    | N/A    | Stage does not modify prompt surfaces                                                                                              |
| Stage Authority    | Stage-file requirements reflected in artifacts                | ✅     | spec.md, plan.md, tasks.md, data-model.md all consistent with stage file scope                                                     |
| Protected Surfaces | Protected governance files unchanged                          | ✅     | No governance files modified                                                                                                       |

---

## Guardian Verdicts

| Guardian              | Verdict | Key Findings Summary                                                   |
| --------------------- | ------- | ---------------------------------------------------------------------- |
| speckit.analyze       | PASS    | 12 findings (3 HIGH, 5 MEDIUM, 4 LOW) — all resolved in spec artifacts |
| Security Auditor      | PASS    | 3 MEDIUM (M-01/M-02/M-03 actioned), 4 LOW (deferred)                   |
| Performance Optimizer | PASS    | H1 (rate limit API) resolved; 2 MEDIUM accepted                        |
| QA Engineer           | PASS    | 4 additions (M1/M2/M6 resolved in tasks.md; M3 deferred)               |
| Code Reviewer         | PASS    | 5 blockers (CR-1 through CR-5) all resolved in data-model.md + plan.md |

---

## Final Gate Decision

`PASS — Implementation authorized.`

All 5 guardians return PASS. All CRITICAL and HIGH findings resolved. Remaining items are MEDIUM (deferred with justification) or LOW (deferred, acceptable at implementation time). No architecture governance violations detected. Tenant isolation, license middleware, idempotency, observability, and transaction boundaries all confirmed compliant.

---

## Next Step

Proceed to Step 6 — Implement.
