# ADR-0001 – Database Per Tenant

## Status

Accepted

## Context

Zidney is a white-label SaaS serving institutions.

Data isolation and institutional trust are critical.

---

## Decision

Each workspace will have:

- Its own PostgreSQL database
- Fully isolated schema
- Independent migrations

---

## Alternatives Considered

### Shared DB with tenant_id column

Rejected because:

- Risk of cross-tenant leakage
- Harder scaling
- Complex indexing
- Lower institutional trust

---

## Consequences

Pros:

- Strong isolation
- Easier compliance
- Cleaner scaling
- Simplified data deletion

Cons:

- More migration complexity
- More DB connections
- Slight infra overhead

---

## Future Notes

Connection pooling per tenant must be managed carefully.
