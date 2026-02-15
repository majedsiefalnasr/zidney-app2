# CI/CD Blueprint

Phase Alignment: Platform Foundation – Operational Safety Layer  
Scope: Continuous Integration, Controlled Deployment, Migration Safety  
Status: Enforced

---

## Objectives

The CI/CD pipeline must guarantee:

- Code quality enforcement
- Schema safety enforcement
- Migration validation
- Deterministic builds
- Safe production deployment
- Snapshot-before-migration policy

No deployment may bypass CI validation.

---

## Phase 1 – Controlled Manual Deployment (Initial Stage)

Until automation matures, deployment follows controlled manual steps.

Process:

1. Pull latest main branch on VPS
2. Build Docker images
3. Take database snapshot (master + affected tenants)
4. Run migrations
5. Validate schema version
6. Restart containers
7. Verify health endpoints

If migration fails:

- Restore snapshot
- Stop deployment
- Log incident

No direct production edits allowed.

---

## Phase 2 – Automated CI (Enforced)

CI must execute on every pull request and main branch push.

Required CI Steps:

- Install dependencies (Bun workspace)
- Run ESLint
- Run TypeScript type check
- Run unit tests
- Validate import boundaries
- Validate migration integrity
- Build Docker images (without pushing on PR)

If any step fails → merge blocked.

---

## Migration Validation Rules

CI must:

- Ensure migration files are versioned
- Prevent modification of existing migration files
- Prevent duplicate schema versions
- Validate schema_version increment

Destructive migrations must require explicit approval.

CI must fail if:

- schema_version mismatch detected
- Migration file altered retroactively
- Migration order conflict detected

---

## Deployment Automation (Future Phase)

CD pipeline must:

- Build Docker image
- Tag image with immutable version
- Push image to registry
- SSH into VPS
- Pull new image
- Take database snapshot
- Apply migrations
- Restart services
- Validate health checks

Deployment must abort automatically if:

- Migration fails
- Health check fails
- Schema validation fails

No rolling forward without validation.

---

## Schema Version Enforcement

Before runtime exposure:

- All tenant schema_version must be >= MIN_SUPPORTED_SCHEMA_VERSION
- master_db schema_version must match platform

If mismatch detected:

- Block API start
- Log critical error
- Prevent partial runtime execution

---

## Artifact Policy

Docker images must be:

- Immutable
- Version tagged
- Never overwritten

Production must never deploy untagged images.

---

## Branch Protection Rules

Main branch must enforce:

- CI passing required
- Code review required
- No direct push
- Migration review mandatory

---

## Testing Requirements

Minimum required for merge:

- Unit tests for modified domain logic
- Snapshot tests for grading logic (if affected)
- Attempt flow tests if runtime modified

No merge allowed with failing tests.

---

## Hard Rules

- No production migration without snapshot
- No skipping CI checks
- No manual schema edits in production
- No force-push to protected branches
- No deploy from unreviewed branch

CI/CD exists to protect tenant isolation and data integrity.

If deployment safety fails, institutional trust fails.
