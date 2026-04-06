# Local CI Report

**Command:** bun run ci:run-local  
**Timestamp:** 2026-04-06T12:22:08.114Z  
**Status:** FAIL  
**Exit Code:** 1  
**Report Location:** specs/runtime/046-billing-and-invoices/reports/LOCAL_CI_REPORT.md

<!-- LOCAL_CI_REPORT_METADATA_START
{
  "overall_status": "FAIL",
  "exit_code": 1,
  "current_stage_dir": "specs/runtime/046-billing-and-invoices",
  "current_stage_name": "STAGE 46 – Billing & Invoices",
  "report_generated_at": "2026-04-06T12:22:08.114Z",
  "failed_step_names": ["ci:local"],
  "report_location": "specs/runtime/046-billing-and-invoices/reports/LOCAL_CI_REPORT.md",
  "runtime_stage_resolved": true,
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
| Current stage directory  | specs/runtime/046-billing-and-invoices                                                                                                            |
| Current stage name       | STAGE 46 – Billing & Invoices                                                                                                                     |
| Runtime stage resolved   | Yes                                                                                                                                               |
| Resolved runtime path    | specs/runtime/046-billing-and-invoices                                                                                                            |
| Resolution source        | git-branch                                                                                                                                        |
| Destination rule         | `specs/runtime/<STAGE_DIR_NAME>/reports/LOCAL_CI_REPORT.md` when a current runtime stage is resolved; otherwise `docs/reports/LOCAL_CI_REPORT.md` |
| Resolved report location | specs/runtime/046-billing-and-invoices/reports/LOCAL_CI_REPORT.md                                                                                 |

---

## Docker Check

| Check               | Command                                               | Status | Duration | Notes                |
| ------------------- | ----------------------------------------------------- | ------ | -------- | -------------------- |
| Docker availability | docker info --format Docker Engine {{.ServerVersion}} | PASS   | 607ms    | Docker Engine 29.3.1 |

---

## Step Summary

| Step Number | Script Name | Command | Status | Duration |
| ----------- | ----------- | ------- | ------ | -------- |

| 0 | docker:availability | `docker info --format Docker Engine {{.ServerVersion}}` | PASS | 607ms |
| 1 | validate:scripts:all | `bun run validate:scripts:all` | PASS | 3938ms |
| 2 | dev:generate:script-docs | `bun run dev:generate:script-docs` | PASS | 153ms |
| 3 | arch:guard | `bun run arch:guard` | PASS | 561ms |
| 4 | arch:type-safety-guard | `bun run arch:type-safety-guard` | PASS | 226ms |
| 5 | lint | `bun run lint` | PASS | 2027ms |
| 6 | ci:local | `bun run ci:local` | FAIL | 46168ms |

---

## Failed Steps

| Step Number | Script Name | Command | Failure Summary |
| ----------- | ----------- | ------- | --------------- |

| 6 | ci:local | `bun run ci:local` | [CI/Repo Doctor — DX Health Checks ] ⭐ Run Set up job |

**Failed Step Names:** ci:local  
**Failed Step Count:** 1

---

## Detailed Failure Output

### Step 6 — ci:local

- Command: `bun run ci:local`
- Duration: 46168ms
- Summary: [CI/Repo Doctor — DX Health Checks ] ⭐ Run Set up job

```text
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Set up job
[CI/Repo Doctor — DX Health Checks                             ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Type Check                                                 ] ⭐ Run Set up job
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Type Check                                                 ] 🚀  Start image=catthehacker/ubuntu:act-latest
[AI Context Layer Validation/AI Context Generation & Validation] 🚀  Start image=catthehacker/ubuntu:act-latest
[Policy Check/Policy Engine Check                              ] ⭐ Run Set up job
[CI/Biome — Lint & Format                                      ] ⭐ Run Set up job
[Policy Check/Policy Engine Check                              ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Biome — Lint & Format                                      ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Set up job
[CI/AI-Guard — Architecture Boundaries                         ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Script UX Validator — Preview                              ] ⭐ Run Set up job
[CI/Script UX Validator — Preview                              ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Trivy Security Scan                                        ] ⭐ Run Set up job
[CI/Trivy Security Scan                                        ] 🚀  Start image=catthehacker/ubuntu:act-latest
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Set up job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] 🚀  Start image=catthehacker/ubuntu:act-latest
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Set up job
[Zidney Architecture Governance/Architecture Governance Checks ] 🚀  Start image=catthehacker/ubuntu:act-latest
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Policy Check/Policy Engine Check                              ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Script UX Validator — Preview                              ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Type Check                                                 ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Biome — Lint & Format                                      ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Trivy Security Scan                                        ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Script UX Validator — Preview                              ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Policy Check/Policy Engine Check                              ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Trivy Security Scan                                        ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Type Check                                                 ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Biome — Lint & Format                                      ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Trivy Security Scan                                        ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Script UX Validator — Preview                              ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Policy Check/Policy Engine Check                              ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Type Check                                                 ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Biome — Lint & Format                                      ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Type Check                                                 ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[Policy Check/Policy Engine Check                              ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Script UX Validator — Preview                              ]   ✅  Success - Set up job
[CI/Type Check                                                 ]   ✅  Success - Set up job
[CI/Script UX Validator — Preview                              ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Type Check                                                 ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ✅  Success - Set up job
[CI/Biome — Lint & Format                                      ]   ✅  Success - Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Set up job
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Set up job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Biome — Lint & Format                                      ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Set up job
[Policy Check/Policy Engine Check                              ]   ✅  Success - Set up job
[AI Context Layer Validation/AI Context Generation & Validation]   ✅  Success - Set up job
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Set up job
[Zidney Architecture Governance/Architecture Governance Checks ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[Policy Check/Policy Engine Check                              ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v1
[CI/Repo Doctor — DX Health Checks                             ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/AI-Guard — Architecture Boundaries                         ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[AI Context Layer Validation/AI Context Generation & Validation]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Trivy Security Scan                                        ]   ✅  Success - Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Checkout
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Main Checkout [3.291375ms]
[CI/Trivy Security Scan                                        ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Resolve stage directory
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/stage] user= workdir=
[Hard Mode Guard/Hard Mode Workflow State                      ]   ❌  Failure - Main Resolve stage directory [204.890833ms]
[Hard Mode Guard/Hard Mode Workflow State                      ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/Script UX Validator — Preview                              ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Complete job
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Complete job
[Hard Mode Guard/Hard Mode Workflow State                      ] 🏁  Job failed
[CI/Type Check                                                 ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Main Checkout
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ✅  Success - Main Checkout [5.221875ms]
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Main Setup Bun
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Biome — Lint & Format                                      ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ❌  Failure - Main Setup Bun [1.026249s]
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Complete job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ✅  Success - Complete job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] 🏁  Job failed
[Policy Check/Policy Engine Check                              ] ⭐ Run Main Checkout repository
[Policy Check/Policy Engine Check                              ]   ✅  Success - Main Checkout repository [3.198667ms]
[Policy Check/Policy Engine Check                              ] ⭐ Run Main Setup Bun
[Policy Check/Policy Engine Check                              ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v1/ dst=/var/run/act/actions/oven-sh-setup-bun@v1/
[CI/Repo Doctor — DX Health Checks                             ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Policy Check/Policy Engine Check                              ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v1/dist/setup/index.js] user= workdir=
[Policy Check/Policy Engine Check                              ]   ❌  Failure - Main Setup Bun [992.825667ms]
[CI/AI-Guard — Architecture Boundaries                         ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Policy Check/Policy Engine Check                              ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[Policy Check/Policy Engine Check                              ] ⭐ Run Complete job
[Policy Check/Policy Engine Check                              ]   ✅  Success - Complete job
[Policy Check/Policy Engine Check                              ] 🏁  Job failed
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Main Checkout repository
[AI Context Layer Validation/AI Context Generation & Validation]   ✅  Success - Main Checkout repository [3.624667ms]
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Main Setup Bun
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Trivy Security Scan                                        ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[AI Context Layer Validation/AI Context Generation & Validation]   ❌  Failure - Main Setup Bun [1.097791292s]
[AI Context Layer Validation/AI Context Generation & Validation] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Complete job
[AI Context Layer Validation/AI Context Generation & Validation]   ✅  Success - Complete job
[AI Context Layer Validation/AI Context Generation & Validation] 🏁  Job failed
[CI/Script UX Validator — Preview                              ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Script UX Validator — Preview                              ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[CI/Type Check                                                 ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Type Check                                                 ] ⭐ Run Main Checkout
[CI/Type Check                                                 ]   ✅  Success - Main Checkout [3.283958ms]
[CI/Type Check                                                 ] ⭐ Run Main Setup Bun
[CI/Type Check                                                 ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Type Check                                                 ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Type Check                                                 ]   ❌  Failure - Main Setup Bun [1.2603265s]
[CI/Type Check                                                 ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/Type Check                                                 ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Type Check                                                 ] ⭐ Run Complete job
[CI/Type Check                                                 ]   ✅  Success - Complete job
[CI/Type Check                                                 ] 🏁  Job failed
[CI/Biome — Lint & Format                                      ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Checkout
[CI/Biome — Lint & Format                                      ]   ✅  Success - Main Checkout [5.193042ms]
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Setup Bun
[CI/Biome — Lint & Format                                      ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[Zidney Architecture Governance/Architecture Governance Checks ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ]   ❌  Failure - Main Setup Bun [1.461864542s]
[CI/Biome — Lint & Format                                      ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ] ⭐ Run Complete job
[CI/Biome — Lint & Format                                      ]   ✅  Success - Complete job
[CI/Biome — Lint & Format                                      ] 🏁  Job failed
[CI/Repo Doctor — DX Health Checks                             ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Main Checkout
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Main Checkout [6.446333ms]
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Main Setup Bun
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ]   ❌  Failure - Main Setup Bun [1.254455209s]
[CI/Repo Doctor — DX Health Checks                             ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Complete job
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Complete job
[CI/Repo Doctor — DX Health Checks                             ] 🏁  Job failed
[CI/AI-Guard — Architecture Boundaries                         ] Non-terminating error while running 'git clone': some refs were not updated
[CI/AI-Guard — Architecture Boundaries                         ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Trivy Security Scan                                        ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Trivy Security Scan                                        ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Checkout
[CI/Script UX Validator — Preview                              ]   ✅  Success - Main Checkout [4.184208ms]
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Setup Bun
[CI/Script UX Validator — Preview                              ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Script UX Validator — Preview                              ]   ❌  Failure - Main Setup Bun [1.099359834s]
[CI/Script UX Validator — Preview                              ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Annotate failures (GitHub UI)
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[CI/Script UX Validator — Preview                              ]   ❌  Failure - Main Annotate failures (GitHub UI) [129.089833ms]
[CI/Script UX Validator — Preview                              ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/Script UX Validator — Preview                              ] ⭐ Run Complete job
[CI/Script UX Validator — Preview                              ]   ✅  Success - Complete job
[CI/Script UX Validator — Preview                              ] 🏁  Job failed
[CI/AI-Guard — Architecture Boundaries                         ] Non-terminating error while running 'git clone': some refs were not updated
[CI/AI-Guard — Architecture Boundaries                         ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Trivy Security Scan                                        ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Trivy Security Scan                                        ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[Zidney Architecture Governance/Architecture Governance Checks ] Non-terminating error while running 'git clone': some refs were not updated
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Checkout repository
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Checkout repository [2.751417ms]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Setup Bun
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ❌  Failure - Main Setup Bun [1.064735167s]
[Zidney Architecture Governance/Architecture Governance Checks ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Upload Architecture Health Artifacts
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-upload-artifact@v4/ dst=/var/run/act/actions/actions-upload-artifact@v4/
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[node /var/run/act/actions/actions-upload-artifact@v4/dist/upload/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ❌  Failure - Main Upload Architecture Health Artifacts [951.909958ms]
[Zidney Architecture Governance/Architecture Governance Checks ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Publish Architecture Summary
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/11] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ❌  Failure - Main Publish Architecture Summary [223.334ms]
[Zidney Architecture Governance/Architecture Governance Checks ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/AI-Guard — Architecture Boundaries                         ] Non-terminating error while running 'git clone': some refs were not updated
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Checkout
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main Checkout [2.730666ms]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Upload AI Execution Validation Artifact
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-upload-artifact@v4/ dst=/var/run/act/actions/actions-upload-artifact@v4/
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Setup Bun
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Trivy Security Scan                                        ] ⭐ Run Main Checkout
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Checkout [3.0035ms]
[CI/Trivy Security Scan                                        ] ⭐ Run Main Setup Bun
[CI/Trivy Security Scan                                        ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ❌  Failure - Main Setup Bun [1.658780625s]
[CI/AI-Guard — Architecture Boundaries                         ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[node /var/run/act/actions/actions-upload-artifact@v4/dist/upload/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ❌  Failure - Main Upload AI Execution Validation Artifact [2.580860916s]
[Zidney Architecture Governance/Architecture Governance Checks ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Publish AI Execution Summary
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/14] user= workdir=
[CI/Trivy Security Scan                                        ]   ❌  Failure - Main Setup Bun [1.640579334s]
[Zidney Architecture Governance/Architecture Governance Checks ]   ❌  Failure - Main Publish AI Execution Summary [375.329ms]
[CI/Trivy Security Scan                                        ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[Zidney Architecture Governance/Architecture Governance Checks ] exitcode '127': command not found, please refer to https://github.com/nektos/act/issues/107 for more information
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Complete job
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Complete job
[CI/AI-Guard — Architecture Boundaries                         ] 🏁  Job failed
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Complete job
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Complete job
[Zidney Architecture Governance/Architecture Governance Checks ] 🏁  Job failed
[CI/Trivy Security Scan                                        ] ⭐ Run Complete job
[CI/Trivy Security Scan                                        ]   ✅  Success - Complete job
[CI/Trivy Security Scan                                        ] 🏁  Job failed

$ act --pull=false
time="2026-04-06T14:21:21+02:00" level=info msg="Using docker host 'unix:///var/run/docker.sock', and daemon socket 'unix:///var/run/docker.sock'"
level=warning msg= ⚠ You are using Apple M-series chip and you have not specified container architecture, you might encounter issues while running act. If so, try running it with '--container-architecture linux/amd64'. ⚠

time="2026-04-06T14:21:21+02:00" level=info msg="Start server on http://10.0.180.208:34567"
Error: Job 'AI Context Generation & Validation' failed
error: script "ci:local" exited with code 1
```

---

## Workflow Guidance / Next Actions

1. If `FAIL` is `PASS` and `BLOCKED` is `PASS`, proceed with the orchestrator closure flow and preserve this report at `specs/runtime/046-billing-and-invoices/reports/LOCAL_CI_REPORT.md`.
2. If any step failed, fix the blocking scripts or workflow jobs listed above, rerun `bun run ci:run-local`, and replace this report with the latest results.
3. If no current runtime stage could be resolved, keep this report under `docs/reports/LOCAL_CI_REPORT.md` until stage context is established.
4. If Docker failed before the workflow ran, start Docker, rerun the local CI command, and confirm the step summary is fully regenerated.

---

## Closure Gate Summary

| Gate Field                     | Value                                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| Closure Gate Status            | BLOCKED                                                          |
| Ready for Orchestrator Closure | No                                                               |
| Overall Local CI Status        | FAIL                                                             |
| Exit Code                      | 1                                                                |
| Failed Step Names              | ci:local                                                         |
| Required Action                | Fix the failing steps (ci:local) and rerun bun run ci:run-local. |

---

## Next Step

Use this report as the pre-closure validation artifact for the orchestrator. Proceed only when the closure gate is `PASS`.
