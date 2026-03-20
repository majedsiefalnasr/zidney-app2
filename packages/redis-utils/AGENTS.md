# packages/redis-utils — AI Behavioral Contract

## Identity

Redis Utils provides **Redis client abstractions** for caching, session management, and rate limiting across Zidney services.

## Ownership

- Redis client factory and connection management
- Cache abstraction (get, set, delete, TTL)
- Rate limiting primitives
- Session storage utilities
- Pub/sub abstractions (if used)

## Non-Negotiable Rules

- **Tenant-scoped keys** — all Redis keys must be prefixed with `workspace_id` or `workspace_slug`
- **No cross-tenant key access** — operations must be scoped to a single tenant
- **TTL required** — every cached value must have an explicit TTL
- **No secrets in cache values** — passwords, tokens must never be stored in Redis
- **Connection pooling** — use shared connections, no per-request connections

## Import Rules

Allowed:

- `packages/types` — shared type definitions
- `packages/config` — Redis connection configuration
- `packages/logger` — structured logging for cache operations

Forbidden:

- `apps/*` — never import from application layer
- `packages/domain-core` — Redis is infrastructure, not domain
- `packages/api-client`, `packages/job-queue`, `packages/validation`

## Patterns

- Key format: `{workspace_slug}:{domain}:{entity_id}` (e.g., `acme:exam:123`)
- Cache-aside pattern for read-heavy data
- Always handle Redis connection failures gracefully (degrade, don't crash)

## Verdict

```
VERDICT: BLOCKED — if Redis key lacks tenant scope prefix
```
