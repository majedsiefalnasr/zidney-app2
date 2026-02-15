# Zidney Docker & Infrastructure Contract

Scope:

This document defines the infrastructure rules for Zidney.

Environment:

- Single VPS (initial architecture)
- Docker Compose
- PostgreSQL (single instance)
- Redis
- Nginx
- API (Bun + Hono)
- Worker (background processor)
- PgBouncer (connection pooling)

Docker is the source of truth for runtime execution.

---

## Architectural Position

Infrastructure enforces:

Isolation → License → Attempt → Runtime → Frontoffice

If infrastructure is misconfigured,
all higher layers become unreliable.

---

## Local Development Rules

All developers MUST:

- Use Docker for infrastructure services
- Use docker-compose for orchestration
- Use the same .env.example template

Allowed locally:

- Frontend may run outside Docker for faster iteration
- API and Worker MAY run outside Docker in development only

NOT ALLOWED:

- Running PostgreSQL outside Docker
- Running Redis outside Docker
- Hardcoding environment variables
- Skipping PgBouncer in production

Docker is mandatory for:

- Database
- Redis
- Production runtime

---

## Database Architecture

Single PostgreSQL instance contains:

- master_db
- workspace\_<slug> databases

Rules:

- No shared schema multi-tenancy
- No cross-database joins
- No shared student tables
- No row-based multi-tenancy

Tenant databases are created only via:

STAGE_05_TENANT_PROVISIONING_SERVICE

Manual DB creation is forbidden.

---

## PgBouncer Requirement

Production MUST use PgBouncer.

Reason:

- One connection pool per tenant (in-memory)
- Prevent connection explosion
- Protect VPS memory

PgBouncer must:

- Use transaction pooling mode
- Limit max client connections
- Be placed between API/Worker and Postgres

Direct production DB connection is forbidden.

---

## Secrets Management

Local:

- .env allowed
- .env must not be committed
- .env.example must be complete

Production:

- Docker secrets required
- No secrets inside image layers
- No secrets in Git history
- DB passwords encrypted at rest in master_db

Worker and API must read secrets from environment only.

---

## Backup & Recovery Policy

Before:

- Platform migration
- Tenant schema migration
- License lifecycle destructive change

System MUST:

- Snapshot master_db
- Snapshot affected tenant DB
- Store timestamped backup

Archive transition:

- Full DB snapshot required
- Snapshot metadata stored in master_db

Rollback allowed only via:

- Snapshot restore
- Not via manual SQL edits

No destructive migration without snapshot.

---

## Provisioning & Deletion Safety

Provisioning must:

- Run inside controlled environment
- Be idempotent
- Log every step

Deletion must:

- Require ARCHIVED state
- Require manual confirmation
- Drop DB only after verification
- Log deletion event

Orphan DBs are unacceptable.

Orphan registry entries are unacceptable.

Periodic integrity check recommended.

---

## Logging & Observability

Containers must:

- Output structured logs (JSON)
- Include request_id
- Include workspace_slug when applicable
- Include service name

Logs must not:

- Contain passwords
- Contain JWT tokens
- Contain PII

Future:

- Centralized logging (ELK or equivalent)

---

## Network Rules

Internal services communicate via Docker network.

Only Nginx exposes public ports.

API and Worker must not expose ports directly in production.

Redis must not be publicly accessible.

Postgres must not be publicly accessible.

---

## Scaling Strategy

Initial:

- Single VPS
- Docker Compose
- Single Postgres instance
- One PgBouncer instance

Future path:

- Dedicated DB server
- Read replicas
- Horizontal API scaling
- Separate worker scaling
- Reverse proxy load balancing

Scaling must not break:

- Database-per-tenant isolation
- Snapshot integrity
- License enforcement

---

## AI Behavioral Constraints

AI generating infrastructure changes MUST:

- Never remove PgBouncer
- Never introduce shared tenant tables
- Never expose DB publicly
- Never bypass provisioning service
- Never introduce row-based multi-tenancy

Infrastructure enforces institutional trust.

Misconfiguration = systemic failure.
