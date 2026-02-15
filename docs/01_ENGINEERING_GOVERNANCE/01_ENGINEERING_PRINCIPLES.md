# Zidney Engineering Principles

Zidney is a white-label, multi-tenant SaaS platform built for institutional trust.  
These principles are non-negotiable architectural rules.

---

## Stability Over Speed

Zidney prioritizes reliability over rapid iteration.

- No breaking change without versioning.
- No silent behavioral change.
- No production schema modification without migration.
- No runtime change without backward compatibility consideration.
- Hotfixes must not introduce hidden side effects.

If a feature compromises stability, it must be rejected or redesigned.

---

## Deterministic and Server-Authoritative Systems

All critical logic must be:

- Server authoritative
- Deterministic
- Idempotent
- Transaction-safe

This is mandatory for:

- Exam attempts
- Grading engine
- Subscription enforcement
- License lifecycle
- Limit enforcement
- Concurrency guards

Client-side logic is advisory only.

---

## Tenant Isolation Is Absolute

Zidney uses strict database-per-tenant isolation.

- No cross-tenant queries.
- No shared tenant tables.
- No cross-database joins.
- No implicit tenant context.
- No fallback default tenant.

Tenant context must be resolved via middleware only.

Isolation failure equals platform failure.

---

## Snapshot Over Live Reference

Historical records must snapshot configuration at execution time.

Applies to:

- Attempts
- Grading configuration
- Exam settings
- Certificates
- Versioned entities

Historical correctness must not depend on mutable configuration.

---

## Upgrade Is Explicit and Controlled

Product updates:

- Are available to licenses.
- Are never forced automatically.
- Must be versioned.
- Must include migration compatibility checks.

Workspace upgrade must be explicit and reversible where possible.

---

## Strict Layer Separation

The system must maintain clean boundaries:

- UI must not access database types directly.
- Frontend must not bypass API layer.
- Domain logic must not depend on transport layer.
- Transport layer must not contain business logic.
- Infrastructure must not leak into domain models.

Cross-layer imports are architectural violations.

---

## Observability Is Mandatory

Every request must include:

- Structured logging
- Correlation ID
- Workspace context
- Attempt ID (when applicable)

Silent failures are not acceptable.

Logs must be structured and machine-parseable.

---

## Explicit Over Implicit

Zidney avoids:

- Magic behavior
- Hidden defaults
- Implicit side effects
- Auto-mutations of configuration

All behavior must be explicit in code and documented in specs.

---

## Security Is Built-In

- Secrets must never be hardcoded.
- Sensitive operations must be audited.
- Rate limiting must protect public endpoints.
- Authentication tokens must be validated strictly.
- License state must be enforced at middleware level.

Security cannot be added later. It must be inherent.

---

## Institutional Trust Principle

Zidney serves institutions.

Institutional trust requires:

- Predictable behavior
- Auditability
- Data integrity
- Isolation guarantees
- Controlled lifecycle management

If any change weakens institutional trust, it must not be merged.
