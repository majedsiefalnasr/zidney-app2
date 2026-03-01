# Clarify Report — TRANSLATION_SYSTEM

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-01T00:20:00Z  
**Status:** COMPLETE

---

## Summary

5 targeted clarification questions resolved the top architectural ambiguities in the spec. Coverage denominator strategy, entity deletion cascade approach, large-scale language removal flow, idempotency semantics, and error contract are all fully resolved. One deferred item (schema_version bump requirement) was resolved by cross-referencing ADR-0008 — the translations table migration will require a MINOR schema_version bump per the new-table policy. All clarifications are appended in-place to `spec.md` under `## Clarifications / Session 2026-03-01`.

---

## Inputs Reviewed

- `specs/runtime/019-translation-system/spec.md` (including `## Clarifications / Session 2026-03-01`)
- `docs/architecture/ADR-0008-formalize-semantic-versioning-policy.md` (schema_version bump policy)

---

## Clarifications Resolved

| #   | Question                                                                  | Resolution                                                                                                                                                                                       | Impact                                                                                                                    |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Entity deletion — FK cascade vs. application-layer cleanup?               | Application-layer explicit `DELETE FROM translations WHERE entity_type+entity_id` within the same transaction as entity deletion. No FK cascade.                                                 | Domain deletion service must orchestrate the cleanup. Worker not involved. Tests must verify atomicity.                   |
| Q2  | HTTP codes and error codes for the three primary validation rejections?   | 422 + `UNSUPPORTED_LANGUAGE`; 404 + `ENTITY_NOT_FOUND`; 422 + `DEFAULT_LANGUAGE_WRITE`                                                                                                           | Error codes defined as constants in domain-core/validation. Integration tests assert exact code+status for each scenario. |
| Q3  | Transaction safety for large language removal cascade (millions of rows)? | Hybrid threshold: ≤10,000 rows → synchronous in-transaction (FR-016); >10,000 rows → HTTP 409, language marked `removing`, Worker `DRAIN_LANGUAGE_TRANSLATIONS` job drains in batches of 1,000   | New Worker job type required. Audit entries apply to both paths. SC-005 updated to reflect async path.                    |
| Q4  | Idempotency key definition for upsert endpoints?                          | Composite key `(entity_type, entity_id, field_name, language_code)` is the idempotency key. Re-submitting same key always safe. Server returns HTTP 200 for both create and update.              | No client-provided idempotency header needed. Retry-safety test required for rapid duplicate submission.                  |
| Q5  | Coverage denominator — how is total translatable field count maintained?  | Static `TRANSLATABLE_FIELDS` constant map in `packages/domain-core/src/translation/translatable-fields.ts`. Pure function, zero DB overhead. Unknown entity_type → 0% + warning log (not error). | No DB table or migration needed for denominator. Governed by code change + domain package version bump.                   |

**Deferred item resolved via ADR-0008:**

| Item                                                             | Resolution                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| schema_version bump requirement for translations table migration | ADR-0008 mandates MINOR schema_version bump for any new table addition. The translations table migration must increment schema_version MINOR. License middleware schema_version check will enforce compatibility on all translation routes. |

---

## Open Items

None. All specification ambiguities are resolved.

---

## Spec Updates Applied

- Appended `## Clarifications / Session 2026-03-01` to `spec.md` (lines 241–287) with:
  - 5 Q&A entries defining the exact resolution for each ambiguity
  - `### Clarification Implications for Technical Planning` section documenting concrete constraints for each resolved item
  - Entity deletion strategy (application-layer, same transaction, no FK)
  - Error contract constants (`UNSUPPORTED_LANGUAGE`, `ENTITY_NOT_FOUND`, `DEFAULT_LANGUAGE_WRITE`)
  - Hybrid language removal threshold (10,000 rows) and Worker job type
  - Idempotency key definition and HTTP 200 for both create/update
  - TRANSLATABLE_FIELDS constant map path and governance model

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                                         |
| ----------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5 questions resolved; ADR-0008 consulted for schema_version item                              |
| Transaction strategy confirmed            | ✅     | Language removal: hybrid threshold (sync ≤10K, async >10K); entity deletion: same transaction |
| Idempotency strategy confirmed            | ✅     | Composite key is the idempotency key; HTTP 200 for create and update                          |
| Isolation boundaries confirmed            | ✅     | All translation operations scoped to tenant DB; no cross-tenant paths                         |
| Version and license constraints confirmed | ✅     | schema_version MINOR bump required per ADR-0008; license middleware enforces compatibility    |
| Error contract defined                    | ✅     | Three primary rejection codes mapped to HTTP status + constant error codes                    |
| Worker job defined for async path         | ✅     | `DRAIN_LANGUAGE_TRANSLATIONS` job type required for >10K language removal                     |

**Overall:** COMPLIANT

---

## Open Risks

- **Hybrid threshold tuning**: The 10,000-row threshold for synchronous vs. async language removal is a default — if a workspace has consistently saturated cache with multiple large languages, the threshold may need tuning per deployment. This is an operational concern, not a blocking spec risk.
- **TRANSLATABLE_FIELDS governance**: If a domain team adds a new translatable field without updating the denominator map, coverage percentages will be understated. The governance gate (code change + version bump) mitigates this but requires discipline.

---

## Next Step

Proceed to Step 3 — Plan.
