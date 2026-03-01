# Plan Report — API Client Layer

**Step:** 3 — Plan  
**Timestamp:** 2026-02-28T22:15:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan generated for a new `packages/api-client` package providing a framework-agnostic HTTP client abstraction. Plan includes research (10 items resolved), data model (9 entities), TypeScript contract, and quickstart guide. Two BLOCKED findings from Guardian validation (idempotency header name, credentials mode) were resolved through artifact updates. Both Architecture Checker and API Designer returned VERDICT: PASS.

---

## Inputs Reviewed

- `specs/runtime/ui-02-api-client-layer/spec.md`
- `specs/runtime/ui-02-api-client-layer/plan.md`
- `specs/runtime/ui-02-api-client-layer/research.md`
- `specs/runtime/ui-02-api-client-layer/data-model.md`
- `specs/runtime/ui-02-api-client-layer/contracts/api-client.ts`
- `specs/runtime/ui-02-api-client-layer/quickstart.md`

---

## Architecture Layers Touched

| Layer             | Planned Changes                                                                         |
| ----------------- | --------------------------------------------------------------------------------------- |
| Frontend (shared) | New `packages/api-client` package — client.ts, types.ts, interceptors.ts, http-error.ts |
| MMC               | Replace existing `core/api/client.ts` with import from `@zidney/api-client`             |
| Backoffice        | Replace existing `core/api/client.ts` with import from `@zidney/api-client`             |
| Frontoffice       | Replace existing `core/api/client.ts` with import from `@zidney/api-client`             |
| API               | No changes                                                                              |
| Worker            | No changes                                                                              |
| DB Master         | No changes                                                                              |
| DB Tenant         | No changes                                                                              |

---

## Key Technical Decisions

| #   | Decision                                                                               | Rationale                                                                           |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | New `packages/api-client` package (framework-agnostic)                                 | `packages/ui-system` stays Vue-focused; API client has zero framework dependencies  |
| 2   | `HttpAdapter` injectable interface                                                     | Enables MockAdapter for deterministic testing without network access                |
| 3   | Fixed interceptor pipeline (auth → correlation → content-type → idempotency → timeout) | Predictable execution order; no dynamic middleware complexity                       |
| 4   | `AppError` as plain interface (not class)                                              | Avoids prototype chain issues across monorepo boundaries                            |
| 5   | Per-app factory pattern via `createApiClient(config)`                                  | Singleton lifecycle in each app's core/api/client.ts                                |
| 6   | Auto-generated correlation IDs (`crypto.randomUUID()`)                                 | Every request traceable; optional caller override                                   |
| 7   | `X-Idempotency-Key` header name (matches backend)                                      | Backend reads `x-idempotency-key`; IANA `Idempotency-Key` would be silently ignored |
| 8   | `credentials: 'include'` default                                                       | Required for httpOnly refresh token cookies on cross-origin requests                |

---

## Migration Impact

| Item                  | Value | Notes                                                |
| --------------------- | ----- | ---------------------------------------------------- |
| Migration required    | No    | UI-only changes; no database schema modifications    |
| `schema_version` bump | No    | No schema changes                                    |
| Backward compatible   | Yes   | Incremental migration — apps can adopt one at a time |

---

## Transaction Boundaries

- N/A — This is a frontend HTTP client package. No direct database writes. Backend owns all transaction boundaries.

---

## Idempotency Strategy

- Client supports `X-Idempotency-Key` header via `RequestConfig.idempotencyKey`
- Key generation is caller's responsibility (FR-014)
- Header attached only on mutations (POST/PATCH/PUT/DELETE), ignored on GET
- Backend enforces idempotency via Redis cache + DB UNIQUE constraints

---

## Guardian Validation Results

| Guardian             | Verdict            | Notes                                                                                              |
| -------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| Architecture Checker | PASS               | All 11 constitution gates passed; import boundaries compliant                                      |
| API Designer         | PASS (after fixes) | Two initial BLOCKED findings resolved: idempotency header name alignment, credentials mode support |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                      |
| -------------------------------------- | ------ | ---------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | Client routes to backend; tenant resolution is server-side |
| All writes are transactional by design | ✅     | N/A — no writes; backend owns transactions                 |
| Server-authoritative time enforced     | ✅     | Client does not generate timestamps                        |
| License middleware enforced            | ✅     | License errors (423, 403) pass through as AppError         |
| Version compatibility enforced         | ✅     | N/A — no schema interactions                               |
| No architecture redesign without ADR   | ✅     | New package follows monorepo conventions                   |

**Overall:** COMPLIANT

---

## Open Risks

- None

---

## Next Step

Proceed to Step 4 — Tasks.
