# Plan Report — MCQ Question Model

**Step:** 3 — Plan  
**Timestamp:** 2026-03-30T13:15:00Z  
**Status:** COMPLETE

---

## Summary

Technical implementation plan generated for STAGE_34_MCQ_QUESTION_MODEL. The plan defines 5 database tables, 8 domain-core files, 11 Zod validation schemas, 14 API route handlers, and comprehensive test coverage. Architecture Guardian and API Designer both returned VERDICT: PASS. No ADR exceptions required.

---

## Inputs Reviewed

- `specs/runtime/034-mcq-question-model/spec.md`
- `specs/runtime/034-mcq-question-model/plan.md`
- `specs/runtime/034-mcq-question-model/research.md`
- `specs/runtime/034-mcq-question-model/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                     |
| --------- | ----------------------------------------------------------------------------------- |
| API       | 14 route handlers in `apps/api/src/routes/backoffice/mcq-questions/`                |
| Worker    | None — question CRUD is synchronous                                                 |
| Frontend  | None — Backoffice UI deferred to future stage                                       |
| DB Master | None — zero master DB access                                                        |
| DB Tenant | 5 new tables, 1 migration file `20260330_012_mcq_questions.ts`, schema_version bump |

---

## Key Technical Decisions

| #   | Decision                                             | Rationale                                                                                     |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | `sanitize-html` for rich text sanitization           | Whitelist approach, no framework deps, well-maintained                                        |
| 2   | Optimistic concurrency via `updated_at` WHERE clause | Prevents lost updates without pessimistic locks; 409 Conflict on stale writes                 |
| 3   | Dependency registry for deletion guards              | Pluggable pattern — future stages register reference checkers without modifying question code |
| 4   | Full option replacement on PATCH                     | Single atomic transaction; simplifies validation vs incremental option editing                |
| 5   | EXISTS subqueries for classification filters         | Indexed join tables; avoids JOINs that multiply rows in paginated queries                     |
| 6   | `deleted_at` TIMESTAMPTZ column for soft delete      | Preserves audit trail; list queries add `WHERE deleted_at IS NULL`                            |
| 7   | Follows baskets module convention exactly            | Consistency across domain modules; proven pattern                                             |

---

## Migration Impact

| Item                  | Value | Notes                                                           |
| --------------------- | ----- | --------------------------------------------------------------- |
| Migration required    | Yes   | `20260330_012_mcq_questions.ts` — 5 tables, 12+ indexes, 12 FKs |
| `schema_version` bump | Yes   | Incremented in migration                                        |
| Backward compatible   | Yes   | Additive only — no existing table modifications                 |

---

## Transaction Boundaries

- **Create question**: Single tx: INSERT question → INSERT options → validate type rules
- **Update question**: Single tx: concurrency check → UPDATE metadata → DELETE old options → INSERT new options → validate
- **Delete question**: Single tx: guard check → hard delete (CASCADE) OR soft delete (SET deleted_at)
- **Link basket**: Single tx: COUNT max_questions → INSERT link
- **Link category/tag**: Single statement with UNIQUE catch → 409 on duplicate
- **Unlink category/tag/basket**: Single DELETE with existence check

---

## Idempotency Strategy

- **Classification links**: UNIQUE constraints on all join tables; duplicate → 409 Conflict, not 500
- **DDL migration**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
- **Optimistic concurrency**: Stale `updatedAt` → 409, not silent overwrite

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                             |
| -------------------------------------- | ------ | ----------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All 5 tables in tenant DB; zero master DB access                  |
| All writes are transactional by design | ✅     | Create, update, delete, link basket — all use explicit tx         |
| Server-authoritative time enforced     | ✅     | All timestamps via `NOW()`, no client timestamps accepted         |
| License middleware enforced            | ✅     | Tenant resolver → license middleware on all routes                |
| Version compatibility enforced         | ✅     | Migration bumps schema_version; version check at request boundary |
| No architecture redesign without ADR   | ✅     | No architectural exceptions detected                              |

**Overall:** COMPLIANT

---

## Guardian Verdicts

| Guardian              | Verdict | Key Findings                                                              |
| --------------------- | ------- | ------------------------------------------------------------------------- |
| Architecture Guardian | PASS    | 6 non-blocking advisories (doc-level corrections + `sanitize-html` audit) |
| API Designer          | PASS    | All 9 API design aspects validated; offset pagination noted as acceptable |

---

## Open Risks

- **A-6 (MEDIUM)**: `sanitize-html` dependency — pin to specific version, verify no CVEs, confirm no transitive HTTP deps
- Offset-based pagination at scale (100k+ questions) — acceptable for backoffice, cursor-based can be added in future stage

---

## Next Step

Proceed to Step 4 — Tasks.
