# Clarify Report — STAGE_20_STATUS_WORKFLOW_ENGINE

**Step:** 2 — Clarify **Timestamp:** 2026-03-01T00:02:00.000Z **Status:** COMPLETE

---

## Summary

5 targeted clarification questions were asked and resolved. All material ambiguities eliminated.
spec.md updated in-place with a `## Clarifications / ### Session 2026-03-01` section. 18 functional
requirements (was 17) now defined after adding FR-018 for rate limiting. Zero remaining open items.

---

## Inputs Reviewed

- `specs/runtime/020-status-workflow-engine/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                    | Resolution                                                                                                   | Impact                                                                      |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Q1  | What locking mechanism serializes simultaneous transitions? | `SELECT FOR UPDATE` on entity row within transaction                                                         | FR-009 rewritten with explicit 5-step atomic sequence including row lock    |
| Q2  | What is the shape of the permission input to the engine?    | `WorkflowContext` includes `permissions: string[]` (pre-resolved by route handler; engine checks membership) | `WorkflowContext` entity definition updated; engine remains stateless       |
| Q3  | What HTTP status codes map to workflow errors?              | 400 bad transition / 403 permission denied / 404 not found / 409 conflict / 429 rate limit                   | New Error Contract section added; FR-004 updated with explicit `403`        |
| Q4  | How is the tenant DB connection passed into the engine?     | Explicit first param: `executeTransition(db: TenantDb, context: WorkflowContext)` — no singleton             | FR-015 expanded to specify injection contract; eliminates DB singleton risk |
| Q5  | Are transition endpoints rate-limited?                      | Yes — 20 transitions/user/entity-type/minute at API route layer; engine is stateless re: rate limiting       | New FR-018 added; 429 row added to Error Contract table                     |

---

## Open Items

None — all ambiguities resolved.

---

## Spec Updates Applied

- **FR-009** rewritten: 5-step atomic transaction sequence now explicitly includes
  `SELECT FOR UPDATE` row lock as step 1
- **FR-004** updated: "authorization error" replaced with explicit `403` HTTP status code
- **FR-015** expanded: tenant DB injection contract defined —
  `executeTransition(db: TenantDb, context: WorkflowContext)` — no global singleton
- **FR-018** added: rate limiting — 20 transitions/user/entity-type/minute enforced at API route
  layer
- **WorkflowContext entity** updated: `permissions: string[]` field added, pre-resolved by route
  handler
- **Error Contract section** added (new): full HTTP status code mapping for all workflow error cases
- **`## Clarifications` section** appended to `spec.md` with `### Session 2026-03-01`

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                         |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | Zero [NEEDS CLARIFICATION] markers remain; 5/5 questions resolved             |
| Transaction strategy confirmed            | ✅     | SELECT FOR UPDATE + 5-step atomicity explicitly defined in FR-009             |
| Idempotency strategy confirmed            | ✅     | FR-017 confirmed: duplicate transition = 400; not a silent pass               |
| Isolation boundaries confirmed            | ✅     | FR-015 DB injection contract prevents singleton — no cross-tenant risk        |
| Version and license constraints confirmed | ✅     | A-002 confirmed: license middleware mandatory; engine called after auth chain |

**Overall:** COMPLIANT — planning authorized.
