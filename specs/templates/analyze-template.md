Zidney Strict Analyze Template (Architecture Drift Detector)

Before approving tasks for implementation, perform a full constitutional compliance audit.

If violations are detected → STOP and describe conflicts clearly.

---

## Scope Validation

Confirm: • Phase: • Stage: • Related Spec: • Related ADR (if any):

Verify: • No cross-phase leakage • No architecture redesign hidden inside tasks • No implicit
feature creep

---

## Isolation Audit

Check: • No cross-tenant joins • No shared student tables • No direct DB instantiation • No service
bypassing tenant resolver • License middleware present on all workspace APIs

If any found → BLOCK.

---

## License Enforcement Audit

Verify: • License status validated before DB usage • Version compatibility checks included • 423 /
403 / 426 error handling defined • No route bypassing license middleware

---

## Transaction Safety Audit

For each write endpoint:

Confirm: • Transaction wrapper present • Concurrency guard included • Rollback defined • No
race-condition risk

If missing → BLOCK.

---

## Idempotency Audit

For any operation marked as idempotent in plan.md:

Verify: • Idempotency strategy defined • Unique constraints defined • Replay protection defined •
Tests included • Consistent with clarifications from this stage

If missing → BLOCK.

---

## Snapshot Integrity Audit

If feature involves snapshot-based operations:

Verify: • Snapshot frozen at start • No mutations of snapshotted data • Worker-only calculation (if
applicable) • API does not override snapshotted state • (Per ADR-0002 if applicable)

If violated → BLOCK.

---

## Versioning & Migration Audit

Verify: • Migration file defined • schema_version bump defined • Product version compatibility
defined • Incompatible requests return 426

---

## Observability Audit

Verify: • Structured logging (Pino format) • correlation_id propagation (or equivalent) •
workspace_slug logging (tenant context) • Domain-specific IDs (attempt_id, student_id, etc. if
applicable) • No console.log

---

## Security Audit

Verify: • RBAC enforced server-side • JWT workspace scope validated • Validation using shared
package • No frontend business logic

---

## Architectural Drift Summary

Output must contain: • Violations detected (if any) • Risk level: LOW / MEDIUM / HIGH / CRITICAL •
Approval status: APPROVED / BLOCKED

---

## Final Compliance Statement

Must conclude with:

“Architecture compliant with Zidney Constitution v1.2.0”

OR

“Implementation blocked due to constitutional violations”
