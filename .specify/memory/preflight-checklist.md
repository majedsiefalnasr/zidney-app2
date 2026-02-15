# Zidney SpecKit Preflight Checklist

Isolation Safety Check

- Does this feature require cross-tenant data access?
- Does it attempt row-based multi-tenancy?
- Does it introduce any shared student tables?
- Does it create DB access outside Tenant Resolver?
- Does it assume a global fallback DB?

If YES to any → STOP.

---

## License Authority Check

- Does this feature execute without passing license middleware?
- Does it mutate tenant state without license validation?
- Does it bypass student/staff limit enforcement?
- Does it assume license status without checking it?

If YES → STOP.

---

## Version Compatibility Check

- Does this feature assume schema without checking schema_version?
- Does it rely on runtime features not tied to product_version?
- Could this break older tenant DBs?

If YES → Must include version enforcement logic.

---

## Attempt Integrity Check

If feature touches exam execution:

- Are questions snapshotted at attempt start?
- Are config flags frozen?
- Is grading done from snapshot only?
- Is grading executed only inside Worker?
- Is submission idempotent?

If any missing → Block plan.

---

## Authoritative Time Check

If feature involves time:

- Is server time used?
- Is client time ignored?
- Are deadlines validated server-side?
- Are soft-lock boundaries enforced server-side?

If not → Redesign.

---

## Transaction Safety Check

- Does every state mutation run inside a transaction?
- Are limit checks transactional?
- Is submission atomic?
- Is provisioning idempotent?
- Are license transitions atomic?

If not → Redesign.

---

## Logging & Observability Check

- Does every endpoint generate structured logs?
- Does log include request_id?
- Does workspace-bound log include workspace_slug?
- Does attempt-bound log include attempt_id?
- Are errors mapped to unified error format?

If missing → Add before implementation.

---

## Rate Limiting & Abuse Check

- Does this endpoint require rate limiting?
- Could it be abused (login, submit, grading, provisioning)?
- Is idempotency required?
- Should it be protected against replay?

If unclear → Clarify before planning.

---

## Layer Separation Check

- Does frontend contain business logic?
- Does API contain grading?
- Does Worker mutate outside transaction?
- Does MMC access tenant DB directly?
- Does Backoffice bypass API layer?

If YES → Reject.

---

## AI Behavioral Enforcement

Before /speckit.plan confirm:

- No middleware bypass
- No weakening of isolation
- No weakening of snapshot integrity
- No weakening of transaction boundaries
- No weakening of version enforcement
- No weakening of structured logging

If conflict detected → Update ADR before proceeding.

---

## Final Pre-Implementation Gate

Only proceed to:

```
/speckit.plan
```

If ALL of the following are true:

- Constitution compliant
- No cross-tenant leakage
- No implicit runtime assumptions
- Versioning considered
- Error contract defined
- Idempotency defined
- Transaction boundaries defined
