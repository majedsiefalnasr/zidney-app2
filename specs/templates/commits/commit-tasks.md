chore({{STAGE_DIR_NAME}}): complete tasks step

Step: Tasks (4/7)
Stage: {{STAGE_NAME}}
Phase: {{PHASE_NAME}}
Status: DRAFT

Tasks generated: {{TASKS_TOTAL}}

Breakdown:

- Infrastructure: {{INFRA_TASK_COUNT}} tasks
- API: {{API_TASK_COUNT}} tasks
- Worker: {{WORKER_TASK_COUNT}} tasks
- Frontend: {{FRONTEND_TASK_COUNT}} tasks
- Observability: {{OBS_TASK_COUNT}} tasks
- Testing: {{TEST_TASK_COUNT}} tasks

Transactional tasks: {{TRANSACTIONAL_TASK_COUNT}}
Idempotency tasks: {{IDEMPOTENCY_TASK_COUNT}}

Artifacts:

- specs/runtime/{{STAGE_DIR_NAME}}/reports/TASKS_REPORT.md
- specs/phases/{{PHASE_NAME}}/{{STAGE_FILE_NAME}} (status: DRAFT)
- specs/runtime/.workflow-state.json
