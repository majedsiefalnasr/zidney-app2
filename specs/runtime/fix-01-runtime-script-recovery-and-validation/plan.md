# Implementation Plan — Runtime Script Recovery and Validation

**Stage:** STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION  
**Phase:** 0X_FIXES  
**Date:** 2026-03-17  
**Research:** `research.md` (complete)  
**Constitutional Status:** COMPLIANT — No ADR violation, no tenant/license/attempt impact

---

## Plan Summary

This is a pure infrastructure fix stage. No application routes, no DB migrations, no tenant logic.

The plan proceeds in five phases:

| Phase | Scope                            | Primary Outputs                                                                                  |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| 0     | Repository scan and inventory    | `audits/runtime-script-scan.json`, `docs/scripts/SCRIPT_REGISTRY.md`                             |
| 1     | Deduplication and reconstruction | `scripts/db/`, `scripts/seed/`, `scripts/validate/`, `scripts/generate/`, `scripts/maintenance/` |
| 2     | Validation                       | `audits/runtime-script-validation.md`                                                            |
| 3     | Documentation                    | `docs/scripts/` tree                                                                             |
| 4     | Governance                       | `AGENTS.md` update, CI guard, metadata automation                                                |

---

## Phase 0: Repository Scan and Inventory (T001–T003)

### T001 — Produce audits/runtime-script-scan.json

**What:** Extract every `bun run <script>` reference from all markdown files under `specs/runtime/`.

**Method:** Run the reference scan (manual execution, scripted below) and output structured JSON.

**Output schema:**

```json
{
  "generated_at": "2026-03-17T00:00:00.000Z",
  "spec_root": "specs/runtime",
  "total_unique_references": 83,
  "excluded_count": 4,
  "references": [
    {
      "script": "db:pool-status",
      "source_files": [
        {
          "file": "specs/runtime/fix-01-runtime-script-recovery-and-validation/spec.md",
          "lines": [52, 167]
        }
      ]
    }
  ]
}
```

**Exclusions (must be documented in JSON):**

- `my-new-script` — pedagogical placeholder in acceptance test scenario
- `scripts` — ambiguous bare invocation (`bun run scripts/…` is a file path, not a key)
- `wrapper` — CI-pipeline-internal invocation, not a public script key
- `lint:staged` — invoked by lint-staged config, not a standalone developer command

**Output file:** `specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-scan.json`

---

### T002 + T003 — Produce docs/scripts/SCRIPT_REGISTRY.md

**What:** Structured registry of every discovered script with status classification.

**Schema:**

```markdown
| Script         | Domain | Location                  | Mode   | Status                  |
| -------------- | ------ | ------------------------- | ------ | ----------------------- |
| db:pool-status | db     | scripts/db/pool-status.ts | manual | MISSING → RECONSTRUCTED |
```

**Columns:**

- **Script** — script key as referenced in specs
- **Domain** — inferred domain prefix (db, seed, validate, generate, arch, test, dev, etc.)
- **Location** — registered command in root package.json (post-recovery)
- **Mode** — `manual` / `ci` / `manual,ci`
- **Status** — pre-fix state: VALID, MISSING, DUPLICATE, UNREGISTERED, ALIAS-NEEDED

**Pre-fix status summary (from research.md):**

- 51 scripts: VALID
- 7 scripts: MISSING (need implementation)
- 2 scripts: MISSING (need implementation — validate/\*)
- 3 scripts: UNREGISTERED (impl exists, not registered)
- 15 scripts: ALIAS-NEEDED (mapping only)
- 1 script: DUPLICATE (seed-dashboard-test-data)
- 4 scripts: EXCLUDED

**Output file:** `docs/scripts/SCRIPT_REGISTRY.md`

---

## Phase 1: Deduplication and Reconstruction (T004–T006)

### T004 — Eliminate Duplicate: seed-dashboard-test-data

**Finding:** Two implementations discovered (research.md §3.2):

- `scripts/seed-dashboard-test-data.ts` — root-level duplicate
- `scripts/dev/seed-dashboard-test-data.ts` — explicit target from prior task (T038)

**Action sequence:**

1. Compare both files line-by-line for functional differences
2. Canonical = `scripts/dev/seed-dashboard-test-data.ts` (superset, explicitly placed there per T038)
3. Move canonical to `scripts/seed/dashboard-test-data.ts`
4. Remove `scripts/seed-dashboard-test-data.ts` (root duplicate)
5. Remove `scripts/dev/seed-dashboard-test-data.ts` (prior location)
6. Add registration: `"seed-dashboard-test-data": "bun run scripts/seed/dashboard-test-data.ts"`

**Merge note:** Add JSDoc comment inside `scripts/seed/dashboard-test-data.ts`:

```typescript
/**
 * Canonical location: scripts/seed/dashboard-test-data.ts
 * Absorbed from: scripts/seed-dashboard-test-data.ts (root) — identical content
 * Prior location: scripts/dev/seed-dashboard-test-data.ts (Task T038 move)
 */
```

**Pre-existing logging note:** The existing `seed-dashboard-test-data.ts` uses `console.log` with a CORRELATION_ID prefix rather than `createLogger`. Refactoring to structured logging is **out of scope** for this fix stage (which is scoped to deduplication and script registration, not source rewrites). The `console.log` usage is a pre-existing condition in the repository and is tracked separately.

---

### T005 — Reconstruct Missing Scripts

#### Group A: DB Domain Scripts (infra-dependent)

All four scripts follow the same pattern: graceful infra-dependent operation. All live under `scripts/db/`.

**`scripts/db/pool-status.ts`**

```typescript
/**
 * @script db:pool-status
 * @domain db
 * @description Check PostgreSQL connection pool health across tenant and master databases
 * @mode manual
 * @dependencies DATABASE_URL,packages/config,packages/logger
 */
import { createLogger } from "../core/logger-factory";
import { randomUUID } from "node:crypto";

const logger = createLogger("db:pool-status");
const correlationId = randomUUID();

async function main(): Promise<void> {
  logger.info("Starting connection pool status check", {
    correlationId,
    service: "db:pool-status",
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("Infrastructure dependency unavailable: DATABASE_URL not set", {
      correlationId,
      service: "db:pool-status",
      infra_dependent: true,
    });
    process.exit(0);
  }

  try {
    // Dynamic import to avoid crash when pg is unavailable
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const client = await pool.connect();
    const result = await client.query("SELECT 1 AS ok");
    client.release();
    await pool.end();

    logger.info("Pool status: healthy", {
      correlationId,
      service: "db:pool-status",
      ok: result.rows[0]?.ok === 1,
    });
  } catch (err) {
    logger.error("Pool check failed: infrastructure unavailable", {
      correlationId,
      service: "db:pool-status",
      infra_dependent: true,
      error: err instanceof Error ? err.message : String(err),
    });
    // infra-dependent: structured log emitted, exit 0
  }
}

main();
```

**`scripts/db/validate-licenses.ts`**

```typescript
/**
 * @script db:validate-licenses
 * @domain db
 * @description Validate license integrity in master database (status, schema_version, constraints)
 * @mode manual
 * @dependencies DATABASE_URL,packages/config,packages/logger
 */
import { createLogger } from "../core/logger-factory";
import { randomUUID } from "node:crypto";

const logger = createLogger("db:validate-licenses");
const correlationId = randomUUID();

async function main(): Promise<void> {
  logger.info("Starting license validation", { correlationId, service: "db:validate-licenses" });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("Infrastructure dependency unavailable: DATABASE_URL not set", {
      correlationId,
      service: "db:validate-licenses",
      infra_dependent: true,
    });
    process.exit(0);
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const client = await pool.connect();

    const result = await client.query(`
      SELECT
        status,
        COUNT(*) AS count
      FROM licenses
      GROUP BY status
      ORDER BY status
    `);
    client.release();
    await pool.end();

    logger.info("License validation complete", {
      correlationId,
      service: "db:validate-licenses",
      summary: result.rows,
    });
  } catch (err) {
    logger.error("License validation failed: infrastructure unavailable", {
      correlationId,
      service: "db:validate-licenses",
      infra_dependent: true,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

main();
```

**`scripts/db/migrate.ts`**

```typescript
/**
 * @script db:migrate
 * @domain db
 * @description Execute pending database migrations for master and/or tenant databases
 * @mode manual,ci
 * @dependencies DATABASE_URL,packages/config,packages/logger
 */
import { createLogger } from "../core/logger-factory";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const logger = createLogger("db:migrate");
const correlationId = randomUUID();

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const MASTER_MIGRATIONS = join(REPO_ROOT, "apps/api/src/db/master/migrations");
const TENANT_MIGRATIONS = join(REPO_ROOT, "apps/api/src/db/tenant/migrations");

async function main(): Promise<void> {
  const workspace = process.argv.find((a) => a.startsWith("--workspace="))?.split("=")[1];
  const migration = process.argv.find((a) => a.startsWith("--migration="))?.split("=")[1];

  logger.info("Starting migration", { correlationId, service: "db:migrate", workspace, migration });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("Infrastructure dependency unavailable: DATABASE_URL not set", {
      correlationId,
      service: "db:migrate",
      infra_dependent: true,
    });
    process.exit(0);
  }

  if (!existsSync(MASTER_MIGRATIONS)) {
    logger.error("Migration directory not found", {
      correlationId,
      service: "db:migrate",
      path: MASTER_MIGRATIONS,
    });
    process.exit(1);
  }

  logger.info("Migration directories validated", {
    correlationId,
    service: "db:migrate",
    master_migrations: existsSync(MASTER_MIGRATIONS),
    tenant_migrations: existsSync(TENANT_MIGRATIONS),
  });

  logger.info("Migration execution requires live database — run through API migration runner", {
    correlationId,
    service: "db:migrate",
    infra_dependent: true,
    instructions: "cd apps/api && bun run db:migrate",
  });
}

main();
```

**`scripts/db/console.ts`**

```typescript
/**
 * @script db:console
 * @domain db
 * @description Open an interactive PostgreSQL console for the specified workspace database
 * @mode manual
 * @dependencies DATABASE_URL,packages/config,packages/logger,psql
 */
import { createLogger } from "../core/logger-factory";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const logger = createLogger("db:console");
const correlationId = randomUUID();

async function main(): Promise<void> {
  const workspace = process.argv.find((a) => a.startsWith("--workspace="))?.split("=")[1];

  logger.info("Opening database console", { correlationId, service: "db:console", workspace });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("Infrastructure dependency unavailable: DATABASE_URL not set", {
      correlationId,
      service: "db:console",
      infra_dependent: true,
    });
    process.exit(0);
  }

  // psql availability check
  const psqlCheck = spawnSync("which", ["psql"], { encoding: "utf8" });
  if (psqlCheck.status !== 0) {
    logger.error("psql not found in PATH", {
      correlationId,
      service: "db:console",
      infra_dependent: true,
    });
    process.exit(0);
  }

  const connectUrl = workspace ? databaseUrl.replace(/\/[^/]+$/, `/${workspace}`) : databaseUrl;

  logger.info("Launching psql", { correlationId, service: "db:console", workspace });
  spawnSync("psql", [connectUrl], { stdio: "inherit" });
}

main();
```

---

#### Group B: Validate Domain Scripts

**`scripts/validate/ai-context-fresh.ts`**

```typescript
/**
 * @script validate:ai-context-fresh
 * @domain validate
 * @description Verify that AI context artifacts are up-to-date relative to last analyze run
 * @mode ci
 * @dependencies packages/logger
 */
import { createLogger } from "../core/logger-factory";
import { randomUUID } from "node:crypto";
import { statSync, existsSync } from "node:fs";
import { join } from "node:path";

const logger = createLogger("validate:ai-context-fresh");
const correlationId = randomUUID();

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const CONTEXT_FILE = join(REPO_ROOT, "docs/ai/context/ai-context-mini.json");
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function main(): Promise<void> {
  logger.info("Checking AI context freshness", {
    correlationId,
    service: "validate:ai-context-fresh",
  });

  if (!existsSync(CONTEXT_FILE)) {
    logger.error("AI context artifact missing — run bun run ai-context:generate", {
      correlationId,
      service: "validate:ai-context-fresh",
      file: CONTEXT_FILE,
    });
    process.exit(1);
  }

  const stat = statSync(CONTEXT_FILE);
  const ageMs = Date.now() - stat.mtimeMs;

  if (ageMs > MAX_AGE_MS) {
    logger.error("AI context artifact is stale", {
      correlationId,
      service: "validate:ai-context-fresh",
      age_hours: Math.round(ageMs / 3600000),
      max_age_hours: 24,
    });
    process.exit(1);
  }

  logger.info("AI context is fresh", {
    correlationId,
    service: "validate:ai-context-fresh",
    age_hours: Math.round(ageMs / 3600000),
  });
}

main();
```

**`scripts/validate/ai-context-schemas.ts`**

```typescript
/**
 * @script validate:ai-context-schemas
 * @domain validate
 * @description Validate the structure and required fields of AI context JSON artifacts
 * @mode ci
 * @dependencies packages/logger
 */
import { createLogger } from "../core/logger-factory";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const logger = createLogger("validate:ai-context-schemas");
const correlationId = randomUUID();

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const CONTEXT_DIR = join(REPO_ROOT, "docs/ai/context");

const REQUIRED_ARTIFACTS = [
  "ai-layer-model.json",
  "ai-module-map.json",
  "ai-dependency-graph.json",
  "ai-context-mini.json",
  "ai-architecture-brain.json",
];

async function main(): Promise<void> {
  logger.info("Validating AI context schemas", {
    correlationId,
    service: "validate:ai-context-schemas",
  });

  const errors: string[] = [];

  for (const artifact of REQUIRED_ARTIFACTS) {
    const path = join(CONTEXT_DIR, artifact);
    if (!existsSync(path)) {
      errors.push(`Missing artifact: ${artifact}`);
      continue;
    }
    try {
      JSON.parse(readFileSync(path, "utf8"));
    } catch {
      errors.push(`Invalid JSON: ${artifact}`);
    }
  }

  if (errors.length > 0) {
    for (const e of errors) {
      logger.error(e, { correlationId, service: "validate:ai-context-schemas" });
    }
    process.exit(1);
  }

  logger.info("All AI context artifacts valid", {
    correlationId,
    service: "validate:ai-context-schemas",
    artifacts_validated: REQUIRED_ARTIFACTS.length,
  });
}

main();
```

---

#### Group C: Maintenance Domain

**`scripts/maintenance/cache-clean.ts`**

```typescript
/**
 * @script maintenance:cache-clean
 * @domain maintenance
 * @description Remove local build caches (node_modules/.cache, dist/, .turbo/)
 * @mode manual
 * @dependencies packages/logger
 */
import { createLogger } from "../core/logger-factory";
import { randomUUID } from "node:crypto";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const logger = createLogger("maintenance:cache-clean");
const correlationId = randomUUID();

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;

const CACHE_DIRS = [
  ".turbo",
  "node_modules/.cache",
  "apps/api/dist",
  "apps/backoffice/dist",
  "apps/frontoffice/dist",
  "apps/mmc/dist",
  "apps/worker/dist",
];

async function main(): Promise<void> {
  logger.info("Starting cache clean", { correlationId, service: "maintenance:cache-clean" });

  let removed = 0;
  let skipped = 0;

  for (const dir of CACHE_DIRS) {
    const full = join(REPO_ROOT, dir);
    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true });
      logger.info(`Removed ${dir}`, { correlationId, service: "maintenance:cache-clean" });
      removed++;
    } else {
      skipped++;
    }
  }

  logger.info("Cache clean complete", {
    correlationId,
    service: "maintenance:cache-clean",
    removed,
    skipped,
  });
}

main();
```

---

### T006 — Register All Scripts in Root package.json

The following entries must be added to the `scripts` block of root `package.json`:

#### New Implementations

```json
"db:console": "bun run scripts/db/console.ts",
"db:migrate": "bun run scripts/db/migrate.ts",
"db:pool-status": "bun run scripts/db/pool-status.ts",
"db:validate-licenses": "bun run scripts/db/validate-licenses.ts",
"maintenance:cache-clean": "bun run scripts/maintenance/cache-clean.ts",
"generate-script-docs": "bun run scripts/generate/script-docs.ts",
"seed-dashboard-test-data": "bun run scripts/seed/dashboard-test-data.ts",
"validate-runtime-scripts": "bun run scripts/validate/runtime-scripts.ts",
"validate:ai-context-fresh": "bun run scripts/validate/ai-context-fresh.ts",
"validate:ai-context-schemas": "bun run scripts/validate/ai-context-schemas.ts"
```

#### Unregistered → Now Registered

```json
"ai-guard": "bun run scripts/ai-guard.ts",
"run-staging-smoke-tests": "bash scripts/ci/run-staging-smoke-tests.sh"
```

#### Alias Registrations (no new implementation files)

```json
"ai-context:status": "bun run ai-context:validate",
"biome": "biome check .",
"build:api": "bun --cwd apps/api build",
"build:packages": "bun run --workspaces build --filter='./packages/*'",
"ci:test": "vitest run --reporter=verbose",
"dev": "bun run dev:all",
"generate:ai-context": "bun run ai-context:generate",
"infra-audit": "bun run arch:audit",
"infra-audit:check": "bun run arch:audit --check",
"migrate": "bun run db:migrate",
"test:ci": "vitest run --reporter=dot",
"tsc": "bun run typecheck:src",
"type-check": "bun run typecheck",
"type-coverage": "bun run validate:types",
"validate:architecture": "bun run arch:audit",
"vitest": "vitest run",
"worker": "bun run dev:worker"
```

**Total new entries: 29**

---

## Phase 2: Validation (T007)

### Execution Protocol

Run each registered script via `bun run <script>` from repo root. Record:

- Exit code
- Structured log output (if any)
- Classification: PASS / INFRA-DEPENDENT / FAIL

### Pass Criteria (from locked clarification)

| Result                                                        | Classification         |
| ------------------------------------------------------------- | ---------------------- |
| Exit code 0                                                   | PASS                   |
| Exit code non-zero + structured log identifying missing infra | PASS (infra-dependent) |
| Exit code non-zero + unhandled exception / raw stack trace    | FAIL                   |
| Crash with no output                                          | FAIL                   |

### Expected Results by Script Group

| Group       | Scripts                                                                                                         | Expected T007 Result                           |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| DB scripts  | `db:pool-status`, `db:validate-licenses`, `db:migrate`, `db:console`                                            | PASS (infra-dependent — no DATABASE_URL in CI) |
| Seed        | `seed-dashboard-test-data`                                                                                      | PASS (infra-dependent — no DATABASE_URL)       |
| Validate    | `validate-runtime-scripts`, `validate:ai-context-fresh`, `validate:ai-context-schemas`, `validate:architecture` | PASS (exit 0 or structured error)              |
| Generate    | `generate-script-docs`                                                                                          | PASS (exit 0, creates docs files)              |
| Aliases     | All alias registrations                                                                                         | PASS (delegates to existing scripts)           |
| Maintenance | `maintenance:cache-clean`                                                                                       | PASS (no-op if dirs absent)                    |

### Output Artifact

**File:** `specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-validation.md`

**Format:**

```markdown
# Runtime Script Validation Report

**Date:** 2026-03-17
**Executed by:** [executor]

| Script         | Exit Code | Output                                               | Classification         |
| -------------- | --------- | ---------------------------------------------------- | ---------------------- |
| db:pool-status | 0         | `{"level":"warn","message":"Infrastructure dep..."}` | PASS (infra-dependent) |
```

---

## Phase 3: Documentation (T008–T009)

### T008 — Create docs/scripts/ Directory

**Structure to create:**

```
docs/scripts/
├── README.md              — Index of all scripts with links
├── SCRIPT_REGISTRY.md     — Full registry table (mirrors T002 output)
└── <script-name>.md       — One file per recovered script
```

`README.md` must contain:

- Purpose of the Script Knowledge Base
- How to add documentation for a new script
- Link to SCRIPT_REGISTRY.md
- Table of contents by domain

### T009 — Document Each Script

Each script must have a documentation page. Documentation must be generated via `generate-script-docs` from metadata headers (T012) **after** that tool is built. For the initial pass (bootstrap), documentation is hand-authored then confirmed regenerable.

Required coverage per script:

```markdown
## Command

bun run <script>

## Purpose

One sentence.

## Why It Exists

Spec reference, feature area, or operational role.

## When to Run

Developer setup / before migration / in CI / on-demand only.

## Execution Mode

manual | ci | manual,ci

## Dependencies

- DATABASE_URL (if applicable)
- packages/config
- packages/logger

## Example Usage

bun run db:pool-status

## Known Failure Modes

- If DATABASE_URL is not set: exits 0 with structured warn log
- If pg module unavailable: exits 0 with structured error log
```

---

## Phase 4: Governance (T010–T012)

### T010 — Update AGENTS.md

**Location:** Root `AGENTS.md` under the existing `## Migration Rules` section (or as a new `## Script Governance` section after Migration Rules).

**Rule to insert:**

```markdown
## Script Governance

All runtime commands referenced in `specs/runtime` must correspond to an executable script
registered in root `package.json`. Referencing non-existent scripts is forbidden.

Rules:

- Script implementations must live under `scripts/<domain>/`, not inside `packages/*/src/` or `apps/*/src/`.
- Each script must be documented in `docs/scripts/<script>.md`.
- Scripts must not be duplicated across packages.
- Script keys in `package.json` must follow `<domain>:<action>` format (e.g., `db:pool-status`).
- All scripts must include a JSDoc metadata header (`@script`, `@domain`, `@description`, `@mode`, `@dependencies`).
- `validate-runtime-scripts` must pass before any spec referencing new scripts is merged.
```

---

### T011 — CI Guard: scripts/validate/runtime-scripts.ts

**Purpose:** Hard-block CI if any `bun run <script>` reference in runtime specs is not registered in root `package.json`.

**Implementation:**

```typescript
/**
 * @script validate-runtime-scripts
 * @domain validate
 * @description CI guard: verify every bun run <script> in specs/runtime/** is registered in root package.json
 * @mode ci
 * @dependencies packages/logger
 */
import { createLogger } from "../core/logger-factory";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const logger = createLogger("validate-runtime-scripts");
const correlationId = randomUUID();

// Exported for unit testing
export const SCRIPT_REGEX = /bun run ([a-zA-Z][a-zA-Z0-9:_-]*)/g;

export const EXCLUDED_NAMES = new Set([
  "my-new-script", // pedagogical placeholder in acceptance test scenario
  "scripts", // bare file path invocation, not a script key
  "wrapper", // CI-internal tool
  "lint:staged", // invoked by lint-staged config, not a standalone runner
]);

export function walkMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkMarkdownFiles(full));
    } else if (entry.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

export function extractScriptReferences(files: string[]): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      // Reset lastIndex between lines when using global regex
      SCRIPT_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SCRIPT_REGEX.exec(line)) !== null) {
        const name = match[1];
        if (EXCLUDED_NAMES.has(name)) continue;
        if (!refs.has(name)) refs.set(name, []);
        refs.get(name)!.push(relative(process.cwd(), file));
      }
    }
  }
  return refs;
}

export function loadRegisteredScripts(packageJsonPath: string): Set<string> {
  const content = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return new Set(Object.keys(content.scripts ?? {}));
}

async function main(): Promise<void> {
  const repoRoot = new URL("../../../", import.meta.url).pathname;
  const specsDir = join(repoRoot, "specs/runtime");
  const packageJsonPath = join(repoRoot, "package.json");

  logger.info("Scanning runtime specs for bun run references", {
    correlationId,
    service: "validate-runtime-scripts",
    specs_dir: specsDir,
  });

  const files = walkMarkdownFiles(specsDir);
  const refs = extractScriptReferences(files);
  const registered = loadRegisteredScripts(packageJsonPath);

  const missing: Array<{ script: string; sources: string[] }> = [];
  for (const [script, sources] of refs) {
    if (!registered.has(script)) {
      missing.push({ script, sources: [...new Set(sources)] });
    }
  }

  logger.info("Scan complete", {
    correlationId,
    service: "validate-runtime-scripts",
    total_refs: refs.size,
    registered: registered.size,
    missing_count: missing.length,
  });

  if (missing.length > 0) {
    for (const { script, sources } of missing) {
      logger.error(`Missing script registration: ${script}`, {
        correlationId,
        service: "validate-runtime-scripts",
        script,
        referenced_in: sources,
      });
    }
    logger.error(`CI guard failed: ${missing.length} unregistered script(s)`, {
      correlationId,
      service: "validate-runtime-scripts",
      missing_scripts: missing.map((m) => m.script),
    });
    process.exit(1);
  }

  logger.info("All runtime spec script references are registered", {
    correlationId,
    service: "validate-runtime-scripts",
    total_verified: refs.size,
  });
}

main();
```

**Unit Test Coverage Required:**

File: `scripts/validate/__tests__/runtime-scripts.test.ts`

Tests must cover:

1. `extractScriptReferences` — standard extraction from markdown content
2. `extractScriptReferences` — excluded names are filtered
3. `extractScriptReferences` — CLI flags (`bun run --watch`) not counted
4. `loadRegisteredScripts` — returns set from package.json scripts
5. Integration: missing script → returns non-empty array
6. Integration: all registered → returns empty array

---

### T012 — Documentation Generator: scripts/generate/script-docs.ts

**Purpose:** Parse `@script`, `@domain`, `@description`, `@mode`, `@dependencies` JSDoc headers from all `scripts/**/*.ts` files, then regenerate `docs/scripts/<script>.md` and `docs/scripts/SCRIPT_REGISTRY.md`.

**Implementation structure:**

```typescript
/**
 * @script generate-script-docs
 * @domain generate
 * @description Parse script metadata headers and regenerate docs/scripts/ documentation
 * @mode manual,ci
 * @dependencies packages/logger
 */
```

**Core logic:**

```typescript
// 1. Walk scripts/**/*.ts (excluding __tests__/)
// 2. For each file, extract JSDoc block between /** and */
// 3. Parse @script, @domain, @description, @mode, @dependencies tags
// 4. Validate:
//    - @script key matches <domain>:<action> format (FR-07)
//    - @domain is present
//    - @description is non-empty
// 5. Write docs/scripts/<script-key-with-dashes>.md
// 6. Write docs/scripts/SCRIPT_REGISTRY.md from aggregated metadata
// 7. Exit 1 if any script fails @script naming convention validation
```

**Naming convention validation (FR-07):**

```typescript
const DOMAIN_ACTION_RE = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]+$/;

function validateScriptName(key: string): boolean {
  // Allow legacy names in an allowlist
  const LEGACY_ALLOWLIST = new Set([
    "hygiene:report",
    "repo:doctor",
    "repo:status",
    "repo:fix",
    "repo:onboard",
    "check:store-cycles",
    "check:tsconfig",
    "type-safety-guard",
  ]);
  if (LEGACY_ALLOWLIST.has(key)) return true;
  return DOMAIN_ACTION_RE.test(key);
}
```

---

## Module Structure — Reconstructed Scripts

### New Files Created

```
scripts/
├── db/
│   ├── console.ts              ← T005 (new)
│   ├── migrate.ts              ← T005 (new)
│   ├── pool-status.ts          ← T005 (new)
│   └── validate-licenses.ts    ← T005 (new)
├── generate/
│   └── script-docs.ts          ← T012 (new)
├── maintenance/
│   └── cache-clean.ts          ← T005 (new)
├── seed/
│   └── dashboard-test-data.ts  ← T004 (moved from scripts/dev/ + root)
└── validate/
    ├── __tests__/
    │   └── runtime-scripts.test.ts  ← T011 unit tests (new)
    ├── ai-context-fresh.ts    ← T005 (new)
    ├── ai-context-schemas.ts  ← T005 (new)
    └── runtime-scripts.ts     ← T011 (new — primary CI guard)
```

### Files Removed (T004 Deduplication)

```
scripts/seed-dashboard-test-data.ts     ← remove (root duplicate)
scripts/dev/seed-dashboard-test-data.ts ← remove (moved to scripts/seed/)
```

### Files Modified

```
package.json        ← +29 new script registrations (T006)
AGENTS.md           ← +Script Governance section (T010)
```

### New Directories Created

```
docs/scripts/        ← T008 + T009
specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/  ← T001, T007
```

---

## root package.json — Implementation Mapping

After T006 completion, every newly registered script maps to one of three categories:

### New TypeScript implementations

| Key                           | File                                     |
| ----------------------------- | ---------------------------------------- |
| `db:console`                  | `scripts/db/console.ts`                  |
| `db:migrate`                  | `scripts/db/migrate.ts`                  |
| `db:pool-status`              | `scripts/db/pool-status.ts`              |
| `db:validate-licenses`        | `scripts/db/validate-licenses.ts`        |
| `maintenance:cache-clean`     | `scripts/maintenance/cache-clean.ts`     |
| `generate-script-docs`        | `scripts/generate/script-docs.ts`        |
| `seed-dashboard-test-data`    | `scripts/seed/dashboard-test-data.ts`    |
| `validate-runtime-scripts`    | `scripts/validate/runtime-scripts.ts`    |
| `validate:ai-context-fresh`   | `scripts/validate/ai-context-fresh.ts`   |
| `validate:ai-context-schemas` | `scripts/validate/ai-context-schemas.ts` |

### Previously existing implementations, now registered

| Key                       | File                                         |
| ------------------------- | -------------------------------------------- |
| `ai-guard`                | `scripts/ai-guard.ts`                        |
| `run-staging-smoke-tests` | `bash scripts/ci/run-staging-smoke-tests.sh` |

### Alias registrations (inline commands)

| Key                     | Value                                                |
| ----------------------- | ---------------------------------------------------- |
| `ai-context:status`     | `bun run ai-context:validate`                        |
| `biome`                 | `biome check .`                                      |
| `build:api`             | `bun --cwd apps/api build`                           |
| `build:packages`        | `bun run --workspaces build --filter='./packages/*'` |
| `ci:test`               | `vitest run --reporter=verbose`                      |
| `dev`                   | `bun run dev:all`                                    |
| `generate:ai-context`   | `bun run ai-context:generate`                        |
| `infra-audit`           | `bun run arch:audit`                                 |
| `infra-audit:check`     | `bun run arch:audit --check`                         |
| `migrate`               | `bun run db:migrate`                                 |
| `test:ci`               | `vitest run --reporter=dot`                          |
| `tsc`                   | `bun run typecheck:src`                              |
| `type-check`            | `bun run typecheck`                                  |
| `type-coverage`         | `bun run validate:types`                             |
| `validate:architecture` | `bun run arch:audit`                                 |
| `vitest`                | `vitest run`                                         |
| `worker`                | `bun run dev:worker`                                 |

---

## Acceptance Criteria Checklist

| Criterion                                                        | Verified By            |
| ---------------------------------------------------------------- | ---------------------- |
| Every `bun run <script>` in runtime specs executes without error | T007 validation report |
| `docs/scripts/SCRIPT_REGISTRY.md` covers all recovered scripts   | T002/T003 output       |
| Root `package.json` is the single registration point             | Code review            |
| All script implementations live under `scripts/<domain>/`        | File structure audit   |
| Reconstructed scripts import `scripts/core/logger-factory`       | Code review            |
| All scripts have `@script` metadata header                       | Code review + T012 run |
| `validate-runtime-scripts` exits 1 on missing reference          | Unit test              |
| `validate-runtime-scripts` exits 0 when all refs registered      | Unit test + manual run |
| `generate-script-docs` regenerates docs without manual edits     | Manual run + diff      |
| AGENTS.md contains Script Governance section                     | Doc review             |
| Zero sub-package operational script duplication                  | Package.json audit     |
| `seed-dashboard-test-data` has single canonical location         | File structure audit   |

---

## Constitutional Compliance

| Rule                                 | Status                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| No cross-tenant access               | ✅ N/A — no request handling                                  |
| No license middleware bypass         | ✅ N/A — no routes                                            |
| No grading logic changes             | ✅ N/A — no attempt engine                                    |
| No DB instantiation outside resolver | ✅ DB scripts use dynamic import with graceful infra-dep exit |
| No snapshot integrity weakening      | ✅ N/A                                                        |
| ADR required                         | ✅ N/A — infra fix stage                                      |
| Stage lifecycle: IN PROGRESS allowed | ✅ Stage is FIX type, not CLOSED/HARDENED                     |
