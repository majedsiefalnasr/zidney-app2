# Developer Experience Automation (STAGE_INFRA_18)

**Branch:** `spec/infra-18-developer-experience-automation`
**Phase:** 01_PLATFORM_FOUNDATION
**Stage:** INFRA_18
**Stage Status:** DRAFT
**Created:** 2026-03-15

---

## Feature Overview

STAGE_INFRA_18 introduces a **Developer Experience (DX) automation layer** for the Zidney monorepo.

The goal is to make the repository **self-diagnosing, self-repairing, and easy to onboard**, while maintaining strict architecture governance.

The automation layer delivers four high-level developer commands:

| Command            | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `bun repo:doctor`  | Run automated repository health diagnostics         |
| `bun repo:fix`     | Automatically repair common repository issues       |
| `bun repo:onboard` | Prepare a new developer environment end-to-end      |
| `bun repo:status`  | Print a summarized view of current repository state |

These commands live under `scripts/dev/` and are registered in the root `package.json`. They contain no business logic and do not interact with tenant databases, attempt engine, or license enforcement.

**In-Scope:**

- `scripts/dev/repo-doctor.ts` — diagnostic runner
- `scripts/dev/repo-fix.ts` — automated repair runner
- `scripts/dev/repo-onboard.ts` — onboarding automation runner
- `scripts/dev/repo-status.ts` — repository status reporter
- Root `package.json` script registrations
- CI integration step for `repo:doctor`
- README developer quick-start section update

**Out-of-Scope:**

- Changes to architecture governance rules or ADRs
- Modifications to tenant isolation, license middleware, or attempt engine
- New API endpoints or data model changes
- Changes to existing governance scripts (`infra-audit.ts`, `ai-guard.ts`, etc.)
- Business logic of any kind
- User-facing runtime or frontoffice features

---

## Constitutional Compliance Declaration

This is a **developer tooling stage** (DX automation layer). It does not affect:

- Tenant isolation or database-per-tenant model
- License enforcement or license middleware
- Attempt engine immutability or snapshot integrity
- Worker authority model
- Transaction boundaries or grading logic
- Server-authoritative time model

**Confirmed Compliance:**
✓ No cross-tenant data access introduced
✓ No middleware bypass
✓ No attempt snapshot integrity changes
✓ No direct DB instantiation
✓ No weakening of security boundaries
✓ No business logic embedded in scripts
✓ Server-authoritative time not applicable (tooling stage, no runtime time usage)

**Non-Applicable Sections (with justification):**

- **Isolation Impact Analysis** — Scripts are developer tooling; no tenant database access
- **License & Version Enforcement** — No workspace-bound routes; no license middleware needed
- **Data Model Changes** — No schema changes; no migrations
- **Transaction Boundaries** — No state mutations in any tenant or master database
- **Authoritative Time Usage** — No time-sensitive operations; no runtime involvement
- **Idempotency Strategy** — Scripts are read-mostly diagnostics/repair runners; idempotency is naturally satisfied by re-running
- **Rate Limiting & Abuse Protection** — Local developer tooling; not exposed endpoints

---

## Command Specifications

### repo:doctor — Repository Diagnostics

Runs automated checks across the repository health surface and reports pass/warn/fail for each.

**Checks performed:**

| Check                             | Action                                                                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing dependencies              | Detect uninstalled or mismatched workspace dependencies                                                                                                                                              |
| Broken workspace links            | Identify broken package references in monorepo workspaces                                                                                                                                            |
| Outdated architecture context     | Detect staleness in `docs/ai/context/` artifacts                                                                                                                                                     |
| Invalid AI context artifacts      | Validate structure and schema of AI context JSON files                                                                                                                                               |
| Missing environment configuration | Verify required `.env` keys exist by comparing against `.env.example` reference (key names only; values are never read, stored, or logged); if `.env.example` is absent, emit warning and skip check |
| Stale generated artifacts         | Identify build outputs or context files out of sync with source                                                                                                                                      |
| Invalid TypeScript configuration  | Detect `tsconfig.json` configuration issues across workspaces                                                                                                                                        |

**Internal execution chain:**

```
bun arch:guard
bun arch:validate-brain
bun type-safety-guard
bun ai-context:validate
```

**Expected output format:**

```
✔ dependencies OK
✔ architecture guard OK
✔ AI context OK
⚠ environment variables missing
```

Each check reports one of: `✔ OK`, `⚠ warning`, `✗ error`. Exit code is non-zero if any error exists.

---

### repo:fix — Automatic Repair

Attempts to automatically resolve common issues identified by `repo:doctor`.

**Fix actions performed:**

| Action                          | Description                                              |
| ------------------------------- | -------------------------------------------------------- |
| Reinstall dependencies          | Runs `bun install` to resolve missing or broken packages |
| Regenerate architecture context | Refreshes architecture intelligence artifacts            |
| Refresh AI context              | Regenerates `docs/ai/context/` artifacts                 |
| Prune unused dependencies       | Removes unused packages from lock file                   |
| Remove stale build artifacts    | Clears outdated build outputs                            |

**Internal execution chain:**

```
bun install
bun arch:generate
bun ai-context:refresh
bun pm prune
```

`repo:fix` is safe to re-run (idempotent). It does not modify source code, schema files, or manual governance artifacts.

---

### repo:onboard — New Developer Onboarding

Prepares a complete local development environment for a new contributor in a single command.

**Steps performed in order:**

| Step | Check                                                                              | Action on failure                                     |
| ---- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1    | Verify Bun installation (minimum version per `engines.bun` in root `package.json`) | Print version and install/upgrade instructions; abort |
| 2    | Install dependencies                                                               | Run `bun install`                                     |
| 3    | Setup Husky hooks                                                                  | Run Husky install                                     |
| 4    | Verify PostgreSQL availability                                                     | Print `docker compose up postgres`; warn              |
| 5    | Verify Redis availability                                                          | Print `docker compose up redis`; warn                 |
| 6    | Generate AI context                                                                | Run `bun ai-context:refresh`                          |
| 7    | Run architecture validation                                                        | Run `bun arch:guard`                                  |

**Expected output format:**

```
✔ bun detected
✔ dependencies installed
✔ husky hooks active
✔ architecture guard validated
```

Steps 4 and 5 emit warnings (not errors) when services are unavailable, since local services may be started separately.

---

### repo:status — Repository Health Summary

Prints a human-readable summary of the current repository health state.

**Information reported:**

| Field                | Source                           |
| -------------------- | -------------------------------- |
| Architecture Health  | `bun arch:health` output         |
| AI Context freshness | `bun ai-context:validate` output |
| Type Safety          | `bun type-safety-guard` summary  |
| CI Pipeline status   | Last known CI state (if cached)  |

**Expected output format:**

```
Repository Status
-----------------
Architecture Health: 98%
AI Context: Fresh
Type Safety: Strict
CI Pipelines: Passing
```

`repo:status` is read-only — it produces no side effects.

---

## Environment Verification

The `repo:doctor` and `repo:onboard` commands include environment service verification.

**Required local services:**

| Service    | Check method               | Guidance on failure                     |
| ---------- | -------------------------- | --------------------------------------- |
| PostgreSQL | TCP connectivity check     | `docker compose up postgres`            |
| Redis      | TCP connectivity check     | `docker compose up redis`               |
| Docker     | `docker info` availability | Install Docker Desktop or Docker Engine |

Service verification is non-blocking for `repo:doctor` (emits warning). It is advisory for `repo:onboard` (continues with warnings to allow partial setup).

---

## Script File Layout

All scripts reside under `scripts/dev/`:

```
scripts/dev/
  repo-doctor.ts
  repo-fix.ts
  repo-onboard.ts
  repo-status.ts
```

Root `package.json` registrations:

```json
"repo:doctor":  "bun scripts/dev/repo-doctor.ts",
"repo:fix":     "bun scripts/dev/repo-fix.ts",
"repo:onboard": "bun scripts/dev/repo-onboard.ts",
"repo:status":  "bun scripts/dev/repo-status.ts"
```

---

## CI Integration

`repo:doctor` is integrated into the CI pipeline as an early health gate.

**Pipeline step:**

```yaml
- name: Repository Doctor
  run: bun repo:doctor
```

This step runs before unit tests and build steps to catch broken environments early.

CI integration requirements:

- Must exit non-zero on any error-level check
- Warnings are non-blocking in CI
- CI must not run `repo:fix` or `repo:onboard` (those are local-only commands)

---

## Documentation Update

The root `README.md` receives a new developer quick-start section:

```
Developer Quick Commands
------------------------
bun repo:onboard   # First-time setup
bun repo:doctor    # Diagnose issues
bun repo:fix       # Auto-repair issues
bun repo:status    # View repo health
```

This ensures new contributors can immediately understand how to interact with the repository.

---

## Observability Requirements

DX automation scripts must use structured output for machine-parseable results where applicable.

| Requirement                 | Rule                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured logging          | Scripts must NOT use `console.log` for diagnostic output                                                                                                            |
| Output mechanism            | Scripts use `process.stdout.write` with an inline symbol+label+status formatter defined within each script; `packages/logger` must not be imported (backend-scoped) |
| Output format               | Use a consistent structured output format (symbol + label + status)                                                                                                 |
| Error messages              | Provide actionable guidance (e.g., the command to run to fix the issue)                                                                                             |
| Exit codes                  | Non-zero exit indicates at least one error-level check failed                                                                                                       |
| No sensitive data in output | Scripts must not print secrets, tokens, or database credentials                                                                                                     |

---

## Layer Separation Confirmation

✓ All scripts are developer tooling only — no business logic
✓ No database access of any kind
✓ No HTTP logic or API routes
✓ No license middleware interaction
✓ No tenant resolver involvement
✓ No attempt engine interaction
✓ No cross-layer imports — scripts may only import from `packages/types` (shared type definitions); all domain, service, and backend packages (`packages/domain-core`, `packages/api-client`, `packages/job-queue`, `packages/redis-utils`, `packages/logger`, `packages/ui-system`) are forbidden imports
✓ UI layers unaffected

---

## Test Strategy

| Test Type             | Requirement                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| Unit tests            | Required for each command's check functions (mock external calls)         |
| Integration tests     | Required for `repo:doctor` end-to-end execution against local environment |
| Idempotency test      | `repo:fix` must produce same result when run twice consecutively          |
| CI gate test          | `repo:doctor` must exit non-zero when a known issue is injected           |
| Environment mock test | `repo:onboard` must handle missing Bun/PostgreSQL/Redis gracefully        |

---

## Failure Modes & Recovery

| Failure Scenario                      | Expected Behavior                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| External tool unavailable (e.g., Bun) | Print actionable installation instructions and exit                                                                            |
| Architecture guard script fails       | Propagate exit code; report error in doctor output                                                                             |
| AI context generation fails           | Report failure in doctor output; suggest `repo:fix`                                                                            |
| `repo:fix` fails mid-run              | Report which step failed; remaining steps continue; final exit code is non-zero if any step encountered an error-level failure |
| PostgreSQL/Redis unavailable          | Warn (do not error); print start-up command                                                                                    |
| CI `repo:doctor` step fails           | CI pipeline blocked; developer must resolve before merge                                                                       |

---

## Success Criteria

All criteria are technology-agnostic and measurable without knowledge of implementation:

| Criterion                 | Target                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Onboarding time reduction | New developer can set up environment in a single command                                |
| Diagnostic coverage       | All 7 diagnostic check categories pass or produce actionable output                     |
| Repair automation         | `repo:fix` resolves at least 4 of 5 defined common issues without manual steps          |
| Status command accuracy   | `repo:status` reflects actual repository health without requiring manual interpretation |
| CI integration            | `repo:doctor` detects broken environments before test/build stages run                  |
| Documentation clarity     | Quick-start section added to README; all 4 commands documented                          |
| Re-run safety             | All 4 commands produce no unintended side effects when run multiple times               |

---

## Assumptions

- All referenced governance scripts (`arch:guard`, `arch:validate-brain`, `type-safety-guard`, `ai-context:validate`, `arch:health`, `arch:generate`, `ai-context:refresh`) already exist and are stable
- Bun is the runtime and package manager for all scripts
- Docker Compose is available in the local development environment
- The CI platform is GitHub Actions
- Scripts produce human-readable output; machine-parseable output (JSON flag) is a future enhancement
- Platform-specific (Windows/WSL) considerations are out of scope for the initial implementation

---

## Explicit Non-Goals

- No modifications to architecture governance rules or scripts
- No new migrations, schema changes, or data model alterations
- No new API endpoints, middleware, or routing
- No changes to license enforcement, tenant resolution, or attempt engine
- No automated production deployments or staging promotions
- No automated code formatting or lint autofix via `repo:fix`
- No GUI, dashboard, or web interface for repository health

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-15

Context: This is a developer tooling stage (DX automation layer). Scripts live under `scripts/dev/` and are pure local developer tooling with no tenant DB access, no license middleware, and no attempt engine involvement. Resolutions below apply that lens.

- Q: What is the exit code strategy for `repo:fix` when some steps fail and remaining steps continue? → A: Exit non-zero if **any** step fails. Final exit code reflects whether any step encountered an error-level failure, regardless of how many steps succeeded. This is consistent with `repo:doctor` behaviour and ensures CI and test assertions have a deterministic contract.

- Q: What minimum Bun version should `repo:onboard` step 1 verify, and how is the version sourced? → A: Verify against the `engines.bun` field in root `package.json`. If the detected Bun version is below the declared minimum, print a clear version mismatch message with upgrade instructions and abort. The `engines.bun` field must be populated before implementation of this step.

- Q: How does `repo:doctor` verify required `.env` keys without risking accidental value exposure in output or logs? → A: Use `.env.example` as the sole canonical reference for required key names. Parse `.env` for key **existence** only — values are never read, compared, stored, or emitted. If `.env.example` is absent, emit a warning (not an error) and skip this check rather than failing.

- Q: What output mechanism replaces `console.log` for `scripts/dev/` scripts, given both `console.log` is banned and JSON mode is deferred? → A: Scripts use `process.stdout.write` with a lightweight inline symbol+label+status formatter defined within each script file. `packages/logger` carries backend service dependencies and must **not** be imported into `scripts/dev/`. Machine-parseable JSON output mode remains deferred to a future enhancement.

- Q: Which specific `packages/` modules are permitted imports for `scripts/dev/` scripts? → A: Scripts may import only from `packages/types` for shared compile-time type definitions. All domain, service, and backend runtime packages — including `packages/domain-core`, `packages/api-client`, `packages/job-queue`, `packages/redis-utils`, `packages/logger`, `packages/validation`, and `packages/ui-system` — are forbidden imports. If no types from `packages/types` are needed, scripts have zero external package imports.
