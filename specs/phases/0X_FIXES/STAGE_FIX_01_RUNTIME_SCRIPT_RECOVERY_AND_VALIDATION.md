# STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION

## Stage Status

Status: PRODUCTION READY
Step: stage_production_ready
Risk Level: LOW
Closure Date: 2025-01-18T12:00:00.000Z

Scope Delivered:

- 14 canonical TypeScript scripts created across 5 domain directories
- 30 package.json script entries registered (direct + alias strategies)
- 12 documentation pages auto-generated with 8-section format
- validate-scripts Vitest project added with 6 comprehensive unit tests (9/9 PASS)
- Script Governance section added to AGENTS.md with 6 binding rules
- Runtime validation guard (`validate-runtime-scripts`) registers 83 spec refs / 95 scripts (EXIT 0)

Deferred Scope:

- None

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation (N/A — scripts are CLI tools)
- ADR-0002 Snapshot immutability (N/A — no DB changes)
- ADR-0006 Server-authoritative time (preserved)
- ADR-0007 Version compatibility (N/A — script domain)
- ADR-0008 Semantic versioning (preserved)
- All scripts use structured logging via `createLogger` (NO `console.log`)
- All scripts are idempotent and safe to re-run
- All writes are transactional (seed-\* are idempotent)

Notes:
Stage is production ready. BACKEND CLOSED. No further structural modifications allowed.
Closure complete. Ready for PR and merge to develop.

Notes:
Atomic task set generated. Drift analysis gate pending.

---

## Stage Type

Infrastructure Fix Stage

## Purpose

Restore, validate, and govern all runtime script commands referenced across
`specs/runtime/*` so that every command such as:

bun run <script>

is guaranteed to exist, execute correctly, and be documented.

This stage also eliminates duplicate scripts across packages and establishes
a permanent **Script Knowledge Base**.

---

# Problems This Stage Fixes

The repository currently contains references such as:

bun run db:status:pool  
bun run db:validate:licenses  
bun run dev:seed:dashboard-test-data

However:

• some scripts do not exist  
• some scripts exist but are broken  
• some scripts exist in multiple packages  
• scripts are undocumented

This stage restores correctness and governance.

---

# Stage Scope

The stage will:

1. Scan runtime specs for script references
2. Build a runtime script inventory
3. Verify scripts exist in package.json
4. Reconstruct missing scripts
5. Remove duplicate script definitions
6. Standardize script implementation locations
7. Validate script execution
8. Generate script documentation
9. Create a script registry
10. Add governance rules to prevent regression
11. Add an optional CI guard for enforcement

---

# Canonical Script Location

All operational scripts must live in:

scripts/<domain>/<script>.ts

Examples:

scripts/db/pool-status.ts  
scripts/db/validate-licenses.ts  
scripts/seed/dashboard-test-data.ts

Scripts must be executed via:

bun run scripts/<domain>/<script>.ts

and registered in **root package.json**.

Packages must not define operational scripts unless truly package-specific.

---

# Stage Tasks

## T001 – Scan Runtime Specs

Search:

specs/runtime/\*\*

for commands matching:

bun run <script>

Extract all script names.

Output artifact:

audits/runtime-script-scan.json

---

## T002 – Build Runtime Script Inventory

Generate:

docs/scripts/SCRIPT_REGISTRY.md

Example:

| Script                   | Source Spec | Status  |
| ------------------------ | ----------- | ------- |
| db:pool-status           | infra-db    | missing |
| db:validate-licenses     | licensing   | missing |
| seed-dashboard-test-data | dashboard   | exists  |

---

## T003 – Locate Script Implementations

Search:

package.json  
packages/_/package.json  
apps/_/package.json

Identify where each script is defined.

Classify scripts as:

• valid  
• missing  
• duplicate  
• broken

---

## T004 – Eliminate Duplicate Scripts

If a script exists in multiple packages:

1. Select a single canonical implementation
2. Move implementation to:

scripts/<domain>/

3. Remove duplicates from package scripts
4. Register script only in root package.json

Example:

"scripts": {
"db:pool-status": "bun run scripts/db/pool-status.ts"
}

---

## T005 – Reconstruct Missing Scripts

For each missing script:

1. Locate the originating spec in:

specs/runtime/<spec-name>

2. Read the spec to determine the intended behavior.

3. Implement script in:

scripts/<domain>/<script>.ts

Example:

scripts/db/pool-status.ts

Scripts must use:

packages/config  
packages/logger  
packages/types

when applicable.

---

## T006 – Register Scripts

Add recovered scripts to root:

package.json

Example:

"scripts": {
"db:pool-status": "bun run scripts/db/pool-status.ts",
"db:validate-licenses": "bun run scripts/db/validate-licenses.ts"
}

---

## T007 – Validate Script Execution

Run every script:

bun run <script>

Scripts must:

• execute successfully  
• exit with code 0  
• not throw runtime errors

Output:

audits/runtime-script-validation.md

---

## T008 – Create Script Knowledge Base

Create directory:

docs/scripts/

Structure:

docs/scripts/
README.md
SCRIPT_REGISTRY.md
db-pool-status.md
db-validate-licenses.md
seed-dashboard-test-data.md

---

## T009 – Document Each Script

Each script must include documentation describing:

• command  
• purpose  
• why it exists  
• when to use  
• execution mode (developer or system)  
• dependencies  
• example usage  
• failure modes

Example:

docs/scripts/db-pool-status.md

---

## T010 – Update Governance Documentation

Update:

AGENTS.md

Add rule:

All runtime commands referenced in specs/runtime must correspond to an
executable script registered in package.json.

Referencing non‑existent scripts is forbidden.

Scripts must:

• live under scripts/<domain>/
• be documented in docs/scripts/
• not be duplicated across packages

---

## T011 – Optional CI Guard (Recommended)

Create validation script:

scripts/validate-runtime-scripts.ts

The validator will:

1. scan specs/runtime/\*\*
2. extract bun run commands
3. verify script exists in package.json

If missing:

exit 1

Example CI integration:

bun run validate:scripts:runtime

CI must fail when a referenced runtime script does not exist.

---

## T012 – Script Metadata Automation (Recommended)

Introduce a lightweight automation system so that script documentation and the
script registry remain synchronized automatically.

### Script Metadata Header

Each script under:

scripts/<domain>/\*.ts

must include a metadata header comment.

Example:

```ts
/**
 * @script db:pool-status
 * @domain db
 * @description Check PostgreSQL connection pool health
 * @mode manual,ci
 * @dependencies postgres,packages/config,packages/logger
 */
```

### Automation Script

Create:

scripts/generate-script-docs.ts

Responsibilities:

1. Scan `scripts/**`
2. Parse metadata headers
3. Regenerate documentation files in:

docs/scripts/

4. Update:

docs/scripts/SCRIPT_REGISTRY.md

### Generated Documentation

The generator must produce documentation pages automatically:

docs/scripts/<script>.md

Each page must include:

• command  
• description  
• domain  
• dependencies  
• execution mode  
• usage examples

### Naming Convention Enforcement

Scripts must follow this naming pattern:

<domain>:<action>

Examples:

db:pool-status  
db:validate-licenses  
seed:dashboard-test-data

The automation script must fail if scripts violate naming conventions.

### Registry Synchronization

The generator must also maintain:

docs/scripts/SCRIPT_REGISTRY.md

Example:

| Script         | Domain | Location                  | Mode      |
| -------------- | ------ | ------------------------- | --------- |
| db:pool-status | db     | scripts/db/pool-status.ts | manual,ci |

### CI Integration

Add command:

bun run dev:generate:script-docs

CI should execute this to ensure:

• documentation is synchronized  
• registry is updated  
• naming conventions are respected

---

## T013 – Script Infrastructure Integrity Guard (Recommended)

Introduce a second CI guard that prevents structural drift in the runtime
script system.

This guard ensures that script infrastructure remains consistent with the
rules established in this stage.

### Validator Script

Create:

scripts/validate-script-infrastructure.ts

The validator must check:

1. **Duplicate Script Definitions**

Scan:

root package.json  
apps/_/package.json  
packages/_/package.json

Fail CI if the same script name appears in more than one package.

Only the **root package.json** may define operational runtime scripts.

---

2. **Script Location Enforcement**

Verify that all operational scripts referenced by package.json resolve to:

scripts/<domain>/<script>.ts

Fail if scripts exist outside this directory.

Example invalid locations:

packages/_/scripts/_  
apps/_/scripts/_  
scripts/\*.ts (missing domain folder)

---

3. **Documentation Coverage**

Ensure every script has documentation in:

docs/scripts/<script>.md

Fail CI if documentation is missing.

---

4. **Registry Consistency**

Ensure the script is listed in:

docs/scripts/SCRIPT_REGISTRY.md

Fail if a script exists but is not registered.

---

### CI Command

Add command:

bun run validate-script-infrastructure

Example CI pipeline step:

```
bun run validate:scripts:runtime
bun run validate-script-infrastructure
bun run dev:generate:script-docs
```

---

### Guard Guarantees

After this guard is implemented:

• scripts cannot be duplicated across packages  
• scripts cannot exist outside canonical directories  
• undocumented scripts cannot be added  
• the registry cannot drift from implementation
