# Branching Model

Zidney follows a strict, spec-driven branching strategy.

The goal is:

- Stability-first development
- Clear traceability to specs
- Migration safety
- Controlled production releases

---

## Primary Branch

main → Production-ready branch

Rules:

- Always deployable
- Protected branch
- No direct pushes
- Merge via Pull Request only
- CI must pass before merge
- At least one review required

There is no long-lived develop branch.

We use trunk-based development with controlled PR review.

---

## Feature Branch Naming

Feature branches must reference the spec stage.

Format:

stage-<number>-<short-description>

Examples:

stage-34-mcq-question-model  
stage-53-attempt-schema  
stage-02c-migration-versioning

Branch names must map to `/specs` stages.

If a feature spans multiple stages, create separate branches.

---

## Hotfix Branch

hotfix/<short-description>

Hotfix rules:

- Must reference issue or production incident
- Must not introduce schema changes unless absolutely required
- If schema change required → must include migration and version bump

Hotfix merges directly into main via PR.

---

## Migration Discipline

If a branch introduces a migration:

- Migration file must be new
- Historical migrations must not be edited
- Migration must be deterministic
- Schema version must be updated

Merge conflicts in migrations must be resolved before merge.

No migration conflict may reach main.

---

## Release Tagging

Production releases must be tagged:

v<major>.<minor>.<patch>

Examples:

v1.0.0  
v1.2.3

Tag must match semantic versioning policy defined in:

docs/architecture/ADR/ADR-0008-semantic-versioning-policy.md

---

## Pull Request Requirements

Every PR must include:

- Spec stage reference
- Schema version impact
- Product version impact
- Migration summary (if applicable)
- Risk assessment (if high-impact)

PR without spec reference will be rejected.

---

## Forbidden Practices

- Direct push to main
- Editing historical migrations
- Long-lived feature branches
- Skipping CI
- Merging with failing tests
- Schema change without version bump

Violation is considered governance breach.

---

## Stability Principle

The branching model protects:

- Tenant isolation
- Migration integrity
- Version compatibility
- Production stability

Branch discipline is not optional.
