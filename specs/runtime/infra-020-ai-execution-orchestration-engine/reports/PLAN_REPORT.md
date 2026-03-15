# Plan Report — AI Execution Orchestration Engine

**Step:** 3 — Plan
**Timestamp:** 2026-03-15T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Technical plan produced for the AI Execution Orchestration Engine (INFRA-020). The plan covers
three CLI entry points (`run-task.ts`, `plan-task.ts`, `validate-execution.ts`), eight supporting
modules, ten unit/integration test files, full CI integration, and execution log artifact management.

Two validation rounds were required:

- Round 1 — Architecture Checker: BLOCKED (3 blockers: stub walk body, spec drift on `packages/config`, plan template hardcoded wrong import constraint)
- Round 1 — API Designer: BLOCKED (4 blockers: `{timestamp}` in plan doc, exit code 2 missing from 2 tables, error handler always exits 1, `ai:run` missing exit 4)
- All blocking issues remediated; non-blocking improvements applied.
- Round 2 — Architecture Checker: PASS (7 low-severity informational items, none blocking)
- Round 2 — API Designer: PASS (1 new low-severity naming fix applied)

---

## Inputs Reviewed

- `specs/runtime/infra-020-ai-execution-orchestration-engine/spec.md`
- `specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md`
- `specs/runtime/infra-020-ai-execution-orchestration-engine/research.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                    |
| --------- | ---------------------------------------------------------------------------------- |
| API       | None — tooling only                                                                |
| Worker    | None — tooling only                                                                |
| Frontend  | None                                                                               |
| DB Master | None                                                                               |
| DB Tenant | None                                                                               |
| Scripts   | New `scripts/ai-engine/` directory with 11 TypeScript modules + 10 test files      |
| CI        | 3 new steps added to `.github/workflows/architecture-governance.yml` (steps 11–13) |
| Package   | 3 new `package.json` scripts: `ai:run`, `ai:plan`, `ai:validate`                   |

---

## Key Technical Decisions

| #   | Decision                                                             | Rationale                                                                                                                                             |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Execution ID = `${Date.now()}-${sha256(task).slice(0,8)}`            | Monotonic ordering + per-task disambiguation; stdlib `node:crypto` only, no external deps                                                             |
| 2   | `@zidney/config` NOT imported                                        | Reads `DATABASE_URL`/`REDIS_URL`/`JWT_SECRET` at startup; crashes in CI tooling context without server env vars. `process.env` used directly instead. |
| 3   | Deterministic skill selection via fixed `KEYWORD_MAP`                | No random/ML selection; purely deterministic keyword match ensures reproducibility per FR-006                                                         |
| 4   | Plan output at `docs/architecture/health/ai-plans/{task_id}.md`      | Consistent with existing `docs/architecture/health/` convention; overwrite on repeat run preserves idempotency                                        |
| 5   | CI steps 11–13 in `architecture-governance.yml`                      | Aligns with existing CI step numbering; adds AI validation, uploads artifact, writes GitHub step summary                                              |
| 6   | Exit codes: 0=pass, 1=fail, 2=timeout, 3=missing file, 4=stale brain | Cross-all-three-commands; discriminated in top-level `isTimeout ? 2 : 1` catch handler; brain exits (3,4) as direct `process.exit()` inside try block |
| 7   | Atomic writes: `{id}.tmp.json` → rename → `{id}.json`                | FR-010, SC-012 compliance; concurrent-safe without file locking                                                                                       |

---

## Module Structure

```
scripts/ai-engine/
├── types.ts                  # Core type definitions
├── execution-id.ts           # Execution ID generation
├── log-writer.ts             # Atomic log artifact writer
├── context-loader.ts         # Loads ai-context-mini.json
├── skill-selector.ts         # Keyword-based skill activation
├── process-runner.ts         # Child process spawner with timeout
├── stale-check.ts            # ai-architecture-brain.json staleness detection
├── monorepo-guard.ts         # Monorepo root detection
├── run-task.ts               # Entry point: bun ai:run (300s timeout)
├── plan-task.ts              # Entry point: bun ai:plan (120s timeout)
├── validate-execution.ts     # Entry point: bun ai:validate (90s/120s CI)
└── __tests__/                # 10 test files (9 unit + 1 integration)
```

---

## Migration Impact

| Item                  | Value | Notes                                  |
| --------------------- | ----- | -------------------------------------- |
| Migration required    | No    | Tooling only; no DB schema changes     |
| `schema_version` bump | No    | Not applicable                         |
| Backward compatible   | Yes   | Additive — new scripts + CI steps only |

---

## Transaction Boundaries

- Not applicable. This is a tooling-only stage.
- All writes are local filesystem log artifacts using atomic `tmp → rename` pattern.
- No database, queue, or external state store operations.

---

## Idempotency Strategy

- Log artifacts named `{execution_id}.json` — unique per run by design.
- Plan artifacts named `{task_id}.md` — overwritten on repeat run for the same task (FR-006 determinism).
- `ai:validate` can be run N times; each run produces a new log file and exits with the current governance state.

---

## Import Boundary Compliance

Allowed: `packages/logger`, Node.js/Bun stdlib (`node:fs`, `node:crypto`, `node:path`, `node:child_process`)  
Forbidden: `packages/config`, any other `packages/*`, any `apps/*`

All modules in `scripts/ai-engine/` are confined to this boundary. `scripts/infra-audit.ts` and `scripts/ai-guard.ts` will enforce this at CI time.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                   |
| -------------------------------------- | ------ | ------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | No tenant DB, resolver, or workspace context anywhere   |
| All writes are transactional by design | ✅     | Atomic tmp→rename; no partial state possible            |
| Server-authoritative time enforced     | ✅     | All timestamps use `new Date(Date.now()).toISOString()` |
| License middleware enforced            | ✅     | N/A — tooling only; no HTTP routes                      |
| Version compatibility enforced         | ✅     | N/A — no schema version impact                          |
| No architecture redesign without ADR   | ✅     | No new packages, no layer changes, no module moves      |
| Attempt engine integrity               | ✅     | N/A — no attempt engine interaction                     |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                                              | Severity | Mitigation                                                                                                         |
| --------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `stale-check.ts` walk performance if `packages/` or `apps/` is unusually large    | Low      | `node_modules` directories are explicitly excluded from the walk                                                   |
| `architecture-health.json` absent after `bun arch:health` exit 0                  | Low      | `architecture_violations` set to `0` sentinel (documented); `validation_result` still derives from tool exit codes |
| Implementer accidentally letting brain-absent/stale throw to global catch handler | Low      | Plan explicitly states: exits 3 and 4 MUST be direct `process.exit()` calls inside the try block                   |
| `loadAiContextMini()` throw reaching global catch emits exit 1 not exit 3         | Low      | Call site must inline check before throwing; noted in plan                                                         |

---

## Blocker Remediation Summary

| Blocker                                                        | Round | Source               | Resolution                                                                                               |
| -------------------------------------------------------------- | ----- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| `getMostRecentTsMtime()` stub body                             | 1     | Architecture Checker | Real recursive walk with `readdirSync(dir, {withFileTypes:true})` + `node_modules` skip + `.tsx` support |
| spec.md `packages/config` as permitted in 6 locations          | 1     | Architecture Checker | All 6 locations updated — `packages/config` now documented as FORBIDDEN with rationale                   |
| Plan import constraint string included `packages/config`       | 1     | Architecture Checker | Corrected to `packages/logger, stdlib only`                                                              |
| `{timestamp}` in plan document template                        | 1     | API Designer         | Removed; explanatory comment added citing FR-006                                                         |
| Exit code 2 absent from `ai:validate`/`ai:plan` tables         | 1     | API Designer         | Exit 2 added to both tables                                                                              |
| Top-level error handler always exits 1                         | 1     | API Designer         | `isTimeout ? process.exit(2) : process.exit(1)`                                                          |
| `ai:run` missing exit 4 for stale brain                        | 1     | API Designer         | Exit 4 added to table; step 9 docs state shared module must not write own log                            |
| NEW-L1 naming drift `exitCodeForResult` vs `exitCodeForReason` | 2     | API Designer         | Normalised to `exitCodeForReason` throughout                                                             |

---

## Next Step

Proceed to Step 4 — Tasks.
