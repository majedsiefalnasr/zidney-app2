# Technical Plan: Trivy Security Scanning and Enforcement

**Stage**: INFRA-026  
**Phase**: 01_PLATFORM_FOUNDATION  
**Related Spec**: `spec.md`  
**Related ADR**: None required (INFRA stage, no architectural layer changes)  
**Plan Generated**: 2026-03-23

---

## Stage Alignment

- **Phase**: 01_PLATFORM_FOUNDATION
- **Stage**: Trivy Security Scanning And Enforcement
- **Related Spec File**: `specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md`
- **Related ADR**: None — Pure INFRA stage; no new packages, layers, or architectural modules. Scripts and CI modifications only.

---

## Architectural Scope Confirmation

This stage is **INFRA-only**. All items below are confirmed N/A:

- ✅ No cross-tenant data access — no tenant context whatsoever
- ✅ No middleware bypass — no API middleware changes
- ✅ No direct DB instantiation — no database involvement
- ✅ No grading logic outside Worker — no attempt or grading code
- ✅ No weakening of snapshot integrity — no snapshot system involvement
- ✅ No weakening of version enforcement — no version middleware changes
- ✅ No layer boundary violation — scripts are INFRA tooling, not domain packages

**Layer boundaries unchanged.** This stage adds files only in:

- `scripts/security/` — shell/TypeScript INFRA tooling
- `.husky/pre-commit` — CI toolchain extension
- `.github/workflows/ci.yml` — CI pipeline addition
- Root `package.json` — script registry entries
- `.trivyignore` — configuration file at repo root
- `docs/scripts/` — documentation
- `tmp/` — gitignored scan output

---

## Implementation Layers

### INFRA Layer (Scripts)

**5 scripts to create under `scripts/security/`**:

| Script file                        | Package.json key        | Purpose                                                   |
| ---------------------------------- | ----------------------- | --------------------------------------------------------- |
| `scripts/security/scan.ts`         | `security:scan`         | Full scan: vuln + secrets + misconfig                     |
| `scripts/security/scan-deps.ts`    | `security:scan:deps`    | Dependency vulns only (pre-commit)                        |
| `scripts/security/scan-secrets.ts` | `security:scan:secrets` | Secrets/credentials only                                  |
| `scripts/security/scan-config.ts`  | `security:scan:config`  | IaC misconfigs (Dockerfile, docker-compose, terraform/)   |
| `scripts/security/scan-ci.ts`      | `security:scan:ci`      | CI-mirror: deps+secrets+misconfig, HIGH/CRITICAL → exit 1 |

**Script implementation pattern** (TypeScript Bun script invoking Trivy CLI):

```typescript
// scripts/security/scan-deps.ts
import { $ } from "bun";

const result = await $`trivy fs . --scanners vuln --severity HIGH,CRITICAL --exit-code 1`
  .quiet()
  .nothrow();
process.exit(result.exitCode);
```

All scripts use `Bun.$` (shell-process integration) to invoke the Trivy CLI binary. Scripts do NOT use Node child_process. They are TypeScript with `/// <reference types="bun-types" />` header.

**Trivy invocation patterns** (verified against Context7 / aquasecurity/trivy docs):

| Script         | Trivy command                                                                                                                     | Exit code on finding     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `scan`         | `trivy fs . --scanners vuln,secret,misconfig`                                                                                     | 0 always (informational) |
| `scan-deps`    | `trivy fs . --scanners vuln --severity HIGH,CRITICAL --exit-code 1`                                                               | 1 on HIGH/CRITICAL       |
| `scan-secrets` | `trivy fs . --scanners secret`                                                                                                    | 0 always (informational) |
| `scan-config`  | `trivy fs . --scanners misconfig --include-non-failures`                                                                          | 0 always (informational) |
| `scan-ci`      | `trivy fs . --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --exit-code 1 --format json --output tmp/trivy-report.json` | 1 on HIGH/CRITICAL       |

> **Note**: `--exit-code 1` combined with `--severity HIGH,CRITICAL` is the verified Trivy pattern for CI blocking (per Context7 docs: `trivy image --exit-code 1 --severity CRITICAL ruby:2.4.0`). Same pattern applies to `trivy fs`.

**Trivy version to pin**: Latest stable at time of implementation. The CI YAML will contain the version string literal (e.g. `TRIVY_VERSION: "v0.59.1"`). All docs will reference this exact version.

---

### CI Layer (GitHub Actions — ci.yml)

**Clarification resolved**: Add a new `security` job to the EXISTING `ci.yml` as part of **Group 1** (parallel, 0-5 min). Do NOT create a new workflow file.

**New job placement in ci.yml**:

```yaml
# ── Job 5. Security Scan (Group 1, parallel) ─────────────────────────
security:
  name: "Trivy — Security Scan"
  runs-on: ubuntu-latest
  timeout-minutes: 10
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

    - name: Install Trivy ${{ env.TRIVY_VERSION }}
      run: |
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | \
          sh -s -- -b /usr/local/bin ${{ env.TRIVY_VERSION }}

    - name: Run security scan
      run: bun run security:scan:ci

    - name: Upload scan report (always)
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: trivy-security-report
        path: tmp/trivy-report.json
        retention-days: 30
```

**`env` section addition** (at top of `ci.yml` `env:` block):

```yaml
TRIVY_VERSION: "v0.59.1"
```

**Placement**: The `security` job block is inserted immediately after **Job 4 (repo-doctor)** and before the `# GROUP 2: TESTS` divider comment. It runs in parallel with all other Group 1 jobs.

**Downstream jobs** (`unit-tests`, `integration-tests`, `e2e-*`): These do NOT need the `security` job added as a `needs` dependency — security is a concurrent gate, not a prerequisite gate. Failing security does not block test runs; the PR merge is blocked by the failing check status.

---

### Pre-Commit Layer (.husky/pre-commit)

**Clarification resolved**: Run `bun run security:scan:deps` unconditionally on EVERY commit (not only when package.json/lock files change).

**Position in pre-commit hook**: Insert the Trivy scan section AFTER the architecture brain validation block (the last existing section) and BEFORE the final `echo "✔ Pre-commit checks passed"` line.

**New block to append to `.husky/pre-commit`**:

```sh
# ── Trivy dependency security scan (always, ≤30s) ───────────────────────────
# Runs unconditionally per INFRA-026 clarification: 30s budget confirmed
# for deps-only scan on Bun monorepo. Blocks on HIGH/CRITICAL only.
if command -v trivy >/dev/null 2>&1; then
  echo "Running Trivy dependency security scan…"
  set +e
  bun run security:scan:deps
  TRIVY_EXIT=$?
  set -e

  if [ "$TRIVY_EXIT" -ne 0 ]; then
    echo "❌ Security scan failed — commit blocked."
    echo "   HIGH or CRITICAL vulnerability detected in dependencies."
    echo "   Run: bun run security:scan:deps to see findings."
    echo "   Suppress a false positive: add the CVE to .trivyignore with justification."
    exit 1
  fi
else
  echo "⚠️  Trivy not installed — skipping dependency scan."
  echo "   Install Trivy: https://trivy.dev/latest/getting-started/installation/"
  echo "   Or run: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin v0.59.1"
fi
```

> **Graceful degradation**: If Trivy is not installed locally (developer machine), the pre-commit hook emits a warning but does NOT block the commit. CI is the authoritative enforcement gate. This avoids blocking developers who have not yet installed Trivy.

---

### Configuration Files

#### `.trivyignore` (repo root)

```
# Trivy vulnerability suppression registry
# GOVERNANCE: Every entry requires a justification comment.
# Process: Add suppression → code review → approved in PR → merged.
#
# Format: CVE-YYYY-NNNNN
# Example:
# CVE-2023-12345  # False positive: only affects Windows, we deploy Linux-only

# No suppressions at initial baseline — this file must exist but starts empty.
```

#### `tmp/trivy-report.json` (gitignored)

The `scan-ci.ts` script writes JSON output here. The `tmp/` directory must be gitignored. Verify `.gitignore` contains `tmp/` entry; add if missing.

---

### Orchestrator Integration

This stage extends the orchestrator's step descriptions (in `.agents/agents/zidney-orchestrator.agent.md`) at two points:

**Step 5 — Analyze** addition:

> Before handing off to `speckit.analyze`, the orchestrator MUST execute Trivy and write its JSON report to `tmp/trivy-report.json`.

**Step 6.5 — Runtime & Static Analysis Gate** addition:

> Read `tmp/trivy-report.json` (if present). Parse: if any result has `Severity: "CRITICAL"` → BLOCK implementation. HIGH findings are logged as warnings but do NOT block the orchestrator gate (they block CI but not orchestrator, per clarification).

**Implementation**: The orchestrator AGENT doc describes these as prose instructions (not code). No TypeScript changes are needed to the orchestrator file. The `security:scan:ci` script handles execution; the orchestrator doc extension describes reading the output file.

---

### Documentation Files (5 required)

All files under `docs/scripts/`:

| File                                    | Script documented       |
| --------------------------------------- | ----------------------- |
| `docs/scripts/security-scan.md`         | `security:scan`         |
| `docs/scripts/security-scan-deps.md`    | `security:scan:deps`    |
| `docs/scripts/security-scan-secrets.md` | `security:scan:secrets` |
| `docs/scripts/security-scan-config.md`  | `security:scan:config`  |
| `docs/scripts/security-scan-ci.md`      | `security:scan:ci`      |

Each file must contain: Purpose, Usage, Trigger Context, Severity Policy table, Output, Prerequisites.

---

## Database Impact

**Master DB**: None. No tables touched. No migration required.  
**Tenant DB**: None. No tables touched. No migration required.

---

## Transaction Design

Not applicable. No database mutations. All operations idempotent by design (scan → report → exit).

---

## Idempotency Plan

All scan scripts are fully idempotent: repeated invocations with identical inputs produce identical exit codes and outputs. `tmp/trivy-report.json` is overwritten on each run.

---

## Version Enforcement Strategy

Not applicable. No schema_version or product_version involved.

---

## Authoritative Time Handling

Not applicable.

---

## Observability & Logging

Scripts write structured output to stdout/stderr using `console.error` for findings and `console.log` for status messages. No custom logger required — these are CLI tools, not server-side services. Exit codes are the primary communication channel.

CI step output is visible in the GitHub Actions step log. The JSON report is uploaded as an artifact for 30-day retention.

---

## Rate Limiting

Not applicable.

---

## Failure Modes

| Failure                                | Behavior                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Trivy binary not in PATH (CI)          | CI install step runs first; if curl fails, CI fails with curl error                             |
| Trivy binary not in PATH (pre-commit)  | Emits warning, does NOT block commit (graceful degradation)                                     |
| Trivy scan timeout (large repo)        | `--timeout` flag can be added to scripts — add `5m` default                                     |
| HIGH/CRITICAL finding                  | CI exits 1 → PR check fails; pre-commit exits 1 → commit blocked                                |
| MEDIUM finding                         | CI exits 0 (warning in log); pre-commit not triggered (scan:deps uses --severity HIGH,CRITICAL) |
| `.trivyignore` suppresses all findings | Harmless — if suppression is approved, exit 0 is correct                                        |
| `tmp/` directory missing               | Bun scripts must `mkdir -p tmp` before writing report                                           |
| Corrupt JSON report                    | Orchestrator gate skips block check if file is missing or unreadable                            |

---

## Security Review

- Script source is TypeScript (compiled by Bun JIT) — no eval, no dynamic require
- No environment variables echoed to logs
- Trivy scan logs DO NOT echo detected secret values — only file path, line, type (Trivy default behavior)
- `.trivyignore` is tracked in git and requires code review for changes
- TRIVY_VERSION is pinned in CI env — no floating version

---

## File Delivery Map

| File                                          | Action                                         | Owner          |
| --------------------------------------------- | ---------------------------------------------- | -------------- |
| `scripts/security/scan.ts`                    | CREATE                                         | Implementation |
| `scripts/security/scan-deps.ts`               | CREATE                                         | Implementation |
| `scripts/security/scan-secrets.ts`            | CREATE                                         | Implementation |
| `scripts/security/scan-config.ts`             | CREATE                                         | Implementation |
| `scripts/security/scan-ci.ts`                 | CREATE                                         | Implementation |
| `package.json`                                | MODIFY — add 5 script entries                  | Implementation |
| `.husky/pre-commit`                           | MODIFY — append Trivy block                    | Implementation |
| `.github/workflows/ci.yml`                    | MODIFY — add security job + TRIVY_VERSION env  | Implementation |
| `.trivyignore`                                | CREATE                                         | Implementation |
| `.gitignore`                                  | MODIFY — verify/add `tmp/` entry               | Implementation |
| `docs/scripts/security-scan.md`               | CREATE                                         | Implementation |
| `docs/scripts/security-scan-deps.md`          | CREATE                                         | Implementation |
| `docs/scripts/security-scan-secrets.md`       | CREATE                                         | Implementation |
| `docs/scripts/security-scan-config.md`        | CREATE                                         | Implementation |
| `docs/scripts/security-scan-ci.md`            | CREATE                                         | Implementation |
| `.agents/agents/zidney-orchestrator.agent.md` | MODIFY — extend Step 5 + Step 6.5 descriptions | Implementation |

---

## Implementation Order

1. **Foundation** (sequential): `scripts/security/` TypeScript files + root `package.json` entries + `.trivyignore` + `tmp/` gitignore
2. **Integration** (sequential): `.husky/pre-commit` extension
3. **CI** (sequential): `.github/workflows/ci.yml` security job
4. **Docs** [P] (can run in parallel): 5 documentation files
5. **Orchestrator** [P] (can run in parallel with Docs): orchestrator agent doc extension
6. **Validation**: Lint, typecheck, manual test each script, verify pre-commit hook, verify CI YAML syntax
