# STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT

## Stage Status

Status: PRODUCTION READY
Step: stage_production_ready
Risk Level: LOW
Closure Date: 2026-03-18

Implementation: COMPLETE ✅
Tasks: 16 / 16 (100%)
Validation: PASSED (lint, type-check, acceptance tests)

Scope Delivered:

- ✅ Local CI simulation via `act` v0.2.84 with Docker v29.2.1
- ✅ 7-step governance orchestrator (`scripts/run-local-ci.ts`) — Docker validation, fail-forward reporting
- ✅ Developer reference documentation (`docs/ci/local-ci.md`) — 2,500+ words
- ✅ 6 npm scripts: `ci:local`, `ci:local:full`, `ci:local:workflow`, `ci:local:list`, `validate:scripts-infra`, `ci:run-local`
- ✅ Infrastructure governance enforcement (script registration, .act.secrets gitignoring)
- ✅ Mandatory pre-closure gate (non-bypassable, enforces local CI validation)
- ✅ Complete acceptance testing suite (T015: Docker, act, containers, state validation; T016: failure modes)
- ✅ Manual testing guide (7 step-by-step scenarios for QA teams)

Deferred Scope:

- None

Constitutional Compliance:

- ✅ ADR-0023 (Local CI Simulation): Fully satisfied
- ✅ ADR-0008 (Semantic Versioning): Enforced via scripts:infra validation
- ✅ ADR-0001 (Multi-Tenancy): No changes — unaffected
- ✅ ADR-0006 (Server-Authoritative Time): No changes — unaffected
- ✅ All import boundaries preserved
- ✅ No cross-layer violations
- ✅ Architecture governance intact

Governance Gates: ALL CLEARED ✅

- Pre-Closure Review Gate: PASSED
- Local CI Simulation Gate: PASSED
- Type Safety & Lint: PASSED (0 errors)
- Guardian Audits: Zidney Security Auditor ✅, Zidney Performance Optimizer ✅, Zidney QA Engineer ✅, Zidney Code Reviewer ✅

Notes:
Stage is production ready. No structural backend modifications allowed. Modifications require a new migration stage.

Constitutional Compliance:

- ADR alignment verified
- Implementation compliant with Zidney Constitution v1.2.0
- No tenant DB access — isolation rules N/A
- No license middleware involvement — license rules N/A
- `.act.secrets` gitignored — never committed

Notes:
Backend implementation complete. No structural backend modifications allowed.

## Purpose

Introduce a deterministic **local CI simulation layer** using `act` to run GitHub Actions workflows locally before pushing.

This stage establishes a **pre-closure gate** that mirrors CI execution and prevents:

- broken workflows reaching GitHub
- hidden script failures
- environment/config drift
- late feedback loops

---

## Scope

This stage covers:

- Local execution of `.github/workflows/*` using `act`
- Standardization of runner images and environment
- Script wrappers for local CI execution
- Secrets strategy for local simulation
- Integration with Zidney orchestrator (closure gate)
- CI parity enforcement (local ≈ GitHub)
- Failure policy and developer workflow

---

## Non-Goals

- Replacing GitHub CI (GitHub remains final authority)
- Full parity with hosted runners (best-effort simulation only)
- Managing production secrets

---

## Success Criteria

- All workflows can run locally via `act`
- `bun run ci:local` passes before push
- Orchestrator blocks closure on failure
- No workflow exists that cannot be simulated locally

---

## Tasks

### T001 – Install & Standardize `act`

Document installation:

- macOS:

  ```
  brew install act
  ```

- Linux:
  ```
  curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
  ```

Requirements:

- Docker must be installed and running

---

### T002 – Runner Mapping

Create:

```
.actrc
```

Content:

```
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```

This ensures consistent runner behavior across environments.

---

### T003 – Script Wrappers

Update root `package.json`:

```json
{
  "scripts": {
    "ci:local": "act --pull=false",
    "ci:local:full": "act",
    "ci:local:workflow": "act -W .github/workflows",
    "ci:local:list": "act -l"
  }
}
```

Guidelines:

- `ci:local` → fast, default execution
- `ci:local:full` → full run (pull images)
- `ci:local:workflow` → targeted debugging

---

### T004 – Secrets Strategy

Create:

```
.act.secrets
```

Example:

```
DATABASE_URL=postgres://localhost:5432/test
REDIS_URL=redis://localhost:6379
NODE_ENV=test
```

Rules:

- Never commit real secrets
- Use local/test-safe values only

---

### T005 – Workflow Compatibility Audit

Audit all workflows in:

```
.github/workflows/*
```

Ensure:

- No unsupported actions
- No cloud-only dependencies
- All jobs can run locally
- No implicit secrets required

Any incompatible workflow must be:

- adapted
- mocked
- or explicitly excluded (documented)

---

### T006 – Local CI Orchestrator Script

Create:

```
scripts/run-local-ci.ts
```

Responsibilities:

1. Run core governance checks:
   - validate-runtime-scripts
   - validate-script-infrastructure
   - generate-script-docs
   - architecture-guard
   - type-safety-guard

2. Execute:

   ```
   bun run ci:local
   ```

3. Aggregate results and exit with failure if any step fails

---

### T007 – Orchestrator Integration (CRITICAL)

Update Zidney orchestrator agent:

Before closure step:

```
Run Local CI Simulation (ACT)

- Execute: bun run ci:local
- All jobs must pass
- Any failure → BLOCK closure
```

This makes `act` a **mandatory gate**, not optional tooling.

---

### T008 – Developer Workflow Integration

Update developer flow:

```
bun run ci:local
git push
```

Optional pre-push hook (non-blocking):

```
echo "⚠️ Run 'bun run ci:local' before pushing"
```

---

### T009 – CI Parity Contract

Rule:

> Every workflow added to `.github/workflows` MUST be runnable via `act`.

Violations:

- Block PR
- Block stage closure

---

### T010 – Failure Policy

Closure is BLOCKED if:

- `act` fails
- Any workflow job fails
- A workflow cannot execute locally

---

### T011 – Performance Profiles (Recommended)

Define:

- Fast profile:

  ```
  bun run ci:local
  ```

- Full profile:
  ```
  bun run ci:local:full
  ```

Goal:

- Keep default execution fast
- Allow deep validation when needed

---

### T012 – Documentation

Create:

```
docs/ci/local-ci.md
```

Include:

- What is `act`
- How to install
- How to run local CI
- Troubleshooting
- Differences vs GitHub CI

---

### T013 – AGENTS.md Update

Add rule:

```
Before closure:
- MUST run local CI simulation (act)
- MUST pass all workflows
- MUST not bypass this step
```

---

## Guard Guarantees

After this stage:

- CI failures are caught BEFORE push
- Workflows are continuously validated
- Script and infra integrity is enforced locally
- Closure becomes deterministic and safe

---

## Risks

| Risk                     | Mitigation                    |
| ------------------------ | ----------------------------- |
| Docker not running       | Fail early with clear message |
| Workflow incompatibility | Enforce T005 audit            |
| Slow execution           | Use T011 profiles             |
| Dev bypass               | Enforce orchestrator gate     |

---

## Follow-Up Opportunities

- Cache Docker layers for faster runs
- Parallel execution optimization
- Workflow test matrix simulation
- GitHub vs act diff analyzer

---

## Final Outcome

This stage introduces:

> A local, deterministic CI simulation layer that acts as the final gate before closure.

This eliminates:

- blind pushes
- delayed CI failures
- workflow uncertainty

And upgrades Zidney into a:

> **self-validating, locally enforced CI-first architecture**
