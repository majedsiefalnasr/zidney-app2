# Plan Report — <STAGE_NAME>

**Step:** 3 — Plan  
**Timestamp:** <ISO_TIMESTAMP>  
**Status:** COMPLETE / BLOCKED

---

## Summary

[Brief summary of technical plan outcome.]

---

## Inputs Reviewed

- `specs/runtime/<STAGE_DIR_NAME>/spec.md`
- `specs/runtime/<STAGE_DIR_NAME>/plan.md`
- `specs/runtime/<STAGE_DIR_NAME>/research.md` (if present)
- `specs/runtime/<STAGE_DIR_NAME>/data-model.md` (if present)
- `specs/runtime/<STAGE_DIR_NAME>/contracts/` (if present)

---

## Architecture Layers Touched

| Layer     | Planned Changes |
| --------- | --------------- |
| API       | ...             |
| Worker    | ...             |
| Frontend  | ...             |
| DB Master | ...             |
| DB Tenant | ...             |

---

## Key Technical Decisions

| #   | Decision | Rationale |
| --- | -------- | --------- |
| 1   | ...      | ...       |

---

## Migration Impact

| Item                  | Value    | Notes |
| --------------------- | -------- | ----- |
| Migration required    | Yes / No | ...   |
| `schema_version` bump | Yes / No | ...   |
| Backward compatible   | Yes / No | ...   |

---

## Transaction Boundaries

- [Write operation + transaction strategy]
- [...]

---

## Idempotency Strategy

- [Operation + idempotency approach]
- [...]

---

## Architecture Governance Compliance

| Check                                               | Status  | Notes |
| --------------------------------------------------- | ------- | ----- |
| No cross-tenant logic introduced (ADR-0001)         | ✅ / ❌ | ...   |
| All writes are transactional by design              | ✅ / ❌ | ...   |
| Server-authoritative time enforced (ADR-0006)       | ✅ / ❌ | ...   |
| License middleware enforced                         | ✅ / ❌ | ...   |
| Version compatibility enforced (ADR-0007, ADR-0008) | ✅ / ❌ | ...   |
| No architecture redesign without ADR                | ✅ / ❌ | ...   |
| Trust chain respected                               | ✅ / ❌ | ...   |
| Import boundaries respected                         | ✅ / ❌ | ...   |

**Overall:** COMPLIANT / BLOCKED

---

## Open Risks

- [List risks, or `None`]

---

## Next Step

Proceed to Step 4 — Tasks.
