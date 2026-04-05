# Local CI Report

**Command:** <ROOT_COMMAND>  
**Timestamp:** <REPORT_GENERATED_AT>  
**Status:** <OVERALL_STATUS>  
**Exit Code:** <EXIT_CODE>  
**Report Location:** <REPORT_LOCATION>

<!-- LOCAL_CI_REPORT_METADATA_START
{
  "overall_status": "<OVERALL_STATUS>",
  "exit_code": <EXIT_CODE>,
  "current_stage_dir": "<CURRENT_STAGE_DIR>",
  "current_stage_name": "<CURRENT_STAGE_NAME>",
  "report_generated_at": "<REPORT_GENERATED_AT>",
  "failed_step_names": <FAILED_STEP_NAMES_JSON>,
  "report_location": "<REPORT_LOCATION>",
  "runtime_stage_resolved": <RUNTIME_STAGE_RESOLVED>,
  "closure_gate_status": "<CLOSURE_GATE_STATUS>",
  "ready_for_closure": <READY_FOR_CLOSURE>
}
LOCAL_CI_REPORT_METADATA_END -->

---

## Summary

<SUMMARY_TEXT>

---

## Resolved Stage / Runtime Context

| Field                    | Value                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current stage directory  | <CURRENT_STAGE_DIR>                                                                                                                               |
| Current stage name       | <CURRENT_STAGE_NAME>                                                                                                                              |
| Runtime stage resolved   | <RUNTIME_STAGE_RESOLVED_LABEL>                                                                                                                    |
| Resolved runtime path    | <RESOLVED_RUNTIME_STAGE_PATH>                                                                                                                     |
| Resolution source        | <RUNTIME_RESOLUTION_SOURCE>                                                                                                                       |
| Destination rule         | `specs/runtime/<STAGE_DIR_NAME>/reports/LOCAL_CI_REPORT.md` when a current runtime stage is resolved; otherwise `docs/reports/LOCAL_CI_REPORT.md` |
| Resolved report location | <REPORT_LOCATION>                                                                                                                                 |

---

## Docker Check

| Check               | Command                | Status                | Duration                | Notes                 |
| ------------------- | ---------------------- | --------------------- | ----------------------- | --------------------- |
| Docker availability | <DOCKER_CHECK_COMMAND> | <DOCKER_CHECK_STATUS> | <DOCKER_CHECK_DURATION> | <DOCKER_CHECK_RESULT> |

---

## Step Summary

| Step Number | Script Name | Command | Status | Duration |
| ----------- | ----------- | ------- | ------ | -------- |

<STEP_SUMMARY_ROWS>

---

## Failed Steps

| Step Number | Script Name | Command | Failure Summary |
| ----------- | ----------- | ------- | --------------- |

<FAILED_STEP_ROWS>

**Failed Step Names:** <FAILED_STEP_NAMES_LABEL>  
**Failed Step Count:** <FAILED_STEP_COUNT>

---

## Detailed Failure Output

<DETAILED_FAILURE_OUTPUT>

---

## Workflow Guidance / Next Actions

1. If `<OVERALL_STATUS>` is `PASS` and `<CLOSURE_GATE_STATUS>` is `PASS`, proceed with the orchestrator closure flow and preserve this report at `<REPORT_LOCATION>`.
2. If any step failed, fix the blocking scripts or workflow jobs listed above, rerun `<ROOT_COMMAND>`, and replace this report with the latest results.
3. If no current runtime stage could be resolved, keep this report under `docs/reports/LOCAL_CI_REPORT.md` until stage context is established.
4. If Docker failed before the workflow ran, start Docker, rerun the local CI command, and confirm the step summary is fully regenerated.

---

## Closure Gate Summary

| Gate Field                     | Value                     |
| ------------------------------ | ------------------------- |
| Closure Gate Status            | <CLOSURE_GATE_STATUS>     |
| Ready for Orchestrator Closure | <READY_FOR_CLOSURE_LABEL> |
| Overall Local CI Status        | <OVERALL_STATUS>          |
| Exit Code                      | <EXIT_CODE>               |
| Failed Step Names              | <FAILED_STEP_NAMES_LABEL> |
| Required Action                | <CLOSURE_GATE_ACTION>     |

---

## Next Step

Use this report as the pre-closure validation artifact for the orchestrator. Proceed only when the closure gate is `PASS`.
