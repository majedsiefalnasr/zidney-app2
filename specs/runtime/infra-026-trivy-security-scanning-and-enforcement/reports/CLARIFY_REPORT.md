# Clarify Report — Trivy Security Scanning And Enforcement

**Step:** 2 — Clarify
**Timestamp:** 2026-03-23T10:12:00Z
**Status:** COMPLETE

---

## Summary

All 5 targeted clarification questions have been resolved. The clarification session confirmed implementation decisions for CI install method, Trivy version pinning, pre-commit trigger scope, CI workflow file target, and orchestrator output format. All clarifications have been appended to `spec.md` under `## Clarifications → ### Session 2026-03-23`.

---

## Inputs Reviewed

- `specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md` (including `## Clarifications`)
- `.github/workflows/ci.yml` (existing CI structure with parallel Group 1 jobs)
- `.agents/skills/precommit-diagnostics/SKILL.md` (pre-commit hook extension patterns)
- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md`

---

## Clarifications Resolved

| #   | Question                   | Resolution                                                                                                                                                  | Impact                                               |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | CI installation method     | Manual `curl` install step in workflow YAML with pinned version; call `bun run security:scan:ci` — no abstraction via action wrappers                       | FR-014, FR-015, FR-016, NFR-006, SC-001              |
| 2   | Trivy version pinning      | Pin to latest stable at implementation time (e.g. `v0.69.3`). Version recorded in CI YAML; local install docs reference same version                        | SC-001, NFR-006, Risk: version drift                 |
| 3   | Pre-commit trigger scope   | Run `security:scan:deps` on EVERY commit unconditionally. Deps-only scan stays within 30s budget and catches transitive dep changes                         | FR-010, NFR-002, US1 acceptance scenarios            |
| 4   | CI workflow file           | Add new `security` job to EXISTING `ci.yml` in Group 1 (parallel with lint/typecheck/arch-guard). Do NOT create a separate workflow                         | FR-014, FR-016, existing CI parallelization strategy |
| 5   | Orchestrator output format | Scripts write JSON to `tmp/trivy-report.json` (`--format json --output`), gitignored. Orchestrator Step 5 reads file; Step 6.5 parses for CRITICAL findings | FR-018, FR-019, FR-020, SC-006                       |

---

## Open Items

None — all material ambiguities resolved.

---

## Spec Updates Applied

- Appended `## Clarifications` section with `### Session 2026-03-23` subsection to `spec.md`
- Each clarification encoded with: question, decision, and impacted FRs/NFRs

---

## Risk Level Assessment

After full clarification, risk scoring:

| Factor                                | Points |
| ------------------------------------- | ------ |
| New external tool integration (Trivy) | +2     |
| CI workflow modification              | +1     |
| Pre-commit hook extension             | +1     |
| New scripts + package.json changes    | +1     |

**Total score: 5 → Risk Level: MEDIUM**

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                    |
| ----------------------------------------- | ------ | -------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 clarifications locked                                |
| Transaction strategy confirmed            | ✅ N/A | INFRA stage — no DB transactions involved                |
| Idempotency strategy confirmed            | ✅     | Scan scripts overwrite output file on each run (NFR-003) |
| Isolation boundaries confirmed            | ✅ N/A | INFRA stage — no tenant isolation concerns               |
| Version and license constraints confirmed | ✅     | Trivy version pinned; no new runtime dependency          |
