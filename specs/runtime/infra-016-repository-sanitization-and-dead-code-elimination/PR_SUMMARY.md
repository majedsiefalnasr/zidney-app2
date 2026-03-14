# PR: infra(016) — Repository sanitization (conservative completion)

Branch: spec/infra-016-repository-sanitization-and-dead-code-elimination
Target: develop
Stage: STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION

## Summary

This PR closes the INFRA-16 sanitation stage with a conservative completion. It removes only low-risk "finder noise" and records evidence and decisions for any assets that were deferred for deeper analysis. Larger consolidation and migration work has been delegated to a follow-up stage, INFRA-21, to avoid scope creep.

## Key outcomes

- Removed Finder noise (.DS_Store) where present.
- Added and updated evidence-backed reports documenting why remaining candidate cleanups were deferred instead of removed.
- Marked the stage `BACKEND CLOSED` (closure) with workflow-state updated.
- Created a follow-up stage `INFRA-21` to handle routing/template consolidation and root-asset resolution.

## Files changed (high level)

- Stage contract / status
  - specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION.md
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/.workflow-state.json
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/README.md

- Reports (new/updated)
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_REPORT.md
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/EVIDENCE_MATRIX.md
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/DUPLICATE_GROUPS.md
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_DECISIONS.md
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/PROTECTED_ASSETS.md
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/ROLLBACK_BATCHES.md
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_INVENTORY.md
  - specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/audits/VALIDATION_REPORT.md

- Follow-up stage (bootstrapped)
  - specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION.md
  - specs/runtime/infra-021-support-surface-routing-and-template-migration/.workflow-state.json
  - specs/runtime/infra-021-support-surface-routing-and-template-migration/README.md

## Why this conservative approach

Several candidate assets (routing surfaces, templates, root generated files) are actively referenced by CI, docs, or shell tooling. Removing them without a coordinated migration risks breaking CI, SpecKit workflows, or agent routing. The updated reports contain direct evidence (script callers, CI references, docs links) to justify deferral.

## Validation performed

- Drift analysis: passed (stage-level audit before closure)
- Pre-commit hooks and `lint-staged` checks: passed during commit
- All changes limited to stage artifacts, reports, and noted Finder-noise removal

## How to review

1. Inspect the updated reports for the evidence that justified deferral:
   - `reports/EVIDENCE_MATRIX.md`
   - `reports/DUPLICATE_GROUPS.md`
   - `reports/SANITIZATION_DECISIONS.md`
   - `reports/SANITIZATION_REPORT.md`
2. Confirm the `STAGE_INFRA_16` stage file and `.workflow-state.json` reflect `BACKEND CLOSED` and the closure timestamp.
3. Verify no runtime code, package.json, or build scripts were altered.
4. Confirm the follow-up stage `INFRA-21` exists and is bootstrapped in `specs/runtime/infra-021-support-surface-routing-and-template-migration/`.

## Risks & Rollback

- Risk: downstream tooling references rely on deferred assets. Mitigation: no deletions performed beyond Finder noise. Full rollback is simply reverting this branch commit(s) — use Git revert or restore from branch tip. If a problem is found after merge, revert the PR and re-open changes in a follow-up stage.

## Follow-up work (INFRA-21)

INFRA-21 will scope and execute:

- Root artifact disposition (backups, generated coverage artifacts)
- Unified prompt/agent routing model and migration
- Template system migration (specs/templates vs .specify/templates)
- Guidance/documentation consolidation

INFRA-21 is bootstrapped on branch: `spec/infra-021-support-surface-routing-and-template-migration`.

## Suggested reviewers

- @team-architecture (architecture guard)
- @devops (CI / deployment reviewers)
- @qa (validation/validation_report review)

---

**Recommendation:** Open PR from `spec/infra-016-repository-sanitization-and-dead-code-elimination` → `develop` for review. This PR is safe to merge once reviewers confirm reports and no runtime changes are required. After merge, begin INFRA-21 specify phase to address the deferred items in a controlled migration.
