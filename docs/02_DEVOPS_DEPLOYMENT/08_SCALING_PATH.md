# Scaling Path

Phase: DevOps & Deployment Scope: Infrastructure evolution strategy for Zidney

---

## Principles

Zidney scaling must preserve:

- Database-per-tenant isolation
- License enforcement guarantees
- Snapshot-before-migration safety
- Stateless runtime containers
- Deterministic deployment

Scaling must never compromise tenant isolation.

---

## Phase 1 – Single VPS (Year 1 Target)

Architecture:

- Single VPS
- Docker Compose
- Single PostgreSQL instance
- PgBouncer enabled
- Single Redis instance
- API + Worker containers
- Nginx reverse proxy

Characteristics:

- Vertical scaling only (CPU/RAM increase)
- One connection pool per tenant (in-memory map)
- < 100 workspaces expected
- 200–500 concurrent exam takers per large workspace supported

Rules:

- No horizontal scaling yet
- No multi-node cluster
- No cross-region deployment

This phase prioritizes stability and operational simplicity.

---

## Phase 2 – Service Separation

Trigger Conditions:

- High DB CPU usage
- Redis memory pressure
- Increased concurrent attempt load

Architecture Changes:

- Separate PostgreSQL server (dedicated instance)
- Separate Redis server
- API + Worker remain on app server
- PgBouncer required

Benefits:

- DB isolation from runtime spikes
- Better memory management
- Improved failover preparation

No change to tenant model.

---

## Phase 3 – Horizontal Runtime Scaling

Trigger Conditions:

- High API CPU
- High concurrent scheduled exam load
- WebSocket pressure

Architecture Changes:

- Load balancer (Nginx or managed LB)
- Multiple API containers
- Multiple Worker containers
- Shared Redis
- Shared PostgreSQL

Critical Requirement:

Runtime must be stateless.

All state must exist in:

- PostgreSQL
- Redis

No in-memory session state allowed.

Tenant connection pools must be safe across multiple instances.

---

## Phase 4 – Database Scaling

Optional future step.

Options:

- Read replicas for analytics
- Dedicated write node
- Connection pooling tuning
- Partitioning heavy tables (attempts)

Tenant DB-per-database model remains intact.

No row-based multi-tenancy introduced.

---

## Scaling Constraints

Never allowed:

- Merging tenant databases
- Shared student tables
- Cross-tenant joins
- Runtime schema auto-migrations
- Disabling snapshot-before-migration rule

---

## Observability Requirement for Scaling

Before moving phases, system must:

- Have structured logs
- Have correlation IDs
- Monitor DB connections
- Monitor attempt throughput
- Monitor worker queue depth
- Monitor memory usage

Scaling without observability is prohibited.

---

## Stability Principle

Scaling must increase capacity without reducing:

- Isolation
- Data integrity
- License enforcement
- Attempt integrity

Institutional trust > raw throughput.
