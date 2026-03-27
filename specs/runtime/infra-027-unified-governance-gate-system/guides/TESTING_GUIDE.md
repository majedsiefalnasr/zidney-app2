# Testing Guide — Unified Governance Gate System

**Stage:** Unified Governance Gate System  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage Directory:** infra-027-unified-governance-gate-system  
**Generated On:** 2026-03-25

---

## Purpose

This guide explains how to validate the Unified Governance Gate implementation end-to-end.
Share with QA, the reviewing engineer, or any developer picking up this branch.

---

## Summary of Delivered Behavior

The Unified Governance Gate (`governance:gate`) is a single command that runs 6 architecture
and governance guards sequentially in **report-all mode** — all guards always run regardless of
intermediate failures, and a summary table is printed at the end.

Key outcomes delivered by this stage:

- `bun run governance:gate` — runs all 6 guards, exits 0 (all pass) or 1 (any fail), never exits 2+
- `bun run governance:gate:ci` — same gate with GitHub Actions `::group::` / `::error::` annotations
- `bun run governance:gate:changed` — lightweight pre-commit variant (arch guard only, fast)
- `bun run governance:report` — informational 3-guard report, always exits 0, writes `docs/governance/governance-report.md`
- `bun run ai-context:validate` — validates AI context freshness + schemas
- Pre-commit hook: `governance:gate:changed` runs automatically before every commit
- CI: Step 18 in `architecture-governance.yml` runs `governance:gate:ci` on every push/PR

---

## Prerequisites

| Requirement                     | Validation Command / Check                                                    |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Bun installed                   | `bun --version` (v1+)                                                         |
| Docker running (for Trivy scan) | `docker ps`                                                                   |
| Correct branch checked out      | `git branch --show-current` → `spec/infra-027-unified-governance-gate-system` |
| Working tree clean              | `git status --porcelain` → empty                                              |

---

## Manual Test Scenarios

### Scenario 1 — Full Good-Path Gate Run

**What to test:** All 6 guards pass, gate exits 0.

```bash
bun run governance:gate
```

**Expected output:**

```
╔══════════════════════════════════════════════╗
║         Unified Governance Gate              ║
╚══════════════════════════════════════════════╝

▶ Running: Architecture Guard (arch:guard)
  ...
  ✔ Architecture Guard — PASS
▶ Running: Type Safety (validate:types)
  ...
  ✔ Type Safety — PASS
▶ Running: Runtime Scripts (validate:scripts:runtime)
  ...
  ✔ Runtime Scripts — PASS
▶ Running: Script Usage (validate:scripts:usage)
  ...
  ✔ Script Usage — PASS
▶ Running: Security CI (infra:security:ci)
  ...
  ✔ Security CI — PASS
▶ Running: AI Context Validate (ai-context:validate)
  ...
  ✔ AI Context Validate — PASS

══════════════════════════════════════════════
  Guard Summary
══════════════════════════════════════════════
  Guard                 Status
  ────────────────────  ──────
  Architecture Guard    ✔ PASS
  Type Safety           ✔ PASS
  Runtime Scripts       ✔ PASS
  Script Usage          ✔ PASS
  Security CI           ✔ PASS
  AI Context Validate   ✔ PASS
══════════════════════════════════════════════

✔ Governance gate PASSED — all 6 guards passed.
```

**Pass criteria:** Exit code 0.

---

### Scenario 2 — CI Mode Gate

**What to test:** `::group::` and `::endgroup::` markers appear in output (required for GitHub Actions log folding).

```bash
bun run governance:gate:ci 2>&1
```

**Expected output includes:**

```
::group::Unified Governance Gate
... (gate output) ...
::endgroup::
```

**Pass criteria:** Both markers present in combined stdout+stderr. Exit code equals `governance:gate` exit code.

---

### Scenario 3 — Changed-Files Gate (pre-commit)

**What to test:** Fast pre-commit gate runs only the architecture guard (not all 6).

```bash
bun run governance:gate:changed
```

**Expected output:**

```
Unified Architecture Guard mode=changed verdict=PASS
```

**Pass criteria:** Exit 0, runs in < 10 seconds.

---

### Scenario 4 — Report Generation

**What to test:** `governance:report` always exits 0 and writes a valid markdown file.

```bash
bun run governance:report
cat docs/governance/governance-report.md | head -20
```

**Expected output:**

- Exit code: always 0 (even if guards fail)
- File `docs/governance/governance-report.md` exists
- Contains: `# Governance Report`, `**Generated:**`, `## Guard Summary`, `## Blocking Violations`, `## Warnings`

---

### Scenario 5 — Unit Tests

**What to test:** All 9 governance unit tests pass.

```bash
bun test scripts/governance/__tests__/gate.test.ts
```

**Expected output:**

```
 9 pass
 0 fail
Ran 9 tests across 1 file. [~60s]
```

**Pass criteria:** 9/9 tests pass.

---

### Scenario 6 — Pre-commit Hook Integration

**What to test:** Making a commit runs `governance:gate:changed` automatically.

```bash
# Make a trivial change
echo "# test" >> /tmp/test-note.txt
git add /tmp/test-note.txt 2>/dev/null || true
git commit --allow-empty -m "test: verify governance hook runs"
```

**Expected output in pre-commit section:**

```
Running unified governance gate (changed-files scope)…
Unified Architecture Guard mode=changed verdict=PASS
```

**Pass criteria:** Commit proceeds (no "❌ Unified governance gate blocked" message).

---

### Scenario 7 — CI Workflow Step 18

**What to test:** Step 18 appears in `architecture-governance.yml`.

```bash
grep -A3 "Unified Governance Gate" .github/workflows/architecture-governance.yml
```

**Expected:**

```yaml
- name: Unified Governance Gate
  run: bun run governance:gate:ci
```

---

### Scenario 8 — .gitignore Exclusion

**What to test:** `docs/governance/governance-report.md` is ignored by git.

```bash
bun run governance:report
git status docs/governance/governance-report.md
```

**Expected:** `docs/governance/governance-report.md` shows as ignored (not tracked, not untracked).

```bash
git check-ignore -v docs/governance/governance-report.md
# Expected: .gitignore:NN:docs/governance/governance-report.md
```

---

## Script Registry Verification

```bash
cat docs/scripts/SCRIPT_REGISTRY.md | grep "governance"
```

**Expected:** 4 entries for `governance:gate`, `governance:gate:ci`, `governance:gate:changed`, `governance:report`.

---

## Post-Merge Checklist

- [ ] `bun run governance:gate` exits 0
- [ ] `bun run governance:gate:ci` includes `::group::` and `::endgroup::` markers
- [ ] `bun run governance:report` exits 0 and writes `docs/governance/governance-report.md`
- [ ] Unit tests: 9/9 pass
- [ ] Pre-commit hook runs `governance:gate:changed` on commit
- [ ] CI step 18 present in `architecture-governance.yml`
- [ ] `docs/governance/governance-report.md` is git-ignored
- [ ] SCRIPT_REGISTRY.md contains 4 governance script entries
