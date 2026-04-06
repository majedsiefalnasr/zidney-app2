# Local CI Report

**Command:** bun run ci:run-local  
**Timestamp:** 2026-04-06T12:15:02.660Z  
**Status:** FAIL  
**Exit Code:** 1  
**Report Location:** docs/reports/LOCAL_CI_REPORT.md

<!-- LOCAL_CI_REPORT_METADATA_START
{
  "overall_status": "FAIL",
  "exit_code": 1,
  "current_stage_dir": "Not resolved",
  "current_stage_name": "Not resolved",
  "report_generated_at": "2026-04-06T12:15:02.660Z",
  "failed_step_names": ["lint","ci:local"],
  "report_location": "docs/reports/LOCAL_CI_REPORT.md",
  "runtime_stage_resolved": false,
  "closure_gate_status": "BLOCKED",
  "ready_for_closure": false
}
LOCAL_CI_REPORT_METADATA_END -->

---

## Summary

Local CI failed. The closure gate is blocked until the listed failures are fixed and the command is rerun to regenerate this report.

---

## Resolved Stage / Runtime Context

| Field                    | Value                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current stage directory  | Not resolved                                                                                                                                      |
| Current stage name       | Not resolved                                                                                                                                      |
| Runtime stage resolved   | No                                                                                                                                                |
| Resolved runtime path    | Not resolved                                                                                                                                      |
| Resolution source        | fallback                                                                                                                                          |
| Destination rule         | `specs/runtime/<STAGE_DIR_NAME>/reports/LOCAL_CI_REPORT.md` when a current runtime stage is resolved; otherwise `docs/reports/LOCAL_CI_REPORT.md` |
| Resolved report location | docs/reports/LOCAL_CI_REPORT.md                                                                                                                   |

---

## Docker Check

| Check               | Command                                               | Status | Duration | Notes                |
| ------------------- | ----------------------------------------------------- | ------ | -------- | -------------------- |
| Docker availability | docker info --format Docker Engine {{.ServerVersion}} | PASS   | 1175ms   | Docker Engine 29.3.1 |

---

## Step Summary

| Step Number | Script Name | Command | Status | Duration |
| ----------- | ----------- | ------- | ------ | -------- |

| 0 | docker:availability | `docker info --format Docker Engine {{.ServerVersion}}` | PASS | 1175ms |
| 1 | validate:scripts:all | `bun run validate:scripts:all` | PASS | 5085ms |
| 2 | dev:generate:script-docs | `bun run dev:generate:script-docs` | PASS | 194ms |
| 3 | arch:guard | `bun run arch:guard` | PASS | 730ms |
| 4 | arch:type-safety-guard | `bun run arch:type-safety-guard` | PASS | 318ms |
| 5 | lint | `bun run lint` | FAIL | 1856ms |
| 6 | ci:local | `bun run ci:local` | FAIL | 794ms |

---

## Failed Steps

| Step Number | Script Name | Command | Failure Summary |
| ----------- | ----------- | ------- | --------------- |

| 5 | lint | `bun run lint` | Checked 2546 files in 1716ms. No fixes applied. |
| 6 | ci:local | `bun run ci:local` | [Policy Check/Policy Engine Check ] ⭐ Run Set up job |

**Failed Step Names:** lint, ci:local  
**Failed Step Count:** 2

---

## Detailed Failure Output

### Step 5 — lint

- Command: `bun run lint`
- Duration: 1856ms
- Summary: Checked 2546 files in 1716ms. No fixes applied.

```text
Checked 2546 files in 1716ms. No fixes applied.
Found 11 errors.

$ biome check .
specs/runtime/046-billing-and-invoices/.workflow-state.json:57:4 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    55 │     }
    56 │     }
  > 57 │   },
       │    ^
    58 │   "history": [
    59 │     {

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:58:3 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    56 │     }
    57 │   },
  > 58 │   "history": [
       │   ^^^^^^^^^
    59 │     {
    60 │       "event": "branch_created",

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:58:12 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    56 │     }
    57 │   },
  > 58 │   "history": [
       │            ^
    59 │     {
    60 │       "event": "branch_created",

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:58:14 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    56 │     }
    57 │   },
  > 58 │   "history": [
       │              ^
  > 59 │     {
        ...
  > 91 │     }
  > 92 │   ]
       │   ^
    93 │ }
    94 │

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:93:1 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    91 │     }
    92 │   ]
  > 93 │ }
       │ ^
    94 │

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:57:4 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    55 │     }
    56 │     }
  > 57 │   },
       │    ^
    58 │   "history": [
    59 │     {

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:58:3 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    56 │     }
    57 │   },
  > 58 │   "history": [
       │   ^^^^^^^^^
    59 │     {
    60 │       "event": "branch_created",

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:58:12 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    56 │     }
    57 │   },
  > 58 │   "history": [
       │            ^
    59 │     {
    60 │       "event": "branch_created",

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:58:14 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    56 │     }
    57 │   },
  > 58 │   "history": [
       │              ^
  > 59 │     {
        ...
  > 91 │     }
  > 92 │   ]
       │   ^
    93 │ }
    94 │

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json:93:1 parse ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × End of file expected

    91 │     }
    92 │   ]
  > 93 │ }
       │ ^
    94 │

  i Use an array for a sequence of values: `[1, 2]`


specs/runtime/046-billing-and-invoices/.workflow-state.json format ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Code formatting aborted due to parsing errors. To format code with errors, enable the 'formatter.formatWithErrors' option.


check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Some errors were emitted while running checks.


error: script "lint" exited with code 1
```

### Step 6 — ci:local

- Command: `bun run ci:local`
- Duration: 794ms
- Summary: [Policy Check/Policy Engine Check ] ⭐ Run Set up job

```text
[Policy Check/Policy Engine Check                              ] ⭐ Run Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Set up job
[Policy Check/Policy Engine Check                              ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Type Check                                                 ] ⭐ Run Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Type Check                                                 ] 🚀  Start image=catthehacker/ubuntu:act-latest
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Set up job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Set up job
[Zidney Architecture Governance/Architecture Governance Checks ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Set up job
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Set up job
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Set up job
[CI/AI-Guard — Architecture Boundaries                         ] 🚀  Start image=catthehacker/ubuntu:act-latest
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Script UX Validator — Preview                              ] ⭐ Run Set up job
[CI/Script UX Validator — Preview                              ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Trivy Security Scan                                        ] ⭐ Run Set up job
[CI/Repo Doctor — DX Health Checks                             ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Biome — Lint & Format                                      ] ⭐ Run Set up job
[CI/Biome — Lint & Format                                      ] 🚀  Start image=catthehacker/ubuntu:act-latest
[AI Context Layer Validation/AI Context Generation & Validation] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Trivy Security Scan                                        ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Type Check                                                 ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Policy Check/Policy Engine Check                              ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Trivy Security Scan                                        ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Script UX Validator — Preview                              ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Biome — Lint & Format                                      ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Script UX Validator — Preview                              ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Policy Check/Policy Engine Check                              ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Type Check                                                 ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Biome — Lint & Format                                      ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Trivy Security Scan                                        ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Policy Check/Policy Engine Check                              ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Biome — Lint & Format                                      ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Type Check                                                 ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Script UX Validator — Preview                              ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Trivy Security Scan                                        ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Hard Mode Guard/Hard Mode Workflow State                      ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[Hard Mode Guard/Hard Mode Workflow State                      ]   ❌  Failure - Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ] 🏁  Job failed
[CI/Biome — Lint & Format                                      ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[CI/Biome — Lint & Format                                      ]   ❌  Failure - Set up job
[CI/Biome — Lint & Format                                      ] 🏁  Job failed
[CI/AI-Guard — Architecture Boundaries                         ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[CI/AI-Guard — Architecture Boundaries                         ]   ❌  Failure - Set up job
[CI/AI-Guard — Architecture Boundaries                         ] 🏁  Job failed
[CI/Script UX Validator — Preview                              ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[CI/Script UX Validator — Preview                              ]   ❌  Failure - Set up job
[CI/Script UX Validator — Preview                              ] 🏁  Job failed
[CI/Repo Doctor — DX Health Checks                             ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[CI/Repo Doctor — DX Health Checks                             ]   ❌  Failure - Set up job
[CI/Repo Doctor — DX Health Checks                             ] 🏁  Job failed
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ❌  Failure - Set up job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] 🏁  Job failed
[Zidney Architecture Governance/Architecture Governance Checks ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[Zidney Architecture Governance/Architecture Governance Checks ]   ❌  Failure - Set up job
[Zidney Architecture Governance/Architecture Governance Checks ] 🏁  Job failed
[Policy Check/Policy Engine Check                              ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[Policy Check/Policy Engine Check                              ]   ❌  Failure - Set up job
[Policy Check/Policy Engine Check                              ] 🏁  Job failed
[AI Context Layer Validation/AI Context Generation & Validation] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[AI Context Layer Validation/AI Context Generation & Validation]   ❌  Failure - Set up job
[AI Context Layer Validation/AI Context Generation & Validation] 🏁  Job failed
[CI/Trivy Security Scan                                        ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[CI/Trivy Security Scan                                        ]   ❌  Failure - Set up job
[CI/Trivy Security Scan                                        ] 🏁  Job failed
[CI/Type Check                                                 ] failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
[CI/Type Check                                                 ]   ❌  Failure - Set up job
[CI/Type Check                                                 ] 🏁  Job failed

$ act --pull=false
time="2026-04-06T14:15:01+02:00" level=info msg="Using docker host 'unix:///var/run/docker.sock', and daemon socket 'unix:///var/run/docker.sock'"
level=warning msg= ⚠ You are using Apple M-series chip and you have not specified container architecture, you might encounter issues while running act. If so, try running it with '--container-architecture linux/amd64'. ⚠

time="2026-04-06T14:15:01+02:00" level=info msg="Start server on http://10.0.180.208:34567"
Error: failed to start container: Error response from daemon: cannot start a paused container, try unpause instead
error: script "ci:local" exited with code 1
```

---

## Workflow Guidance / Next Actions

1. If `FAIL` is `PASS` and `BLOCKED` is `PASS`, proceed with the orchestrator closure flow and preserve this report at `docs/reports/LOCAL_CI_REPORT.md`.
2. If any step failed, fix the blocking scripts or workflow jobs listed above, rerun `bun run ci:run-local`, and replace this report with the latest results.
3. If no current runtime stage could be resolved, keep this report under `docs/reports/LOCAL_CI_REPORT.md` until stage context is established.
4. If Docker failed before the workflow ran, start Docker, rerun the local CI command, and confirm the step summary is fully regenerated.

---

## Closure Gate Summary

| Gate Field                     | Value                                                                  |
| ------------------------------ | ---------------------------------------------------------------------- |
| Closure Gate Status            | BLOCKED                                                                |
| Ready for Orchestrator Closure | No                                                                     |
| Overall Local CI Status        | FAIL                                                                   |
| Exit Code                      | 1                                                                      |
| Failed Step Names              | lint, ci:local                                                         |
| Required Action                | Fix the failing steps (lint, ci:local) and rerun bun run ci:run-local. |

---

## Next Step

Use this report as the pre-closure validation artifact for the orchestrator. Proceed only when the closure gate is `PASS`.
