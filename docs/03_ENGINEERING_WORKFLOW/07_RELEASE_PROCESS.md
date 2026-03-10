# Release Process

Zidney follows a controlled, versioned, and migration-safe release process.

Releases must protect:

- Tenant isolation
- Schema integrity
- Runtime stability
- Version compatibility
- Institutional trust

No informal deployment is allowed.

---

## Release Types

Patch Release (x.y.Z)

- Bug fixes
- No schema changes
- No breaking API changes
- No product compatibility changes

Minor Release (x.Y.0)

- Backward-compatible features
- May include additive schema changes
- Product version may increase

Major Release (X.0.0)

- Breaking changes
- Incompatible schema evolution
- Explicit upgrade required per workspace
- Snapshot mandatory before upgrade

All releases must follow semantic versioning policy defined in:
docs/architecture/adr/adr-0008-formalize-semantic-versioning-policy.md

---

## Pre-Release Requirements

Before tagging a release:

- All tests passing
- Lint and typecheck passing
- Migrations validated on:
  - Fresh database
  - Existing populated database
- Version numbers updated (schema + product if applicable)
- Docker image builds successfully
- No pending migration conflicts
- No unresolved TODO in production code

Release must be traceable to spec stages.

---

## Version Tagging

Release must be tagged:

v<major>.<minor>.<patch>

Example: v1.3.0

Tag must match runtime version.

Tag must be created from main branch only.

No manual tag editing allowed.

---

## Deployment Procedure (Production)

Deployment must follow this sequence:

1. Pull latest main
2. Build Docker images
3. Deploy containers without applying migrations yet
4. Verify health endpoints operational
5. Execute migrations per tenant (if required)
6. Restart services (if needed)
7. Verify runtime compatibility checks pass
8. Monitor logs for errors

Tenant migrations must be executed via worker upgrade job.

No manual SQL execution allowed in production.

---

## Per-Tenant Upgrade Flow

For releases that include schema changes:

For each ACTIVE workspace:

1. Set license state to UPGRADING
2. Take full database snapshot
3. Apply migrations
4. Validate schema_version
5. Update product_version if required
6. Restore license state to ACTIVE

If migration fails:

- Restore snapshot
- Set license state to UPGRADE_FAILED
- Log structured error
- Do not leave partial state

---

## Post-Deployment Validation

After deployment:

- Verify API health endpoint
- Verify resolver functionality
- Verify authentication
- Verify license enforcement
- Verify attempt start
- Verify submission flow
- Verify scheduled exam enforcement
- Verify worker queue operational
- Check structured logs for anomalies

Release is not complete until runtime verification succeeds.

---

## Observability During Release

Monitor:

- Error rate
- Response latency
- Database connection pool usage
- Worker queue backlog
- Migration logs

All logs must include:

- workspace_slug (if tenant scoped)
- request_id
- version information

---

## Emergency Rollback Procedure

Rollback must be controlled and logged.

Steps:

1. Stop new traffic
2. Revert Docker image to previous tag
3. Restore affected tenant snapshots (if migration applied)
4. Restart services
5. Verify health and runtime checks

Rollback must not skip snapshot restoration.

Manual schema rollback is forbidden.

---

## Forbidden Practices

- Deploying directly from feature branch
- Skipping migration validation
- Editing historical migrations before release
- Applying runtime incompatible with schema
- Manual SQL in production
- Skipping snapshot before destructive migration

Violation is governance breach.

---

## Stability Principle

Release discipline protects:

- Tenant isolation
- Attempt integrity
- Version compatibility
- Institutional credibility

A release that risks data integrity must not ship.
