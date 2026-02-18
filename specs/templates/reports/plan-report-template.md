# Plan Report — <STAGE_NAME>

**Step:** 3 — Plan  
**Timestamp:** <ISO_TIMESTAMP>  
**Status:** COMPLETE / BLOCKED

---

## Summary

[Summary of the technical plan.]

---

## Architecture Layers Touched

| Layer     | Changes |
| --------- | ------- |
| API       | ...     |
| Worker    | ...     |
| Frontend  | ...     |
| DB Master | ...     |
| DB Tenant | ...     |

---

## Key Technical Decisions

| #   | Decision | Rationale |
| --- | -------- | --------- |
| 1   | ...      | ...       |

---

## Migration Impact

- Migration required: Yes / No
- schema_version bump: Yes / No
- Backward compatible: Yes / No

---

## Transaction Boundaries

[List each write operation and its transaction strategy.]

---

## Idempotency Strategy

[Describe idempotency approach per operation.]

---

## Constitutional Compliance

| Check                          | Status  |
| ------------------------------ | ------- |
| No cross-tenant logic          | ✅ / ❌ |
| All writes transactional       | ✅ / ❌ |
| Server-authoritative time only | ✅ / ❌ |
| License middleware enforced    | ✅ / ❌ |
| Version compatibility enforced | ✅ / ❌ |
| No architecture redesign       | ✅ / ❌ |

**Overall:** COMPLIANT / BLOCKED

---

## Next Step

Proceed to Step 4 — Tasks.
