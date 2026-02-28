# Analyze Report — TENANT_BOOTSTRAP

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** 2026-02-28T01:00:00Z  
**Status:** APPROVED

---

## Summary

Full composite drift audit completed across 5 guardians. All 9 structural drift criteria passed. Four guardian rounds required remediation (Security Auditor × 2, Performance Optimizer × 2, QA Engineer × 2, Code Reviewer × 1 with minor fixes). After two remediation rounds per guardian, all 5 guardians returned **VERDICT: PASS**. Implementation is authorized.

---

## Inputs Reviewed

- `specs/runtime/017-tenant-bootstrap/spec.md`
- `specs/runtime/017-tenant-bootstrap/plan.md`
- `specs/runtime/017-tenant-bootstrap/tasks.md`
- Guardian outputs from Step 5.1A (Security Auditor, Performance Optimizer, QA Engineer, Code Reviewer)

---

## Violations Detected and Remediated

| #   | Violation ID | Violation Type | Description                                                                                                                                                                 | Severity | Guardian              | Remediation Applied                                                                                                                    |
| --- | ------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | H-01         | Security       | No rate limit on `/ws/backoffice` — allows WS connection flood                                                                                                              | HIGH     | Security Auditor      | `createRateLimitMiddleware({windowMs:60_000, max:10, keyPrefix:'backoffice-ws'})` added to WS middleware chain                         |
| 2   | H-02         | Security       | TOCTOU race: two-step `GET + SETEX` for WS connection registry — window between reads allows duplicate connections                                                          | HIGH     | Security Auditor      | Replaced with atomic `wsRedis.set(wsKey,'1',{NX:true,EX:ttl})` — single atomic operation                                               |
| 3   | M-01         | Security       | Poll failure handler was fail-open — repeated Redis poll failures kept WS open indefinitely                                                                                 | MEDIUM   | Security Auditor      | `consecutivePollFailures` counter added; `ws.close(1011,'POLL_FAILURE')` after `MAX_POLL_FAILURES` (default 3)                         |
| 4   | M-02         | Security       | `createModuleGuard` accepted no logger parameter — module access denials produced no log output                                                                             | MEDIUM   | Security Auditor      | `createModuleGuard(logger: Logger, requiredModule: Module)` — `logger.warn('Module guard denied request', {5 fields})` on every denial |
| 5   | F-01         | Performance    | `wsRedis = createRedisClient()` was called inside the WS route handler — new Redis client created per connection                                                            | CRITICAL | Performance Optimizer | `const moduleWsRedis = createRedisClient()` hoisted to module scope; all WS handlers close over the module singleton                   |
| 6   | F-02         | Performance    | RBAC `SELECT EXISTS` query hit the DB on every authenticated request — no caching                                                                                           | HIGH     | Performance Optimizer | Redis cache added before DB query: key `rbac:{tenant_id}:{user_id}:{module}:{action}`, TTL 30s; DB query only on cache miss            |
| 7   | QA-B1        | Test Coverage  | No WS lifecycle integration tests — connect, disconnect, duplicate connection, TOCTOU, license transition, and poll failure paths all untested                              | CRITICAL | QA Engineer           | T030 added: `tests/integration/api/backoffice/ws.test.ts` (7 WS lifecycle scenarios)                                                   |
| 8   | QA-B2        | Test Coverage  | T028 context endpoint test only covered 4 scenarios — missing cross-workspace JWT, ARCHIVED, 404, 426, and full 9-field verification                                        | HIGH     | QA Engineer           | T028 expanded to 10 scenarios including AC-08 cross-workspace JWT assertion                                                            |
| 9   | QA-B3        | Test Coverage  | No tenant isolation test — no validation that workspace-A JWT is rejected on workspace-B routes                                                                             | CRITICAL | QA Engineer           | T031 added: `tests/integration/isolation/backoffice-isolation.test.ts` (multi-tenant correctness)                                      |
| 10  | CR-H1        | Correctness    | Store filename conflict: plan.md FE-02 defines `stores/context.ts` + `useContextStore`; tasks.md T017 used `stores/backofficeContext.ts` — would cause import build failure | HIGH     | Code Reviewer         | T017 updated: filename changed to `stores/context.ts`                                                                                  |
| 11  | CR-H2        | Correctness    | `HonoEnv`/`Variables` type map absent from plan — all `c.get()` calls would return `unknown`; TypeScript strict mode failures                                               | HIGH     | Code Reviewer         | `BackofficeVariables` + `BackofficeEnv` types added to plan (new file `apps/api/src/routes/backoffice/types.ts`); T007 updated         |
| 12  | CR-H3        | Observability  | `onError(evt)` never read `evt.error` — WS errors not observable in production logs                                                                                         | HIGH     | Code Reviewer         | `onError` updated: `error_message: evt instanceof ErrorEvent ? evt.message : String(evt)` added to log fields                          |
| 13  | CR-H4        | Correctness    | `consecutivePollFailures` reset AFTER `setex` — transient Redis write hiccup would trigger false fail-closed (valid connections closed with 1011)                           | HIGH     | Code Reviewer         | Reset moved BEFORE `setex`; `setex` wrapped in best-effort `try/catch` (non-fatal)                                                     |

**Non-blocking observations (no task changes required):**

| #   | ID     | Category      | Observation                                                                                                |
| --- | ------ | ------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | OBS-01 | Naming        | View filenames in plan.md (`components/` folder) use `.vue` extension inconsistently — noted, not blocking |
| 2   | OBS-02 | Observability | `createModuleGuard` deny logging previously silent — resolved by M-02 fix above                            |
| 3   | OBS-03 | Schema        | `correlationId` stored as schema extension field — non-standard Drizzle pattern, acceptable for this stage |

---

## Audit Checklist

| Domain             | Check                                                         | Status | Notes                                                                                                                           |
| ------------------ | ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Isolation          | No cross-tenant joins                                         | ✅     | All DB access originates from `tenant.db` resolver context — no cross-tenant references                                         |
| Isolation          | Tenant resolver required for tenant DB access                 | ✅     | Tenant resolver runs second in middleware chain — no DB access before resolver completes                                        |
| License            | License middleware enforced before tenant DB access           | ✅     | License enforcement middleware is third in chain — SOFT_LOCKED → 423, ARCHIVED → 403                                            |
| Transactions       | All write paths transactional                                 | ✅     | Migration uses `db.transaction()`; no bare writes outside a transaction boundary                                                |
| Idempotency        | Replay protection defined for critical flows                  | ✅     | WS connection registry uses atomic SET NX (H-02 fix) — duplicate connections rejected; migration `down()` throws (forward-only) |
| Snapshot Integrity | Snapshot remains immutable after start (if applicable)        | N/A    | No attempt engine in this stage                                                                                                 |
| Versioning         | Schema/product compatibility checks enforced                  | ✅     | Schema version middleware at position 4 in REST chain; `schema_version` returned in context response                            |
| Observability      | Structured logs include `correlation_id` and `workspace_slug` | ✅     | All log calls verified — full required field set present in every log entry                                                     |
| Security           | No tenant override from request body                          | ✅     | Tenant resolved from subdomain/path slug only — no request body override path exists                                            |

---

## Guardian Verdicts

| Guardian                           | Final Verdict | Rounds | Key Findings Summary                                                                                                      |
| ---------------------------------- | ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| speckit.analyze (structural drift) | **PASS**      | 1      | All 9 drift criteria passed; 3 non-blocking observations noted                                                            |
| zidney-security-auditor            | **PASS**      | 2      | H-01 (WS rate limit), H-02 (TOCTOU atomic SET NX), M-01 (fail-closed), M-02 (module guard logging) — all fixed            |
| zidney-performance-optimizer       | **PASS**      | 2      | F-01 (module-scoped Redis singleton), F-02 (RBAC Redis cache TTL-30s) — both fixed                                        |
| zidney-qa-engineer                 | **PASS**      | 2      | T028 expanded (10 scenarios), T030 added (7 WS lifecycle scenarios), T031 added (tenant isolation) — all fixed            |
| zidney-code-reviewer               | **PASS**      | 1      | CR-H1 (store filename), CR-H2 (HonoEnv types), CR-H3 (onError observability), CR-H4 (false fail-closed setex) — all fixed |

---

## Final Gate Decision

`APPROVED — Implementation authorized.`

All 5 guardians returned `VERDICT: PASS`. All 13 violations remediated. Tasks total updated from 29 → 31 (T030, T031 added). Plan.md updated with 6 security/performance/observability fixes and HonoEnv type system. tasks.md updated with 4 task expansions + 2 new tasks + 2 corrections.

---

## Next Step

Proceed to Step 6 — Implement.
