# Spec: Runtime Script Recovery and Validation

## Feature Overview

**What is being built:**
A full recovery, validation, and governance pass over all operational scripts referenced across
`specs/runtime/*`. This stage restores correctness by ensuring every `bun run <script>` command
cited in a runtime spec actually exists, executes cleanly, and is documented. It also establishes
a permanent Script Knowledge Base and a CI guard to prevent regression.

**Phase:** 0X_FIXES  
**Stage:** STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION  
**Stage File:** `specs/phases/0X_FIXES/STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION.md`  
**Stage Type:** Infrastructure Fix Stage

**Affected areas:**

- Runtime scripts only (no application features, no user-facing flows)
- Root `package.json` (script registration)
- `scripts/<domain>/` directory tree (canonical script location)
- `docs/scripts/` (Script Knowledge Base)
- `AGENTS.md` (governance rule update)
- CI pipeline (optional guard script)

---

## Constitutional Compliance Declaration

This stage is an infrastructure maintenance operation. It does not introduce application routes,
database access, or business logic changes.

- No cross-tenant access — scripts operate on infrastructure tooling only
- No middleware bypass — scripts do not touch request handling
- No grading logic — scripts are operational/admin utilities
- No direct DB instantiation outside the existing provisioning model
- No weakening of snapshot integrity
- No weakening of transaction boundaries
- No weakening of version enforcement

No ADR is required for this stage.

---

## Problem Statement

The repository currently references operational scripts across `specs/runtime/*` using commands
such as:

```
bun run db:pool-status
bun run db:validate-licenses
bun run seed-dashboard-test-data
```

The current state of these scripts has four failure modes:

1. **Missing** — The script is referenced in a spec but does not exist anywhere in the repository.
2. **Broken** — The script file exists but throws errors or exits with a non-zero code.
3. **Duplicated** — The same script is defined in multiple `package.json` files across several
   packages or apps, making canonical ownership ambiguous.
4. **Undocumented** — Scripts exist and run but have no documentation describing their purpose,
   usage, or failure modes.

This causes spec-to-reality drift: a developer following a spec runs a command and either gets an
error or gets inconsistent behavior depending on which package context they happen to be in.

---

## Scope

This stage covers twelve tasks, each producing a verifiable artifact.

### T001 — Scan Runtime Specs

Scan all files under `specs/runtime/**` and extract every `bun run <script>` command.  
**Output artifact:** `audits/runtime-script-scan.json`

### T002 — Build Runtime Script Inventory

Produce a structured registry of every discovered script command, its source spec, and its current
status (missing, exists, duplicate, broken).  
**Output artifact:** `docs/scripts/SCRIPT_REGISTRY.md`

### T003 — Locate Script Implementations

Search `package.json`, `packages/*/package.json`, and `apps/*/package.json` to determine where
each script is currently defined. Classify each script as: valid, missing, duplicate, or broken.  
**Output artifact:** Classification appended to inventory in T002.

### T004 — Eliminate Duplicate Scripts

For each script defined in more than one `package.json`:

1. Select the single canonical implementation.
2. Move the implementation file to `scripts/<domain>/<script>.ts`.
3. Remove duplicate script entries from non-root `package.json` files.
4. Register the canonical version in root `package.json` only.

### T005 — Reconstruct Missing Scripts

For each script classified as missing:

1. Locate the originating spec under `specs/runtime/<spec-name>`.
2. Derive the intended behavior from the spec.
3. Implement the script at `scripts/<domain>/<script>.ts`.
4. Scripts must use `packages/config`, `packages/logger`, and `packages/types` where applicable.

### T006 — Register Scripts in Root package.json

Add all recovered and reconstructed scripts to the root `package.json` `scripts` block using the
canonical form:

```json
"db:pool-status": "bun run scripts/db/pool-status.ts"
```

### T007 — Validate Script Execution

Execute every script via `bun run <script>`. Each script must:

- Exit with code `0`
- Produce no unhandled runtime exceptions
- Complete within a reasonable timeout

**Output artifact:** `audits/runtime-script-validation.md`

### T008 — Create Script Knowledge Base Directory

Establish `docs/scripts/` with a `README.md` index file and individual documentation pages for
each script.

### T009 — Document Each Script

Each script must have a documentation page at `docs/scripts/<script>.md` covering:

- Command
- Purpose
- Why it exists
- When to run it
- Execution mode (developer or system/CI)
- Dependencies
- Example usage
- Known failure modes

### T010 — Update Governance Documentation

Add the following governance rule to `AGENTS.md`:

> All runtime commands referenced in `specs/runtime` must correspond to an executable script
> registered in root `package.json`. Referencing non-existent scripts is forbidden. Scripts must
> live under `scripts/<domain>/`, be documented in `docs/scripts/`, and must not be duplicated
> across packages.

### T011 — CI Guard Script (Recommended)

Create `scripts/validate-runtime-scripts.ts`. The script must:

1. Scan `specs/runtime/**` and extract all `bun run <script>` references.
2. Verify each referenced script exists in root `package.json`.
3. Exit with code `1` if any referenced script is missing.

Register as: `"validate-runtime-scripts": "bun run scripts/validate-runtime-scripts.ts"` in root
`package.json`.

### T012 — Script Metadata Automation (Recommended)

Introduce a metadata comment header standard for all scripts:

```ts
/**
 * @script db:pool-status
 * @domain db
 * @description Check PostgreSQL connection pool health
 * @mode manual,ci
 * @dependencies postgres,packages/config,packages/logger
 */
```

Create `scripts/generate-script-docs.ts` that:

1. Scans `scripts/**/*.ts`
2. Parses metadata headers
3. Regenerates documentation files under `docs/scripts/`
4. Updates `docs/scripts/SCRIPT_REGISTRY.md`
5. Fails if any script violates the `<domain>:<action>` naming convention

---

## User Scenarios and Acceptance Tests

### Scenario 1 — Developer follows a runtime spec

**Given** a developer reads `specs/runtime/006-attempt-engine-foundation/spec.md` and finds a
`bun run db:pool-status` command  
**When** they run that command from the repository root  
**Then** the script executes, exits with code 0, and produces structured log output

### Scenario 2 — Developer finds script documentation

**Given** a developer needs to understand what `bun run db:validate-licenses` does  
**When** they open `docs/scripts/db-validate-licenses.md`  
**Then** they can determine the purpose, usage, dependencies, and failure modes without reading
source code

### Scenario 3 — CI detects a missing script reference

**Given** a developer adds a new `bun run my-new-script` reference to a spec file  
**When** they push to CI without registering the script in `package.json`  
**Then** `bun run validate-runtime-scripts` exits with code 1 and lists the missing script

### Scenario 4 — Script deduplication complete

**Given** `db:pool-status` was previously defined in both `apps/api/package.json` and
`packages/config/package.json`  
**When** T004 completes  
**Then** only root `package.json` defines `db:pool-status`, pointing to
`scripts/db/pool-status.ts`

### Scenario 5 — No spec-to-script drift after stage completion

**Given** the full T001–T012 workflow has been executed  
**When** `bun run validate-runtime-scripts` is run  
**Then** it exits with code 0 — every script referenced in runtime specs exists and is
registered

---

## Functional Requirements

### FR-01 Script Scan

Every `bun run <script>` command in `specs/runtime/**` must be captured in
`audits/runtime-script-scan.json` with source file and line reference.

### FR-02 Script Inventory

`docs/scripts/SCRIPT_REGISTRY.md` must list every discovered script with columns: Script, Domain,
Location, Mode, Status.

### FR-03 Single Registration Point

Each operational script must be registered in root `package.json` only. Package-level
`package.json` files must not define scripts that are intended for cross-package use.

### FR-04 Canonical Location

All script implementation files must reside under `scripts/<domain>/<script>.ts`. No script
implementations inside `packages/*/src/` or `apps/*/src/`.

### FR-05 Required Package Imports

Reconstructed and new scripts must use `packages/config`, `packages/logger`, and `packages/types`
where applicable. `console.log` is forbidden in scripts; structured logging is required.

**Logging convention for the `scripts/` layer:** The established canonical pattern across `scripts/`
is to use `scripts/core/logger-factory.ts` (a thin wrapper around `packages/logger`) rather than
importing `packages/logger` directly. This is consistent with all existing scripts under
`scripts/dev/`, `scripts/architecture/`, and `scripts/governance/`. Both `scripts/core/logger-factory`
and direct `packages/logger` imports produce compliant structured output. The reference to
`packages/logger` in this spec means "produce structured log output conforming to the logger
contract" — using `scripts/core/logger-factory` satisfies this requirement.

### FR-06 Metadata Headers

All scripts under `scripts/<domain>/*.ts` must include a JSDoc metadata comment with `@script`,
`@domain`, `@description`, `@mode`, and `@dependencies` fields.

### FR-07 Naming Convention

Script keys in `package.json` must follow `<domain>:<action>` format (e.g., `db:pool-status`,
`seed:dashboard-test-data`). The automation script must fail on violations.

### FR-08 Execution Validation

Every script in the recovered set must be executed successfully (exit code 0) and the result
captured in `audits/runtime-script-validation.md`.

### FR-09 Documentation Coverage

Every script must have a corresponding documentation file at `docs/scripts/<script>.md` covering
all required sections from T009.

### FR-10 CI Guard Registration

`scripts/validate-runtime-scripts.ts` must be registered in root `package.json` and must exit
with code 1 if any runtime spec references an unregistered script.

### FR-11 Governance Rule Recorded

The governance rule from T010 must be present in `AGENTS.md` before this stage is considered
closed.

### FR-12 Documentation Generator

`scripts/generate-script-docs.ts` must regenerate `docs/scripts/` content from metadata headers
on demand, without manual editing of documentation files.

---

## Success Criteria

All criteria are technology-agnostic and user/operator observable:

1. **Zero broken commands** — Every `bun run <script>` command referenced in runtime specs
   completes without error.

2. **100% registry coverage** — Every script found during the T001 scan appears in
   `docs/scripts/SCRIPT_REGISTRY.md` with a documented status.

3. **Single source of truth** — No script name appears in more than one `package.json` file
   after deduplication.

4. **Full documentation coverage** — Every recovered script has an individual documentation page
   in `docs/scripts/`.

5. **CI guard operational** — Running `bun run validate-runtime-scripts` exits with code 0 when
   all referenced scripts are registered, and exits with code 1 when any are missing.

6. **Governance rule in place** — The script governance rule is recorded in `AGENTS.md` and is
   enforceable.

7. **Automated documentation sync** — Running `bun run generate-script-docs` regenerates the
   full `docs/scripts/` directory from metadata headers without manual intervention.

8. **No regressions introduced** — All existing tests continue to pass; no runtime behavior is
   altered by this stage.

---

## Constraints

- **No architecture changes** — This is an infrastructure fix stage. No new packages, no new
  application routes, no schema changes, no ADRs required.
- **Bun runtime** — All scripts must use Bun as the runtime. Node.js-only APIs must not be used.
- **TypeScript only** — All new script files must be `.ts`, not `.js` or `.mjs`.
- **No cross-tenant logic** — Scripts must not access tenant databases or perform tenant-bound
  operations without going through the tenant resolver.
- **Structured logging** — `console.log` is forbidden. All log output must use `packages/logger`
  with structured fields (`timestamp`, `level`, `service`, `correlation_id`).
- **Canonical script path** — `scripts/<domain>/<script>.ts` is the only valid implementation
  location. Packages may not own cross-package scripts.
- **Root-only registration** — Only root `package.json` may register operational scripts.
- **Forward-only** — No existing script definitions may be removed without being replaced by the
  canonical version first (no gap in functionality).

---

## Assumptions

- The full set of runtime specs under `specs/runtime/**` is the authoritative source for which
  scripts are "required." Scripts only referenced in non-runtime specs are out of scope for this
  stage.
- Scripts that exit with non-zero codes due to missing infrastructure (e.g., no database
  connection in a CI environment without infrastructure) are considered "valid implementations"
  for this stage, provided the failure mode is documented and the script handles the error
  gracefully with a structured log message.
- `packages/config`, `packages/logger`, and `packages/types` are stable and available for
  import. No changes to these packages are in scope.
- The `<domain>:<action>` naming convention applies to script keys in `package.json`. File names
  on disk use `<action>.ts` inside `scripts/<domain>/`. For example: key `db:pool-status` →
  file `scripts/db/pool-status.ts`.

---

## Key Entities

| Entity                  | Description                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Runtime Script          | An operational TypeScript file under `scripts/<domain>/<script>.ts` registered in root `package.json`         |
| Script Registry         | `docs/scripts/SCRIPT_REGISTRY.md` — the canonical list of all scripts with domain, location, mode, and status |
| Script Inventory Audit  | `audits/runtime-script-scan.json` — raw scan output from T001                                                 |
| Validation Report       | `audits/runtime-script-validation.md` — execution results from T007                                           |
| Script Metadata Header  | JSDoc comment block at the top of each script file                                                            |
| CI Guard                | `scripts/validate-runtime-scripts.ts` — fails CI if spec references an unregistered script                    |
| Documentation Generator | `scripts/generate-script-docs.ts` — regenerates `docs/scripts/` from metadata                                 |

---

## Out of Scope

- Application feature development of any kind
- Changes to tenant isolation, license middleware, or attempt engine
- Schema migrations or database structural changes
- New packages under `packages/`
- New application routes under `apps/`
- Changes to CI pipeline infrastructure beyond adding the optional script guard
- Scripts referenced only in non-runtime specs (phase, architecture, infra-only specs)
- Performance optimization of existing scripts
- Migrating scripts from any runtime other than Bun
- Dependency upgrades to any package

---

## Observability Requirements

Scripts must emit structured logs using `packages/logger`.  
Required log fields per invocation:

- `timestamp`
- `level`
- `service` (script name, e.g., `db:pool-status`)
- `correlation_id` (generated per run via `packages/logger` or `packages/config`)

Execution results must be captured in `audits/runtime-script-validation.md` (T007).

---

## Test Strategy

- **Manual execution tests:** Each script is run via `bun run <script>` and exit code recorded (T007).
- **CI guard test:** `validate-runtime-scripts` is run against a spec with a deliberately missing
  script to confirm it exits with code 1.
- **Documentation generator test:** `generate-script-docs` is run and output files verified
  against expected structure.
- **Unit tests:** Not required for pure script orchestration utilities in this infrastructure
  stage. Any non-trivial parsing logic (e.g., in `validate-runtime-scripts.ts`) must have unit
  tests.

---

## Explicit Non-Goals

- This stage does NOT fix bugs in features — only in script infrastructure.
- This stage does NOT introduce new operational capabilities — only restores existing referenced
  ones.
- This stage does NOT create or modify any database migrations.
- This stage does NOT update CI pipeline YAML files beyond adding the `validate-runtime-scripts`
  step (if recommended).
- This stage does NOT touch any Vue, Hono, or frontend code.

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

This stage is an infrastructure fix with no tenant isolation impact, no license middleware
changes, no attempt engine modifications, and no schema alterations. All scripts use the
established canonical tooling (`packages/config`, `packages/logger`, `packages/types`) and are
registered in the root `package.json` in accordance with existing governance rules.

---

## Clarifications

### Session 2026-03-17

- Q: Which `bun run` script names will be scanned (pattern matching rules for T001)? → A: Scan ALL markdown text content in `specs/runtime/**/*.md` (not limited to fenced code blocks — prose references count equally). Apply the regex `bun run ([a-zA-Z][a-zA-Z0-9:_-]*)` to every line. Exclude invocations that include CLI flags directly after `bun run` (e.g., `bun run --watch` or `bun run --hot`) — these are runtime-mode flags, not script names. Deduplicate extracted names by exact string match. The result set is the authoritative scope for T002–T012.

- Q: How are "broken" scripts detected during the inventory phase (T002/T003, before T007 execution)? → A: Use a three-signal static classification during T003: (1) **Missing** — the `package.json` entry references a file path that does not exist on disk, or there is no `package.json` entry at all; (2) **Broken** — the implementation file exists but fails `bun build --dry-run` (import resolution error) or `tsc --noEmit` (TypeScript type error); (3) **Duplicate** — the same script key is defined in more than one `package.json`. A file that is syntactically and type-correct but may fail at runtime due to missing infrastructure is classified **valid/infra-dependent** — not broken — provided it handles the missing-infra path gracefully. T007 is the runtime validation gate; T003 is static-only.

- Q: Do scripts need development-mode env vars or can T007 run without any infrastructure setup? → A: T007 runs without any live infrastructure (no database, no Redis, no external services). Scripts are invoked with only the root `.env` file loaded (if present); no per-script env injection is performed. A script passes T007 if it either (a) exits with code 0, or (b) exits with a non-zero code AND emits a structured log message (via `packages/logger`) that clearly identifies the missing infrastructure dependency — no unhandled exception, no raw stack trace to stdout/stderr. An unhandled exception or crash output with no structured log is a T007 validation failure regardless of the infrastructure availability. Scripts that require specific env vars beyond what root `.env` provides must declare those vars in their `@dependencies` metadata field and document the failure mode.

- Q: What does "canonical selection" mean when duplicate scripts have diverged implementations (T004)? → A: When two or more diverged implementations exist for the same script key, the canonical implementation is selected by the following precedence order: (1) If one implementation is a functional superset of the other (handles all cases the other handles, plus more), it wins. (2) If implementations are incompatible, the implementation in `apps/api/package.json` serves as the baseline; any unique logic present in other implementations must be ported into the merged canonical version before the duplicate is removed. (3) If no `apps/api` entry exists, the alphabetically first package path (`packages/<a>` before `packages/<b>`) provides the baseline. The merge decision and any ported logic must be documented in a JSDoc comment inside the canonical file referencing the source it absorbed. "Canonical selection" is never a deletion — it is always a merge-then-remove operation.

- Q: Should the T011 CI guard block CI (exit 1) or only warn when a missing script reference is detected? → A: T011 MUST exit with code 1 and block CI. The "Recommended" label on T011 in the task list indicates that adding the step to the CI pipeline YAML is recommended but not mandated by this stage — however, once the script is registered in root `package.json`, its behavior is non-negotiable: it exits with code 1 when any spec-referenced script is absent, with no warn-only mode. There is no `--warn` flag. If a future stage opts into running it in CI, it will hard-block. This ensures governance is enforceable rather than advisory.
