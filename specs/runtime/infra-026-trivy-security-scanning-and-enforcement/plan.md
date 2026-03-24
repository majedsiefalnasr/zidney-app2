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

**5 scripts plus 1 shared helper to create under `scripts/security/`**:

| Script file                        | Package.json key         | Purpose                                                                |
| ---------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `scripts/security/trivy-config.ts` | N/A                      | Shared config/helper for scanners, severities, report path, exclusions |
| `scripts/security/scan.ts`         | `infra:security`         | Full scan: vuln + secrets + misconfig                                  |
| `scripts/security/scan-deps.ts`    | `infra:security:deps`    | Dependency vulns only (pre-commit)                                     |
| `scripts/security/scan-secrets.ts` | `infra:security:secrets` | Secrets/credentials only; supports staged-file mode                    |
| `scripts/security/scan-config.ts`  | `infra:security:config`  | IaC misconfigs (Dockerfile, docker-compose, terraform/)                |
| `scripts/security/scan-ci.ts`      | `infra:security:ci`      | CI/orchestrator sanitized report generator and exit-code gate          |

**Script implementation pattern** (TypeScript Bun script invoking Trivy CLI):

```typescript
// scripts/security/scan-deps.ts
import { materializeTrackedFiles, runTrivyFs } from "./trivy-config";

const tracked = await materializeTrackedFiles();
const report = await runTrivyFs({
  target: tracked.targetDir,
  scanners: ["vuln"],
  severities: ["MEDIUM", "HIGH", "CRITICAL"],
});
```

All scripts use a shared helper built on `Bun.spawn()` to invoke the Trivy CLI binary. Repo-wide scans materialize tracked working-tree snapshots so local untracked files and vendored directories do not distort results. Scripts do NOT use Node child_process.

**Trivy invocation patterns** (verified against Context7 / aquasecurity/trivy docs):

| Script         | Trivy command / wrapper behavior                                                                                                                                                                                                                                                                                                                                         | Exit code on finding          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `scan`         | Shared helper materializes tracked working-tree files and runs `trivy fs <tracked-tempdir> --scanners vuln,secret,misconfig`                                                                                                                                                                                                                                             | 0 always (informational)      |
| `scan-deps`    | Shared helper materializes tracked working-tree files and runs `trivy fs <tracked-tempdir> --scanners vuln --severity MEDIUM,HIGH,CRITICAL --format json`; wrapper logs MEDIUM findings as warnings and exits 1 only on HIGH/CRITICAL                                                                                                                                    | 1 on HIGH/CRITICAL            |
| `scan-secrets` | Shared helper runs `trivy fs <tracked-tempdir> --scanners secret --format json` for repo-wide scans and `trivy fs <staged-tempdir> --scanners secret --format json` for `--staged`; wrapper exits 1 on any secret match                                                                                                                                                  | 1 on any secret when blocking |
| `scan-config`  | Shared helper materializes tracked working-tree files and runs `trivy fs <tracked-tempdir> --scanners misconfig --include-non-failures`                                                                                                                                                                                                                                  | 0 always (informational)      |
| `scan-ci`      | Shared helper materializes tracked working-tree files and runs `trivy fs <tracked-tempdir> --scanners vuln,secret,misconfig --severity MEDIUM,HIGH,CRITICAL --format json`; wrapper writes a sanitized summary to `tmp/trivy-report.json`, logs MEDIUM as warnings, and exits 1 on HIGH/CRITICAL vulnerabilities, HIGH/CRITICAL misconfigurations, or any secret finding | 1 on blocking condition       |

> **Note**: The implementation uses JSON output plus wrapper-controlled exit semantics so MEDIUM findings can be surfaced as warnings while HIGH/CRITICAL still block CI and pre-commit. For CI and orchestrator report generation, HIGH/CRITICAL infrastructure misconfigurations use the same blocking classification as HIGH/CRITICAL vulnerabilities.

**Trivy version to pin**: `v0.59.1`. The CI YAML, local install docs, and validation tasks will all use this exact `TRIVY_VERSION` literal.

---

### CI Layer (GitHub Actions — ci.yml)

**Clarification resolved**: Add a new `security` job to the EXISTING `ci.yml` as part of **Group 1** (parallel, 0-5 min). Do NOT create a new workflow file.

**New job placement in ci.yml**:

```yaml
# ── Job 5. Security Scan (Group 1, parallel) ─────────────────────────
security:
  name: "Trivy — Security Scan"
  runs-on: ubuntu-latest
  timeout-minutes: 3
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

    - name: Restore Trivy cache
      uses: actions/cache@v4
      with:
        path: ~/.cache/trivy
        key: trivy-db-${{ runner.os }}-${{ env.TRIVY_VERSION }}
        restore-keys: trivy-db-${{ runner.os }}-

    - name: Download Trivy ${{ env.TRIVY_VERSION }} release asset
      run: |
        VERSION_NO_V="${TRIVY_VERSION#v}"
        curl -fsSLo trivy.tar.gz "https://github.com/aquasecurity/trivy/releases/download/${TRIVY_VERSION}/trivy_${VERSION_NO_V}_Linux-64bit.tar.gz"
        curl -fsSLo trivy_checksums.txt "https://github.com/aquasecurity/trivy/releases/download/${TRIVY_VERSION}/trivy_${VERSION_NO_V}_checksums.txt"

    - name: Verify Trivy checksum and install
      run: |
        VERSION_NO_V="${TRIVY_VERSION#v}"
        grep "trivy_${VERSION_NO_V}_Linux-64bit.tar.gz" trivy_checksums.txt | shasum -a 256 -c -
        tar -xzf trivy.tar.gz trivy
        install trivy /usr/local/bin/trivy

    - name: Run security scan
      run: bun run infra:security:ci

    - name: Upload sanitized scan report (always)
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

**Placement**: The `security` job block is inserted immediately after **Job 4 (repo-doctor)** and before the `# GROUP 2: TESTS` divider comment.

**Downstream jobs** (`unit-tests`, `integration-tests`, `e2e-*`): These MUST include `security` in their `needs` dependency set so build/test execution waits for the security gate to pass.

---

### Pre-Commit Layer (.husky/pre-commit)

**Clarification resolved**: Run `bun run infra:security:deps` unconditionally on EVERY commit and run `bun run infra:security:secrets --staged` against staged files only.

**Position in pre-commit hook**: Insert the Trivy scan section AFTER the architecture brain validation block (the last existing section) and BEFORE the final `echo "✔ Pre-commit checks passed"` line.

**New block to append to `.husky/pre-commit`**:

```sh
# ── Trivy security scans (≤30s budget total) ─────────────────────────────────
# Dependency scan runs on every commit. Secret scan runs only on staged files.
if command -v trivy >/dev/null 2>&1; then
  echo "Running Trivy dependency security scan…"
  set +e
  bun run infra:security:deps
  DEPS_EXIT=$?
  set -e

  if [ "$DEPS_EXIT" -ne 0 ]; then
    echo "❌ Dependency security scan failed — commit blocked."
    echo "   HIGH or CRITICAL vulnerability detected in dependencies."
    echo "   Run: bun run infra:security:deps to see findings."
    echo "   Suppress a false positive: add the CVE to .trivyignore with justification."
    exit 1
  fi

  echo "Running Trivy staged secret scan…"
  set +e
  bun run infra:security:secrets --staged
  SECRETS_EXIT=$?
  set -e

  if [ "$SECRETS_EXIT" -ne 0 ]; then
    echo "❌ Secret scan failed — commit blocked."
    echo "   Sensitive data detected in staged content."
    echo "   Run: bun run infra:security:secrets --staged to inspect metadata only."
    exit 1
  fi
else
  echo "⚠️  Trivy not installed — security scans cannot run locally."
  echo "   Install Trivy: https://trivy.dev/latest/getting-started/installation/"
  echo "   Or install the pinned v0.59.1 release asset and verify its checksum before placing the binary on PATH."
  echo "   Commit blocked until Trivy is installed because secret enforcement is mandatory."
  exit 1
fi
```

> **Enforcement note**: Because local secret blocking is mandatory, missing Trivy is a hard stop for pre-commit. The staged secret scan keeps the hook within the 30-second budget.

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

This stage extends the orchestrator's step descriptions (in `.agents/agents/orchestrator.agent.md`) at two points:

**Step 5 — Analyze** addition:

> Before handing off to `speckit.analyze`, the orchestrator MUST execute `bun run infra:security:ci` and write its sanitized JSON report to `tmp/trivy-report.json`.

**Step 6.5 — Runtime & Static Analysis Gate** addition:

> Read `tmp/trivy-report.json`. Parse: if any result contains a CRITICAL vulnerability, a CRITICAL infrastructure misconfiguration, or any secret finding, BLOCK implementation. If the file is missing, unreadable, malformed, or missing required fields, fail closed and BLOCK implementation. HIGH-only vulnerability or misconfiguration findings are logged as warnings but do NOT block the orchestrator gate. LOW findings remain suppressed; MEDIUM findings remain warnings.

**Implementation**: The orchestrator AGENT doc describes these as prose instructions (not code). No TypeScript changes are needed to the orchestrator file. The `infra:security:ci` script handles execution; the orchestrator doc extension describes reading the output file.

---

### Documentation Files (5 required)

All files under `docs/scripts/`:

| File                                    | Script documented        |
| --------------------------------------- | ------------------------ |
| `docs/scripts/security-scan.md`         | `infra:security`         |
| `docs/scripts/security-scan-deps.md`    | `infra:security:deps`    |
| `docs/scripts/security-scan-secrets.md` | `infra:security:secrets` |
| `docs/scripts/security-scan-config.md`  | `infra:security:config`  |
| `docs/scripts/security-scan-ci.md`      | `infra:security:ci`      |

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

Scripts write structured output to stdout/stderr using redacted summaries only. Secret values are never echoed; only file path, line number, and rule/type may be emitted. Exit codes are the primary communication channel.

CI step output is visible in the GitHub Actions step log. The JSON report is uploaded as an artifact for 30-day retention.

---

## Rate Limiting

Not applicable.

---

## STRIDE Threat Model

- **Spoofing**: Untrusted Trivy binaries are mitigated by downloading the pinned `v0.59.1` release asset and verifying its published checksum before installation.
- **Tampering**: The orchestrator consumes only the sanitized JSON summary contract and fails closed on malformed, unreadable, or incomplete reports.
- **Repudiation**: CI logs, uploaded sanitized artifacts, and git-tracked `.trivyignore` changes provide reviewable audit trails.
- **Information Disclosure**: Secret values are never retained in persisted JSON artifacts; only sanitized metadata is stored and uploaded.
- **Denial of Service**: Cache restore, runtime budgets, and staged-only local secret scanning keep scan overhead bounded.
- **Elevation of Privilege**: Scans are read-only and operate through repo scripts without elevated runtime privileges.

## Failure Modes

| Failure                                                             | Behavior                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Trivy binary not in PATH (CI)                                       | CI install step runs first; if curl fails, CI fails with curl error                           |
| Trivy binary not in PATH (pre-commit)                               | Commit blocked with install guidance because local secret enforcement is mandatory            |
| Trivy scan timeout (large repo)                                     | `--timeout` flag can be added to scripts — keep any default aligned to the 3-minute CI budget |
| HIGH/CRITICAL finding                                               | CI exits 1 → PR check fails; pre-commit deps scan exits 1 → commit blocked                    |
| Secret finding                                                      | CI exits 1 → PR check fails; pre-commit staged secret scan exits 1 → commit blocked           |
| MEDIUM finding                                                      | Logged as warning only; does not change exit code                                             |
| Explicit approved `.trivyignore` entries suppress specific findings | Allowed only for the listed finding; blanket suppression is forbidden                         |
| `tmp/` directory missing                                            | Bun scripts must `mkdir -p tmp` before writing report                                         |
| Corrupt JSON report                                                 | Orchestrator gate fails closed and blocks implementation                                      |

---

## Security Review

- Script source is TypeScript (compiled by Bun JIT) — no eval, no dynamic require
- No environment variables echoed to logs
- Persisted Trivy summary artifacts MUST be sanitized by repo-owned logic before upload or orchestrator consumption; secret values are never retained in `tmp/trivy-report.json`
- `.trivyignore` is tracked in git and requires code review for changes
- TRIVY_VERSION is pinned in CI env — no floating version

---

## File Delivery Map

| File                                    | Action                                              | Owner          |
| --------------------------------------- | --------------------------------------------------- | -------------- |
| `scripts/security/trivy-config.ts`      | CREATE                                              | Implementation |
| `scripts/security/scan.ts`              | CREATE                                              | Implementation |
| `scripts/security/scan-deps.ts`         | CREATE                                              | Implementation |
| `scripts/security/scan-secrets.ts`      | CREATE                                              | Implementation |
| `scripts/security/scan-config.ts`       | CREATE                                              | Implementation |
| `scripts/security/scan-ci.ts`           | CREATE                                              | Implementation |
| `package.json`                          | MODIFY — add 5 script entries under infra namespace | Implementation |
| `.husky/pre-commit`                     | MODIFY — append Trivy block                         | Implementation |
| `.github/workflows/ci.yml`              | MODIFY — add security job + TRIVY_VERSION env       | Implementation |
| `.trivyignore`                          | CREATE                                              | Implementation |
| `.gitignore`                            | MODIFY — verify/add `tmp/` entry                    | Implementation |
| `docs/scripts/security-scan.md`         | CREATE                                              | Implementation |
| `docs/scripts/security-scan-deps.md`    | CREATE                                              | Implementation |
| `docs/scripts/security-scan-secrets.md` | CREATE                                              | Implementation |
| `docs/scripts/security-scan-config.md`  | CREATE                                              | Implementation |
| `docs/scripts/security-scan-ci.md`      | CREATE                                              | Implementation |
| `.agents/agents/orchestrator.agent.md`  | MODIFY — extend Step 5 + Step 6.5 descriptions      | Implementation |

---

## Implementation Order

1. **Foundation** (sequential): shared helper + `scripts/security/` TypeScript files + root `package.json` entries + `.trivyignore` + `tmp/` gitignore
2. **Integration** (sequential): `.husky/pre-commit` dependency and staged-secret extensions
3. **CI** (sequential): `.github/workflows/ci.yml` security job + Trivy cache + downstream `needs`
4. **Docs** [P] (can run in parallel): 5 documentation files
5. **Orchestrator** [P] (can run in parallel with Docs): orchestrator agent doc extension
6. **Validation**: script registry generation, script validators, lint, typecheck, ai-guard, infra-audit, CI YAML syntax, baseline scan runs, timing checks, orchestrator gate fixtures
