# Runtime Invariants

Captured: 2026-03-12T17:25:53Z

The clean-baseline path for this stage preserves all runtime guarantees by leaving runtime files untouched.

## Frozen Invariants

- Authentication and correlation propagation
- Tenant resolution and license middleware order
- Schema-version and product-version compatibility checks
- Worker authority and server-authoritative time
- Standard `{ success, data, error }` response envelope
- Existing transaction and idempotency guarantees
- Secret handling and structured logging discipline
