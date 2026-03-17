# Plan Report — Runtime Script Recovery and Validation

**Step:** 3 — Plan  
**Timestamp:** 2026-03-17T00:00:00.000Z  
**Status:** COMPLETE

---

## Summary

Technical plan complete for `STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION`. This is a pure
infrastructure fix stage — no application routes, no DB migrations, no tenant logic, no frontend
changes.

`research.md` (336 lines) identified the full scope:

- **83** unique `bun run <script>` references in `specs/runtime/` markdown files
- **32** missing scripts (not registered in root `package.json`)
- **17** aliases (shorthand keys mapping to existing commands — no new scripts needed)
- **1** duplicate (`seed-dashboard-test-data`)
- **5** already registered and valid
- **28** net-new TypeScript script files required across 5 domains

The plan proceeds in 5 phases, producing 10 new TypeScript scripts, a `docs/scripts/` knowledge
base, a CI governance guard (`validate-runtime-scripts`), and an `AGENTS.md` governance rule.

Guardian validation required 3 correction rounds before achieving a composite PASS:

- Round 1: Import path correction (`../../core/logger-factory` → `../core/logger-factory`)
- Round 2: Script key naming fix (`cache-clean` → `maintenance:cache-clean`)
- Round 3: Consistent `service` field in all logger calls (14 corrections across 8 scripts +
  CI guard)

---

## Inputs Reviewed

- `specs/runtime/fix-01-runtime-script-recovery-and-validation/spec.md`
- `specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md`
- `specs/runtime/fix-01-runtime-script-recovery-and-validation/research.md`

---

## Architecture Layers Touched

| Layer            | Planned Changes                                                            |
| ---------------- | -------------------------------------------------------------------------- |
| API              | None                                                                       |
| Worker           | None                                                                       |
| Frontend         | None                                                                       |
| DB Master        | None                                                                       |
| DB Tenant        | None                                                                       |
| Scripts/CLI      | 10 new TypeScript files under `scripts/db/`, `scripts/validate/`,          |
|                  | `scripts/maintenance/`, `scripts/generate/`; 1 file move (`scripts/seed/`) |
| Documentation    | New `docs/scripts/` tree (SCRIPT_REGISTRY.md, RUNBOOK.md, domain READMEs)  |
| Package Registry | Root `package.json` — 33 new entries (32 missing + 1 dedup move)           |
| Governance       | `AGENTS.md` governance rule, CI guard script                               |

---

## Key Technical Decisions

| #   | Decision                                                             | Rationale                                                                                          |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Graceful infra-dependent pattern for all DB scripts                  | DATABASE_URL absent → `logger.warn` + `process.exit(0)`; avoids hard CI failure without live infra |
| 2   | Logger via `../core/logger-factory` (not `packages/logger` directly) | All existing scripts use this pattern; FR-05 clarified in spec.md                                  |
| 3   | T011 hard-block (`exit 1`) on unregistered references                | Prevents spec drift from accumulating; deterministic CI enforcement                                |
| 4   | T007 env validation: infra-absent = PASS                             | Locked in clarifications session 2026-03-17 Q3                                                     |
| 5   | T004 canonical = superset rule → `apps/api` baseline                 | Equal content → alphabetical; locked in clarifications session 2026-03-17 Q4                       |
| 6   | Scan regex: `bun run ([a-zA-Z][a-zA-Z0-9:_-]*)`                      | Matches all valid script keys; locked in clarifications session 2026-03-17 Q1                      |
| 7   | Broken detection: static-only (no live execution)                    | `bun build --dry-run` / `tsc --noEmit`; locked in clarifications session 2026-03-17 Q2             |
| 8   | T004 `console.log` pre-existing — move only                          | Source rewrite out of scope for this fix stage; documented in plan.md T004 note                    |

---

## Migration Impact

| Item                  | Value | Notes                                       |
| --------------------- | ----- | ------------------------------------------- |
| Migration required    | No    | Zero schema changes; pure scripts + docs    |
| `schema_version` bump | No    | Not applicable                              |
| Backward compatible   | Yes   | Moves/additions only; no removals of routes |

---

## Transaction Boundaries

- No transactional writes in scope — all changes are file system operations (create, move, delete)
  and `package.json` edits
- DB scripts are read-only diagnostics using ephemeral pool instances (`new Pool({ max: 1 })`)
  scoped inside `main()`, released and ended before exit
- CI guard reads only — no writes

---

## Idempotency Strategy

- Root `package.json` script registration: idempotent — overwriting with same entry is a no-op
- File move (T004): not idempotent by nature; plan includes existence-check before remove
- CI guard (T011): stateless; reads and exits on every invocation

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                          |
| -------------------------------------- | ------ | -------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | No tenant DB access; no cross-tenant joins                     |
| All writes are transactional by design | ✅     | No writes to tenant or master DB                               |
| Server-authoritative time enforced     | ✅     | Not applicable — no time-sensitive operations                  |
| License middleware enforced            | ✅     | Not applicable — no HTTP request handling                      |
| Version compatibility enforced         | ✅     | Not applicable — pure scripts                                  |
| No architecture redesign without ADR   | ✅     | No new modules under `packages/` or `apps/`; scripts/ is infra |

**Overall:** COMPLIANT

---

## Guardian Validation

| Guardian                    | Verdict | Notes                                                             |
| --------------------------- | ------- | ----------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | After 3 correction rounds (import path, key name, service fields) |
| Zidney API Designer         | ✅ PASS | After service field additions to all 8 scripts + CI guard         |

**Composite verdict: APPROVED — Implementation gate authorized.**

---

## Open Risks

- `console.log` in `scripts/seed/dashboard-test-data.ts` (pre-existing, out of scope — tracked
  separately)
- 17 alias entries require human verification that their targets are correct during T006
- `generate:ai-context` and `generate:architecture-diff` may have environment dependencies that
  differ from CI runtime

---

## Next Step

Proceed to Step 4 — Tasks.
