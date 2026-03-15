# Implementation Plan — Developer Experience Automation (STAGE_INFRA_18)

**Stage:** INFRA_18
**Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `spec/infra-18-developer-experience-automation`
**Spec:** `specs/runtime/infra-18-developer-experience-automation/spec.md`
**Status:** PLAN — ready for implementation

---

## Summary

Four TypeScript scripts under `scripts/dev/` deliver a fully self-diagnosing, self-repairing, and
easy-to-onboard developer experience. All scripts are pure developer tooling:

- No tenant DB access
- No license middleware
- No API endpoints
- No data model changes
- No migrations
- No new packages to install

---

## Constitutional Gate

| Rule                            | Status                                 |
| ------------------------------- | -------------------------------------- |
| No cross-tenant DB access       | ✓ PASS — tooling layer only            |
| No license middleware bypass    | ✓ PASS — not applicable                |
| No attempt engine mutation      | ✓ PASS — not applicable                |
| No worker authority violation   | ✓ PASS — not applicable                |
| No cross-layer import violation | ✓ PASS — import boundary defined below |
| No secrets in output            | ✓ PASS — .env values never read/logged |
| console.log banned              | ✓ PASS — process.stdout.write used     |
| packages/logger forbidden       | ✓ PASS — explicitly excluded           |

---

## 1. File Layout

### New files (create)

```
scripts/dev/
  repo-doctor.ts          # Diagnostic runner
  repo-fix.ts             # Automated repair runner
  repo-onboard.ts         # New developer onboarding runner
  repo-status.ts          # Repository health summary reporter
```

### Modified files

```
package.json                                        # Add 4 script entries + engines.bun field
.github/workflows/ci.yml                            # Add repo-doctor job to Group 1
README.md                                           # Add Developer Quick Commands section
```

### New test files (create)

```
tests/unit/dev-scripts/
  repo-doctor.test.ts
  repo-fix.test.ts
  repo-onboard.test.ts
  repo-status.test.ts
tests/integration/dev-scripts/
  repo-doctor.integration.test.ts
```

---

## 2. Shared Output Formatter

Each script defines its own inline formatter — no shared module, no import from `packages/logger`.

### Formatter contract (replicated in each script file)

```typescript
type CheckStatus = "ok" | "warn" | "error";

const SYMBOL: Record<CheckStatus, string> = {
  ok: "✔",
  warn: "⚠",
  error: "✗",
};

function line(label: string, status: CheckStatus, detail?: string): void {
  const detail_part = detail ? ` — ${detail}` : "";
  process.stdout.write(`${SYMBOL[status]} ${label}${detail_part}\n`);
}
```

- `✔` = check passed (status: `ok`)
- `⚠` = advisory / non-blocking warning (status: `warn`)
- `✗` = error requiring action (status: `error`)

Output goes to `process.stdout` only. Error guidance is written to `process.stderr` for
non-interactive consumers that separate streams.

### Exit code contract

All four scripts share this contract:

| Condition                             | Exit code |
| ------------------------------------- | --------- |
| All checks passed (no errors)         | `0`       |
| At least one error-level check failed | `1`       |
| Warnings only (no errors)             | `0`       |

```typescript
process.exit(hasError ? 1 : 0);
```

### Import restriction enforcement

| Import                                                       | Allowed                                           |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `packages/types`                                             | ✓ YES — shared compile-time type definitions only |
| `packages/domain-core`                                       | ✗ FORBIDDEN                                       |
| `packages/api-client`                                        | ✗ FORBIDDEN                                       |
| `packages/job-queue`                                         | ✗ FORBIDDEN                                       |
| `packages/redis-utils`                                       | ✗ FORBIDDEN                                       |
| `packages/logger`                                            | ✗ FORBIDDEN                                       |
| `packages/validation`                                        | ✗ FORBIDDEN                                       |
| `packages/ui-system`                                         | ✗ FORBIDDEN                                       |
| Node built-ins (`node:child_process`, `node:fs`, `node:net`) | ✓ YES                                             |

If no types from `packages/types` are needed in a script, zero external package imports are used.

---

## 3. `repo-doctor.ts` — Diagnostic Runner

### Purpose

Run all 7 repository health checks and report pass/warn/fail for each. Exit non-zero if any check
reaches error level.

### Internal execution chain

```
1. checkDependencies()         → bun pm ls --json (parse output for mismatches/missing links)
2. checkWorkspaceLinks()       → inspect each workspace package.json for declared deps vs node_modules
3. checkArchitectureContext()  → bun arch:guard (subprocess, capture exit code)
4. checkArchitectureBrain()    → bun arch:validate-brain (subprocess, capture exit code)
5. checkAiContext()            → bun ai-context:validate (subprocess, capture exit code)
6. checkEnvFile()              → parse .env.example keys; verify .env has each key (existence only)
7. checkTypeScript()           → bun type-safety-guard (subprocess, capture exit code)
```

### Check logic detail

**Check 1 — Missing dependencies** (`checkDependencies`)

- Spawn `bun install --dry-run` (or equivalent) in the repo root.
- If subprocess exits non-zero → `error` status.
- Actionable message: `"Run: bun install"`.

**Check 2 — Broken workspace links** (`checkWorkspaceLinks`)

- Read each workspace's `package.json` (apps/\*, packages/\*).
- For each dependency prefixed `@zidney/` or listed under `workspaces`, verify the corresponding
  directory exists under `node_modules`.
- If any missing → `error` status; list the broken links.
- Actionable message: `"Run: bun install"`.

**Check 3 — Architecture guard** (`checkArchitectureGuard`)

- Spawn: `bun arch:guard`
- Exit code 0 → `ok`. Non-zero → `error`.
- Actionable message: `"Run: bun arch:fix or review architecture violations"`.

**Check 4 — Architecture brain validation** (`checkArchitectureBrain`)

- Spawn: `bun arch:validate-brain`
- Exit code 0 → `ok`. Non-zero → `error`.
- Actionable message: `"Run: bun scripts/infra-audit.ts to regenerate brain"`.

**Check 5 — AI context artifacts** (`checkAiContext`)

- Spawn: `bun ai-context:validate`
- Exit code 0 → `ok`. Non-zero → `warn` (stale context is advisory).
- Actionable message: `"Run: bun ai-context:refresh"`.

**Check 6 — Environment file** (`checkEnvFile`)

- Algorithm:
  1. Read `.env.example`; if absent → `warn` and skip (not an error).
  2. Extract key names only (split on `=`, take left side; strip comments and blank lines;
     strip leading `export ` and `declare -x ` prefixes before comparison).
  3. Read `.env`; if absent → `error`.
  4. Extract key names from `.env` (same method — strip prefixes, strip comments).
  5. For each key in `.env.example` that is absent from `.env` → `error`.
  6. Values are **never** read, stored, compared, or emitted.
- Actionable message: `"Copy .env.example to .env and fill in required values"`.

**Check 7 — TypeScript configuration** (`checkTypeScript`)

- Spawn: `bun type-safety-guard`
- Exit code 0 → `ok`. Non-zero → `error`.
- Actionable message: `"Run: bun typecheck for details"`.

### Expected terminal output

```
✔ dependencies OK
✔ workspace links OK
✔ architecture guard OK
✔ architecture brain OK
⚠ AI context — stale, run: bun ai-context:refresh
⚠ environment variables — .env missing 2 keys: DATABASE_URL, REDIS_URL
✔ TypeScript configuration OK
```

### Subprocess pattern

All external commands are spawned as child processes using `Bun.spawnSync` or Node's
`child_process.spawnSync`. stdout/stderr are captured and suppressed from terminal output unless
the check fails and the message is diagnostic (in which case a condensed first line is shown). The
subprocess stdout is **not** forwarded raw to prevent output contamination.

**Subprocess output sanitization contract (H-02):**

The "condensed first line" detail is defined as:

1. Capture the first line of stderr (not stdout) only.
2. Truncate to maximum 120 characters.
3. Strip all control characters: `/[\x00-\x1F\x7F]/g`.
4. Never forward raw subprocess stdout or stderr as-is.
5. The sanitized string becomes `result.errorMessage` in `ProcessResult`.

```typescript
type ProcessResult = {
  exitCode: number;
  errorMessage: string; // first line of stderr, control chars stripped, max 120 chars
};

function sanitizeDetail(raw: string): string {
  return raw
    .split("\n")[0] // first line only
    .replace(/[\x00-\x1F\x7F]/g, "") // strip control characters
    .slice(0, 120); // max 120 chars
}
```

---

## 4. `repo-fix.ts` — Automatic Repair Runner

### Purpose

Execute repair steps in sequence. Continue past step failures. Exit non-zero if any step failed.

### Internal execution chain (ordered)

```
Step 1: bun install                    → reinstall / restore dependencies
Step 2: bun arch:generate              → regenerate architecture intelligence map
Step 3: bun ai-context:refresh         → refresh docs/ai/context/ artifacts
Step 4: bun pm prune                   → remove unused packages from lock file
Step 5: (clean stale build artifacts)  → delete dist/ and .nuxt/ directories if present
```

### Step execution model

```typescript
type FixStep = { label: string; run: () => ProcessResult };

const steps: FixStep[] = [
  /* ... */
];
let hasError = false;

for (const step of steps) {
  const result = step.run();
  if (result.exitCode !== 0) {
    line(step.label, "error", result.errorMessage);
    hasError = true;
    // continue — do NOT break; remaining steps execute
  } else {
    line(step.label, "ok");
  }
}

process.exit(hasError ? 1 : 0);
```

Key properties:

- All steps always run regardless of earlier failures (continue-on-error pattern).
- Exit code is `1` if **any** step failed, `0` only if all succeeded.
- Step 5 (stale artifact cleanup) uses `fs.rmSync` with `{ recursive: true, force: true }` on
  `dist/` subdirectories and `.nuxt/`. Source files, schema files, and governance artifacts are
  never touched.

**Path canonicalization safety contract (M-02):**

Before any `fs.rmSync` call in Step 5, the implementation MUST:

1. Resolve the real path using `fs.realpathSync`.
2. Verify the resolved path begins with the repository root (`process.cwd() + path.sep`).
3. If the resolved path falls outside the repo root → emit `warn` and skip deletion (do not abort).
4. This guard prevents symlink traversal attacks where a build output symlink points outside the repo.

```typescript
function safeDel(label: string, target: string): void {
  const repoRoot = process.cwd();
  const abs = path.resolve(repoRoot, target);
  try {
    const real = fs.realpathSync(abs);
    if (!real.startsWith(repoRoot + path.sep) && real !== repoRoot) {
      line(label, "warn", `skipped — resolves outside repo root`);
      return;
    }
    fs.rmSync(real, { recursive: true, force: true });
    line(label, "ok");
  } catch {
    // target does not exist — idempotent no-op
    line(label, "ok");
  }
}
```

### Expected terminal output

```
✔ dependencies installed
✔ architecture context regenerated
✔ AI context refreshed
✔ unused packages pruned
✔ stale build artifacts removed
```

### Safety guarantees

- Does not modify source code files.
- Does not modify schema or migration files.
- Does not modify governance artifacts (`docs/architecture/`, `specs/`, `docs/ai/`).
- Step 5 only removes `dist/` and `.nuxt/` output directories.

---

## 5. `repo-onboard.ts` — New Developer Onboarding

### Purpose

Prepare a complete local development environment in a single command for a new contributor.
Steps execute in order; step 1 (Bun version) is a hard abort gate. Steps 4–5 (services) emit
warnings and continue.

### Internal execution chain (ordered, sequential)

```
Step 1: Verify Bun version             → read engines.bun from root package.json; compare semver
Step 2: bun install                    → install all workspace dependencies
Step 3: bun run prepare                → activate Husky git hooks
Step 4: TCP check localhost:5432       → verify PostgreSQL; warn if unreachable
Step 5: TCP check localhost:6379       → verify Redis; warn if unreachable
Step 6: bun ai-context:refresh         → generate/refresh AI context artifacts
Step 7: bun arch:guard                 → validate architecture boundaries
```

### Step 1 — Bun version verification detail

```typescript
import packageJson from "../../package.json" with { type: "json" };

const required = packageJson.engines?.bun ?? null;
if (!required) {
  line("bun version check", "warn", "engines.bun not declared in package.json — skipping");
} else {
  const detected = Bun.version; // runtime value from Bun global
  if (!satisfiesSemver(detected, required)) {
    line(
      "bun version",
      "error",
      `detected ${detected}, required ${required}. Run: bun upgrade or install from https://bun.sh`,
    );
    process.exit(1); // hard abort — onboarding cannot continue
  }
  line("bun detected", "ok", `v${detected}`);
}
```

`satisfiesSemver` is a minimal inline implementation operating on major.minor.patch triplets only
(no range operators beyond `>=`). No external semver package is imported.

**`satisfiesSemver` contract (M-01):**

```typescript
function satisfiesSemver(detected: string, required: string): boolean {
  // Strip pre-release suffix (e.g. "1.3.9-canary.1" → "1.3.9")
  const clean = (v: string) => v.split("-")[0];
  const parse = (v: string): [number, number, number] | null => {
    const parts = clean(v).split(".").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return parts as [number, number, number];
  };
  const d = parse(detected);
  const r = parse(required.replace(/^[>=]+/, ""));
  // On parse failure: warn-and-continue (do NOT hard-abort on bad version string)
  if (!d || !r) return true;
  if (d[0] !== r[0]) return d[0] > r[0];
  if (d[1] !== r[1]) return d[1] > r[1];
  return d[2] >= r[2];
}
```

Contract rules:

- Pre-release suffixes are stripped before comparison (split on `-`, take `[0]`).
- Each segment is compared using `parseInt` (i.e. numeric ordering, not lexicographic).
- A version string that cannot be parsed → returns `true` (warn-and-continue; never hard-abort on
  parse failure, only on confirmed version mismatch).
- Only the `>=` operator is supported.

### Step 3 — Husky activation

- Spawn: `bun run prepare` (which maps to `husky` via root `package.json`).
- If Husky directory (`.husky/`) does not exist → `warn` (hooks may be absent).
- If spawn exits non-zero → `error`.

### Steps 4–5 — Service TCP checks

```typescript
async function checkTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);
  });
}
```

- PostgreSQL: `localhost:5432` — warn on failure: `"Run: docker compose up postgres"`
- Redis: `localhost:6379` — warn on failure: `"Run: docker compose up redis"`
- These never fail the overall exit code (warn-only).

### Abort strategy

| Step                 | On failure                                                    |
| -------------------- | ------------------------------------------------------------- |
| Step 1 (Bun version) | Print mismatch + instructions → `process.exit(1)` immediately |
| Steps 2, 3           | Mark `hasError = true`; continue                              |
| Steps 4, 5           | Warn only; `hasError` unchanged                               |
| Steps 6, 7           | Mark `hasError = true`; continue                              |

Final exit: `process.exit(hasError ? 1 : 0)`.

### Expected terminal output

```
✔ bun detected — v1.3.9
✔ dependencies installed
✔ husky hooks active
⚠ PostgreSQL unreachable — run: docker compose up postgres
⚠ Redis unreachable — run: docker compose up redis
✔ AI context refreshed
✔ architecture guard validated
```

---

## 6. `repo-status.ts` — Repository Health Summary

### Purpose

Print a human-readable, read-only summary of current repository health. No side effects.

### Internal execution chain

```
1. bun arch:health         → capture stdout; extract health percentage
2. bun ai-context:validate → capture exit code; derive "Fresh" or "Stale"
3. bun type-safety-guard   → capture exit code; derive "Strict" or "Violations found"
4. (CI cache file check)   → look for cached CI state in .cache/ci-status.json (advisory)
```

### CI status source

- Check for existence of `.cache/ci-status.json` (written by a future CI artifact script).
- If absent → show `"Unknown (no cached state)"`.
- If present → read `status` field (string); **sanitize before display** (see contract below).
- This is purely advisory; failure to read this file is not an error.

**`ci-status.json` sanitization contract (H-01):**

The `status` field must be sanitized before being written to `process.stdout`:

```typescript
const KNOWN_STATUSES = ["Passing", "Failing", "Pending", "Skipped", "Unknown"] as const;

function safeStatus(raw: unknown): string {
  if (typeof raw !== "string") return "Unknown (invalid)";
  // Strip all non-printable-ASCII characters (removes ANSI/OSC sequences)
  const stripped = raw
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 32);
  return (KNOWN_STATUSES as readonly string[]).includes(stripped)
    ? stripped
    : "Unknown (unrecognised)";
}
```

This prevents terminal injection attacks via ANSI/OSC escape sequences inserted into the cache file.

### Output rendering

```
Repository Status
-----------------
Architecture Health:   98%
AI Context:            Fresh
Type Safety:           Strict
CI Pipelines:          Passing
```

Header and separator are written via `process.stdout.write`. Fields are left-aligned with padding
to the colon position (column 23).

### Exit code

Always `0` — `repo:status` is read-only and never fails CI.

---

## 7. `package.json` Additions

### 7a. Add `engines.bun` field

The root `package.json` currently has no `engines` field. Add:

```json
"engines": {
  "bun": ">=1.3.9"
}
```

This value aligns with `BUN_VERSION: "1.3.9"` declared in `.github/workflows/ci.yml`.

### 7b. Add 4 script entries

Add to the `"scripts"` object in alphabetical proximity with other `repo:*` groupings:

```json
"repo:doctor":  "bun scripts/dev/repo-doctor.ts",
"repo:fix":     "bun scripts/dev/repo-fix.ts",
"repo:onboard": "bun scripts/dev/repo-onboard.ts",
"repo:status":  "bun scripts/dev/repo-status.ts"
```

Placement: insert after the last `"arch:*"` script block (before `"type-safety-guard"`), as a
distinct `repo:*` group for discoverability.

---

## 8. CI Integration

### Target workflow: `.github/workflows/ci.yml`

Add a new parallel job in **Group 1** (alongside `lint`, `typecheck`, `arch-guard`). The job is
named `repo-doctor` and runs `bun repo:doctor`.

Group 1 runs at 0–5 min concurrently. `repo-doctor` has no service dependencies matching this
profile.

### New job definition

```yaml
# ── Job X. Repository Doctor ───────────────────────────────────────────
repo-doctor:
  name: "Repo Doctor — Environment Health Gate"
  runs-on: ubuntu-latest
  timeout-minutes: 5
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Restore node_modules from cache
      uses: actions/cache@v4
      id: cache-nodemodules
      with:
        path: node_modules
        key: nodemodules-${{ hashFiles('bun.lock') }}
        restore-keys: nodemodules-

    - name: Install dependencies
      if: steps.cache-nodemodules.outputs.cache-hit != 'true'
      run: bun install --frozen-lockfile

    - name: Repository Doctor
      run: bun repo:doctor
```

### Placement rule

Insert this job inside the `# GROUP 1: CODE QUALITY` section in `ci.yml`, alongside the existing
`lint`, `typecheck`, and `arch-guard` jobs. The job has no `needs:` dependency — it runs in
parallel with Group 1.

### Downstream dependency note

The `unit-tests` job currently declares `needs: [lint, typecheck]`. If broader protection is
desired, `repo-doctor` may be added to `unit-tests.needs` in the same PR. This is **optional** and
can be decided during implementation based on team preference — the plan does not mandate it to
avoid expanding the blast radius of the spec.

### CI constraints (from spec)

- `repo:fix` and `repo:onboard` must NOT be added to CI.
- Warnings in `repo:doctor` output are non-blocking (exit code 0 when warnings-only).
- `repo:doctor` CI step must exit non-zero on any error-level check.

---

## 9. README.md Update

### Location

Insert after the existing **30-Second Developer Onboarding** section and before the next `---`
divider, or append as a new top-level section if a better anchor exists.

### Content to add

```markdown
---

## Developer Quick Commands

| Command            | Purpose                      |
| ------------------ | ---------------------------- |
| `bun repo:onboard` | First-time environment setup |
| `bun repo:doctor`  | Diagnose repository issues   |
| `bun repo:fix`     | Auto-repair common issues    |
| `bun repo:status`  | View current health summary  |

Run `bun repo:onboard` when setting up the repository for the first time.
Run `bun repo:doctor` before raising a bug report to capture environment state.
```

---

## 10. Test Plan

### Unit tests — `tests/unit/dev-scripts/`

Each test file mocks external subprocess calls (`Bun.spawnSync` / `child_process.spawnSync`) and
filesystem reads. No real commands are executed.

| File                   | Tests                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `repo-doctor.test.ts`  | Each of the 7 check functions in isolation: pass, warn, error paths; `.env.example` absent → warn; `.env` absent → error; env key missing → error; values never captured |
| `repo-fix.test.ts`     | All steps succeed → exit 0; step 2 fails, rest continue → exit 1; step 5 (artifact cleanup) only removes dist/ not source files                                          |
| `repo-onboard.test.ts` | Step 1 version mismatch → abort (exit 1, steps 2–7 not run); service TCP unreachable → warn only (exit 0 if no other errors); all steps pass → exit 0                    |
| `repo-status.test.ts`  | Subprocess outputs parsed correctly; `.cache/ci-status.json` absent → "Unknown"; output format validated                                                                 |

### Integration test — `tests/integration/dev-scripts/repo-doctor.integration.test.ts`

Runs `bun repo:doctor` against the actual local environment with real subprocess output.

- Must exit with code 0 or detect at least 1 check result (smoke test).
- `.env.example` present check: injects a missing key; verifies output contains `✗`.
- Uses test fixture directory to avoid mutating real `.env`.

### Idempotency test (within `repo-fix.test.ts`)

- Run `repo:fix` logic twice in sequence against the same mock state.
- Assert output is identical on both runs.
- Assert no accumulation of side effects.

### CI gate test (within `repo-doctor.test.ts`)

- Inject a failing subprocess mock for one check.
- Assert exit code is `1`.
- Assert output contains `✗` for that check.
- Assert other checks still reported (no early bail-out).

### Environment mock test (within `repo-onboard.test.ts`)

- Mock Bun version below minimum → assert abort with exit 1 and upgrade message.
- Mock PostgreSQL TCP timeout → assert `⚠` warning and exit 0.
- Mock Redis TCP timeout → assert `⚠` warning and exit 0.

---

## 11. Architecture Boundary Compliance

All four scripts live under `scripts/dev/`. They are not in `apps/` or `packages/`, so they cannot
create cross-app import violations. Import rules:

```
scripts/dev/*.ts   →   packages/types   (✓ allowed)
scripts/dev/*.ts   →   node:*           (✓ built-ins allowed)
scripts/dev/*.ts   →   packages/logger  (✗ FORBIDDEN)
scripts/dev/*.ts   →   apps/*           (✗ FORBIDDEN — no app imports in scripts)
```

The `ARCHITECTURE_MAP.json` does not need to be updated for scripts living outside `packages/` and
`apps/` module roots. No `bun run arch:add-module` call is required.

---

## 12. File Change Surface Summary

| File                                                            | Action | Description                                            |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| `scripts/dev/repo-doctor.ts`                                    | CREATE | 7-check diagnostic runner                              |
| `scripts/dev/repo-fix.ts`                                       | CREATE | 5-step automated repair runner                         |
| `scripts/dev/repo-onboard.ts`                                   | CREATE | 7-step new developer onboarding                        |
| `scripts/dev/repo-status.ts`                                    | CREATE | Read-only health summary reporter                      |
| `package.json`                                                  | MODIFY | Add `engines.bun` field; add 4 `repo:*` script entries |
| `.github/workflows/ci.yml`                                      | MODIFY | Add `repo-doctor` job in Group 1                       |
| `README.md`                                                     | MODIFY | Add Developer Quick Commands section                   |
| `tests/unit/dev-scripts/repo-doctor.test.ts`                    | CREATE | Unit tests for doctor checks                           |
| `tests/unit/dev-scripts/repo-fix.test.ts`                       | CREATE | Unit tests for fix steps                               |
| `tests/unit/dev-scripts/repo-onboard.test.ts`                   | CREATE | Unit tests for onboard steps                           |
| `tests/unit/dev-scripts/repo-status.test.ts`                    | CREATE | Unit tests for status reporter                         |
| `tests/integration/dev-scripts/repo-doctor.integration.test.ts` | CREATE | Integration smoke test                                 |

**Total files created:** 9  
**Total files modified:** 3  
**New packages installed:** 0  
**New migrations:** 0  
**Schema changes:** 0

---

## 13. Implementation Order

1. Add `engines.bun` to `package.json` (prerequisite for Step 1 of `repo-onboard`).
2. Add 4 `repo:*` script entries to `package.json`.
3. Implement `scripts/dev/repo-doctor.ts` (most complex; establishes formatter pattern).
4. Implement `scripts/dev/repo-fix.ts` (copy formatter from doctor).
5. Implement `scripts/dev/repo-onboard.ts` (copy formatter; add TCP check logic).
6. Implement `scripts/dev/repo-status.ts` (copy formatter; simplest logic).
7. Write all unit tests.
8. Write integration test.
9. Add `repo-doctor` job to `.github/workflows/ci.yml`.
10. Add Developer Quick Commands section to `README.md`.
11. Run `bun repo:doctor` locally to verify self-consistency.
12. Run `bun run lint && bun run typecheck` to verify no regressions.
