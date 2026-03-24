# Plan Report — Trivy Security Scanning And Enforcement

**Step:** 3 — Plan  
**Timestamp:** 2026-03-23T10:20:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan produced for INFRA-026. This is a pure INFRA stage: 5 TypeScript scan scripts, CI integration, pre-commit hook extension, configuration files, and documentation. No database migrations, no tenant isolation changes, no API layer changes. Context7 MCP consulted for Trivy CLI API patterns.

---

## Inputs Reviewed

- `specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md` (including 5 clarifications)
- Context7 MCP `/websites/trivy_dev` — CLI patterns, `trivy fs`, `--exit-code`, `--severity`
- Context7 MCP `/aquasecurity/trivy` — GitHub Actions integration, filtering
- `.husky/pre-commit` — existing hook structure
- `.github/workflows/ci.yml` — existing Group 1 parallel job structure (lint, typecheck, arch-guard, repo-doctor)
- `lint-staged.config.mjs` — existing staged file hooks

---

## Architecture Layers Touched

| Layer         | Planned Changes                                                                           |
| ------------- | ----------------------------------------------------------------------------------------- |
| API           | None                                                                                      |
| Worker        | None                                                                                      |
| Frontend      | None                                                                                      |
| DB Master     | None                                                                                      |
| DB Tenant     | None                                                                                      |
| INFRA/Scripts | 5 new TypeScript scripts under `scripts/security/`                                        |
| INFRA/CI      | New `security` job added to `ci.yml` Group 1; `TRIVY_VERSION` env var                     |
| INFRA/Hooks   | Trivy block appended to `.husky/pre-commit` (graceful degradation if Trivy not installed) |
| INFRA/Config  | `.trivyignore` created at repo root; `tmp/` gitignore entry verified                      |
| Agents        | `zidney-orchestrator.agent.md` Step 5 + Step 6.5 prose extended                           |
| Docs          | 5 docs files under `docs/scripts/security-*.md`                                           |

---

## Key Technical Decisions

| #   | Decision                                                                         | Rationale                                                                                                                               |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scripts use `Bun.$` shell API (not Node child_process)                           | Monorepo uses Bun; `Bun.$` is idiomatic and avoids Node dependency                                                                      |
| 2   | `scan-ci.ts` writes JSON to `tmp/trivy-report.json` via `--format json --output` | Decouples execution from orchestrator parsing per FR-020; file is gitignored                                                            |
| 3   | Pre-commit: graceful degradation if Trivy not installed                          | Trivy is external tool; blocking devs who haven't installed it creates friction without security benefit — CI is the authoritative gate |
| 4   | Pre-commit scope: `scan-deps` only (not `scan-ci`)                               | 30-second budget constraint; full scan reserved for CI where time is less critical                                                      |
| 5   | CI: manual curl install (not `aquasecurity/trivy-action`)                        | Avoids action abstraction; keeps CI step aligned with local dev invocation pattern                                                      |
| 6   | Security job added to `ci.yml` Group 1 (not separate file)                       | Clarification Q4: single workflow file, parallel with lint/typecheck/arch-guard                                                         |
| 7   | Trivy version pinned as `TRIVY_VERSION: "v0.59.1"` in CI env                     | SC-001 — supply chain protection; version string determined at implementation time                                                      |
| 8   | Orchestrator gate: CRITICAL blocks, HIGH warns only                              | Clarification aligns with FR-008; HIGH already blocks CI merge so orchestrator gate adds only CRITICAL hard-block                       |

---

## Migration Impact

| Item                  | Value | Notes                                        |
| --------------------- | ----- | -------------------------------------------- |
| Migration required    | No    | Pure INFRA — no DB involvement               |
| `schema_version` bump | No    | N/A                                          |
| Backward compatible   | Yes   | Additive only — no existing behavior changed |

---

## Transaction Boundaries

Not applicable — no database mutations in this stage.

---

## Idempotency Strategy

All scan scripts are fully idempotent by design. Repeated invocations with identical inputs produce identical exit codes. `tmp/trivy-report.json` is overwritten on each execution.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                 |
| -------------------------------------- | ------ | ----------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | INFRA stage — no tenant context                       |
| All writes are transactional by design | ✅     | No DB writes; file writes are INFRA tooling           |
| Server-authoritative time enforced     | ✅     | Not applicable — CLI tooling                          |
| License middleware enforced            | ✅     | Not applicable — no API routes                        |
| Version compatibility enforced         | ✅     | Not applicable — no schema versioning                 |
| No architecture redesign without ADR   | ✅     | No new packages, no layer changes; INFRA scripts only |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                   | Mitigation                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Trivy scan timeout on large repo       | Add `--timeout 5m` flag to all scripts                                  |
| False positives block valid pre-commit | `.trivyignore` suppression documented; graceful warning if Trivy absent |
| TRIVY_VERSION becomes outdated         | Version string in docs; can be updated in single CI env var             |

---

## Next Step

Proceed to Step 4 — Tasks.
