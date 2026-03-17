# STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: LOW
Last Updated: 2026-03-17T06:00:00.000Z

Implementation: COMPLETE
Tasks: 16 / 16 completed

Scope Closed:

- Developer tooling (`act` local CI simulation) — no tenant DB access
- 16 atomic tasks T001–T016 all marked [X]
- 6 `package.json` script keys: `ci:local`, `ci:local:full`, `ci:local:workflow`, `ci:local:list`, `validate:scripts-infra`, `ci:run-local`
- `scripts/run-local-ci.ts` — 7-step governance orchestrator (style-compliant: single-quotes/no-semicolons)
- `.act.secrets` gitignored; `docs/ci/local-ci.md` reference doc created
- `AGENTS.md` updated with Local CI Simulation Gate section (mandatory pre-closure gate)

Deferred Scope:

- None

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
