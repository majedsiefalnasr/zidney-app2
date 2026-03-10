Zidney Strict Analyze Template (Architecture Drift Detector)

Before approving tasks for implementation, perform a full constitutional compliance audit.

If violations are detected → STOP and describe conflicts clearly.

---

## Scope Validation

Confirm: • Phase: 1 – Platform Foundation • Stage: STAGE_02_MULTI_TENANCY_ARCHITECTURE • Related
Spec: specs/runtime/002-multi-tenancy-architecture/spec.md • Related ADR:
ADR-0001-database-per-tenant.md, ADR-0007-product-version-compatibility.md

Verify: • No cross-phase leakage: Confirmed - tasks scoped to platform foundation only • No
architecture redesign hidden inside tasks: Confirmed - tasks implement defined architecture • No
implicit feature creep: Confirmed - no provisioning or runtime features included

---

## Isolation Audit

Check: • No cross-tenant joins: Confirmed - no joins defined • No shared student tables: Confirmed -
no student data access • No direct DB instantiation: Confirmed - uses pool manager abstraction • No
service bypassing tenant resolver: Confirmed - resolver is global for workspace routes • License
middleware present on all workspace APIs: Confirmed - tenant resolver includes license checks

If any found → BLOCK.

**Status**: PASS

---

## License Enforcement Audit

Verify: • License status validated before DB usage: Confirmed - T008 enforces license status •
Version compatibility checks included: Confirmed - T009, T010 check schema and product versions •
423 / 403 / 426 error handling defined: Confirmed - T014-T018 map errors • No route bypassing
license middleware: Confirmed - global for /api/workspace/\*

**Status**: PASS

---

## Transaction Safety Audit

For each write endpoint:

Confirm: • Transaction wrapper present: N/A - no write endpoints in this stage • Concurrency guard
included: N/A • Rollback defined: N/A • No race-condition risk: Confirmed - read-only operations

If missing → BLOCK.

**Status**: PASS (no write operations)

---

## Idempotency Audit

For: • Attempt start: N/A • Attempt submission: N/A • Grading: N/A • License transitions: N/A •
Provisioning: N/A • Billing: N/A

Verify: • Idempotency strategy defined: N/A - no mutating operations • Unique constraints defined:
N/A • Replay protection defined: N/A • Tests included: N/A

If missing → BLOCK.

**Status**: PASS (no mutating operations)

---

## Snapshot Integrity Audit

If attempt-related:

Verify: • Snapshot frozen at start: N/A • No grading using live exam config: N/A • Worker-only
grading: N/A • API does not calculate score: N/A

If violated → BLOCK.

**Status**: PASS (not attempt-related)

---

## Versioning & Migration Audit

Verify: • Migration file defined: Confirmed - T001 creates migration • schema_version bump defined:
Confirmed - T002 updates version • Product version compatibility defined: Confirmed - T010 checks
compatibility • Incompatible requests return 426: Confirmed - T017 maps 426

**Status**: PASS

---

## Observability Audit

Verify: • Structured logging: Confirmed - T013 adds structured logging • request_id propagation:
Confirmed - T004A ensures correlation ID • workspace_slug logging: Confirmed - T013 includes
workspace_slug • attempt_id logging (runtime): N/A • No console.log: Confirmed - uses structured
logging

**Status**: PASS

---

## Security Audit

Verify: • RBAC enforced server-side: N/A - no user-specific access • JWT workspace scope validated:
N/A - resolver doesn't validate JWT • Validation using shared package: N/A - no input validation in
resolver • No frontend business logic: Confirmed - no frontend tasks

**Status**: PASS (infrastructure security only)

---

## Architectural Drift Summary

Output must contain: • Violations detected (if any): None • Risk level: LOW • Approval status:
APPROVED

---

## Final Compliance Statement

Architecture compliant with Zidney Constitution v1.2.0
