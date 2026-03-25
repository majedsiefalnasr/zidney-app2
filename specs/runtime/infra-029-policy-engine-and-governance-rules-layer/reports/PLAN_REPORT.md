# Plan Report — Policy Engine and Governance Rules Layer

**Step:** 3 — Plan
**Timestamp:** 2026-03-25T01:30:00Z
**Status:** COMPLETE

---

## Summary

The technical plan for INFRA-29 is complete. A 775-line `plan.md` and companion `data-model.md`
describe a compile-time-registered, runtime-executed governance layer under `scripts/policy-engine/`
that unifies all authority checks (architecture, type-safety, script governance, security) under a
single CLI entry point (`bun run policy:check`). Both guardian agents (Architecture Guardian and
API Designer) issued passing verdicts after one round of remediation each.

---

## Inputs Reviewed

- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/spec.md`
- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/plan.md`
- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/data-model.md`

---

## Architecture Layers Touched

| Layer      | Planned Changes                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Scripts    | New `scripts/policy-engine/` subtree — 8 rule files, 4 adapters, 2 reporters, engine, registry, loader, CLI   |
| CI / Husky | Update `.husky/pre-commit` to call `bun run policy:check --changed`; new `.github/workflows/policy-check.yml` |
| API        | None                                                                                                          |
| Worker     | None                                                                                                          |
| Frontend   | None                                                                                                          |
| DB Master  | None                                                                                                          |
| DB Tenant  | None                                                                                                          |

---

## Key Technical Decisions

| #   | Decision                                                                                                                                                                                                   | Rationale                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **No filesystem I/O inside rule `evaluate()`** — SCRIPTS-003/004 use pre-loaded `context.existingScriptPaths` / `context.documentedScriptNames`                                                            | Rule purity: rules must be free of side effects; all I/O is centralised in `context/loader.ts`                                                   |
| 2   | **AbortSignal injected via `context.abortSignal`** — engine creates `AbortController` and writes `.signal` into context before dispatching rules                                                           | Single injection point; no duplicate `signal?` parameters on adapter signatures; adapters call `Bun.spawn(..., { signal: context.abortSignal })` |
| 3   | **`loadContext()` returns `ContextLoadResult`** — `{ context, warnings }` — engine `check()` accepts `loaderWarnings?: ContextWarning[]` and prepends them as ENGINE-002/ENGINE-003 `PolicyResult` entries | Warnings survive into output without contaminating the pure `PolicyContext` object; reporter shows them alongside rule results                   |
| 4   | **Parallel-by-default, `sequential: true` opt-in** — `PolicyRule.sequential` flag; engine splits registry, runs parallel batch first, then sequential queue                                                | Minimises pre-commit latency (2 s budget) while allowing order-sensitive rules to run after the parallel batch                                   |
| 5   | **Adapter-wrapping layout** — legacy scripts remain untouched; adapters call them via `Bun.spawn`; no removals in INFRA-29                                                                                 | Zero regression risk; existing governance tooling continues independently                                                                        |
| 6   | **`PolicyDomain` union + `domain` on `PolicyResult`** — reporters can group by domain; orchestrator can skip irrelevant domains                                                                            | Enables filtered output (`--domain ARCH`) and structured JSON for upstream consumers                                                             |
| 7   | **Two-tier timeout** — `POLICY_TIMEOUT_PRE_COMMIT=2000ms` (Husky), `POLICY_TIMEOUT_CI=30000ms` (CI)                                                                                                        | NFR-021: different SLOs for interactive vs automated contexts without code divergence                                                            |

---

## Migration Impact

| Item                  | Value | Notes                                           |
| --------------------- | ----- | ----------------------------------------------- |
| Migration required    | No    | Pure scripts layer — no database schema changes |
| `schema_version` bump | No    | Not applicable                                  |
| Backward compatible   | Yes   | All legacy scripts remain; new CLI is additive  |

---

## Transaction Boundaries

Not applicable — no database writes in this stage.

---

## Idempotency Strategy

- `policy:check` is a read-only analysis command; it produces no side effects. Re-running always produces consistent results for the same repository state.
- Adapter subprocess calls are idempotent by nature (analysis tools).

---

## Guardian Audit Results

### Architecture Guardian — PASS (after 1 remediation round)

Three violations were raised and resolved:

| ID  | Violation                                                                                                               | Resolution                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | `ContextWarning` / `ContextLoadResult` orphaned — `loadContext()` returned `PolicyContext` with no channel for warnings | Changed return type to `Promise<ContextLoadResult>` (carrying `{ context, warnings }`); engine `check()` accepts `loaderWarnings?` and converts them to `PolicyResult` entries   |
| V2  | `SCRIPTS-003` / `SCRIPTS-004` purity violation — rules performed filesystem I/O inside `evaluate()`                     | Added `existingScriptPaths?` and `documentedScriptNames?` to `PolicyContext`; loader pre-fetches both; rules now read from context only                                          |
| V3  | AbortSignal dead letter — `signal?` parameters on individual adapters were never populated                              | Engine injects `abortController.signal` into `context.abortSignal` (step 2 of execution model); all adapters use `context.abortSignal`; independent `signal?` parameters removed |

Architecture Guardian final verdict: **PASS**

### API Designer — PASS (after 1 remediation round)

Two HIGH findings were raised and resolved:

| Severity  | Finding                                                                  | Resolution                                                                                                   |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| HIGH (H1) | `TrivyVulnerability.severity: string` too wide — permits invalid values  | Narrowed to `'CRITICAL' \| 'HIGH' \| 'MEDIUM' \| 'LOW' \| 'UNKNOWN'` in `data-model.md`                      |
| HIGH (H2) | `PolicyResult` missing `domain: PolicyDomain` — contradicted Invariant 5 | Added `domain: PolicyDomain` to `PolicyResult` interface and all inline example objects throughout `plan.md` |

One LOW finding resolved as a side-effect:

| Severity | Finding                                          | Resolution               |
| -------- | ------------------------------------------------ | ------------------------ |
| LOW (L1) | `TrivyVulnerability.pkgName` ambiguous camelCase | Renamed to `packageName` |

API Designer final verdict: **PASS**

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                              |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | Pure scripts layer — no tenant awareness                                           |
| All writes are transactional by design | ✅     | No database writes in this stage                                                   |
| Server-authoritative time enforced     | ✅     | Not applicable                                                                     |
| License middleware enforced            | ✅     | Not applicable — no API routes                                                     |
| Version compatibility enforced         | ✅     | Not applicable                                                                     |
| No architecture redesign without ADR   | ✅     | New `scripts/policy-engine/` module; no changes to existing architecture contracts |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                     | Likelihood | Impact | Mitigation                                                                                                                                |
| ---------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GitNexus unavailable at pre-commit time  | MEDIUM     | LOW    | Loader degrades gracefully — emits `GIT_UNAVAILABLE` / `GITNEXUS_MISSING` ContextWarning; engine shows warning result, does not block     |
| Trivy not installed                      | MEDIUM     | LOW    | `trivy.adapter.ts` detects missing binary, returns `[{ ruleId: 'SECURITY-001', severity: 'warning', ... }]`; engine continues             |
| Adapter subprocess exceeds timeout       | LOW        | MEDIUM | AbortController cancels all in-flight subprocesses; `ENGINE-001` error result emitted; exit 1                                             |
| Legacy governance script breaking change | LOW        | HIGH   | Adapters parse stdout — any output format change requires adapter update; mitigated by pinned rule versions and spec-driven adapter tests |

---

## Next Step

Proceed to Step 4 — Tasks.
