# Research Findings: Implement multi-tenancy architecture for Zidney platform

**Date**: 2026-02-15 **Feature**:
[specs/runtime/002-multi-tenancy-architecture/spec.md](specs/runtime/002-multi-tenancy-architecture/spec.md)

## Research Tasks

### Task 1: Research tenant resolver middleware implementation in Hono

**Decision**: Use Hono's built-in middleware system with context attachment **Rationale**: Hono
provides `app.use()` for global middleware, allows attaching tenant context to request object,
supports async operations for DB lookups **Alternatives considered**: Custom Express-style
middleware, but Hono is the chosen framework; third-party multi-tenancy libraries (too opinionated
and may violate isolation rules)

### Task 2: Research connection pool management for database-per-tenant

**Decision**: Use pg (node-postgres) Pool with in-memory Map<workspaceId, Pool>, lazy initialization
**Rationale**: pg Pool provides connection pooling, Map ensures one pool per tenant, lazy creation
prevents resource waste, Bun compatible **Alternatives considered**: Prisma (ORM, may add overhead),
custom pooling (reinvent wheel), shared pools (violates isolation)

### Task 3: Research semantic versioning comparison in TypeScript

**Decision**: Use semver npm package for version comparison **Rationale**: Standard library for
semver, supports major/minor/patch comparison, lightweight, widely used **Alternatives considered**:
Custom regex parsing (error-prone), other semver libs (semver is most popular)

### Task 4: Research in-memory caching for registry

**Decision**: Use Map with TTL-based invalidation (simple implementation) **Rationale**: Map
provides fast lookups, TTL prevents stale data, no external dependencies needed for <100 tenants
**Alternatives considered**: Redis (overkill for small scale), LRU cache libs (adds complexity), no
cache (increases DB load)

### Task 5: Best practices for multi-tenancy in Node.js/Bun

**Decision**: Database-per-tenant with middleware resolution, no shared schemas **Rationale**:
Ensures strict isolation, middleware enforces access control, aligns with constitution
**Alternatives considered**: Row-based tenancy (violates rules), schema-based (less isolation)

### Task 6: Postgres connection pooling libraries

**Decision**: node-postgres (pg) with Pool **Rationale**: Native Postgres driver, excellent
performance, Bun compatible, supports connection pooling **Alternatives considered**: pg-promise
(adds abstraction), knex (ORM level)
