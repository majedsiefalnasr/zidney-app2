# MCP Activation Matrix — Zidney

Defines which MCP tools may be used during each phase of development.

Purpose:

- Prevent uncontrolled schema changes
- Prevent infra misuse
- Prevent runtime corruption
- Maintain phase discipline

---

## Phase 1 — Platform Foundation

Allowed MCPs:

- Git
- Filesystem
- Postgres (read-only)
- Redis
- Docker

Not required:

- Load testing

Purpose: Architecture, isolation, migrations, provisioning.

---

## Phase 2 — MMC

Allowed MCPs:

- Git
- Filesystem
- Postgres (master DB)
- Docker

Restricted:

- No tenant DB schema changes unless explicitly defined

Purpose: Commercial control layer only.

---

## Phase 3 — Backoffice Core

Allowed MCPs:

- Git
- Filesystem
- Postgres (tenant DB)
- Redis
- Docker

Purpose: Domain modeling and content structure.

---

## Phase 4 — Runtime & Attempt Engine

Allowed MCPs:

- Git
- Filesystem
- Postgres (tenant DB)
- Redis
- Docker
- Load testing (recommended)

Purpose: High-concurrency runtime safety.

---

## Phase 5 — Frontoffice Runtime

Allowed MCPs:

- Git
- Filesystem
- Postgres
- Redis
- Docker
- Load testing (recommended)

Purpose: Student-facing stability.

---

## Production Safety Rule

Postgres MCP in production must be:

- Read-only
- No direct mutation
- No manual SQL execution

All schema changes must go through migrations.

---

## Upgrade Enforcement

When schema changes are detected:

- Git MCP must validate migration file exists
- Postgres MCP must validate schema_version increment
- AI must reference STAGE_02C

---

## Isolation Enforcement

During any stage involving tenant DB:

- Filesystem MCP must verify no cross-app import
- Postgres MCP must verify no shared schema usage
- AI must confirm resolver-based DB usage

---

## Runtime Integrity Enforcement

During attempt-related stages:

- AI must verify snapshot model compliance
- Redis MCP may validate job idempotency
- Load test MCP recommended before release

---

This matrix prevents phase contamination and architectural drift.
