# Zidney API – Server-Side Authority Contract

Stack:

- Bun
- Hono
- PostgreSQL
- Drizzle ORM
- Redis
- Pino
- Zod
- JWT (jose)

The API is the single source of truth for all business logic.

No frontend application (MMC, Backoffice, Frontoffice) may enforce business rules independently.

---

## Architectural Position

The API enforces the full trust chain:

Isolation → License → Provisioning → Authentication → Authorization → Attempt → Runtime

The API is authoritative for:

- Multi-tenancy resolution
- License lifecycle enforcement
- Provisioning orchestration
- Authentication & JWT validation
- RBAC authorization
- Attempt snapshot integrity
- Grading logic
- Version compatibility
- Subscription enforcement
- Rate limiting
- Observability and logging

No logic may bypass API enforcement layers.

---

## Non-Negotiable Enforcement Layers

Every workspace-bound request MUST pass through:

1. Tenant Resolver (database-per-tenant isolation)
2. License Middleware (status + limits + version enforcement)
3. Authentication Middleware (JWT validation)
4. Authorization Middleware (RBAC enforcement)
5. Runtime guards (if attempt-related)

No route may access tenant DB before these layers succeed.

---

## Tenant Isolation Rules

API MUST:

- Resolve tenant from subdomain or /workspace/<slug>
- Load tenant metadata from master_db
- Maintain one connection pool per tenant
- Never reuse pools across tenants
- Never allow cross-tenant joins
- Never allow manual tenant override from request body

No service may instantiate its own DB connection.
All DB access must come from request context.

---

## License Authority

API is the only authority for license state.

Must enforce:

- ACTIVE → allowed
- SOFT_LOCKED → 423
- ARCHIVED → 403
- DELETED → 404
- PROVISIONING → restricted

Soft lock expiration must be validated at runtime.
Auto-transition to ARCHIVED when expired.

Student and staff limits must be:

- Transactionally enforced
- Checked inside DB transaction
- Never based on cached counters

---

## Provisioning Authority

Provisioning runs as asynchronous job.

API responsibilities:

- Create license in PROVISIONING state
- Enqueue provisioning job
- Prevent access until ACTIVE
- Record provisioning failure states
- Guarantee idempotency

API must never assume DB exists until provisioning confirmed.

---

## Authentication & Authorization

JWT must:

- Include workspace_id
- Include role
- Include token_version
- Expire properly

API must:

- Validate signature
- Match workspace_id to resolved tenant
- Enforce token_version invalidation
- Reject expired tokens

RBAC rules live server-side only.
Frontend must not compute permissions.

---

## Attempt Engine Authority

API controls:

- Attempt snapshot creation
- Question order freezing
- Mode freezing (Relax, Chrono, Rush)
- Config flag freezing
- Grading configuration freezing
- Server-authoritative time

Attempt data must be immutable after submission.

Submission must be idempotent.

---

## Version Compatibility Enforcement

On every tenant request:

- Validate schema_version
- Validate product_version compatibility
- Reject incompatible versions (426)

API must never operate on outdated schema.

---

## Error Handling Contract

All errors MUST follow:

{
success: false,
error: {
code: "ERROR_CODE",
message: "Human readable message"
},
request_id: "uuid"
}

API must:

- Never leak stack traces
- Never leak DB credentials
- Never expose internal SQL errors
- Log full internal error with correlation ID

---

## Observability Requirements

Every request must include:

- request_id
- workspace_slug (if applicable)
- user_id (if authenticated)
- attempt_id (if applicable)

Structured logs only.
No console.log.

Critical events must be logged:

- Provisioning
- License transition
- Submission
- Soft-lock transition
- Archive
- Restore
- Deletion

---

## Rate Limiting & Security

API must enforce:

- Login rate limits
- Submission endpoint protection
- WebSocket throttling
- Idempotency keys for submission
- Payload size limits

Security decisions never delegated to frontend.

---

## AI Behavioral Constraints (Server Scope)

AI generating backend code MUST:

- Never bypass tenant resolver
- Never access DB outside context
- Never hardcode workspace logic
- Never duplicate license checks in route handlers
- Never move business logic to frontend
- Never create cross-app imports
- Respect layered middleware order

API is the authoritative enforcement layer.

No exceptions.

---

## References

- specs/01_PLATFORM_FOUNDATION/
- specs/04_RUNTIME/
- docs/01_ENGINEERING_GOVERNANCE/
- docs/architecture/
