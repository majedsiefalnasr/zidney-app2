# Deployment Overview

This document defines the official production deployment architecture for Zidney.

Zidney is designed as a database-per-tenant white-label SaaS platform. Infrastructure must enforce
strict isolation, version safety, and operational stability.

---

## Production Infrastructure Model

Initial deployment target:

- Single VPS
- Docker Compose orchestration
- PostgreSQL (single instance)
- PgBouncer (connection pooling)
- Redis (queue + pub/sub)
- Bun (API runtime)
- Worker service (background jobs)
- Nginx (single public entry point)

No service is allowed to run directly on the host outside Docker.

---

## High-Level Architecture Flow

Internet ↓ Nginx (reverse proxy) ↓ API (Bun + Hono) ↓ PgBouncer ↓ PostgreSQL ├── master*db ├──
workspace*<slug*1> ├── workspace*<slug*2> └── workspace*<slug_n>

Redis is used for:

- Background jobs
- Attempt processing
- Pub/Sub (WebSocket notifications)

---

## Multi-Tenancy Enforcement

Zidney uses strict database-per-tenant isolation.

Rules:

- One master database (master_db)
- One database per workspace (workspace\_<slug>)
- No row-based multi-tenancy
- No shared student tables
- No cross-tenant joins
- No global runtime tables for tenant data

All B2B and B2C data must exist only inside its tenant database.

Isolation is enforced at infrastructure level, not application logic only.

---

## Database Exposure Policy

In production:

- PostgreSQL must NOT expose public ports
- PgBouncer must NOT expose public ports
- Only Nginx exposes ports 80/443
- API and Worker communicate over internal Docker network

Direct database access from the internet is forbidden.

---

## Deployment Lifecycle

Initial deployment process:

1. SSH into VPS
2. Pull main branch
3. Build Docker images
4. Run migrations (master + tenant if required)
5. Restart containers
6. Validate health endpoints

All schema migrations must complete successfully before API is exposed.

Snapshot must be taken before destructive production migrations.

---

## Environment Types

Local:

- Docker Compose
- Postgres + PgBouncer + Redis
- Local .env allowed

Staging (optional):

- Same architecture as production
- Used for migration testing

Production:

- VPS
- Docker Compose
- Encrypted secrets
- No direct DB exposure

---

## Stability Principle

Infrastructure exists to guarantee:

- Tenant isolation
- License enforcement
- Version safety
- Snapshot recovery
- Deterministic runtime behavior

If isolation or migration safety fails, Zidney fails.

Infrastructure must remain simple, predictable, and auditable.

---

Next document: 02_DOCKER_ARCHITECTURE.md
