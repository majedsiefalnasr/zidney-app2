# Local CI Report

**Command:** bun run ci:run-local  
**Timestamp:** 2026-04-04T19:23:50.335Z  
**Status:** FAIL  
**Exit Code:** 1  
**Report Location:** specs/runtime/044-plans-and-subscriptions/reports/LOCAL_CI_REPORT.md

<!-- LOCAL_CI_REPORT_METADATA_START
{
  "overall_status": "FAIL",
  "exit_code": 1,
  "current_stage_dir": "specs/runtime/044-plans-and-subscriptions",
  "current_stage_name": "STAGE 44 – Plans & Subscriptions",
  "report_generated_at": "2026-04-04T19:23:50.335Z",
  "failed_step_names": ["ci:local"],
  "report_location": "specs/runtime/044-plans-and-subscriptions/reports/LOCAL_CI_REPORT.md",
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
| Current stage directory  | specs/runtime/044-plans-and-subscriptions                                                                                                         |
| Current stage name       | STAGE 44 – Plans & Subscriptions                                                                                                                  |
| Runtime stage resolved   | Yes                                                                                                                                               |
| Resolved runtime path    | specs/runtime/044-plans-and-subscriptions                                                                                                         |
| Resolution source        | git-branch                                                                                                                                        |
| Destination rule         | `specs/runtime/<STAGE_DIR_NAME>/reports/LOCAL_CI_REPORT.md` when a current runtime stage is resolved; otherwise `docs/reports/LOCAL_CI_REPORT.md` |
| Resolved report location | specs/runtime/044-plans-and-subscriptions/reports/LOCAL_CI_REPORT.md                                                                              |

---

## Docker Check

| Check               | Command                                               | Status | Duration | Notes                |
| ------------------- | ----------------------------------------------------- | ------ | -------- | -------------------- |
| Docker availability | docker info --format Docker Engine {{.ServerVersion}} | PASS   | 678ms    | Docker Engine 29.3.1 |

---

## Step Summary

| Step Number | Script Name | Command | Status | Duration |
| ----------- | ----------- | ------- | ------ | -------- |

| 0 | docker:availability | `docker info --format Docker Engine {{.ServerVersion}}` | PASS | 678ms |
| 1 | validate:scripts:all | `bun run validate:scripts:all` | PASS | 4048ms |
| 2 | dev:generate:script-docs | `bun run dev:generate:script-docs` | PASS | 189ms |
| 3 | arch:guard | `bun run arch:guard` | PASS | 679ms |
| 4 | arch:type-safety-guard | `bun run arch:type-safety-guard` | PASS | 253ms |
| 5 | lint | `bun run lint` | PASS | 2075ms |
| 6 | ci:local | `bun run ci:local` | FAIL | 553209ms |

---

## Failed Steps

| Step Number | Script Name | Command | Failure Summary |
| ----------- | ----------- | ------- | --------------- |

| 6 | ci:local | `bun run ci:local` | [Hard Mode Guard/Hard Mode Workflow State ] ⭐ Run Set up job |

**Failed Step Names:** ci:local  
**Failed Step Count:** 1

---

## Detailed Failure Output

### Step 6 — ci:local

- Command: `bun run ci:local`
- Duration: 553209ms
- Summary: [Hard Mode Guard/Hard Mode Workflow State ] ⭐ Run Set up job

```text
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Set up job
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Type Check                                                 ] ⭐ Run Set up job
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Set up job
[Zidney Architecture Governance/Architecture Governance Checks ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/AI-Guard — Architecture Boundaries                         ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Type Check                                                 ] 🚀  Start image=catthehacker/ubuntu:act-latest
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Set up job
[CI/Biome — Lint & Format                                      ] ⭐ Run Set up job
[CI/Biome — Lint & Format                                      ] 🚀  Start image=catthehacker/ubuntu:act-latest
[AI Context Layer Validation/AI Context Generation & Validation] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Trivy Security Scan                                        ] ⭐ Run Set up job
[CI/Trivy Security Scan                                        ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Set up job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Set up job
[CI/Repo Doctor — DX Health Checks                             ] 🚀  Start image=catthehacker/ubuntu:act-latest
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] 🚀  Start image=catthehacker/ubuntu:act-latest
[Policy Check/Policy Engine Check                              ] ⭐ Run Set up job
[Policy Check/Policy Engine Check                              ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Script UX Validator — Preview                              ] ⭐ Run Set up job
[CI/Script UX Validator — Preview                              ] 🚀  Start image=catthehacker/ubuntu:act-latest
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Script UX Validator — Preview                              ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Trivy Security Scan                                        ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Biome — Lint & Format                                      ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Type Check                                                 ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Policy Check/Policy Engine Check                              ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Trivy Security Scan                                        ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Script UX Validator — Preview                              ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Biome — Lint & Format                                      ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Type Check                                                 ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Policy Check/Policy Engine Check                              ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Script UX Validator — Preview                              ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Type Check                                                 ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Biome — Lint & Format                                      ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Policy Check/Policy Engine Check                              ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Trivy Security Scan                                        ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[Policy Check/Policy Engine Check                              ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Type Check                                                 ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Biome — Lint & Format                                      ]   ✅  Success - Set up job
[CI/Trivy Security Scan                                        ]   ✅  Success - Set up job
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Set up job
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Set up job
[CI/Script UX Validator — Preview                              ]   ✅  Success - Set up job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ✅  Success - Set up job
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Set up job
[AI Context Layer Validation/AI Context Generation & Validation]   ✅  Success - Set up job
[Policy Check/Policy Engine Check                              ]   ✅  Success - Set up job
[CI/Type Check                                                 ]   ✅  Success - Set up job
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Set up job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[Zidney Architecture Governance/Architecture Governance Checks ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[AI Context Layer Validation/AI Context Generation & Validation]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Biome — Lint & Format                                      ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[Policy Check/Policy Engine Check                              ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v1
[CI/Repo Doctor — DX Health Checks                             ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Trivy Security Scan                                        ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/AI-Guard — Architecture Boundaries                         ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Script UX Validator — Preview                              ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Type Check                                                 ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Checkout
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Main Checkout [4.287417ms]
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Resolve stage directory
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/stage] user= workdir=
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Main Resolve stage directory [304.916291ms]
[Hard Mode Guard/Hard Mode Workflow State                      ]   ⚙  ::set-output:: stage_dir=specs/runtime/044-plans-and-subscriptions
[Hard Mode Guard/Hard Mode Workflow State                      ]   ⚙  ::set-output:: state_file=specs/runtime/044-plans-and-subscriptions/.workflow-state.json
[Hard Mode Guard/Hard Mode Workflow State                      ]   ⚙  ::set-output:: branch=044-plans-and-subscriptions
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Main Checkout
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Validate state file
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ✅  Success - Main Checkout [3.65925ms]
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/2] user= workdir=
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Main Setup Bun
[Zidney Architecture Governance/Architecture Governance Checks ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Main Validate state file [791.623458ms]
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Validate governance authority files
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Main Checkout repository
[AI Context Layer Validation/AI Context Generation & Validation]   ✅  Success - Main Checkout repository [3.029584ms]
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Biome — Lint & Format                                      ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Main Validate governance authority files [655.179708ms]
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Main Setup Bun
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[Policy Check/Policy Engine Check                              ] ⭐ Run Main Checkout repository
[Policy Check/Policy Engine Check                              ]   ✅  Success - Main Checkout repository [7.350666ms]
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Validate protected authority files are not unexpectedly modified
[CI/Repo Doctor — DX Health Checks                             ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/4] user= workdir=
[Policy Check/Policy Engine Check                              ] ⭐ Run Main Setup Bun
[Policy Check/Policy Engine Check                              ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v1/ dst=/var/run/act/actions/oven-sh-setup-bun@v1/
[CI/Trivy Security Scan                                        ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ✅  Success - Main Setup Bun [3.342758459s]
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ⚙  ::set-output:: cache-hit=true
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/AI-Guard — Architecture Boundaries                         ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ⚙  ::add-path:: /root/.bun/bin
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Main Install dependencies
[CI/Script UX Validator — Preview                              ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Policy Check/Policy Engine Check                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v1/dist/setup/index.js] user= workdir=
[CI/Type Check                                                 ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Main Validate protected authority files are not unexpectedly modified [3.032383875s]
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Validate stage file status block
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/2] user= workdir=
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/5] user= workdir=
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Main Validate stage file status block [563.254708ms]
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Validate step consistency
[AI Context Layer Validation/AI Context Generation & Validation]   ✅  Success - Main Setup Bun [5.211480666s]
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[AI Context Layer Validation/AI Context Generation & Validation]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[AI Context Layer Validation/AI Context Generation & Validation]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[AI Context Layer Validation/AI Context Generation & Validation]   ⚙  ::set-output:: cache-hit=true
[AI Context Layer Validation/AI Context Generation & Validation]   ⚙  ::set-output:: bun-version=1.3.11
[AI Context Layer Validation/AI Context Generation & Validation]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[AI Context Layer Validation/AI Context Generation & Validation]   ⚙  ::add-path:: /root/.bun/bin
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Main Validate step consistency [517.92375ms]
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Main Install dependencies
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Main Validate directory structure
[Hard Mode Guard/Hard Mode Workflow State                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/7] user= workdir=
[Hard Mode Guard/Hard Mode Workflow State                      ]   ❌  Failure - Main Validate directory structure [454.285916ms]
[Hard Mode Guard/Hard Mode Workflow State                      ] exitcode '1': failure
[Zidney Architecture Governance/Architecture Governance Checks ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[Hard Mode Guard/Hard Mode Workflow State                      ] ⭐ Run Complete job
[Hard Mode Guard/Hard Mode Workflow State                      ]   ✅  Success - Complete job
[Hard Mode Guard/Hard Mode Workflow State                      ] 🏁  Job failed
[AI Context Layer Validation/AI Context Generation & Validation]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/2] user= workdir=
[AI Context Layer Validation/AI Context Generation & Validation]   ❌  Failure - Main Install dependencies [4.115131416s]
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ❌  Failure - Main Install dependencies [7.449376833s]
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] exitcode '1': failure
[AI Context Layer Validation/AI Context Generation & Validation] exitcode '1': failure
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] ⭐ Run Complete job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ]   ✅  Success - Complete job
[Type Safety Enforcement/TypeScript — Strict Mode Check        ] 🏁  Job failed
[CI/Biome — Lint & Format                                      ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Checkout
[CI/Biome — Lint & Format                                      ]   ✅  Success - Main Checkout [3.758917ms]
[AI Context Layer Validation/AI Context Generation & Validation] ⭐ Run Complete job
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Setup Bun
[AI Context Layer Validation/AI Context Generation & Validation]   ✅  Success - Complete job
[AI Context Layer Validation/AI Context Generation & Validation] 🏁  Job failed
[CI/Biome — Lint & Format                                      ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ]   ✅  Success - Main Setup Bun [1.652510833s]
[CI/Biome — Lint & Format                                      ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/Biome — Lint & Format                                      ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/Biome — Lint & Format                                      ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/Biome — Lint & Format                                      ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/Biome — Lint & Format                                      ]   ⚙  ::set-output:: cache-hit=true
[CI/Biome — Lint & Format                                      ]   ⚙  ::add-path:: /root/.bun/bin
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Cache Bun install packages
[CI/Biome — Lint & Format                                      ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[CI/Repo Doctor — DX Health Checks                             ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Main Checkout
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Main Checkout [2.985334ms]
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Main Setup Bun
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ]   ⚙  ***
[CI/Biome — Lint & Format                                      ]   ✅  Success - Main Cache Bun install packages [3.347764833s]
[CI/Biome — Lint & Format                                      ]   ⚙  ::set-output:: cache-hit=false
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Install dependencies
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Main Setup Bun [2.4259985s]
[CI/Repo Doctor — DX Health Checks                             ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/Repo Doctor — DX Health Checks                             ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/Repo Doctor — DX Health Checks                             ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/Repo Doctor — DX Health Checks                             ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/Repo Doctor — DX Health Checks                             ]   ⚙  ::set-output:: cache-hit=true
[CI/Repo Doctor — DX Health Checks                             ]   ⚙  ::add-path:: /root/.bun/bin
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Main Cache Bun install packages
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[CI/Trivy Security Scan                                        ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Trivy Security Scan                                        ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Biome — Lint & Format                                      ]   ✅  Success - Main Install dependencies [2.59237125s]
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Build packages (lightweight)
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/4] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ]   ⚙  ***
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Main Cache Bun install packages [4.643397417s]
[CI/Repo Doctor — DX Health Checks                             ]   ⚙  ::set-output:: cache-hit=false
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Main Install dependencies
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ] Non-terminating error while running 'git clone': some refs were not updated
[CI/AI-Guard — Architecture Boundaries                         ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Main Install dependencies [1.542082s]
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Main Run repo:doctor
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/4] user= workdir=
[CI/Script UX Validator — Preview                              ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Script UX Validator — Preview                              ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[CI/Type Check                                                 ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Type Check                                                 ] ⭐ Run Main Checkout
[CI/Type Check                                                 ]   ✅  Success - Main Checkout [3.438125ms]
[CI/Type Check                                                 ] ⭐ Run Main Setup Bun
[CI/Type Check                                                 ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[Zidney Architecture Governance/Architecture Governance Checks ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Type Check                                                 ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[Policy Check/Policy Engine Check                              ]   ✅  Success - Main Setup Bun [34.358351708s]
[Policy Check/Policy Engine Check                              ]   ⚙  ::set-output:: bun-version=1.3.11
[Policy Check/Policy Engine Check                              ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[Policy Check/Policy Engine Check                              ]   ⚙  ::set-output:: cache-hit=false
[Policy Check/Policy Engine Check                              ]   ⚙  ::add-path:: /root/.bun/bin
[Policy Check/Policy Engine Check                              ] ⭐ Run Main Install dependencies
[CI/Type Check                                                 ]   ✅  Success - Main Setup Bun [1.964456875s]
[CI/Type Check                                                 ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/Type Check                                                 ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/Type Check                                                 ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/Type Check                                                 ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/Type Check                                                 ]   ⚙  ::set-output:: cache-hit=true
[CI/Type Check                                                 ]   ⚙  ::add-path:: /root/.bun/bin
[CI/Type Check                                                 ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Type Check                                                 ] ⭐ Run Main Cache Bun install packages
[CI/Type Check                                                 ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[Policy Check/Policy Engine Check                              ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/2] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ]   🚧  ::warning::Slow execution: 11615ms
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Main Run repo:doctor [13.0889075s]
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Post Cache Bun install packages
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/save/index.js] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Post Cache Bun install packages [585.83275ms]
[CI/Trivy Security Scan                                        ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Trivy Security Scan                                        ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Post Setup Bun
[Policy Check/Policy Engine Check                              ]   ✅  Success - Main Install dependencies [5.053432208s]
[Policy Check/Policy Engine Check                              ] ⭐ Run Main Run Policy Check (full mode with JSON output)
[CI/Repo Doctor — DX Health Checks                             ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/cache-save/index.js] user= workdir=
[CI/Type Check                                                 ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Post Setup Bun [1.415253s]
[CI/Biome — Lint & Format                                      ]   ✅  Success - Main Build packages (lightweight) [21.814456417s]
[CI/Repo Doctor — DX Health Checks                             ] ⭐ Run Complete job
[CI/Repo Doctor — DX Health Checks                             ] Cleaning up container for job Repo Doctor — DX Health Checks
[CI/Repo Doctor — DX Health Checks                             ]   ✅  Success - Complete job
[CI/Repo Doctor — DX Health Checks                             ] 🏁  Job succeeded
[CI/Type Check                                                 ]   ⚙  ***
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Install redis CLI (redis-tools)
[CI/Type Check                                                 ]   ✅  Success - Main Cache Bun install packages [6.380616417s]
[Policy Check/Policy Engine Check                              ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Type Check                                                 ]   ⚙  ::set-output:: cache-hit=true
[CI/Type Check                                                 ] ⭐ Run Main Install dependencies
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[bash --noprofile --norc -e -o pipefail /var/run/act/workflow/5.sh] user= workdir=
[CI/Type Check                                                 ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ] Non-terminating error while running 'git clone': some refs were not updated
[CI/AI-Guard — Architecture Boundaries                         ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Type Check                                                 ]   ✅  Success - Main Install dependencies [2.195974542s]
[CI/Type Check                                                 ] ⭐ Run Main Build packages (lightweight)
[CI/Type Check                                                 ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/4] user= workdir=
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Checkout
[CI/Script UX Validator — Preview                              ]   ✅  Success - Main Checkout [3.716208ms]
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Setup Bun
[CI/Script UX Validator — Preview                              ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Script UX Validator — Preview                              ]   ✅  Success - Main Setup Bun [2.143171s]
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: cache-hit=true
[CI/Script UX Validator — Preview                              ]   ⚙  ::add-path:: /root/.bun/bin
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Cache Bun install packages
[CI/Script UX Validator — Preview                              ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[Zidney Architecture Governance/Architecture Governance Checks ] Non-terminating error while running 'git clone': some refs were not updated
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Checkout repository
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Checkout repository [3.991959ms]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Setup Bun
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Trivy Security Scan                                        ] ⭐ Run Main Checkout
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Checkout [4.588292ms]
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Trivy Security Scan                                        ] ⭐ Run Main Setup Bun
[CI/Trivy Security Scan                                        ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Setup Bun [3.130122166s]
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: cache-hit=true
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: bun-version=1.3.11
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::add-path:: /root/.bun/bin
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Install dependencies
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/2] user= workdir=
[CI/Script UX Validator — Preview                              ]   ⚙  ***
[CI/Script UX Validator — Preview                              ]   ✅  Success - Main Cache Bun install packages [6.835250292s]
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Setup Bun [2.963830583s]
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: cache-hit=true
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: cache-hit=true
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/Trivy Security Scan                                        ]   ⚙  ::add-path:: /root/.bun/bin
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Install dependencies
[CI/AI-Guard — Architecture Boundaries                         ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Checkout
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main Checkout [5.024209ms]
[CI/Biome — Lint & Format                                      ]   ✅  Success - Main Install redis CLI (redis-tools) [16.936027125s]
[CI/Trivy Security Scan                                        ] ⭐ Run Main Cache Bun install packages
[CI/Trivy Security Scan                                        ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Setup Bun
[CI/Biome — Lint & Format                                      ] ⭐ Run Main Run Biome lint + format check
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main Setup Bun [2.97661025s]
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Install dependencies [6.540321541s]
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ::set-output:: cache-hit=true
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ::add-path:: /root/.bun/bin
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Build and Validate GitNexus Context
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Cache Bun install packages
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[CI/Trivy Security Scan                                        ]   ⚙  ***
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Cache Bun install packages [5.889440583s]
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: cache-hit=true
[CI/Trivy Security Scan                                        ] ⭐ Run Main Install dependencies
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Script UX Validator — Preview                              ]   ✅  Success - Main Install dependencies [8.681127042s]
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Build and Validate GitNexus Context [3.621231625s]
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Run Script UX Validator (CI auto preview mode)
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Verify AI Bootstrap Exists
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ***
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main Cache Bun install packages [4.431575709s]
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ::set-output:: cache-hit=true
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Install dependencies
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/script_ux] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/4] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Verify AI Bootstrap Exists [2.457749167s]
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Install dependencies [4.863275083s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Run Zidney AI Guard
[CI/Trivy Security Scan                                        ] ⭐ Run Main Restore Trivy cache
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Trivy Security Scan                                        ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[CI/Script UX Validator — Preview                              ]   ✅  Success - Main Run Script UX Validator (CI auto preview mode) [5.46411175s]
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Upload Script UX report
[CI/Script UX Validator — Preview                              ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-upload-artifact@v4/ dst=/var/run/act/actions/actions-upload-artifact@v4/
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/5] user= workdir=
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Run Zidney AI Guard [5.683819333s]
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-upload-artifact@v4/dist/upload/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main Install dependencies [8.033141334s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Run Infrastructure Audit (full repo architecture audit)
[CI/Trivy Security Scan                                        ]   ⚙  ***
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Script UX Validator — Preview                              ]   ✅  Success - Main Upload Script UX report [4.964246584s]
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: artifact-id=3267074769
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: artifact-digest=25fb0480cfbef8fe204a5dca83a68cbb16a8a2f6a54eab817f3844e8cbb90b8b
[CI/Script UX Validator — Preview                              ]   ⚙  ::set-output:: artifact-url=https://github.com/majedsiefalnasr/zidney-app2/actions/runs/1/artifacts/3267074769
[CI/Biome — Lint & Format                                      ]   ✅  Success - Main Run Biome lint + format check [19.782960459s]
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Restore ai-context artifacts cache (T086)
[CI/Script UX Validator — Preview                              ] ⭐ Run Main Annotate failures (GitHub UI)
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[CI/Biome — Lint & Format                                      ] ⭐ Run Post Cache Bun install packages
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/save/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ]   ✅  Success - Post Cache Bun install packages [1.171512125s]
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[CI/Biome — Lint & Format                                      ] ⭐ Run Post Setup Bun
[CI/Script UX Validator — Preview                              ]   ✅  Success - Main Annotate failures (GitHub UI) [3.691477041s]
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Script UX Validator — Preview                              ] ⭐ Run Post Cache Bun install packages
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/save/index.js] user= workdir=
[CI/Biome — Lint & Format                                      ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/cache-save/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[CI/Script UX Validator — Preview                              ]   ✅  Success - Post Cache Bun install packages [536.81725ms]
[CI/Script UX Validator — Preview                              ] ⭐ Run Post Setup Bun
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ***
[CI/Biome — Lint & Format                                      ]   ✅  Success - Post Setup Bun [2.742084458s]
[CI/Biome — Lint & Format                                      ] ⭐ Run Complete job
[CI/Biome — Lint & Format                                      ] Cleaning up container for job Biome — Lint & Format
[CI/Biome — Lint & Format                                      ]   ✅  Success - Complete job
[CI/Biome — Lint & Format                                      ] 🏁  Job succeeded
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main Restore ai-context artifacts cache (T086) [6.7676365s]
[CI/AI-Guard — Architecture Boundaries                         ]   ⚙  ::set-output:: cache-hit=false
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main module-boundary-validation
[CI/Script UX Validator — Preview                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/cache-save/index.js] user= workdir=
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Restore Trivy cache [16.546595875s]
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: cache-hit=true
[CI/Trivy Security Scan                                        ] ⭐ Run Main Install Trivy
[CI/Script UX Validator — Preview                              ]   ✅  Success - Post Setup Bun [2.292113333s]
[CI/Script UX Validator — Preview                              ] ⭐ Run Complete job
[CI/Script UX Validator — Preview                              ] Cleaning up container for job Script UX Validator — Preview
[CI/Script UX Validator — Preview                              ]   ✅  Success - Complete job
[CI/Script UX Validator — Preview                              ] 🏁  Job succeeded
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/5] user= workdir=
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[bash --noprofile --norc -e -o pipefail /var/run/act/workflow/5.sh] user= workdir=
[CI/Type Check                                                 ]   ✅  Success - Main Build packages (lightweight) [45.220240583s]
[CI/Type Check                                                 ] ⭐ Run Main Type check source
[CI/Type Check                                                 ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/5] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   🚧  ::warning::Slow execution: 4860ms
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main module-boundary-validation [7.481262542s]
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Generate ai-context on cache miss
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main Generate ai-context on cache miss [699.646042ms]
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main AI Agent Runtime Status Check
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/7] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main AI Agent Runtime Status Check [646.964917ms]
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Main Save ai-context artifacts cache (T087)
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache-save@v4/ dst=/var/run/act/actions/actions-cache-save@v4/
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 16378ms
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Run Infrastructure Audit (full repo architecture audit) [21.436727667s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Run Architecture Diff (PR-specific architecture drift check)
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/7] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache-save@v4/dist/save-only/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Main Save ai-context artifacts cache (T087) [3.035683042s]
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Post Restore ai-context artifacts cache (T086)
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/save/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Post Restore ai-context artifacts cache (T086) [821.729459ms]
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Post Cache Bun install packages
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/save/index.js] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Post Cache Bun install packages [363.846834ms]
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Post Setup Bun
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 4539ms
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Run Architecture Diff (PR-specific architecture drift check) [5.595856792s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Run Architecture Health
[CI/AI-Guard — Architecture Boundaries                         ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/cache-save/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/8] user= workdir=
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Post Setup Bun [1.332681125s]
[CI/AI-Guard — Architecture Boundaries                         ] ⭐ Run Complete job
[CI/AI-Guard — Architecture Boundaries                         ] Cleaning up container for job AI-Guard — Architecture Boundaries
[CI/AI-Guard — Architecture Boundaries                         ]   ✅  Success - Complete job
[CI/AI-Guard — Architecture Boundaries                         ] 🏁  Job succeeded
[CI/Type Check                                                 ]   ✅  Success - Main Type check source [30.544519334s]
[CI/Type Check                                                 ] ⭐ Run Main Type check tests
[CI/Type Check                                                 ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Run Architecture Health [18.974408208s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Run Script Validation (naming, broken refs, registry)
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/9] user= workdir=
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Install Trivy [40.500381833s]
[CI/Trivy Security Scan                                        ] ⭐ Run Main Run Trivy Security Scan
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 8214ms
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 7780ms
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 18970ms
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Run Script Validation (naming, broken refs, registry) [19.768367792s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Upload Architecture Health Artifacts
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-upload-artifact@v4/ dst=/var/run/act/actions/actions-upload-artifact@v4/
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-upload-artifact@v4/dist/upload/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Upload Architecture Health Artifacts [1.878380333s]
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: artifact-id=1917935213
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: artifact-digest=04af36d151e2d5d1ebed568db8893412b9e881fe320e9c4a453541466088df3b
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: artifact-url=https://github.com/majedsiefalnasr/zidney-app2/actions/runs/1/artifacts/1917935213
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Publish Architecture Summary
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/11] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Publish Architecture Summary [681.130833ms]
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  Summary - ## Zidney Architecture Governance Report

Infrastructure audit report not found.

### Architecture Health
# Architecture Health Summary

- Score: 96
- Health State: EXCELLENT
- Verdict: PASS
- Threshold: 80

## Findings
- **MEDIUM** gitnexus query: GitNexus query failed during architecture-health enrichment.
- **MEDIUM** gitnexus impact: GitNexus impact failed during architecture-health enrichment.

## Signals
- dependency_integrity: PASS (0 findings, delta 0)
- layer_integrity: PASS (0 findings, delta 0)
- circular_dependency_risk: PASS (0 findings, delta 0)
- type_safety_governance: PASS (0 findings, delta 0)
- architecture_drift: WARN (2 findings, delta 4)
- intelligence_synchronization: PASS (0 findings, delta 0)
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Run AI Execution Validation
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/12] user= workdir=
[CI/Type Check                                                 ]   ✅  Success - Main Type check tests [28.847945959s]
[CI/Type Check                                                 ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Type Check                                                 ] ⭐ Run Post Cache Bun install packages
[CI/Type Check                                                 ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/save/index.js] user= workdir=
[CI/Type Check                                                 ]   ✅  Success - Post Cache Bun install packages [405.744708ms]
[CI/Type Check                                                 ] ⭐ Run Post Setup Bun
[CI/Type Check                                                 ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/cache-save/index.js] user= workdir=
[CI/Type Check                                                 ]   ✅  Success - Post Setup Bun [1.321117792s]
[CI/Type Check                                                 ] ⭐ Run Complete job
[CI/Type Check                                                 ] Cleaning up container for job Type Check
[CI/Type Check                                                 ]   ✅  Success - Complete job
[CI/Type Check                                                 ] 🏁  Job succeeded
[Policy Check/Policy Engine Check                              ]   🚧  ::warning::Slow execution: 113991ms
[Policy Check/Policy Engine Check                              ]   ✅  Success - Main Run Policy Check (full mode with JSON output) [1m56.148719958s]
[Policy Check/Policy Engine Check                              ] ⭐ Run Post Setup Bun
[Policy Check/Policy Engine Check                              ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v1/dist/cache-save/index.js] user= workdir=
[Policy Check/Policy Engine Check                              ]   ✅  Success - Post Setup Bun [524.315584ms]
[Policy Check/Policy Engine Check                              ] ⭐ Run Complete job
[Policy Check/Policy Engine Check                              ] Cleaning up container for job Policy Engine Check
[Policy Check/Policy Engine Check                              ]   ✅  Success - Complete job
[Policy Check/Policy Engine Check                              ] 🏁  Job succeeded
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 16436ms
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Run AI Execution Validation [17.40525325s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Upload AI Execution Validation Artifact
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-upload-artifact@v4/ dst=/var/run/act/actions/actions-upload-artifact@v4/
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-upload-artifact@v4/dist/upload/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Upload AI Execution Validation Artifact [2.028102541s]
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: artifact-id=32812181
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: artifact-digest=de2e4f185c7905d3b2c36f745b2cebd36ff8650cf0769d4779f7cfa28f6f3006
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: artifact-url=https://github.com/majedsiefalnasr/zidney-app2/actions/runs/1/artifacts/32812181
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Publish AI Execution Summary
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/14] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Publish AI Execution Summary [574.25925ms]
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  Summary - ## AI Execution Validation Report

### Latest Execution Log
~~ ~json
{
  "execution_id": "1775330235187-133c8eb8",
  "task_id": "133c8eb86cf81347",
  "timestamp": "2026-04-04T19:17:31.618Z",
  "command": "ai:validate",
  "skills_activated": [],
  "files_modified": [],
  "architecture_violations": 0,
  "validation_result": "pass",
  "execution_duration_ms": 16433,
  "error": null
}~~ ~
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Validate Script Naming Convention
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/15] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Validate Script Naming Convention [525.57975ms]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Validate Script Usages (no broken or orphan references)
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/16] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Validate Script Usages (no broken or orphan references) [2.145878291s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Validate Script Infrastructure (headers + registry freshness)
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/17] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Validate Script Infrastructure (headers + registry freshness) [702.3235ms]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Verify Script Registry Generation
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/18] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Verify Script Registry Generation [853.703666ms]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Restore Trivy cache
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ***
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Restore Trivy cache [5.355521292s]
[Zidney Architecture Governance/Architecture Governance Checks ]   ⚙  ::set-output:: cache-hit=true
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Install Trivy
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash --noprofile --norc -e -o pipefail /var/run/act/workflow/20.sh] user= workdir=
[CI/Trivy Security Scan                                        ]   🚧  ::warning::Slow execution: 99479ms
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Run Trivy Security Scan [1m40.471704s]
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Trivy Security Scan                                        ] ⭐ Run Main Upload sanitized Trivy report
[CI/Trivy Security Scan                                        ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-upload-artifact@v4/ dst=/var/run/act/actions/actions-upload-artifact@v4/
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-upload-artifact@v4/dist/upload/index.js] user= workdir=
[CI/Trivy Security Scan                                        ]   ✅  Success - Main Upload sanitized Trivy report [1.421427167s]
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: artifact-id=2361144800
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: artifact-digest=02099004208e80d9309af1fb933214c238816c56ee4aef241376c989fee9dbf2
[CI/Trivy Security Scan                                        ]   ⚙  ::set-output:: artifact-url=https://github.com/majedsiefalnasr/zidney-app2/actions/runs/1/artifacts/2361144800
[CI/Trivy Security Scan                                        ] ⭐ Run Post Restore Trivy cache
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/save/index.js] user= workdir=
[CI/Trivy Security Scan                                        ]   ✅  Success - Post Restore Trivy cache [385.997792ms]
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Trivy Security Scan                                        ] ⭐ Run Post Cache Bun install packages
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/save/index.js] user= workdir=
[CI/Trivy Security Scan                                        ]   ✅  Success - Post Cache Bun install packages [281.037375ms]
[CI/Trivy Security Scan                                        ] ⭐ Run Post Setup Bun
[CI/Trivy Security Scan                                        ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/cache-save/index.js] user= workdir=
[CI/Trivy Security Scan                                        ]   ✅  Success - Post Setup Bun [454.613375ms]
[CI/Trivy Security Scan                                        ] ⭐ Run Complete job
[CI/Trivy Security Scan                                        ] Cleaning up container for job Trivy Security Scan
[CI/Trivy Security Scan                                        ]   ✅  Success - Complete job
[CI/Trivy Security Scan                                        ] 🏁  Job succeeded
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Main Install Trivy [57.923505417s]
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Main Unified Governance Gate
[Zidney Architecture Governance/Architecture Governance Checks ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/21] user= workdir=
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 6342ms
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 3515ms
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 3167ms
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 11588ms
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 72730ms
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 115437ms
[Zidney Architecture Governance/Architecture Governance Checks ]   ❗  ::error::Governance gate failed.
[Zidney Architecture Governance/Architecture Governance Checks ]   🚧  ::warning::Slow execution: 115612ms
[Zidney Architecture Governance/Architecture Governance Checks ]   ❗  ::error::Governance gate CI failed.
[Zidney Architecture Governance/Architecture Governance Checks ]   ❌  Failure - Main Unified Governance Gate [1m56.740442042s]
[Zidney Architecture Governance/Architecture Governance Checks ] exitcode '1': failure
[Zidney Architecture Governance/Architecture Governance Checks ] ⭐ Run Complete job
[Zidney Architecture Governance/Architecture Governance Checks ]   ✅  Success - Complete job
[Zidney Architecture Governance/Architecture Governance Checks ] 🏁  Job failed
[CI/Build Verification                                          ] ⭐ Run Set up job
[CI/Unit Tests                                                  ] ⭐ Run Set up job
[CI/Integration Tests                                           ] ⭐ Run Set up job
[CI/Integration Tests                                           ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Unit Tests                                                  ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Build Verification                                          ] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/Integration Tests                                           ]   🐳  docker pull image=postgres:15-alpine platform= username= forcePull=false
[CI/Build Verification                                          ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Integration Tests                                           ]   🐳  docker pull image=redis:7-alpine platform= username= forcePull=false
[CI/Unit Tests                                                  ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Unit Tests                                                  ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Build Verification                                          ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Integration Tests                                           ]   🐳  docker pull image=catthehacker/ubuntu:act-latest platform= username= forcePull=false
[CI/Integration Tests                                           ] Cleaning up services for job Integration Tests
[CI/Unit Tests                                                  ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Build Verification                                          ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Integration Tests                                           ] Cleaning up network for job Integration Tests, and network name is: act-CI-Integration-Tests-b344348caf92be812d385d0f699642ec8cf02a2c753d340a4c3d2e6e5d9e3e34-integration-tests-network
[CI/Integration Tests                                           ]   🐳  docker pull image=postgres:15-alpine platform= username= forcePull=false
[CI/Integration Tests                                           ]   🐳  docker pull image=redis:7-alpine platform= username= forcePull=false
[CI/Integration Tests                                           ]   🐳  docker create image=redis:7-alpine platform= entrypoint=[] cmd=[] network="act-CI-Integration-Tests-b344348caf92be812d385d0f699642ec8cf02a2c753d340a4c3d2e6e5d9e3e34-integration-tests-network"
[CI/Integration Tests                                           ]   🐳  docker create image=postgres:15-alpine platform= entrypoint=[] cmd=[] network="act-CI-Integration-Tests-b344348caf92be812d385d0f699642ec8cf02a2c753d340a4c3d2e6e5d9e3e34-integration-tests-network"
[CI/Integration Tests                                           ]   🐳  docker run image=redis:7-alpine platform= entrypoint=[] cmd=[] network="act-CI-Integration-Tests-b344348caf92be812d385d0f699642ec8cf02a2c753d340a4c3d2e6e5d9e3e34-integration-tests-network"
[CI/Integration Tests                                           ]   🐳  docker run image=postgres:15-alpine platform= entrypoint=[] cmd=[] network="act-CI-Integration-Tests-b344348caf92be812d385d0f699642ec8cf02a2c753d340a4c3d2e6e5d9e3e34-integration-tests-network"
[CI/Integration Tests                                           ]   🐳  docker create image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Unit Tests                                                  ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Build Verification                                          ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Unit Tests                                                  ]   ✅  Success - Set up job
[CI/Build Verification                                          ]   ✅  Success - Set up job
[CI/Unit Tests                                                  ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Build Verification                                          ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Integration Tests                                           ]   🐳  docker run image=catthehacker/ubuntu:act-latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[] network="host"
[CI/Integration Tests                                           ] container health of 844a96820c2006f29668a826bd8566defe5eacbd0eef9734bc415a72b5b99f6c (redis:7-alpine) is starting
[CI/Integration Tests                                           ] container health of 6edbe29a8d3611fdfa21b775c2edbaf477fa99da774259d007dcbc07136179b5 (postgres:15-alpine) is starting
[CI/Unit Tests                                                  ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Build Verification                                          ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Integration Tests                                           ] container health of 844a96820c2006f29668a826bd8566defe5eacbd0eef9734bc415a72b5b99f6c (redis:7-alpine) is starting
[CI/Integration Tests                                           ] container health of 6edbe29a8d3611fdfa21b775c2edbaf477fa99da774259d007dcbc07136179b5 (postgres:15-alpine) is starting
[CI/Integration Tests                                           ] container health of 6edbe29a8d3611fdfa21b775c2edbaf477fa99da774259d007dcbc07136179b5 (postgres:15-alpine) is starting
[CI/Integration Tests                                           ] container health of 844a96820c2006f29668a826bd8566defe5eacbd0eef9734bc415a72b5b99f6c (redis:7-alpine) is starting
[CI/Unit Tests                                                  ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Unit Tests                                                  ] ⭐ Run Main Checkout
[CI/Unit Tests                                                  ]   ✅  Success - Main Checkout [6.7925ms]
[CI/Unit Tests                                                  ] ⭐ Run Main Setup Bun
[CI/Unit Tests                                                  ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Unit Tests                                                  ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Unit Tests                                                  ]   ✅  Success - Main Setup Bun [1.611718584s]
[CI/Unit Tests                                                  ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/Unit Tests                                                  ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/Unit Tests                                                  ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/Unit Tests                                                  ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/Unit Tests                                                  ]   ⚙  ::set-output:: cache-hit=true
[CI/Unit Tests                                                  ]   ⚙  ::add-path:: /root/.bun/bin
[CI/Unit Tests                                                  ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Unit Tests                                                  ] ⭐ Run Main Cache Bun install packages
[CI/Unit Tests                                                  ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[CI/Integration Tests                                           ] container health of 844a96820c2006f29668a826bd8566defe5eacbd0eef9734bc415a72b5b99f6c (redis:7-alpine) is starting
[CI/Integration Tests                                           ] container health of 6edbe29a8d3611fdfa21b775c2edbaf477fa99da774259d007dcbc07136179b5 (postgres:15-alpine) is starting
[CI/Build Verification                                          ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Build Verification                                          ] ⭐ Run Main Checkout
[CI/Build Verification                                          ]   ✅  Success - Main Checkout [3.111167ms]
[CI/Build Verification                                          ] ⭐ Run Main Setup Bun
[CI/Build Verification                                          ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Unit Tests                                                  ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[CI/Unit Tests                                                  ]   ⚙  ***
[CI/Unit Tests                                                  ]   ✅  Success - Main Cache Bun install packages [3.032397333s]
[CI/Unit Tests                                                  ]   ⚙  ::set-output:: cache-hit=true
[CI/Unit Tests                                                  ] ⭐ Run Main Install dependencies
[CI/Build Verification                                          ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Unit Tests                                                  ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Build Verification                                          ]   ✅  Success - Main Setup Bun [2.1147725s]
[CI/Build Verification                                          ]   ⚙  ::set-output:: cache-hit=true
[CI/Build Verification                                          ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/Build Verification                                          ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/Build Verification                                          ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/Build Verification                                          ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/Build Verification                                          ]   ⚙  ::add-path:: /root/.bun/bin
[CI/Build Verification                                          ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Build Verification                                          ] ⭐ Run Main Cache Bun install packages
[CI/Build Verification                                          ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[CI/Build Verification                                          ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[CI/Build Verification                                          ]   ⚙  ***
[CI/Build Verification                                          ]   ✅  Success - Main Cache Bun install packages [2.585824417s]
[CI/Build Verification                                          ]   ⚙  ::set-output:: cache-hit=true
[CI/Build Verification                                          ] ⭐ Run Main Install dependencies
[CI/Build Verification                                          ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Build Verification                                          ]   ✅  Success - Main Install dependencies [1.21108175s]
[CI/Unit Tests                                                  ]   ❌  Failure - Main Install dependencies [5.450942s]
[CI/Unit Tests                                                  ] exitcode '1': failure
[CI/Integration Tests                                           ] container health of 6edbe29a8d3611fdfa21b775c2edbaf477fa99da774259d007dcbc07136179b5 (postgres:15-alpine) is healthy
[CI/Integration Tests                                           ] container health of 844a96820c2006f29668a826bd8566defe5eacbd0eef9734bc415a72b5b99f6c (redis:7-alpine) is healthy
[CI/Build Verification                                          ] ⭐ Run Main Build all workspaces
[CI/Unit Tests                                                  ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[node --no-warnings -e console.log(process.execPath)] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Set up job
[CI/Build Verification                                          ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/4] user= workdir=
[CI/Integration Tests                                           ]   ☁  git clone 'https://github.com/oven-sh/setup-bun' # ref=v2
[CI/Unit Tests                                                  ] ⭐ Run Complete job
[CI/Unit Tests                                                  ]   ✅  Success - Complete job
[CI/Unit Tests                                                  ] 🏁  Job failed
[CI/Integration Tests                                           ]   ☁  git clone 'https://github.com/actions/cache' # ref=v4
[CI/Integration Tests                                           ] Non-terminating error while running 'git clone': some refs were not updated
[CI/Integration Tests                                           ]   ☁  git clone 'https://github.com/actions/upload-artifact' # ref=v4
[CI/Integration Tests                                           ] ⭐ Run Main Checkout
[CI/Integration Tests                                           ]   ✅  Success - Main Checkout [5.21775ms]
[CI/Integration Tests                                           ] ⭐ Run Main Setup Bun
[CI/Integration Tests                                           ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/oven-sh-setup-bun@v2/ dst=/var/run/act/actions/oven-sh-setup-bun@v2/
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/oven-sh-setup-bun@v2/dist/setup/index.js] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Main Setup Bun [2.0528675s]
[CI/Integration Tests                                           ]   ⚙  ::set-output:: bun-revision=1.3.11+af24e281e
[CI/Integration Tests                                           ]   ⚙  ::set-output:: bun-path=/root/.bun/bin/bun
[CI/Integration Tests                                           ]   ⚙  ::set-output:: bun-download-url=https://github.com/oven-sh/bun/releases/download/bun-v1.3.11/bun-linux-aarch64.zip
[CI/Integration Tests                                           ]   ⚙  ::set-output:: cache-hit=true
[CI/Integration Tests                                           ]   ⚙  ::set-output:: bun-version=1.3.11
[CI/Integration Tests                                           ]   ⚙  ::add-path:: /root/.bun/bin
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Integration Tests                                           ] ⭐ Run Main Cache Bun install packages
[CI/Integration Tests                                           ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-cache@v4/ dst=/var/run/act/actions/actions-cache@v4/
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-cache@v4/dist/restore/index.js] user= workdir=
[CI/Integration Tests                                           ]   ⚙  ***
[CI/Integration Tests                                           ]   ✅  Success - Main Cache Bun install packages [2.717488542s]
[CI/Integration Tests                                           ]   ⚙  ::set-output:: cache-hit=true
[CI/Integration Tests                                           ] ⭐ Run Main Install dependencies
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/3] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Main Install dependencies [1.25920125s]
[CI/Integration Tests                                           ] ⭐ Run Main Install postgres client (for `pg_isready`)
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[bash --noprofile --norc -e -o pipefail /var/run/act/workflow/4.sh] user= workdir=
[CI/Build Verification                                          ]   ❌  Failure - Main Build all workspaces [21.6197965s]
[CI/Build Verification                                          ] exitcode '1': failure
[CI/Build Verification                                          ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Build Verification                                          ] ⭐ Run Complete job
[CI/Build Verification                                          ]   ✅  Success - Complete job
[CI/Build Verification                                          ] 🏁  Job failed
[CI/Integration Tests                                           ]   ✅  Success - Main Install postgres client (for `pg_isready`) [9.85934875s]
[CI/Integration Tests                                           ] ⭐ Run Main Install redis CLI (for `redis-cli`)
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[bash --noprofile --norc -e -o pipefail /var/run/act/workflow/5.sh] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Main Install redis CLI (for `redis-cli`) [5.0067085s]
[CI/Integration Tests                                           ] ⭐ Run Main Wait for services
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/6] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Main Wait for services [580.400333ms]
[CI/Integration Tests                                           ] ⭐ Run Main Initialize test database
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/7] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Main Initialize test database [884.683ms]
[CI/Integration Tests                                           ] ⭐ Run Main Verify DB initialization
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/8] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Main Verify DB initialization [539.951625ms]
[CI/Integration Tests                                           ] ⭐ Run Main Run integration tests
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[bash -e /var/run/act/workflow/9] user= workdir=
[CI/Integration Tests                                           ]   ❗  ::error file=/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/tests/integration/backoffice/roles.routes.test.ts,title=tests/integration/backoffice/roles.routes.test.ts > GET /api/v1/backoffice/workspace/role-permission-modules > returns 200 with module list (10 modules),line=482,column=31::AssertionError: expected [ { …(2) }, { …(2) }, { …(2) }, …(9) ] to have a length of 10 but got 12%0A%0A- Expected%0A+ Received%0A%0A- 10%0A+ 12%0A%0A ❯ tests/integration/backoffice/roles.routes.test.ts:482:31%0A%0A
[CI/Integration Tests                                           ]   ❌  Failure - Main Run integration tests [2m13.572929083s]
[CI/Integration Tests                                           ] exitcode '1': failure
[CI/Integration Tests                                           ] ⭐ Run Main Dump Postgres logs (on failure)
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[bash --noprofile --norc -e -o pipefail /var/run/act/workflow/10.sh] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Main Dump Postgres logs (on failure) [1.210205708s]
[CI/Integration Tests                                           ] ⭐ Run Main Upload Postgres diagnostics (on failure)
[CI/Integration Tests                                           ]   🐳  docker cp src=/Users/majedsiefalnasr/.cache/act/actions-upload-artifact@v4/ dst=/var/run/act/actions/actions-upload-artifact@v4/
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/actions/actions-upload-artifact@v4/dist/upload/index.js] user= workdir=
[CI/Integration Tests                                           ]   ✅  Success - Main Upload Postgres diagnostics (on failure) [1.686779625s]
[CI/Integration Tests                                           ]   ⚙  ::set-output:: artifact-id=1366739515
[CI/Integration Tests                                           ]   ⚙  ::set-output:: artifact-digest=43b8ddcba871accd699a870d8128b159bd4a2d5b4950dd21db81c351b78f60f9
[CI/Integration Tests                                           ]   ⚙  ::set-output:: artifact-url=https://github.com/majedsiefalnasr/zidney-app2/actions/runs/1/artifacts/1366739515
[CI/Integration Tests                                           ]   🐳  docker exec cmd=[/opt/acttoolcache/node/24.14.0/arm64/bin/node /var/run/act/workflow/hashfiles/index.js] user= workdir=
[CI/Integration Tests                                           ] ⭐ Run Complete job
[CI/Integration Tests                                           ]   ✅  Success - Complete job
[CI/Integration Tests                                           ] 🏁  Job failed

$ act --pull=false
time="2026-04-04T21:14:36+02:00" level=info msg="Using docker host 'unix:///var/run/docker.sock', and daemon socket 'unix:///var/run/docker.sock'"
level=warning msg= ⚠ You are using Apple M-series chip and you have not specified container architecture, you might encounter issues while running act. If so, try running it with '--container-architecture linux/amd64'. ⚠

time="2026-04-04T21:14:36+02:00" level=info msg="Start server on http://192.168.1.101:34567"
time="2026-04-04T21:14:36+02:00" level=info msg="deleted cache: &{ID:26 Key:ai-context-51cc25075d90ce194f2977003293b66325610b03bf0309ec7cf070a5fc15e69b Version:6ec9a033bb11123671cd716e11eff9204f572a519732c7664973a362f1b831db Size:13540 Complete:true UsedAt:1775250557 CreatedAt:1775250556}" module=artifactcache
time="2026-04-04T21:14:36+02:00" level=info msg="deleted cache: &{ID:24 Key:bun-install-75e7ef1cbec0544627e8171aa910454ed2bef07674bec5c7af7c707429be36f4 Version:fa41662746cbc87250de5e92176076fe85bd909a356918ae89303fda6c1de20c Size:201 Complete:true UsedAt:1775250535 CreatedAt:1775250535}" module=artifactcache
time="2026-04-04T21:14:36+02:00" level=info msg="deleted cache: &{ID:25 Key:bun-install-75e7ef1cbec0544627e8171aa910454ed2bef07674bec5c7af7c707429be36f4 Version:fa41662746cbc87250de5e92176076fe85bd909a356918ae89303fda6c1de20c Size:201 Complete:true UsedAt:1775250543 CreatedAt:1775250543}" module=artifactcache
time="2026-04-04T21:14:36+02:00" level=info msg="deleted cache: &{ID:28 Key:bun-install-75e7ef1cbec0544627e8171aa910454ed2bef07674bec5c7af7c707429be36f4 Version:fa41662746cbc87250de5e92176076fe85bd909a356918ae89303fda6c1de20c Size:199 Complete:true UsedAt:1775250560 CreatedAt:1775250560}" module=artifactcache
time="2026-04-04T21:14:36+02:00" level=info msg="deleted cache: &{ID:29 Key:bun-install-75e7ef1cbec0544627e8171aa910454ed2bef07674bec5c7af7c707429be36f4 Version:fa41662746cbc87250de5e92176076fe85bd909a356918ae89303fda6c1de20c Size:201 Complete:true UsedAt:1775250561 CreatedAt:1775250561}" module=artifactcache
time="2026-04-04T21:14:36+02:00" level=info msg="deleted cache: &{ID:30 Key:bun-install-75e7ef1cbec0544627e8171aa910454ed2bef07674bec5c7af7c707429be36f4 Version:fa41662746cbc87250de5e92176076fe85bd909a356918ae89303fda6c1de20c Size:200 Complete:true UsedAt:1775250591 CreatedAt:1775250591}" module=artifactcache
Error: Job 'AI Context Generation & Validation' failed
error: script "ci:local" exited with code 1
```

---

## Workflow Guidance / Next Actions

1. If `FAIL` is `PASS` and `BLOCKED` is `PASS`, proceed with the orchestrator closure flow and preserve this report at `specs/runtime/044-plans-and-subscriptions/reports/LOCAL_CI_REPORT.md`.
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
