# TESTING_GUIDE — INFRA-026 Trivy Security Scanning and Enforcement

**For**: QA Engineers, Developers, and Security Auditors  
**Stage**: INFRA-026 Trivy Security Scanning And Enforcement  
**Date**: 2026-03-24  
**Scope**: Complete end-to-end testing of security scanning integration

---

## Introduction

This guide provides step-by-step instructions to verify that the Trivy security scanning infrastructure works correctly across all three enforcement layers:

1. **Pre-commit hook** — Local developer gate (dependencies + secrets)
2. **GitHub Actions CI** — Remote enforcement gate (full scanning)
3. **Orchestrator integration** — Orchestration-layer enforcement (fail-closed JSON parsing)

Each test can be run independently. All tests should PASS before merging to `develop`.

---

## Test Environment Setup

### Prerequisites

- Working Zidney monorepo clone with `spec/infra-026-trivy-security-scanning-and-enforcement` branch checked out
- Bun package manager installed (`bun --version` should succeed)
- Git with Husky hooks enabled (`git hooks path` should show `.husky`)
- Trivy v0.69.3 available on PATH (installed via CI job or `bun run infra:security:ci`)

### Quick Setup

```bash
# Clone and checkout branch
git clone https://github.com/majedsiefalnasr/zidney-app2.git
cd zidney-app2
git checkout spec/infra-026-trivy-security-scanning-and-enforcement

# Install dependencies
bun install

# Verify Trivy is available (optional, not required for all tests)
which trivy || (echo "Trivy not found, will be installed during CI tests")
```

---

## Test 1: Dependency Scanning (Local Pre-Commit)

**Objective**: Verify that `infra:security:deps` detects dependencies with HIGH/CRITICAL vulnerabilities  
**Scope**: Dependency vulnerability scanner only  
**Expected Time**: 2-3 minutes

### 1.1 — Test Clean Repository

**Steps**:

1. Run the dependency scanner on a clean repository:
   ```bash
   bun run infra:security:deps
   ```

**Expected Result**:

```
Trivy scan clean — no MEDIUM/HIGH/CRITICAL or secret findings detected.
exit code: 0
```

✅ **PASS**: Output indicates clean scan and exit code is 0

### 1.2 — Test Pre-Commit Hook (Dependency Gate)

**Steps**:

1. Create a test branch:
   ```bash
   git checkout -b test/infra-026-deps-gate
   ```
2. Modify `package.json` to introduce a known vulnerable dependency (use a real CVE fixture or craft a temporary entry):
   ```json
   {
     "dependencies": {
       "express": "4.0.0" // Known vulnerable version
     }
   }
   ```
3. Run `bun install` to update lock file
4. Stage the changes:
   ```bash
   git add package.json bun.lock
   ```
5. Attempt to commit:
   ```bash
   git commit -m "test: introduce vulnerable dependency"
   ```

**Expected Result**:

- Pre-commit hook executes `infra:security:deps`
- High-severity dependency is detected
- Commit is blocked (exit code 1 from hook)
- Terminal displays affected package name, CVE, and severity

**Output Example**:

```
husky - pre-commit hook executing...
Trivy scan found HIGH/CRITICAL vulnerabilities:
  express 4.0.0 | CVE-2022-24999 | HIGH | Path traversal

Commit blocked due to HIGH-severity findings.
exit code: 1
```

✅ **PASS**: Commit was blocked and diagnostic message displayed

### 1.3 — Test MEDIUM Severity Warning (Non-Blocking)

**Steps**:

1. Modify `package.json` to use a dependency with only MEDIUM-severity issues:
   ```json
   {
     "dependencies": {
       "lodash": "4.17.15" // MEDIUM-severity findings expected
     }
   }
   ```
2. Run `bun install`
3. Stage changes:
   ```bash
   git add package.json bun.lock
   ```
4. Attempt to commit:
   ```bash
   git commit -m "test: dependency with medium-severity findings"
   ```

**Expected Result**:

- Pre-commit hook runs `infra:security:deps`
- MEDIUM-severity findings are logged as warnings
- Commit is NOT blocked (exit code 0)
- Commit proceeds successfully

✅ **PASS**: MEDIUM severity warned but not blocked

---

## Test 2: Secret Scanning (Pre-Commit Staged-File Mode)

**Objective**: Verify that `infra:security:secrets --staged` detects secrets in staged files  
**Scope**: Secret detection scanner with staged files only  
**Expected Time**: 2-3 minutes

### 2.1 — Test Clean Staged Files

**Steps**:

1. Create a new branch:
   ```bash
   git checkout -b test/infra-026-secrets-gate
   ```
2. Create a benign file and stage it:
   ```bash
   echo "# API Gateway Configuration" > config.md
   git add config.md
   ```
3. Attempt to commit:
   ```bash
   git commit -m "test: benign config file"
   ```

**Expected Result**:

- Pre-commit secret scan runs (`infra:security:secrets --staged`)
- No secrets detected
- Commit proceeds (exit code 0)

✅ **PASS**: Clean files committed without blocking

### 2.2 — Test Secret Detection (Hard Block)

**Steps**:

1. Create a file with a hardcoded secret (API key, token) and stage it:
   ```bash
   echo "API_KEY=sk_live_1234567890abcdef" > .env.local
   git add .env.local
   ```
2. Attempt to commit:
   ```bash
   git commit -m "test: accidentally committed secret"
   ```

**Expected Result**:

- Pre-commit secret scan detects the secret
- Commit is blocked with a diagnostic message
- File path and secret type are reported
- **CRITICAL**: Secret value is NOT echoed to terminal or logs

**Output Example**:

```
husky - pre-commit script failing...
Trivy scan detected secrets in staged files:
  .env.local | Generic API Key | CRITICAL

Commit blocked due to secret findings. No secret values displayed.
exit code: 1
```

✅ **PASS**: Secret blocked, file path reported, no value leaked

---

## Test 3: Full Filesystem Scan (Local)

**Objective**: Verify that `infra:security` performs a complete scan across all scanners  
**Scope**: All three scanners (dependencies, secrets, config)  
**Expected Time**: 3-5 minutes

### 3.1 — Run Full Scan

**Steps**:

1. Return to main branch (without test modifications):
   ```bash
   git checkout spec/infra-026-trivy-security-scanning-and-enforcement
   git clean -fd  # Remove test files
   ```
2. Run the full security scan:
   ```bash
   bun run infra:security
   ```

**Expected Result**:

- Full scan completes across all three scanners
- Output includes sections for:
  - Dependencies (vulnerabilities)
  - Secrets (detected patterns)
  - Configuration (Dockerfile, docker-compose, Terraform misconfigs)
- Exit code 0 (clean scan expected on `develop`)

✅ **PASS**: Full scan executes without errors

---

## Test 4: Configuration Scanning (IaC)

**Objective**: Verify that `infra:security:config` detects infrastructure misconfiguration  
**Scope**: Infrastructure as Code misconfiguration detection  
**Expected Time**: 1-2 minutes

### 4.1 — Run Config Scan

**Steps**:

1. Run the config scanner:
   ```bash
   bun run infra:security:config
   ```

**Expected Result**:

- Scans `Dockerfile`, `docker-compose.yml`, `terraform/` directories
- Reports any MEDIUM/HIGH/CRITICAL misconfigurations
- Example output (expected on current repo):
  ```
  [WARN] MEDIUM | MISCONFIGURATION | DS-0013 | 'RUN cd ...' to change directory | path=Dockerfile
  ```
- Exit code 0 (on clean, non-blocking repo)

✅ **PASS**: Config scan completes and reports findings (if any)

---

## Test 5: CI Mode Scan (Local Simulation)

**Objective**: Verify that `infra:security:ci` mirrors CI behavior exactly  
**Scope**: CI-equivalent scanning with sanitized JSON artifact generation  
**Expected Time**: 2-3 minutes

### 5.1 — Run CI Mode

**Steps**:

1. Run the CI-mode scanner:
   ```bash
   bun run infra:security:ci
   ```

**Expected Result**:

- Scan executes (dependencies, secrets, config)
- Generates sanitized JSON report to `tmp/trivy-report.json`
- Exit code 0 on clean scan, exit code 1 on HIGH/CRITICAL/secrets
- No secret values in JSON artifact

**Verify artifact**:

```bash
cat tmp/trivy-report.json | jq '.findings | length'  # Show finding count
cat tmp/trivy-report.json | grep -i "key\|token\|password"  # Verify no actual secret values
```

✅ **PASS**: JSON artifact generated, clean, and properly sanitized

### 5.2 — Idempotency Check

**Steps**:

1. Run CI mode twice in succession:
   ```bash
   bun run infra:security:ci
   FIRST_HASH=$(md5 tmp/trivy-report.json)
   bun run infra:security:ci
   SECOND_HASH=$(md5 tmp/trivy-report.json)
   echo "First:  $FIRST_HASH"
   echo "Second: $SECOND_HASH"
   ```

**Expected Result**:

- Both runs produce identical output (same MD5 hash)
- Consistent exit codes
- Proves idempotent behavior

✅ **PASS**: CI mode is idempotent

---

## Test 6: Script Documentation & Registry

**Objective**: Verify that all scripts are documented and properly registered  
**Scope**: Script governance and documentation completeness  
**Expected Time**: 2-3 minutes

### 6.1 — Verify Script Registration

**Steps**:

1. Check that all 5 scripts are registered in `package.json`:
   ```bash
   cat package.json | jq '.scripts | keys | map(select(startswith("infra:security")))'
   ```

**Expected Result**:

```json
[
  "infra:security",
  "infra:security:ci",
  "infra:security:config",
  "infra:security:deps",
  "infra:security:secrets"
]
```

✅ **PASS**: All 5 scripts present in registry

### 6.2 — Verify Documentation Completeness

**Steps**:

1. Check that all documentation files exist:
   ```bash
   for doc in security-scan security-scan-deps security-scan-secrets security-scan-config security-scan-ci; do
     [ -f "docs/scripts/${doc}.md" ] && echo "✅ ${doc}.md" || echo "❌ ${doc}.md MISSING"
   done
   ```

**Expected Result**:

```
✅ security-scan.md
✅ security-scan-deps.md
✅ security-scan-secrets.md
✅ security-scan-config.md
✅ security-scan-ci.md
```

### 6.3 — Verify Documentation Structure

**Steps**:

1. Check each doc has required sections:
   ```bash
   for doc in docs/scripts/security-scan*.md; do
     echo "=== $(basename $doc) ==="
     grep -E "^##\s" "$doc" | head -5
   done
   ```

**Expected**: Each doc contains sections:

- Purpose
- Usage (CLI invocation)
- Trigger Context (when it runs)
- Severity Policy (MEDIUM, HIGH, CRITICAL behavior)
- Output Format
- Prerequisites

✅ **PASS**: All documentation present and complete

---

## Test 7: GitHub Actions CI Workflow

**Objective**: Verify that CI workflow executes security scan and blocks on findings  
**Scope**: GitHub Actions integration and merge-blocking behavior  
**Expected Time**: 5-10 minutes per workflow run

### 7.1 — Run Local CI Simulation

**Steps**:

1. Run local CI simulation using `act`:
   ```bash
   bun run ci:run-local
   ```

**Expected Result**:

- All governance steps PASS (ai-guard, infra-audit, lint validation)
- Security job executes and completes in <3 minutes
- Workflow exits cleanly (code 0 on clean scan)

✅ **PASS**: Local CI simulation succeeds

### 7.2 — Verify Merge-Blocking Behavior (Manual)

**Steps**:

1. Push current branch to GitHub:
   ```bash
   git push origin spec/infra-026-trivy-security-scanning-and-enforcement
   ```
2. Open a pull request from the branch to `develop`
3. Observe GitHub PR checks:
   - Navigate to "Checks" tab
   - Look for a `security` check run
   - Verify status = passed (green checkmark)

**Expected Result**:

- PR shows passing security check
- No blocking failures
- Merge is allowed

✅ **PASS**: CI security check passes and does not block merge

---

## Test 8: Orchestrator Integration

**Objective**: Verify that orchestrator Step 6.5 correctly parses sanitized Trivy JSON  
**Scope**: Orchestrator fail-closed gate and hard-block logic  
**Expected Time**: 2-3 minutes

### 8.1 — Simulate Orchestrator Validation Gate

**Steps**:

1. Locate the CI-generated artifact:
   ```bash
   cat tmp/trivy-report.json | jq '.'  # Inspect structure
   ```

**Expected Result**:

- JSON is valid (parseable by `jq`)
- No secret values present (check for "key", "password", "token" strings)
- Finding count and severity breakdown visible

✅ **PASS**: Artifact structure is valid and sanitized

---

## Test 9: Performance Validation

**Objective**: Verify that scanning stays within performance budgets  
**Scope**: Execution time for pre-commit and CI jobs  
**Expected Time**: Measured during tests 1-5

### 9.1 — Pre-Commit Timing

**From Test 1 and 2 execution**:

- Note the time when pre-commit hook starts (git commit command)
- Note the time when hook completes
- Total duration should be **<30 seconds**

**Example**:

```
Start: 14:23:45.100
End:   14:23:57.850
Duration: 12.75 seconds ✅ (under 30 second budget)
```

✅ **PASS**: Pre-commit <30s

### 9.2 — CI Job Timing

**From Test 7.1 (local CI run)**:

- Extract security job duration from `act` output
- Should be **<3 minutes (180 seconds)**

**Example output**:

```
security job completed in 65 seconds ✅ (64% under budget)
```

✅ **PASS**: CI job <3 minutes

---

## Test 10: Error Handling & Edge Cases

**Objective**: Verify graceful handling of edge cases  
**Scope**: Error scenarios and boundary conditions  
**Expected Time**: 3-5 minutes

### 10.1 — Missing Trivy (Pre-Commit Fallback)

**Steps**:

1. Temporarily uninstall or hide Trivy:
   ```bash
   mv /usr/local/bin/trivy /usr/local/bin/trivy.bak 2>/dev/null || true
   ```
2. Attempt a commit:
   ```bash
   echo "test" > test.txt
   git add test.txt
   git commit -m "test: trivy unavailable"
   ```

**Expected Result**:

- Hook detects Trivy unavailability
- One of:
  - Hook gracefully skips (if dependency is optional)
  - Hook fails with clear diagnostic message (if secret enforcement is mandatory)
- Commit either succeeds or fails with clear error, not crash

✅ **PASS**: Graceful error handling

### 10.2 — Restore Trivy

```bash
mv /usr/local/bin/trivy.bak /usr/local/bin/trivy 2>/dev/null || true
```

---

## Troubleshooting

| Issue                              | Symptoms                                    | Resolution                                                                            |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| Pre-commit hook not running        | `git commit` proceeds without security scan | Run `git hooks install` or `husky install` to re-enable hooks                         |
| Trivy not found                    | "trivy: command not found" or similar       | Install Trivy v0.69.3 manually or run CI job first: `bun run infra:security:ci`       |
| Permission denied on scripts       | Hook execution fails with permission error  | `chmod +x scripts/security/*.ts` to ensure executable                                 |
| CI workflow fails to find artifact | "tmp/trivy-report.json not found"           | Artifact is in `tmp/` which is gitignored; re-run `bun run infra:security:ci` locally |
| JSON parsing error in orchestrator | "Failed to parse JSON"                      | Verify `tmp/trivy-report.json` is valid: `cat tmp/trivy-report.json \| jq '.'`        |

---

## Test Summary Checklist

| Test    | Objective                                              | Status |
| ------- | ------------------------------------------------------ | ------ |
| Test 1  | Dependency scanning (clean + blocking + warning)       | ⬜     |
| Test 2  | Secret scanning (staged files, hard block, no leakage) | ⬜     |
| Test 3  | Full filesystem scan (all scanners)                    | ⬜     |
| Test 4  | Configuration scanning (IaC misconfigs)                | ⬜     |
| Test 5  | CI mode scan (idempotent JSON generation)              | ⬜     |
| Test 6  | Script documentation & registry (completeness)         | ⬜     |
| Test 7  | GitHub Actions CI workflow (merge-blocking)            | ⬜     |
| Test 8  | Orchestrator integration (fail-closed parsing)         | ⬜     |
| Test 9  | Performance validation (timing budgets)                | ⬜     |
| Test 10 | Error handling & edge cases                            | ⬜     |

**Total Tests**: 10 | **Required for Approval**: All PASS

---

## Sign-Off

All tests completed and passing? Mark below:

- [ ] All 10 tests PASS
- [ ] No blocking issues found
- [ ] Performance budgets met
- [ ] Documentation complete and accurate
- [ ] Ready for production merge

**Date Completed**: **\*\***\_\_\_\_**\*\***  
**Tested By**: **\*\***\_\_\_\_**\*\***  
**Approval**: **\*\***\_\_\_\_**\*\***

---

**Next Steps**: Submit PR with passing test results attached. Feature is ready for code review and merge to `develop`.
