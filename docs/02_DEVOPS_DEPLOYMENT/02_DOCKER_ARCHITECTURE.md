# Docker Architecture

Phase Alignment: Platform Foundation – Infrastructure Layer  
Scope: Local development and VPS deployment architecture  
Status: Enforced

---

## Architectural Principles

The Docker layer must enforce:

- Database-per-tenant isolation
- Single PostgreSQL instance
- PgBouncer connection pooling
- No direct public database exposure
- Explicit network segmentation
- Deterministic container startup order

Docker is infrastructure enforcement, not business logic.

---

## Container Topology

Required services:

- nginx (reverse proxy)
- api (Bun + Hono backend)
- worker (background processor)
- postgres (single instance)
- pgbouncer (connection pooling layer)
- redis (job queue + pub/sub)

Optional future services:

- monitoring stack (Prometheus, Grafana)
- centralized logging (Loki, ELK)

---

## Service Responsibilities

### nginx

- Public entry point (ports 80/443 only)
- Reverse proxy to api
- No direct DB access
- TLS termination (production)

### api

- Tenant resolver
- License enforcement
- Runtime business logic
- No schema migration execution in production

### worker

- Background jobs
- Grading tasks
- Notifications
- Provisioning jobs

### postgres

- Single instance
- Contains:
  - master_db
  - workspace\_<slug> databases
- Not exposed publicly

### pgbouncer

- All API connections must go through PgBouncer
- Prevents connection exhaustion
- Mandatory in production

### redis

- Queue backend
- Pub/Sub for WebSocket fanout
- No public exposure

---

## Network Design

- All containers communicate over internal Docker network
- Only nginx exposes ports to host
- postgres, redis, and pgbouncer must not expose host ports
- api and worker must not expose public ports directly

Network isolation is mandatory.

---

## Volumes

Persistent volumes required for:

- PostgreSQL data directory
- Media uploads (if local storage is used)
- Backup directory (if stored locally)

Redis persistence optional but recommended.

No container may rely on ephemeral data for critical state.

---

## Environment Injection

- All secrets via environment variables
- No hardcoded credentials
- No credentials committed to repository
- Separate .env files for:
  - development
  - staging (future)
  - production

Production must not use development secrets.

---

## Health Checks

Each service must expose health signals:

### api

- /health endpoint
- DB connectivity verification
- Redis connectivity verification

### worker

- Redis connectivity check
- Job processor readiness

### postgres

- pg_isready check

### pgbouncer

- Connection availability check

nginx must depend on api health.

---

## Restart Policy

All core services:

restart: unless-stopped

Worker may use:

restart: always

---

## Deployment Modes

### Local Development

- Docker required for postgres, redis, pgbouncer
- api may run inside Docker or host
- Worker may run inside Docker or host
- Hot reload allowed

### Production (Single VPS – Year 1)

- All services run in Docker
- Single VPS
- Reverse proxy via nginx
- Snapshot-before-migration enforced
- Manual upgrade path

---

## Hard Rules

- No direct DB access from host in production
- No schema migrations executed automatically on container boot
- No shared database across environments
- No public exposure of internal services
- No bypassing PgBouncer in production

Docker must reinforce isolation guarantees defined in Stage 02.
